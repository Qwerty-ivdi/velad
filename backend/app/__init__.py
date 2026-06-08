# app/__init__.py
from flask import Flask, request, send_from_directory
from pathlib import Path
from flask import make_response
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
import sys
print("Python path:", sys.path)
print("Starting app...")

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

    socketio = SocketIO(
        app,
        cors_allowed_origins=["http://localhost:3000", "https://veladtwitch.vercel.app"],
        async_mode='threading',
        ping_timeout=60,  # таймаут пинга 60 сек
        ping_interval=25,  # интервал пинга 25 сек
        max_http_buffer_size=1e6,  # макс размер сообщения 1MB
        logger=False,  # отключаем логи (экономия ресурсов)
        engineio_logger=False  # отключаем логи EngineIO
    )

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

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        if os.environ.get('RAILWAY_ENVIRONMENT'):
            upload_folder = Path('/tmp/uploads')
        else:
            upload_folder = Path(__file__).resolve().parent.parent / 'uploads'

        # Проверяем существование файла
        file_path = upload_folder / filename
        if not file_path.exists():
            return {'error': 'File not found'}, 404

        # Отправляем файл с CORS заголовками
        response = make_response(send_from_directory(upload_folder, filename))
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    # Добавляем OPTIONS обработчик для CORS preflight
    @app.route('/uploads/<path:filename>', methods=['OPTIONS'])
    def uploaded_file_options(filename):
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    return app, socketio

if __name__ != '__main__':
    app, socketio = create_app()