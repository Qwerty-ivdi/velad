import bcrypt
import uuid
import jwt
import secrets
import re
import requests
import os
from urllib.parse import urlencode
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, redirect, session
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from app.services.db_service import db_service

auth_bp = Blueprint('auth', __name__)


def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_username(username):
    if len(username) < 3 or len(username) > 30:
        return False
    return re.match(r'^[a-zA-Z0-9_-]+$', username) is not None


def get_frontend_url():
    """Получить URL фронтенда из переменной окружения"""
    url = os.environ.get('FRONTEND_URL')
    if url:
        return url.rstrip('/')
    # Fallback для Railway
    return 'https://veladtwitch.vercel.app'


def get_backend_url():
    """Получить URL бэкенда из переменной окружения"""
    url = os.environ.get('BACKEND_URL')
    print(f"🔍 BACKEND_URL env: {url}")  # ОТЛАДКА
    if url:
        return url.rstrip('/')
    return 'https://velad-production.up.railway.app'  # Жёсткое значение


# ==================== EMAIL/ПАРОЛЬ РЕГИСТРАЦИЯ ====================

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
            INSERT INTO users (id, email, password_hash, username, display_name, avatar_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, [str(user_id), email, password_hash.decode('utf-8'), username, display_name, avatar_url, datetime.now()])

        db_service.execute_query("""
            INSERT INTO profiles (id, username, display_name, email, avatar_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, [str(user_id), username, display_name, email, avatar_url, datetime.now()])

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


# ==================== EMAIL/ПАРОЛЬ ВХОД ====================

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

        token = jwt.encode(
            {
                'sub': user['id'],
                'exp': datetime.utcnow() + timedelta(days=7)
            },
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
        )

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

    # Проверяем, что переменные установлены
    client_id = current_app.config.get('TWITCH_CLIENT_ID')
    if not client_id:
        print("❌ TWITCH_CLIENT_ID is not set!")
        return jsonify({'error': 'Twitch Client ID not configured'}), 500

    state = secrets.token_urlsafe(32)
    session['twitch_oauth_state'] = state

    backend_url = get_backend_url()
    redirect_uri = f"{backend_url}/auth/twitch/callback"

    print("=" * 60)
    print("🔍 TWITCH LOGIN CALLED")
    print(f"🔍 BACKEND_URL: {backend_url}")
    print(f"🔍 REDIRECT_URI: {redirect_uri}")
    print(f"🔍 CLIENT_ID: {client_id[:10]}...")
    print("=" * 60)

    params = {
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'chat:read chat:edit user:read:email',
        'state': state
    }

    auth_url = f"https://id.twitch.tv/oauth2/authorize?{urlencode(params)}"
    return redirect(auth_url)


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


@auth_bp.route('/twitch/callback', methods=['GET'])
def twitch_callback():
    """Callback после авторизации через Twitch"""
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')

    print("=" * 60)
    print("🔥 TWITCH CALLBACK RECEIVED 🔥")
    print("=" * 60)

    frontend_url = get_frontend_url()
    backend_url = get_backend_url()

    if error:
        return redirect(f"{frontend_url}/login?error=twitch_auth_failed")

    if not code:
        return jsonify({'error': 'No code provided'}), 400

    saved_state = session.pop('twitch_oauth_state', None)
    if not saved_state or saved_state != state:
        return redirect(f"{frontend_url}/login?error=invalid_state")

    # Обмен кода на токены
    token_url = "https://id.twitch.tv/oauth2/token"
    redirect_uri = f"{backend_url}/auth/twitch/callback"

    token_data = {
        'client_id': current_app.config['TWITCH_CLIENT_ID'],
        'client_secret': current_app.config['TWITCH_CLIENT_SECRET'],
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': redirect_uri
    }

    token_response = requests.post(token_url, data=token_data)

    if token_response.status_code != 200:
        return redirect(f"{frontend_url}/login?error=token_exchange_failed")

    tokens = token_response.json()
    access_token = tokens.get('access_token')
    refresh_token = tokens.get('refresh_token')

    print(f"📝 Access token length: {len(access_token) if access_token else 0}")
    print(f"📝 Refresh token length: {len(refresh_token) if refresh_token else 0}")

    # Получаем информацию о пользователе
    user_info = get_twitch_user_info(access_token)
    if not user_info:
        return redirect(f"{frontend_url}/login?error=no_user_info")

    twitch_id = user_info['id']
    twitch_login = user_info['login']
    email = user_info.get('email')
    display_name = user_info.get('display_name', twitch_login)
    avatar_url = user_info.get('profile_image_url', '')

    print(f"✅ Twitch user: {twitch_login} ({email})")

    # Ищем пользователя
    user = db_service.execute_query(
        "SELECT * FROM users WHERE twitch_id = %s OR email = %s",
        [twitch_id, email], fetch_one=True
    )

    if user and isinstance(user, dict):
        user_id = user.get('id')
        print(f"📡 Using existing user_id: {user_id}")

        db_service.execute_query("""
            UPDATE users 
            SET twitch_access_token = %s, 
                twitch_refresh_token = %s, 
                twitch_token_expires_at = NOW() + INTERVAL '30 days',
                twitch_login = %s,
                avatar_url = %s,
                updated_at = NOW()
            WHERE id = %s
        """, [access_token, refresh_token, twitch_login, avatar_url, user_id])
        print(f"✅ Updated user {twitch_login}")
    else:
        user_id = str(uuid.uuid4())
        db_service.execute_query("""
            INSERT INTO users (id, email, username, display_name, password_hash,
                              twitch_id, twitch_login, twitch_access_token, 
                              twitch_refresh_token, avatar_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [user_id, email, twitch_login, display_name, '',
              twitch_id, twitch_login, access_token, refresh_token,
              avatar_url, datetime.now()])
        print(f"✅ Created new user {twitch_login}")

    # Генерируем JWT
    jwt_token = jwt.encode(
        {
            'sub': user_id,
            'exp': datetime.utcnow() + timedelta(days=7)
        },
        current_app.config['SECRET_KEY'],
        algorithm='HS256'
    )

    print(f"🔑 Generated token: {jwt_token[:50]}...")
    print(f"✅ Redirecting to frontend: {frontend_url}/auth/callback")

    return redirect(f"{frontend_url}/auth/callback?access_token={jwt_token}")


@auth_bp.route('/twitch/token', methods=['GET'])
@jwt_required()
def get_twitch_token():
    """Вернуть валидный токен Twitch для текущего пользователя"""
    try:
        user_id = get_jwt_identity()
        print(f"📡 Getting Twitch token for user: {user_id}")

        user = db_service.execute_query("""
            SELECT twitch_access_token, twitch_login, twitch_token_expires_at
            FROM users WHERE id = %s
        """, [user_id], fetch_one=True)

        if not user:
            return jsonify({
                'has_token': False,
                'error': 'User not found'
            }), 200

        if not user.get('twitch_access_token'):
            print(f"⚠️ No Twitch token found")
            return jsonify({
                'has_token': False,
                'error': 'No Twitch token found'
            }), 200

        expires_at = user.get('twitch_token_expires_at')
        if expires_at and expires_at <= datetime.now():
            print(f"⚠️ Token expired at {expires_at}")
            return jsonify({
                'has_token': False,
                'error': 'Token expired'
            }), 200

        token_length = len(user['twitch_access_token'])
        print(f"✅ Returning Twitch token for {user['twitch_login']} (length: {token_length})")

        return jsonify({
            'has_token': True,
            'twitch_access_token': user['twitch_access_token'],
            'twitch_login': user['twitch_login']
        }), 200

    except Exception as e:
        print(f"❌ Error in get_twitch_token: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'has_token': False, 'error': str(e)}), 500