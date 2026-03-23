from flask import Blueprint, request, jsonify, current_app
from app.services.db_service import db_service
import jwt
import uuid
from datetime import datetime

profile_bp = Blueprint('profile', __name__)


def get_user_from_token(token):
    """Получение пользователя из JWT токена"""
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload.get('user_id')

        user = db_service.execute_query("""
            SELECT u.id, u.email, u.username, u.display_name, u.avatar_url, 
                   u.bio, u.location, u.website, u.created_at,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count
            FROM users u
            WHERE u.id = %s
        """, [user_id], fetch_one=True)

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

    if user.get('created_at'):
        user['created_at'] = user['created_at'].isoformat()

    return jsonify(user), 200


@profile_bp.route('/profile/<user_id>', methods=['GET'])
def get_profile_by_id(user_id):
    """Получение профиля по ID"""
    try:
        user = db_service.execute_query("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, 
                   u.location, u.website, u.created_at,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
                   (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count
            FROM users u
            WHERE u.id = %s
        """, [user_id], fetch_one=True)

        if not user:
            return jsonify({'error': 'Профиль не найден'}), 404

        if user.get('created_at'):
            user['created_at'] = user['created_at'].isoformat()

        return jsonify(user), 200

    except Exception as e:
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

    allowed_fields = ['display_name', 'bio', 'location', 'website', 'avatar_url']
    update_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

    if not update_data:
        return jsonify({'error': 'Нет данных для обновления'}), 400

    set_clause = ", ".join([f"{key} = %s" for key in update_data.keys()])
    values = list(update_data.values())
    values.append(user['id'])

    query = f"""
        UPDATE users 
        SET {set_clause}, updated_at = NOW() 
        WHERE id = %s 
        RETURNING id, email, username, display_name, avatar_url, bio, location, website
    """

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
    """Получение статистики пользователя (ОДНА функция!)"""
    try:
        stats = db_service.execute_query("""
            SELECT 
                (SELECT COUNT(*) FROM follows WHERE following_id = %s) as followers_count,
                (SELECT COUNT(*) FROM follows WHERE follower_id = %s) as following_count,
                (SELECT COUNT(*) FROM posts WHERE user_id = %s) as posts_count
        """, [user_id, user_id, user_id], fetch_one=True)

        return jsonify(stats or {'followers_count': 0, 'following_count': 0, 'posts_count': 0}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/users/search', methods=['GET'])
def search_users():
    """Поиск пользователей"""
    try:
        query = request.args.get('q', '').strip()
        limit = request.args.get('limit', 20, type=int)

        if not query:
            return jsonify({'users': []}), 200

        search_pattern = f"%{query}%"

        users = db_service.execute_query("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count
            FROM users u
            WHERE u.username ILIKE %s OR u.display_name ILIKE %s
            ORDER BY 
                CASE 
                    WHEN u.username ILIKE %s THEN 1
                    WHEN u.display_name ILIKE %s THEN 2
                    ELSE 3
                END,
                followers_count DESC
            LIMIT %s
        """, [search_pattern, search_pattern, f"{query}%", f"{query}%", limit], fetch_all=True)

        # Проверяем, подписан ли текущий пользователь
        auth_header = request.headers.get('Authorization')
        current_user = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            current_user = get_user_from_token(token)

        for user in users:
            user['is_following'] = False
            if current_user and current_user['id'] != user['id']:
                follow_check = db_service.execute_query(
                    "SELECT id FROM follows WHERE follower_id = %s AND following_id = %s",
                    [current_user['id'], user['id']],
                    fetch_one=True
                )
                user['is_following'] = follow_check is not None

        return jsonify({'users': users or []}), 200

    except Exception as e:
        print(f"❌ Search error: {e}")
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/users/<user_id>/follow', methods=['POST'])
def follow_user(user_id):
    """Подписаться на пользователя"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    current_user = get_user_from_token(token)

    if not current_user:
        return jsonify({'error': 'Неверный токен'}), 401

    if current_user['id'] == user_id:
        return jsonify({'error': 'Нельзя подписаться на самого себя'}), 400

    user_exists = db_service.execute_query(
        "SELECT id FROM users WHERE id = %s",
        [user_id],
        fetch_one=True
    )

    if not user_exists:
        return jsonify({'error': 'Пользователь не найден'}), 404

    existing = db_service.execute_query(
        "SELECT id FROM follows WHERE follower_id = %s AND following_id = %s",
        [current_user['id'], user_id],
        fetch_one=True
    )

    if existing:
        return jsonify({'message': 'Уже подписан', 'is_following': True}), 200

    follow_id = uuid.uuid4()
    now = datetime.now()

    db_service.execute_query(
        "INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (%s, %s, %s, %s)",
        [str(follow_id), current_user['id'], user_id, now]
    )

    return jsonify({'message': 'Подписка оформлена', 'is_following': True}), 200


@profile_bp.route('/users/<user_id>/unfollow', methods=['POST'])
def unfollow_user(user_id):
    """Отписаться от пользователя"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    current_user = get_user_from_token(token)

    if not current_user:
        return jsonify({'error': 'Неверный токен'}), 401

    db_service.execute_query(
        "DELETE FROM follows WHERE follower_id = %s AND following_id = %s",
        [current_user['id'], user_id]
    )

    return jsonify({'message': 'Отписка выполнена', 'is_following': False}), 200


@profile_bp.route('/users/<user_id>/followers', methods=['GET'])
def get_followers(user_id):
    """Получить список подписчиков пользователя"""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)

        followers = db_service.execute_query("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio,
                   f.created_at as followed_at,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            WHERE f.following_id = %s
            ORDER BY f.created_at DESC
            LIMIT %s OFFSET %s
        """, [user_id, limit, offset], fetch_all=True)

        return jsonify({'followers': followers or []}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/users/<user_id>/following', methods=['GET'])
def get_following(user_id):
    """Получить список подписок пользователя"""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)

        following = db_service.execute_query("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio,
                   f.created_at as followed_at,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count
            FROM follows f
            JOIN users u ON f.following_id = u.id
            WHERE f.follower_id = %s
            ORDER BY f.created_at DESC
            LIMIT %s OFFSET %s
        """, [user_id, limit, offset], fetch_all=True)

        return jsonify({'following': following or []}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500