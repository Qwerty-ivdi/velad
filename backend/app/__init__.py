from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from app.config import Config
from app.services.db_service import db_service
from app.routes.auth import auth_bp
from app.routes.profile import profile_bp
from app.routes.posts import posts_bp
from app.routes.messenger import messenger_bp
from app.socket_handlers import register_socket_handlers

socketio = SocketIO()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['SECRET_KEY'] = Config.SECRET_KEY

    # ====== ВРЕМЕННОЕ РЕШЕНИЕ ДЛЯ CORS ======
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    # ========================================

    # Инициализация БД
    db_service.init_app(app)

    # Инициализация Socket.IO
    socketio.init_app(app, cors_allowed_origins="*")

    # Регистрация Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(posts_bp, url_prefix='/api')
    app.register_blueprint(messenger_bp, url_prefix='/api')

    # Регистрация WebSocket обработчиков
    register_socket_handlers(socketio, db_service)

    @app.route('/health', methods=['GET'])
    def health_check():
        return {'status': 'ok', 'message': 'Velad API is running'}, 200

    return app, socketio