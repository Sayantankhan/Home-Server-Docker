import os
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from .db import get_db

config_routes = Blueprint('config_routes', __name__)
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

@config_routes.route("/config", methods=["GET"])
def get_configs():
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT key, value FROM app_config")
                rows = cur.fetchall()
        return jsonify(rows), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500