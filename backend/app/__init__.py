# app/__init__.py
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

    CORS(app,
         origins=["http://localhost:3000", "https://veladtwitch.vercel.app"],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'Access-Control-Allow-Origin'],
         allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

    db_service.init_app(app)

    socketio = SocketIO(
        app,
        cors_allowed_origins=["http://localhost:3000", "https://veladtwitch.vercel.app"],
        async_mode='threading',
        ping_timeout=60,
        ping_interval=25,
        logger=True,
        engineio_logger=True
    )

    # Регистрация Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(posts_bp, url_prefix='/api')
    app.register_blueprint(messenger_bp, url_prefix='/api')
    app.register_blueprint(stats_bp, url_prefix='/api')
    app.register_blueprint(twitch_bp, url_prefix='/api/twitch')

    # Регистрация обработчиков SocketIO
    register_socket_handlers(socketio, db_service)

    @app.route('/socket.io/', methods=['OPTIONS'])
    @app.route('/socket.io/<path:path>', methods=['OPTIONS'])
    def socketio_options(path=None):
        from flask import make_response
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = 'https://veladtwitch.vercel.app'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response, 200

    @app.route('/health', methods=['GET'])
    def health_check():
        return {'status': 'ok'}, 200

    return app, socketio