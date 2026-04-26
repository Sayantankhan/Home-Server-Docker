from flask import Flask, jsonify, send_from_directory, request, Response
from flask_cors import cross_origin, CORS
from routes import register_routes
import docker
from docker.errors import NotFound, APIError
import socket
import subprocess
import requests
import os

from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

#app = Flask(__name__)
app = Flask(__name__, static_folder="home-server-ui/build", static_url_path="")
client = docker.from_env()
CORS(app)

load_dotenv()

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

RUNNING_PROCESSES = {}
NGROK_CACHE = {}
HEARTBEAT_CACHE = {}

###### Non Docker Services (e.g. local scripts) ######

def find_service(service_name):
    for service in SERVICES:
        if service["service_name"] == service_name:
            return service
    return None

@app.route("/api/appservices", methods=["GET"])
def list_services():
    return jsonify(SERVICES), 200

@app.route("/api/appservices/<service_name>", methods=["GET"])
def get_service(service_name):
    for service in SERVICES:
        if service["service_name"] == service_name:
            return jsonify(service)
    return jsonify({"error": "Service not found"}), 404

@app.route("/api/appservices/<service_name>/run", methods=["POST"])
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

@app.route("/api/appservices/<service_name>/stream-run", methods=["POST"])
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

@app.route("/api/appservices/<service_name>/stop", methods=["POST"])
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

@app.route("/api/appservices/<service_name>/status", methods=["GET"])
def service_status(service_name):
    service = find_service(service_name)
    if not service:
        return jsonify({"error": "Service not found"}), 404

    port = service.get("port")
    if not port:
        return jsonify({"error": "No port configured for service"}), 400

    try:
        result = subprocess.run(
            ["lsof", "-i", f"tcp:{port}"],
            capture_output=True,
            text=True
        )
        # result = subprocess.run(
        #     f"lsof -i :{port}",
        #     #shell=True,
        #     capture_output=True,
        #     text=True
        # )

        #is_running = bool(result.stdout.strip())
        is_running = result.returncode == 0

        response = {
            "service": service_name,
            "status": "running" if is_running else "stopped",
            "port": port
        }

        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

register_routes(app)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
    #os.system("nohup flask run --host=0.0.0.0 --port=5000 &")
