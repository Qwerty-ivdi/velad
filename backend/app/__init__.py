# app/__init__.py
from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from app.routes.stats import stats_bp
from app.config import Config
from app.services.db_service import db_service
from app.routes.auth import auth_bp
from app.routes.profile import profile_bp
from app.routes.posts import posts_bp
from app.routes.messenger import messenger_bp
from app.socket_handlers import register_socket_handlers
from app.routes.twitch import twitch_bp
from app.services.twitch_service import twitch_service
from app.routes.twitch_webhook import twitch_webhook_bp
from app.routes.user import user_bp
import os
import dns.resolver

dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4']


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['SECRET_KEY'] = Config.SECRET_KEY

    CORS(app,
         origins=["http://localhost:3000", "https://veladtwitch.vercel.app"],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'])

    db_service.init_app(app)

    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

    # Регистрация Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(posts_bp, url_prefix='/api')
    app.register_blueprint(messenger_bp, url_prefix='/api')
    app.register_blueprint(stats_bp, url_prefix='/api')
    app.register_blueprint(twitch_bp, url_prefix='/api/twitch')
    app.register_blueprint(twitch_webhook_bp)
    app.register_blueprint(user_bp, url_prefix='/api')

    register_socket_handlers(socketio, db_service)
    twitch_service.init_app(app)

    jwt = JWTManager(app)

    @app.route('/health', methods=['GET'])
    def health_check():
        return {'status': 'ok'}, 200

    return app, socketio