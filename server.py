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

#app = Flask(__name__)
app = Flask(__name__, static_folder="home-server-ui/build", static_url_path="")
CORS(app)
load_dotenv()

register_routes(app)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
    #os.system("nohup flask run --host=0.0.0.0 --port=5000 &")
