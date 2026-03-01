from flask import Flask, jsonify, send_from_directory
from flask_cors import cross_origin, CORS
import docker
from docker.errors import NotFound, APIError
import socket
import os

#app = Flask(__name__)
app = Flask(__name__, static_folder="home-server-ui/build", static_url_path="")
client = docker.from_env()
CORS(app, origins=["http://home-server:5000", "http://localhost:5000", "*"])

# Get host IP
hostname = socket.gethostname()
host_ip = socket.gethostbyname(hostname)

def get_container(name):
    try:
        return client.containers.get(name)
    except NotFound:
        return None

@app.route("/api/services/add", methods=["POST"])
@cross_origin()
def add_service():
    data = request.json

    name = data.get("name")
    image = data.get("image")
    ports = data.get("ports", {})      # {"80/tcp": 8080}
    env = data.get("environment", {})  # {"KEY": "VALUE"}
    command = data.get("command")
    restart_policy = data.get("restart_policy", "unless-stopped")

    if not name or not image:
        return jsonify({"error": "name and image are required"}), 400

    try:
        # Pull image if not present
        try:
            client.images.get(image)
        except ImageNotFound:
            client.images.pull(image)

        container = client.containers.run(
            image=image,
            name=name,
            command=command,
            environment=env,
            ports=ports,
            detach=True,
            restart_policy={"Name": restart_policy}
        )

        return jsonify({
            "name": name,
            "image": image,
            "status": "running",
            "id": container.id[:12]
        })

    except APIError as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/services/<name>/start", methods=["POST"])
@cross_origin()
def start_service(name):
    container = get_container(name)
    if not container:
        return jsonify({"error": "Container not found"}), 404
    
    try:
        if container.status != "running":
            container.start()
        container.reload()
        return jsonify({
            "name": container.name,
            "status": container.status,
            "action": "started"
        })
    except APIError as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/services/<name>/exit", methods=["POST"])
@cross_origin()
def exit_service(name):
    try:
        container = client.containers.get(name)
    except NotFound:
        return jsonify({"error": "Container not found"}), 404

    try:
        container.reload()
        if container.status == "running":
            container.stop()
            container.reload()
            return jsonify({
                "name": container.name,
                "status": container.status,
                "action": "exited"
            })
        else:
            return jsonify({
                "name": container.name,
                "status": container.status,
                "action": "already stopped"
            })
    except APIError as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/services")
@cross_origin()
def get_services():
    containers = client.containers.list(all=True)
    services = []
    for container in containers:
        ports = container.attrs.get("NetworkSettings", {}).get("Ports", {})
        urls = set()
        for port, bindings in ports.items():
            if bindings:
                for bind in bindings:
                    host_port = bind.get("HostPort")
                    if host_port:
                        urls.add(f"http://{host_ip}:{host_port}")

        services.append({
            "name": container.name,
            "status": container.status,
            "type": "Docker",
            "urls": list(urls)
        })
    return jsonify(services)


def calculate_cpu_percent(stats):
    cpu_delta = (
        stats["cpu_stats"]["cpu_usage"]["total_usage"]
        - stats["precpu_stats"]["cpu_usage"]["total_usage"]
    )
    system_delta = (
        stats["cpu_stats"]["system_cpu_usage"]
        - stats["precpu_stats"]["system_cpu_usage"]
    )
    cpu_count = len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", []))

    if system_delta > 0 and cpu_delta > 0:
        return (cpu_delta / system_delta) * cpu_count * 100.0
    return 0.0


def calculate_memory(stats):
    usage = stats["memory_stats"].get("usage", 0)
    limit = stats["memory_stats"].get("limit", 0)
    percent = (usage / limit * 100) if limit else 0
    return usage, limit, percent

@app.route("/api/services/<name>/stats")
@cross_origin()
def service_stats(name):
    container = get_container(name)
    if not container:
        return jsonify({"error": "Container not found"}), 404

    try:
        stats = container.stats(stream=False)
        attrs = container.attrs

        # ---- CPU ----
        cpu_percent = calculate_cpu_percent(stats)

        # ---- Memory ----
        mem_usage, mem_limit, mem_percent = calculate_memory(stats)

        # ---- Network IO ----
        net_rx = 0
        net_tx = 0
        for iface in stats.get("networks", {}).values():
            net_rx += iface.get("rx_bytes", 0)
            net_tx += iface.get("tx_bytes", 0)

        # ---- Block IO ----
        blk_read = 0
        blk_write = 0
        for blk in stats.get("blkio_stats", {}).get("io_service_bytes_recursive", []):
            if blk["op"] == "Read":
                blk_read += blk["value"]
            elif blk["op"] == "Write":
                blk_write += blk["value"]

        # ---- Ports ----
        ports = attrs.get("NetworkSettings", {}).get("Ports", {})
        exposed_ports = []
        published_ports = []

        for container_port, bindings in ports.items():
            exposed_ports.append(container_port)
            if bindings:
                for b in bindings:
                    published_ports.append({
                        "container_port": container_port,
                        "host_ip": b.get("HostIp"),
                        "host_port": b.get("HostPort")
                    })

        return jsonify({
            # ---- Identity ----
            "name": container.name,
            "id": container.id[:12],
            "image": attrs.get("Config", {}).get("Image"),
            "status": container.status,

            # ---- Runtime ----
            "cpu": {
                "percent": round(cpu_percent, 2)
            },
            "memory": {
                "usage_bytes": mem_usage,
                "limit_bytes": mem_limit,
                "percent": round(mem_percent, 2)
            },
            "pids": stats.get("pids_stats", {}).get("current", 0),

            # ---- IO ----
            "network_io": {
                "rx_bytes": net_rx,
                "tx_bytes": net_tx
            },
            "block_io": {
                "read_bytes": blk_read,
                "write_bytes": blk_write
            },

            # ---- Networking ----
            "network_mode": attrs.get("HostConfig", {}).get("NetworkMode"),
            "ports": {
                "exposed": exposed_ports,
                "published": published_ports
            }
        })

    except APIError as e:
        return jsonify({"error": str(e)}), 500

# Serve React index.html
@app.route("/")
@cross_origin()
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

# Serve any other static files (JS, CSS, etc.)
@app.route("/<path:path>")
@cross_origin()
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
    #os.system("nohup flask run --host=0.0.0.0 --port=5000 &")
