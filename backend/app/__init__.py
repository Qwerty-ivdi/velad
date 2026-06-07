from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from app.config import Config
from app.services.db_service import db_service
from app.routes.auth import auth_bp
from app.routes.posts import posts_bp
from app.routes.profile import profile_bp
from app.routes.messenger import messenger_bp
from app.routes.stats import stats_bp
from app.routes.twitch import twitch_bp
from app.socket_handlers import register_socket_handlers
import os

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['SECRET_KEY'] = Config.SECRET_KEY
    app.config['JWT_SECRET_KEY'] = Config.SECRET_KEY
    app.config['JWT_TOKEN_LOCATION'] = ['headers']

    # ✅ ПРАВИЛЬНАЯ НАСТРОЙКА CORS
    CORS(app,
         origins=[
             "http://localhost:3000",
             "https://veladtwitch.vercel.app",
             "https://veladtwitch.vercel.app"  # можно добавить с www
         ],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'Access-Control-Allow-Origin'],
         allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
         expose_headers=['Content-Type', 'Authorization'],
         max_age=3600  # кэширование preflight на 1 час
         )

    db_service.init_app(app)

    # JWT Manager
    jwt = JWTManager(app)

    # SocketIO
    socketio = SocketIO(
        app,
        cors_allowed_origins=["http://localhost:3000", "https://veladtwitch.vercel.app"],
        async_mode='threading',
        ping_timeout=60,
        ping_interval=25
    )

    # Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(posts_bp, url_prefix='/api')
    app.register_blueprint(messenger_bp, url_prefix='/api')
    app.register_blueprint(stats_bp, url_prefix='/api')
    app.register_blueprint(twitch_bp, url_prefix='/api/twitch')

    # Socket handlers
    register_socket_handlers(socketio, db_service)

    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', 'https://veladtwitch.vercel.app')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @app.route('/health', methods=['GET'])
    def health_check():
        return {'status': 'ok'}, 200

    return app, socketio