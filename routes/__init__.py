from .heartbeat_route import heartbeat_routes, heartbeat_ws_router
from .config_route import config_routes
from .static_route import static_routes
from .docker_route import docker_routes
from .process_route import process_routes
from .ngrok_route import ngrok_routes

def register_routes(app):
    app.register_blueprint(static_routes)
    app.register_blueprint(heartbeat_routes, url_prefix="/api/appservices")
    app.register_blueprint(config_routes, url_prefix="/api")
    app.register_blueprint(docker_routes)
    app.register_blueprint(process_routes)
    app.register_blueprint(ngrok_routes)

def register_ws_routes(fastapi_app):
    # WS routes registered separately in FastAPI since Flask doesn't handle WS
    fastapi_app.include_router(heartbeat_ws_router)
    
