import bcrypt
import uuid
import jwt
import secrets
import re
import requests
from urllib.parse import urlencode
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, redirect
from app.services.db_service import db_service

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

        if not all([email, password, username, display_name]):
            return jsonify({'error': 'Все поля обязательны'}), 400

        if not validate_email(email):
            return jsonify({'error': 'Неверный формат email'}), 400

        if not validate_username(username):
            return jsonify({'error': 'Имя пользователя должно содержать 3-30 символов'}), 400

        if len(password) < 6:
            return jsonify({'error': 'Пароль должен быть не менее 6 символов'}), 400

        existing = db_service.execute_query(
            "SELECT id FROM users WHERE email = %s OR username = %s",
            [email, username], fetch_one=True
        )

        if existing:
            return jsonify({'error': 'Пользователь с таким email или именем уже существует'}), 400

        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)
        user_id = uuid.uuid4()
        avatar_url = f"https://ui-avatars.com/api/?name={display_name}&background=9146FF&color=fff&size=128"

        db_service.execute_query("""
            INSERT INTO users (id, email, password_hash, username, display_name, avatar_url)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, [str(user_id), email, password_hash.decode('utf-8'), username, display_name, avatar_url])

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

        user = db_service.execute_query("""
            SELECT id, email, username, display_name, avatar_url, password_hash
            FROM users WHERE email = %s
        """, [email], fetch_one=True)

        if not user:
            return jsonify({'error': 'Неверный email или пароль'}), 401

        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Неверный email или пароль'}), 401

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


# ==================== TWITCH OAuth ====================

@auth_bp.route('/twitch/login', methods=['GET'])
def twitch_login():
    """Начало OAuth авторизации через Twitch"""
    state = secrets.token_urlsafe(32)

    # Определяем базовый URL в зависимости от окружения
    host_url = request.host_url.rstrip('/')
    if 'localhost' in host_url or '127.0.0.1' in host_url:
        redirect_uri = "http://localhost:5000/api/auth/twitch/callback"
    else:
        redirect_uri = f"{host_url}/api/auth/twitch/callback"

    params = {
        'client_id': current_app.config['TWITCH_CLIENT_ID'],
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'user_read user:read:email',
        'state': state
    }

    auth_url = f"https://id.twitch.tv/oauth2/authorize?{urlencode(params)}"

    return jsonify({'url': auth_url}), 200


@auth_bp.route('/twitch/callback', methods=['GET'])
def twitch_callback():
    """Callback после авторизации через Twitch"""
    code = request.args.get('code')
    state = request.args.get('state')

    if not code:
        return jsonify({'error': 'No code provided'}), 400

    # Определяем redirect_uri для обмена токена
    host_url = request.host_url.rstrip('/')
    if 'localhost' in host_url or '127.0.0.1' in host_url:
        redirect_uri = "http://localhost:5000/api/auth/twitch/callback"
    else:
        redirect_uri = f"{host_url}/api/auth/twitch/callback"

    # Обмен кода на токены
    token_url = "https://id.twitch.tv/oauth2/token"
    token_data = {
        'client_id': current_app.config['TWITCH_CLIENT_ID'],
        'client_secret': current_app.config['TWITCH_CLIENT_SECRET'],
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': redirect_uri
    }

    token_response = requests.post(token_url, data=token_data)

    if token_response.status_code != 200:
        return jsonify({'error': 'Failed to get access token'}), 400

    tokens = token_response.json()
    access_token = tokens.get('access_token')
    refresh_token = tokens.get('refresh_token')

    # Получаем информацию о пользователе Twitch
    user_info = get_twitch_user_info(access_token)
    if not user_info:
        return jsonify({'error': 'Failed to get user info'}), 400

    twitch_id = user_info['id']
    twitch_login = user_info['login']
    email = user_info.get('email')
    display_name = user_info.get('display_name', twitch_login)
    avatar_url = user_info.get('profile_image_url', '')

    # Ищем пользователя в БД
    user = db_service.execute_query(
        "SELECT * FROM users WHERE twitch_id = %s OR email = %s",
        [twitch_id, email], fetch_one=True
    )

    if user:
        # Обновляем существующего пользователя
        db_service.execute_query("""
            UPDATE users 
            SET twitch_access_token = %s, 
                twitch_refresh_token = %s, 
                twitch_token_expires_at = NOW() + INTERVAL '30 days',
                updated_at = NOW()
            WHERE id = %s
        """, [access_token, refresh_token, user['id']])

        user_id = user['id']
        username = user['username']
    else:
        # Создаём нового пользователя
        user_id = uuid.uuid4()
        username = twitch_login

        # Проверяем уникальность username
        existing = db_service.execute_query(
            "SELECT id FROM users WHERE username = %s",
            [username], fetch_one=True
        )
        if existing:
            username = f"{twitch_login}_{uuid.uuid4().hex[:6]}"

        db_service.execute_query("""
            INSERT INTO users (id, email, username, display_name, 
                              twitch_id, twitch_login, twitch_access_token, 
                              twitch_refresh_token, avatar_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [str(user_id), email, username, display_name,
              twitch_id, twitch_login, access_token, refresh_token,
              avatar_url, datetime.now()])

        db_service.execute_query("""
            INSERT INTO profiles (id, username, display_name, email, avatar_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, [str(user_id), username, display_name, email, avatar_url, datetime.now()])

    # Генерируем JWT токен для нашего приложения
    jwt_token = jwt.encode({
        'user_id': str(user_id),
        'exp': datetime.utcnow() + timedelta(days=7)
    }, current_app.config['SECRET_KEY'], algorithm='HS256')

    # Определяем URL фронтенда для редиректа
    frontend_url = request.headers.get('Origin', 'http://localhost:3000')
    if 'vercel.app' in frontend_url:
        frontend_url = 'https://velad.vercel.app'

    return redirect(f"{frontend_url}/auth/callback?access_token={jwt_token}")


def get_twitch_user_info(access_token):
    """Получение информации о пользователе из Twitch API"""
    url = "https://api.twitch.tv/helix/users"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Client-ID': current_app.config['TWITCH_CLIENT_ID']
    }

    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data.get('data'):
                return data['data'][0]
    except Exception as e:
        print(f"Error getting Twitch user info: {e}")

    return None


@auth_bp.route('/twitch/logout', methods=['POST'])
def twitch_logout():
    """Выход из Twitch (не обязателен)"""
    # Здесь можно добавить логику отзыва токена, но это не критично
    return jsonify({'message': 'Logged out from Twitch'}), 200