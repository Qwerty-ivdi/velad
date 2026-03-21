import bcrypt
import uuid
import jwt
import datetime
from flask import Blueprint, request, jsonify, current_app
from app.services.db_service import db_service
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

        print(f"📥 Login attempt for: {email}")

        if not email or not password:
            return jsonify({'error': 'Email и пароль обязательны'}), 400

        # Ищем пользователя
        user = db_service.execute_query(
            "SELECT * FROM users WHERE email = %s",
            [email],
            fetch_one=True
        )

        if not user:
            print("❌ User not found")
            return jsonify({'error': 'Неверный email или пароль'}), 401

        # Проверяем пароль
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            print("❌ Wrong password")
            return jsonify({'error': 'Неверный email или пароль'}), 401

        # Генерируем JWT токен
        token = jwt.encode({
            'user_id': str(user['id']),  # Важно: конвертируем в строку!
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
        }, current_app.config['SECRET_KEY'], algorithm='HS256')

        print(f"✅ Login successful, token generated: {token[:50]}...")

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