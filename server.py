from flask import Flask, jsonify, send_from_directory, request, Response
from flask_cors import cross_origin, CORS
from routes import register_routes

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.wsgi import WSGIMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send
from routes.ws import register_ws_routes

import uvicorn  

from dotenv import load_dotenv

load_dotenv()
# ── Flask app ─────────────────────────────────────────────────────────────────
flask_app = Flask(__name__, static_folder="home-server-ui/build", static_url_path="")
CORS(flask_app)
register_routes(flask_app)

# ── WSGI bridge that only handles HTTP, not WS ────────────────────────────────
class HTTPOnlyWSGIMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi = WSGIMiddleware(wsgi_app)
 
    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "websocket":
            # let FastAPI handle it — should have been caught by a WS route already
            await send({"type": "websocket.close", "code": 1000})
            return
        await self.wsgi(scope, receive, send)
 
# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# WS routes registered first so FastAPI matches them before falling to Flask
register_ws_routes(app)

# Flask handles everything else (HTTP only)
app.mount("/", HTTPOnlyWSGIMiddleware(flask_app))

# ── entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    #app.run(host="0.0.0.0", port=5000)
    #os.system("nohup flask run --host=0.0.0.0 --port=5000 &")
    uvicorn.run("server:app", host="0.0.0.0", port=5000)
