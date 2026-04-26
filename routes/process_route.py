from flask import Blueprint, request, jsonify, Response
import subprocess

process_routes = Blueprint('process_routes', __name__)

# -----------------------
# Static Service List
# -----------------------

SERVICES = [
    {
        "service_name": "poll-app",
        "service_path": "/project/poll-app",
        "run_command": "make run-bin-ngrok",
        "stop_command": "make stop",
        "build_command": "make build",
        "log": "make logs",
        "port": 8099,
        "ngrok" : {
            "enabled": True,
            "port": 4040,
        }
    }
]

NGROK_CACHE = {}

###### Non Docker Services (e.g. local scripts) ######

def find_service(service_name):
    for service in SERVICES:
        if service["service_name"] == service_name:
            return service
    return None

@process_routes.route("/api/appservices", methods=["GET"])
def list_services():
    return jsonify(SERVICES), 200

@process_routes.route("/api/appservices/<service_name>", methods=["GET"])
def get_service(service_name):
    for service in SERVICES:
        if service["service_name"] == service_name:
            return jsonify(service)
    return jsonify({"error": "Service not found"}), 404

@process_routes.route("/api/appservices/<service_name>/run", methods=["POST"])
def run_service(service_name):
    service = find_service(service_name)
    if not service:
        return jsonify({"error": "Service not found"}), 404

    try:
        result = subprocess.run(
            service["run_command"],
            shell=True,
            cwd=service["service_path"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        return jsonify({
            "status": "success" if result.returncode == 0 else "failed",
            "output": result.stdout,
            "error": result.stderr
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@process_routes.route("/api/appservices/<service_name>/stream-run", methods=["POST"])
def stream_run(service_name):
    service = find_service(service_name)
    if not service:
        return jsonify({"error": "Service not found"}), 404

    def generate():
        process = subprocess.Popen(
            service["run_command"],
            shell=True,
            cwd=service["service_path"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        for line in iter(process.stdout.readline, ''):
            yield f"data: {line}\n\n"

        process.stdout.close()
        process.wait()

    return Response(generate(), mimetype="text/event-stream")

@process_routes.route("/api/appservices/<service_name>/stop", methods=["POST"])
def stop_service(service_name):
    service = find_service(service_name)
    if not service:
        return jsonify({"error": "Service not found"}), 404

    try:
        result = subprocess.run(
            service["stop_command"],
            shell=True,
            cwd=service["service_path"],
            capture_output=True,
            text=True
        )

        NGROK_CACHE.pop(service_name, None)

        return jsonify({
            "status": "success" if result.returncode == 0 else "failed",
            "output": result.stdout,
            "error": result.stderr
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
