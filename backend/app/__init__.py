from flask import Flask
from flask_cors import CORS
from app.config import Config
from app.services.db_service import db_service
from app.routes.auth import auth_bp
from app.routes.profile import profile_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Настройка CORS
    CORS(app, origins=app.config['CORS_ORIGINS'])

    # Проверка подключения к БД
    try:
        result = db_service.execute_query("SELECT 1 as test", fetch_one=True)
        print("✅ Database connection successful!")
    except Exception as e:
        print(f"⚠️ Database connection warning: {e}")

    # Регистрация Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(profile_bp, url_prefix='/api')

    @app.route('/health', methods=['GET'])
    def health_check():
        try:
            db_service.execute_query("SELECT 1")
            return {
                'status': 'ok',
                'message': 'Velad API is running',
                'database': 'connected'
            }, 200
        except Exception as e:
            return {
                'status': 'error',
                'message': str(e),
                'database': 'disconnected'
            }, 500

    return app