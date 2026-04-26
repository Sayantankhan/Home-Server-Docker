from .heartbeat_route import heartbeat_routes
from .config_route import config_routes
from .static_route import static_routes
from .docker_route import docker_routes
from .process_route import process_routes

def register_routes(app):
    app.register_blueprint(static_routes)
    app.register_blueprint(heartbeat_routes, url_prefix="/api/appservices")
    app.register_blueprint(config_routes, url_prefix="/api")
    app.register_blueprint(docker_routes)
    app.register_blueprint(process_routes)
    
