from flask import Flask
from flask_cors import CORS
from app.config import Config
from app.services.supabase_service import supabase_service
from app.routes.auth import auth_bp
from app.routes.profile import profile_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Настройка CORS
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    # Инициализация Supabase
    supabase_service.init_app(app)
    
    # Регистрация Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(profile_bp, url_prefix='/api')
    
    @app.route('/health', methods=['GET'])
    def health_check():
        return {'status': 'ok', 'message': 'Velad API is running'}, 200
    
    return app