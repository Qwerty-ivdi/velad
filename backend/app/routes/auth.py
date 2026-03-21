from flask import Blueprint, request, jsonify, current_app
from app.services.supabase_service import supabase_service
import re

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    """Проверка формата email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_username(username):
    """Проверка имени пользователя"""
    if len(username) < 3 or len(username) > 30:
        return False
    return re.match(r'^[a-zA-Z0-9_-]+$', username) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Регистрация нового пользователя
    Ожидает: {
        "email": "user@example.com",
        "password": "password123",
        "username": "username",
        "display_name": "Display Name"
    }
    """
    try:
        data = request.get_json()
        
        # Валидация данных
        required_fields = ['email', 'password', 'username', 'display_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Поле {field} обязательно'}), 400
        
        email = data['email']
        password = data['password']
        username = data['username']
        display_name = data['display_name']
        
        # Проверка email
        if not validate_email(email):
            return jsonify({'error': 'Неверный формат email'}), 400
        
        # Проверка username
        if not validate_username(username):
            return jsonify({'error': 'Имя пользователя должно содержать 3-30 символов: буквы, цифры, _, -'}), 400
        
        # Проверка пароля
        if len(password) < 6:
            return jsonify({'error': 'Пароль должен быть не менее 6 символов'}), 400
        
        # Получаем клиент Supabase
        supabase = supabase_service.get_client()
        
        # 1. Регистрируем пользователя в Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "username": username,
                    "display_name": display_name,
                    "avatar_url": f"https://ui-avatars.com/api/?name={display_name}&background=9146FF&color=fff&size=128"
                }
            }
        })
        
        if not auth_response.user:
            return jsonify({'error': 'Ошибка при создании пользователя'}), 400
        
        user_id = auth_response.user.id
        
        # 2. Создаем профиль в таблице profiles
        profile_data = {
            "id": user_id,
            "username": username,
            "display_name": display_name,
            "email": email,
            "avatar_url": f"https://ui-avatars.com/api/?name={display_name}&background=9146FF&color=fff&size=128",
            "bio": "",
            "location": "",
            "website": ""
        }
        
        profile_response = supabase.table('profiles').insert(profile_data).execute()
        
        if profile_response.error:
            # Если профиль не создался, удаляем пользователя?
            return jsonify({'error': 'Ошибка при создании профиля'}), 500
        
        # 3. Возвращаем данные пользователя
        return jsonify({
            'message': 'Регистрация успешна',
            'user': {
                'id': user_id,
                'email': email,
                'username': username,
                'display_name': display_name,
                'avatar_url': profile_data['avatar_url']
            }
        }), 201
        
    except Exception as e:
        current_app.logger.error(f'Registration error: {str(e)}')
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Вход пользователя
    Ожидает: {
        "email": "user@example.com",
        "password": "password123"
    }
    """
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email и пароль обязательны'}), 400
        
        supabase = supabase_service.get_client()
        
        # Вход в систему
        auth_response = supabase.auth.sign_in_with_password({
            "email": data['email'],
            "password": data['password']
        })
        
        if not auth_response.user:
            return jsonify({'error': 'Неверный email или пароль'}), 401
        
        user = auth_response.user
        session = auth_response.session
        
        # Получаем профиль пользователя
        profile_response = supabase.table('profiles')\
            .select('*')\
            .eq('id', user.id)\
            .execute()
        
        profile = profile_response.data[0] if profile_response.data else {}
        
        return jsonify({
            'message': 'Вход успешен',
            'session': {
                'access_token': session.access_token,
                'refresh_token': session.refresh_token
            },
            'user': {
                'id': user.id,
                'email': user.email,
                'username': profile.get('username'),
                'display_name': profile.get('display_name'),
                'avatar_url': profile.get('avatar_url')
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Login error: {str(e)}')
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/twitch/auth', methods=['POST'])
def twitch_auth():
    """
    Аутентификация через Twitch
    """
    try:
        supabase = supabase_service.get_client()
        
        # Получаем URL для авторизации через Twitch
        auth_response = supabase.auth.sign_in_with_oauth({
            "provider": "twitch",
            "options": {
                "redirect_to": f"{request.host_url}api/auth/twitch/callback"
            }
        })
        
        return jsonify({
            'url': auth_response.url
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Twitch auth error: {str(e)}')
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/twitch/callback', methods=['GET'])
def twitch_callback():
    """
    Callback после авторизации через Twitch
    """
    try:
        code = request.args.get('code')
        if not code:
            return jsonify({'error': 'Code not provided'}), 400
        
        # Здесь нужно обработать callback и получить сессию
        # В Supabase это происходит автоматически, если правильно настроен redirect_to
        
        return jsonify({'message': 'Twitch auth successful'}), 200
        
    except Exception as e:
        current_app.logger.error(f'Twitch callback error: {str(e)}')
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Выход пользователя
    """
    try:
        supabase = supabase_service.get_client()
        supabase.auth.sign_out()
        return jsonify({'message': 'Выход выполнен'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500