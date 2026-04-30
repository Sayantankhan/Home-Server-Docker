from flask import Blueprint, request, jsonify, Response
from psycopg2.extras import RealDictCursor
from .db import get_db
import os 
import subprocess
import socket
import signal

ngrok_routes = Blueprint('ngrok_routes', __name__)

# ── helpers ───────────────────────────────────────────────────────────────────
def _strip_scheme(url: str) -> str:
    return url.replace("https://", "").replace("http://", "")

def _error(msg: str, code: int = 500):
    return jsonify({"error": msg}), code

# ── routes ────────────────────────────────────────────────────────────────────
@ngrok_routes.route("/api/ngrok/tunnels", methods=["GET"])
def list_tunnels():
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""SELECT id, name, public_url, status, region, port, created_at 
                            FROM ngrok_tunnels 
                            ORDER BY created_at DESC""")
                rows = cur.fetchall()
        return jsonify(rows), 200
    except Exception as e:
        return _error(str(e))

@ngrok_routes.route("/api/ngrok/tunnels/<int:tunnel_id>", methods=["GET"])
def get_tunnel(tunnel_id: int):
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT process_id, app_port
                    FROM ngrok_tunnels_details
                    WHERE ngrok_tunnels_id = %s
                      AND isactive = true
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (tunnel_id,))
                existing = cur.fetchone()

        if not existing:
            return jsonify({"tunnel_id": tunnel_id, "attached": False, "process_id": None}), 200

        return jsonify({
            "tunnel_id": tunnel_id,
            "attached": True,
            "process_id": existing["process_id"],
            "app_port": existing["app_port"]
        }), 200

    except Exception as e:
        return _error(str(e))
    
@ngrok_routes.route("/api/ngrok/tunnel/<int:tunnel_id>/attach", methods=["POST"])
def attach_tunnel(tunnel_id):
        data = request.get_json(silent=True) or {}
        port = data.get("port")

        if not port:
            return _error("port is required", 400)

        try:
            port = int(port)
        except (ValueError, TypeError):
            return _error("port must be an integer", 400)

        try:
            with get_db() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        SELECT nt.id, nt.public_url, nt2.ngrok_token
                        FROM ngrok_tunnels nt
                        INNER JOIN ngrok_tunnels_tokens nt2
                            ON nt.id = nt2.ngrok_tunnels_id
                        WHERE nt.status = 'active'
                        AND nt.id = %s
                    """, (tunnel_id,))
                    tunnel = cur.fetchone()

                if not tunnel:
                    return _error("Tunnel not found or inactive", 404)
                
                # check if already attached
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        SELECT process_id
                        FROM ngrok_tunnels_details
                        WHERE ngrok_tunnels_id = %s
                        AND isactive = true
                        ORDER BY created_at DESC
                        LIMIT 1
                    """, (tunnel_id,))
                    existing = cur.fetchone()
                
                if existing and existing["process_id"]:
                    return _error("Tunnel already attached", 400)

                # spawn ngrok process
                cmd = [
                    "ngrok", "http",
                    f"--url={_strip_scheme(tunnel['public_url'])}",
                    str(port),
                    "--authtoken", tunnel["ngrok_token"],
                ]

                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )

                # record in db
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        INSERT INTO ngrok_tunnels_details
                            (ngrok_tunnels_id, app_port, process_id, hostname)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    """, (tunnel_id, port, process.pid, socket.gethostname()))
            
            return jsonify({
                "message": "Tunnel attached",
                "tunnel_id": tunnel_id,
                "pid": process.pid,
                "domain": tunnel["public_url"],
            }), 200
        
        except Exception as e:
            return _error(str(e))

@ngrok_routes.route("/api/ngrok/tunnel/<int:tunnel_id>/detach", methods=["POST"])
def detach_tunnel(tunnel_id):
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT process_id
                    FROM ngrok_tunnels_details
                    WHERE ngrok_tunnels_id = %s
                      AND isactive = true
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (tunnel_id,))
                row = cur.fetchone()

            if not row or not row["process_id"]:
                return _error("No active tunnel found", 400)

            pid = row["process_id"]

            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                print("Process %d already gone, marking inactive anyway", pid)

            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE ngrok_tunnels_details
                    SET isactive = false
                    WHERE ngrok_tunnels_id = %s
                      AND process_id = %s
                """, (tunnel_id, pid))

        return jsonify({
            "message": "Tunnel detached",
            "tunnel_id": tunnel_id,
            "pid": pid,
        }), 200

    except Exception as e:
        return _error(str(e))