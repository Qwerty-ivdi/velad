import bcrypt
import uuid
import jwt

from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from app.services.db_service import db_service
# from app.services.twitch_service import twitch_service
import requests
import re

auth_bp = Blueprint('auth', __name__)


def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_username(username):
    if len(username) < 3 or len(username) > 30:
        return False
    return re.match(r'^[a-zA-Z0-9_-]+$', username) is not None


@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()

        email = data.get('email')
        password = data.get('password')
        username = data.get('username')
        display_name = data.get('display_name')

        print(f"📝 Registration attempt for: {email}")

        # Валидация
        if not all([email, password, username, display_name]):
            return jsonify({'error': 'Все поля обязательны'}), 400

        if not validate_email(email):
            return jsonify({'error': 'Неверный формат email'}), 400

        if not validate_username(username):
            return jsonify({'error': 'Имя пользователя должно содержать 3-30 символов'}), 400

        if len(password) < 6:
            return jsonify({'error': 'Пароль должен быть не менее 6 символов'}), 400

        # Проверка существования пользователя
        existing = db_service.execute_query(
            "SELECT id FROM users WHERE email = %s OR username = %s",
            [email, username]
        )

        if existing:
            return jsonify({'error': 'Пользователь с таким email или именем уже существует'}), 400

        # Хэшируем пароль
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)

        user_id = uuid.uuid4()
        avatar_url = f"https://ui-avatars.com/api/?name={display_name}&background=9146FF&color=fff&size=128"

        # Создаем пользователя
        db_service.execute_query("""
            INSERT INTO users (id, email, password_hash, username, display_name, avatar_url)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, [str(user_id), email, password_hash.decode('utf-8'), username, display_name, avatar_url])

        # Создаем профиль
        db_service.execute_query("""
            INSERT INTO profiles (id, username, display_name, email, avatar_url)
            VALUES (%s, %s, %s, %s, %s)
        """, [str(user_id), username, display_name, email, avatar_url])

        return jsonify({
            'message': 'Регистрация успешна',
            'user': {
                'id': str(user_id),
                'email': email,
                'username': username,
                'display_name': display_name,
                'avatar_url': avatar_url
            }
        }), 201

    except Exception as e:
        print(f"❌ Registration error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email и пароль обязательны'}), 400

        # Ищем пользователя в БД
        user = db_service.execute_query("""
            SELECT id, email, username, display_name, avatar_url, password_hash
            FROM users WHERE email = %s
        """, [email], fetch_one=True)

        if not user:
            return jsonify({'error': 'Неверный email или пароль'}), 401

        # Проверяем пароль
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Неверный email или пароль'}), 401

        # Генерируем JWT токен
        token = jwt.encode({
            'user_id': user['id'],
            'exp': datetime.utcnow() + timedelta(days=7)
        }, current_app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            'message': 'Вход успешен',
            'access_token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'username': user['username'],
                'display_name': user['display_name'],
                'avatar_url': user['avatar_url']
            }
        }), 200

    except Exception as e:
        print(f"❌ Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/twitch/login', methods=['GET'])
def twitch_login():
    """Начало OAuth авторизации через Twitch"""
    import secrets
    import base64

    # Генерируем state для защиты от CSRF
    state = secrets.token_urlsafe(32)
    request.session['twitch_oauth_state'] = state  # нужно настроить сессии

    # Строим URL для авторизации
    redirect_uri = f"{request.host_url}api/auth/twitch/callback"
    url = f"https://id.twitch.tv/oauth2/authorize?client_id={current_app.config['TWITCH_CLIENT_ID']}&redirect_uri={redirect_uri}&response_type=code&scope=user_read+user:read:follows&state={state}"

    return jsonify({'url': url}), 200


@auth_bp.route('/twitch/callback', methods=['GET'])
def twitch_callback():
    """Callback после авторизации через Twitch"""
    code = request.args.get('code')
    state = request.args.get('state')

    # Проверка state (опционально)
    # if state != request.session.get('twitch_oauth_state'):
    #     return jsonify({'error': 'Invalid state'}), 400

    if not code:
        return jsonify({'error': 'No code provided'}), 400

    # Получаем токены
    token_url = "https://id.twitch.tv/oauth2/token"
    data = {
        'client_id': current_app.config['TWITCH_CLIENT_ID'],
        'client_secret': current_app.config['TWITCH_CLIENT_SECRET'],
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': f"{request.host_url}api/auth/twitch/callback"
    }

    response = requests.post(token_url, data=data)
    if response.status_code != 200:
        return jsonify({'error': 'Failed to get token'}), 400

    token_data = response.json()
    access_token = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token')

    # Получаем информацию о пользователе Twitch
   # user_info = twitch_service.get_user_info(access_token)
   # if not user_info:
   #     return jsonify({'error': 'Failed to get user info'}), 400

   # twitch_id = user_info['id']
   # twitch_login = user_info['login']
   # email = user_info.get('email')

    # Ищем пользователя в БД
    user = db_service.execute_query(
        "SELECT * FROM users WHERE twitch_id = %s OR email = %s",
        [twitch_id, email], fetch_one=True
    )

    if user:
        # Обновляем существующего пользователя
        db_service.execute_query("""
            UPDATE users 
            SET twitch_access_token = %s, twitch_refresh_token = %s, 
                twitch_token_expires_at = %s, updated_at = NOW()
            WHERE id = %s
        """, [access_token, refresh_token,
              datetime.now() + timedelta(seconds=token_data['expires_in']),
              user['id']])

        user_id = user['id']
    else:
        # Создаем нового пользователя
        user_id = uuid.uuid4()
        db_service.execute_query("""
            INSERT INTO users (id, email, username, display_name, 
                              twitch_id, twitch_login, twitch_access_token, 
                              twitch_refresh_token, avatar_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [str(user_id), email, twitch_login, user_info['display_name'],
              twitch_id, twitch_login, access_token, refresh_token,
              user_info['profile_image_url'], datetime.now()])

    # Генерируем JWT токен для нашего приложения
    payload = {'user_id': str(user_id), 'exp': datetime.utcnow() + timedelta(days=7)}
    jwt_token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

    # Перенаправляем на фронтенд с токеном
    frontend_url = "http://localhost:3000/auth/callback"
    return redirect(f"{frontend_url}?access_token={jwt_token}")