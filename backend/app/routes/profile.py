from flask import Blueprint, request, jsonify
from app.services.db_service import db_service
import jwt
from flask import current_app

profile_bp = Blueprint('profile', __name__)


def get_user_from_token(token):
    """Получение пользователя из JWT токена"""
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload.get('user_id')

        user = db_service.execute_query(
            "SELECT id, email, username, display_name, avatar_url, bio, location, website FROM users WHERE id = %s",
            [user_id],
            fetch_one=True
        )
        return user
    except Exception as e:
        print(f"Token decode error: {e}")
        return None


@profile_bp.route('/profile', methods=['GET'])
def get_profile():
    """Получение текущего профиля"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    return jsonify(user), 200


@profile_bp.route('/profile/<user_id>', methods=['GET'])
def get_profile_by_id(user_id):
    """Получение профиля по ID"""
    try:
        user = db_service.execute_query(
            "SELECT id, email, username, display_name, avatar_url, bio, location, website, created_at FROM users WHERE id = %s",
            [user_id],
            fetch_one=True
        )

        if not user:
            return jsonify({'error': 'Профиль не найден'}), 404

        return jsonify(user), 200

    except Exception as e:
        print(f"Error getting profile: {e}")
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/profile', methods=['PUT'])
def update_profile():
    """Обновление профиля"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    data = request.get_json()

    # Разрешенные поля для обновления
    allowed_fields = ['display_name', 'bio', 'location', 'website', 'avatar_url']
    update_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

    if not update_data:
        return jsonify({'error': 'Нет данных для обновления'}), 400

    # Формируем SQL запрос
    set_clause = ", ".join([f"{key} = %s" for key in update_data.keys()])
    values = list(update_data.values())
    values.append(user['id'])

    query = f"UPDATE users SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING id, email, username, display_name, avatar_url, bio, location, website"

    updated_user = db_service.execute_query(query, values, fetch_one=True)

    return jsonify({
        'message': 'Профиль обновлен',
        'user': updated_user
    }), 200


@profile_bp.route('/profile/username/<username>', methods=['GET'])
def check_username(username):
    """Проверка доступности имени пользователя"""
    try:
        user = db_service.execute_query(
            "SELECT id FROM users WHERE username = %s",
            [username],
            fetch_one=True
        )

        return jsonify({
            'available': user is None,
            'username': username
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/profile/<user_id>/stats', methods=['GET'])
def get_user_stats(user_id):
    """Получение статистики пользователя"""
    try:
        # Количество подписчиков
        followers = db_service.execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE following_id = %s",
            [user_id],
            fetch_one=True
        )

        # Количество подписок
        following = db_service.execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE follower_id = %s",
            [user_id],
            fetch_one=True
        )

        # Количество постов
        posts = db_service.execute_query(
            "SELECT COUNT(*) as count FROM posts WHERE user_id = %s",
            [user_id],
            fetch_one=True
        )

        return jsonify({
            'followers_count': followers['count'] if followers else 0,
            'following_count': following['count'] if following else 0,
            'posts_count': posts['count'] if posts else 0
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500