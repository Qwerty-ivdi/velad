from functools import wraps
from flask import request, jsonify, g
from app.services.supabase_service import supabase_service

def require_auth(f):
    """
    Декоратор для проверки авторизации
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Требуется авторизация'}), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            supabase = supabase_service.get_client()
            
            # Проверяем токен и получаем пользователя
            user = supabase.auth.get_user(token)
            
            if not user.user:
                return jsonify({'error': 'Неверный токен'}), 401
            
            g.user_id = user.user.id
            g.user = user.user
            
        except Exception as e:
            return jsonify({'error': 'Ошибка авторизации'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function