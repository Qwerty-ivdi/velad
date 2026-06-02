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


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['SECRET_KEY'] = Config.SECRET_KEY
    socketio = SocketIO(app, cors_allowed_origins="*")

    # ========== ПРАВИЛЬНАЯ НАСТРОЙКА CORS ==========
    CORS(app,
         origins="*",
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'])


    # ========== ОТДЕЛЬНЫЙ ОБРАБОТЧИК ДЛЯ OPTIONS ==========
    @app.route('/<path:path>', methods=['OPTIONS'])
    @app.route('/', methods=['OPTIONS'])
    def handle_options(path=None):
        response = app.make_default_options_response()
        response.headers.add('Access-Control-Allow-Origin',
            request.headers.get('Origin', 'https://veladtwitch.vercel.app'))
        response.headers.add('Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-Requested-With, Accept')
        response.headers.add('Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE, OPTIONS, PATCH')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

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
        return {'status': 'ok', 'message': 'Velad API is running'}, 200

    @app.route('/ready', methods=['GET'])
    def ready_check():
        try:
            db_service.execute_query("SELECT 1")
            return {'status': 'ready'}, 200
        except Exception as e:
            return {'status': 'not ready', 'error': str(e)}, 500

    return app, socketio