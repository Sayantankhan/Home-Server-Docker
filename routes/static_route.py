from flask import Blueprint, current_app
from flask_cors import cross_origin, CORS

static_routes = Blueprint('static_routes', __name__)

# Serve React index.html
@static_routes.route("/")
@cross_origin()
def serve_index():
    return current_app.send_static_file("index.html")

# Serve SPA routes + static fallback
@static_routes.route("/<path:path>")
def serve_static(path):
    try:
        return current_app.send_static_file(path)
    except:
        # React Router fallback
        return current_app.send_static_file("index.html")