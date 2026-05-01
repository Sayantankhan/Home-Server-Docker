import os
import json
from flask import Blueprint, request, jsonify
import time
from .cache import get_master, get_slave

heartbeat_routes = Blueprint('heartbeat_routes', __name__)

HB_THRESHOLD = int(os.getenv("HB_THRESHOLD_SECONDS", 60))
HB_TTL       = int(os.getenv("HB_TTL_SECONDS", 120))
 
def hb_key(service_name: str) -> str:
    return f"heartbeat:{service_name}"
 
def service_is_alive(last_heartbeat: float) -> bool:
    return time.time() - last_heartbeat < HB_THRESHOLD

# ── routes ────────────────────────────────────────────────────────────────────
@heartbeat_routes.route("/heartbeat/<service_name>", methods=["POST"])
def heartbeat(service_name):
    try:
        data = request.get_json(silent=True) or {}
        now  = time.time()

        payload = {
            "registered_at":  data.get("registered_at", now),
            "host":           data.get("host"),
            "port":           data.get("port"),
            "meta":           json.dumps(data.get("meta", {})),
            "last_heartbeat": now
        }

        r = get_master()
        key = hb_key(service_name)
        r.hset(key, mapping=payload)
        r.expire(key, HB_TTL)

        return jsonify({
            "service":        service_name,
            "status":         "alive",
            "last_heartbeat": now
        }), 200
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

@heartbeat_routes.route("/heartbeat/services", methods=["GET"])
def list_heartbeat_services():
    try:
        r = get_slave()
        keys = r.keys("heartbeat:*")

        services = []
        for key in keys:
            data = r.hgetall(key)
            if not data:
                continue

            service_name  = key.split(":", 1)[1]
            last_hb       = float(data.get("last_heartbeat", 0))
            registered_at = float(data.get("registered_at", 0))

            services.append({
                "service":        service_name,
                "status":         "running" if service_is_alive(last_hb) else "stopped",
                "host":           data.get("host"),
                "port":           data.get("port"),
                "meta":           json.loads(data.get("meta", "{}")),
                "registered_at":  registered_at,
                "last_heartbeat": last_hb
            })
        return jsonify({"services": services}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@heartbeat_routes.route("/heartbeat/services/<service_name>", methods=["GET"])
def validate_heartbeat(service_name):
    try:
        r = get_slave()
        data = r.hgetall(hb_key(service_name))
 
        if not data:
            return jsonify({"error": "Service not found"}), 404
 
        last_hb       = float(data.get("last_heartbeat", 0))
        registered_at = float(data.get("registered_at", 0))
 
        return jsonify({
            "service":        service_name,
            "status":         "running" if service_is_alive(last_hb) else "stopped",
            "host":           data.get("host"),
            "port":           data.get("port"),
            "meta":           json.loads(data.get("meta", "{}")),
            "registered_at":  registered_at,
            "last_heartbeat": last_hb
        }), 200
 
    except Exception as e:
        return jsonify({"error": str(e)}), 500