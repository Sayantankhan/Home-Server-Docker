from fastapi import FastAPI
from .pingpong_ws import router as sample_ws_router

def register_ws_routes(app: FastAPI):
    app.include_router(sample_ws_router)