from flask import Blueprint, request, jsonify, current_app
from app.services.db_service import db_service
from flask_jwt_extended import jwt_required, get_jwt_identity
import jwt
import uuid
from datetime import datetime

profile_bp = Blueprint('profile', __name__)


def get_user_from_token(token):
    """Декодирует JWT токен и возвращает словарь с id пользователя"""
    try:
        import jwt
        payload = jwt.decode(
            token,
            current_app.config['SECRET_KEY'],
            algorithms=['HS256']
        )
        user_id = payload.get('sub')  # Используем 'sub'
        if user_id:
            return {'id': user_id}
        return None
    except Exception as e:
        print(f"Error decoding token: {e}")
        return None


@profile_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        print(f"📡 Getting profile for user: {user_id}")

        if not user_id:
            return jsonify({'error': 'User ID not found in token'}), 401

        # Упрощённый запрос — уберите сложные подзапросы для проверки
        user = db_service.execute_query("""
            SELECT id, email, username, display_name, avatar_url, created_at,
                   twitch_login, twitch_id, bio, location, website
            FROM users
            WHERE id = %s
        """, [user_id], fetch_one=True)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Получаем счётчики отдельно (если таблицы существуют)
        followers_count = 0
        following_count = 0
        posts_count = 0

        try:
            followers_result = db_service.execute_query(
                "SELECT COUNT(*) as count FROM follows WHERE following_id = %s",
                [user_id], fetch_one=True
            )
            followers_count = followers_result['count'] if followers_result else 0
        except Exception as e:
            print(f"⚠️ Could not get followers count: {e}")

        try:
            following_result = db_service.execute_query(
                "SELECT COUNT(*) as count FROM follows WHERE follower_id = %s",
                [user_id], fetch_one=True
            )
            following_count = following_result['count'] if following_result else 0
        except Exception as e:
            print(f"⚠️ Could not get following count: {e}")

        try:
            posts_result = db_service.execute_query(
                "SELECT COUNT(*) as count FROM posts WHERE user_id = %s",
                [user_id], fetch_one=True
            )
            posts_count = posts_result['count'] if posts_result else 0
        except Exception as e:
            print(f"⚠️ Could not get posts count: {e}")

        return jsonify({
            'id': user.get('id'),
            'email': user.get('email'),
            'username': user.get('username'),
            'display_name': user.get('display_name'),
            'avatar_url': user.get('avatar_url'),
            'bio': user.get('bio'),
            'location': user.get('location'),
            'website': user.get('website'),
            'created_at': user['created_at'].isoformat() if user.get('created_at') else None,
            'twitch_login': user.get('twitch_login'),
            'has_twitch': user.get('twitch_id') is not None,
            'followers_count': followers_count,
            'following_count': following_count,
            'posts_count': posts_count,
            'is_following': False
        }), 200

    except Exception as e:
        print(f"❌ Error getting profile: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/profile/<user_id>', methods=['GET'])
def get_profile_by_id(user_id):
    """Получение профиля по ID"""
    try:
        print("=" * 60)
        print(f"🔥 GET PROFILE BY ID: {user_id}")

        # Получаем данные пользователя
        user = db_service.execute_query("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, 
                   u.location, u.website, u.created_at,
                   u.twitch_login,
                   COALESCE((SELECT COUNT(*) FROM follows WHERE following_id = u.id), 0) as followers_count,
                   COALESCE((SELECT COUNT(*) FROM follows WHERE follower_id = u.id), 0) as following_count,
                   COALESCE((SELECT COUNT(*) FROM posts WHERE user_id = u.id), 0) as posts_count
            FROM users u
            WHERE u.id = %s
        """, [user_id], fetch_one=True)

        if not user:
            return jsonify({'error': 'Профиль не найден'}), 404

        # Получаем текущего пользователя из токена
        auth_header = request.headers.get('Authorization')
        is_following = False

        print(f"🔍 Auth header exists: {auth_header is not None}")

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            print(f"🔍 Token: {token[:30]}...")

            try:
                # Декодируем токен
                payload = jwt.decode(
                    token,
                    current_app.config['SECRET_KEY'],
                    algorithms=['HS256']
                )
                current_user_id = payload.get('sub')
                print(f"🔍 Current user ID from token: {current_user_id}")
                print(f"🔍 Target user ID: {user_id}")

                if current_user_id and str(current_user_id) != str(user_id):
                    # ПРЯМОЙ SQL ЗАПРОС С ПРИВЕДЕНИЕМ ТИПОВ
                    query = """
                        SELECT COUNT(*) as count FROM follows 
                        WHERE follower_id = %s::uuid AND following_id = %s::uuid
                    """
                    follow_check = db_service.execute_query(
                        query,
                        [str(current_user_id), str(user_id)],
                        fetch_one=True
                    )

                    print(f"🔍 Follow check result: {follow_check}")
                    is_following = follow_check and follow_check.get('count', 0) > 0
                    print(f"🔍 is_following: {is_following}")
                else:
                    print("🔍 Same user - skipping follow check")

            except Exception as e:
                print(f"❌ Token decode error: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("❌ No Authorization header")

        result = {
            'id': user.get('id'),
            'username': user.get('username'),
            'display_name': user.get('display_name'),
            'avatar_url': user.get('avatar_url'),
            'bio': user.get('bio'),
            'location': user.get('location'),
            'website': user.get('website'),
            'created_at': user.get('created_at').isoformat() if user.get('created_at') else None,
            'twitch_login': user.get('twitch_login'),
            'followers_count': int(user.get('followers_count', 0)),
            'following_count': int(user.get('following_count', 0)),
            'posts_count': int(user.get('posts_count', 0)),
            'is_following': is_following
        }

        print(f"✅ FINAL RESULT: is_following={is_following}")
        print("=" * 60)
        return jsonify(result), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
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
            if current_user and current_user.get('id') != user['id']:
                follow_check = db_service.execute_query(
                    "SELECT id FROM follows WHERE follower_id = %s AND following_id = %s",
                    [current_user.get('id'), user['id']],
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

    if current_user.get('id') == user_id:
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
        [current_user.get('id'), user_id],
        fetch_one=True
    )

    if existing:
        return jsonify({'message': 'Уже подписан', 'is_following': True}), 200

    follow_id = uuid.uuid4()
    now = datetime.now()

    db_service.execute_query(
        "INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (%s, %s, %s, %s)",
        [str(follow_id), current_user.get('id'), user_id, now]
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
        [current_user.get('id'), user_id]
    )

    return jsonify({'message': 'Отписка выполнена', 'is_following': False}), 200


@profile_bp.route('/users/<user_id>/followers', methods=['GET'])
def get_followers(user_id):
    """Получить список подписчиков пользователя"""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)

        auth_header = request.headers.get('Authorization')
        current_user_id = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            current_user = get_user_from_token(token)
            if current_user:
                current_user_id = current_user.get('id')

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

        # Добавляем информацию о подписке для каждого подписчика
        for follower in followers:
            follower['is_following'] = False
            if current_user_id:
                check = db_service.execute_query(
                    "SELECT id FROM follows WHERE follower_id = %s AND following_id = %s",
                    [current_user_id, follower['id']], fetch_one=True
                )
                follower['is_following'] = check is not None

        return jsonify({'followers': followers or []}), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/users/<user_id>/following', methods=['GET'])
def get_following(user_id):
    """Получить список подписок пользователя"""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)

        auth_header = request.headers.get('Authorization')
        current_user_id = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            current_user = get_user_from_token(token)
            if current_user:
                current_user_id = current_user.get('id')

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

        # Добавляем информацию о подписке для каждого пользователя
        for follow in following:
            follow['is_following'] = False
            if current_user_id:
                check = db_service.execute_query(
                    "SELECT id FROM follows WHERE follower_id = %s AND following_id = %s",
                    [current_user_id, follow['id']], fetch_one=True
                )
                follow['is_following'] = check is not None

        return jsonify({'following': following or []}), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/twitch/status', methods=['GET'])
def get_twitch_status():
    """Проверка, подключён ли Twitch аккаунт"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    twitch_data = db_service.execute_query(
        "SELECT twitch_id, twitch_login FROM users WHERE id = %s",
        [user.get('id')], fetch_one=True
    )

    return jsonify({
        'connected': bool(twitch_data and twitch_data.get('twitch_id')),
        'twitch_login': twitch_data.get('twitch_login') if twitch_data else None
    }), 200