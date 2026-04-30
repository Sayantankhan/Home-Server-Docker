from flask import Blueprint, request, jsonify, Response
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager
import os 
import subprocess
import socket
import signal

ngrok_routes = Blueprint('ngrok_routes', __name__)
load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "dbname": os.getenv("DB_NAME"),
    "sslmode": os.getenv("DB_SSLMODE")
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

@ngrok_routes.route("/api/ngrok/tunnels", methods=["GET"])
def list_tunnels():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("SELECT id, name, public_url, status, region, port, created_at FROM ngrok_tunnels")
        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify(rows), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@ngrok_routes.route("/api/ngrok/tunnel/<int:tunnel_id>/attach", methods=["POST"])
def attach_tunnel(tunnel_id):
    try:
        data = request.get_json() or {}

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("select nt.id, nt.public_url, nt2.ngrok_token from ngrok_tunnels nt inner join ngrok_tunnels_tokens nt2 \
                    on nt.id = nt2.ngrok_tunnels_id and nt.status = 'active' and nt.id = %s", (tunnel_id,))
        row = cur.fetchone()

        cur.close()

        if not row:
            return jsonify({"error": "Tunnel not found or inactive"}), 404
        
        domain = row["public_url"]
        token = row["ngrok_token"]
        port = data["port"]

        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("select process_id from ngrok_tunnels_details where ngrok_tunnels_id = %s and isactive = true order by created_at desc limit 1", (tunnel_id,))
        row = cur.fetchone()
        cur.close()
        if row and row["process_id"]:
            return jsonify({"error": "Tunnel already attached"}), 400
        
        # Build command
        cmd = [
            "ngrok", "http",
            f"--url={domain.replace('https://', '').replace('http://', '')}",
            str(port),
            "--authtoken", token
        ]

        print("Executing command:", cmd)
        
        # Detach process
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )

        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("Insert into ngrok_tunnels_details (ngrok_tunnels_id, app_port, process_id, hostname) values (%s, %s, %s, %s) returning id", (tunnel_id, port, process.pid, socket.gethostname()))
        cur.close()
        conn.commit()
        conn.close()

        return jsonify({
            "message": "Tunnel attached",
            "tunnel_id": tunnel_id,
            "pid": process.pid,
            "domain": domain,
            "cmd": " ".join(cmd)
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@ngrok_routes.route("/api/ngrok/tunnel/<int:tunnel_id>/detach", methods=["POST"])
def detach_tunnel(tunnel_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("select process_id from ngrok_tunnels_details where ngrok_tunnels_id = %s and isactive = true order by created_at desc limit 1", (tunnel_id,))
        row = cur.fetchone()
        cur.close()

        pid = row["process_id"] if row else None

        if not pid:
            return jsonify({"error": "No active tunnel found"}), 400

        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            return jsonify({"error": "Process not found"}), 404

        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("update ngrok_tunnels_details set isactive = false where ngrok_tunnels_id = %s and process_id = %s", (tunnel_id, pid))
        cur.close()
        conn.commit()
        conn.close()

        return jsonify({
            "message": "Tunnel detached",
            "tunnel_id": tunnel_id,
            "pid": pid
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500