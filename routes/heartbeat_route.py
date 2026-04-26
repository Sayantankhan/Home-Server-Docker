from flask import Blueprint, request, jsonify
import time

heartbeat_routes = Blueprint('heartbeat_routes', __name__)

HEARTBEAT_CACHE = {}

@heartbeat_routes.route("/heartbeat/<service_name>", methods=["POST"])
def heartbeat(service_name):
    data = request.get_json() or {}
    HEARTBEAT_CACHE[service_name] = {
        "registered_at": time.time(),
        "host": data.get("host"),
        "port": data.get("port"),
        "meta": data.get("meta", {}),
        "last_heartbeat": time.time()
    }
    return jsonify({"service": service_name, "status": "alive", "last_heartbeat": HEARTBEAT_CACHE[service_name]["last_heartbeat"]}), 200

def service_is_alive(last_heartbeat, last_hb_threshold=60):
    return time.time() - last_heartbeat < last_hb_threshold


@heartbeat_routes.route("/heartbeat/services", methods=["GET"])
def list_heartbeat_services():
    services = []
    for service_name, data in HEARTBEAT_CACHE.items():
        last_hb = data.get("last_heartbeat")
        is_alive = service_is_alive(last_hb)

        services.append({
            "service": service_name,
            "status": "running" if is_alive else "stopped",

            # ---- full details ----
            "host": data.get("host"),
            "port": data.get("port"),
            "meta": data.get("meta", {}),
            "registered_at": data.get("registered_at"),
            "last_heartbeat": last_hb
        })

    return jsonify({"services": services}), 200


@heartbeat_routes.route("/heartbeat/services/<service_name>", methods=["GET"])
def validate_heartbeat(service_name):
    if service_name in HEARTBEAT_CACHE :
        last_hb = HEARTBEAT_CACHE[service_name]["last_heartbeat"]
        is_alive = service_is_alive(last_hb)

        return jsonify({
            "service": service_name,
            "status": "running" if is_alive else "stopped",

            # ---- full details ----
            "host": HEARTBEAT_CACHE[service_name].get("host"),
            "port": HEARTBEAT_CACHE[service_name].get("port"),
            "meta": HEARTBEAT_CACHE[service_name].get("meta", {}),
            "registered_at": HEARTBEAT_CACHE[service_name].get("registered_at"),
            "last_heartbeat": last_hb
        }), 200
    else:
        return jsonify({"error": "Service not found"}), 404
