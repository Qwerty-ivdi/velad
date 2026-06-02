from flask import Flask
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


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['SECRET_KEY'] = Config.SECRET_KEY
    socketio = SocketIO(app, cors_allowed_origins="*")

    # Настройка CORS для продакшена
    allowed_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,https://veladtwitch.vercel.app').split(',')

    CORS(app,
         origins="*",
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
         expose_headers=['Content-Type', 'Authorization'])

    # Инициализация БД
    db_service.init_app(app)

    # Инициализация Socket.IO
    socketio.init_app(app, cors_allowed_origins="*")

    # Регистрация Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(profile_bp, url_prefix='/api')
    app.register_blueprint(posts_bp, url_prefix='/api')
    app.register_blueprint(messenger_bp, url_prefix='/api')
    app.register_blueprint(stats_bp, url_prefix='/api')
    app.register_blueprint(twitch_bp, url_prefix='/api/twitch')
    app.register_blueprint(twitch_webhook_bp)
    app.register_blueprint(user_bp, url_prefix='/api')

    # Регистрация WebSocket обработчиков
    register_socket_handlers(socketio, db_service)
    twitch_service.init_app(app)

    # Инициализация JWT
    jwt = JWTManager(app)

    @app.route('/health', methods=['GET'])
    def health_check():
        print("📍 Health check called")  # Добавьте для отладки
        return {'status': 'ok', 'message': 'Velad API is running'}, 200


    @app.route('/ready', methods=['GET'])
    def ready_check():
        # Проверка подключения к БД
        try:
            db_service.execute_query("SELECT 1")
            return {'status': 'ready'}, 200
        except Exception as e:
            return {'status': 'not ready', 'error': str(e)}, 500

    return app, socketio