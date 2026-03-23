from flask import Blueprint, request, jsonify, current_app
from app.services.db_service import db_service
import uuid
from datetime import datetime
import os
import base64
from pathlib import Path

# Настройки для загрузки
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

posts_bp = Blueprint('posts', __name__)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@posts_bp.route('/upload', methods=['POST'])
def upload_image():
    """Загрузка изображения"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'Нет файла'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'Файл не выбран'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Неподдерживаемый формат файла. Используйте: png, jpg, jpeg, gif, webp'}), 400

    # Создаем папку если нет
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    UPLOAD_FOLDER = BASE_DIR / 'uploads'
    UPLOAD_FOLDER.mkdir(exist_ok=True)

    # Генерируем уникальное имя
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{user['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_FOLDER / filename

    # Сохраняем файл
    file.save(str(filepath))

    # Проверяем, что файл создан
    if filepath.exists():
        print(f"✅ File saved: {filepath}, size: {filepath.stat().st_size} bytes")
    else:
        print(f"❌ File not saved: {filepath}")

    # Возвращаем полный URL
    file_url = f"http://localhost:5000/uploads/{filename}"
    print(f"📎 File URL: {file_url}")

    return jsonify({
        'url': file_url,
        'filename': filename
    }), 200

def get_user_from_token(token):
    """Получение пользователя из JWT токена"""
    import jwt
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload.get('user_id')

        user = db_service.execute_query(
            "SELECT id, username, display_name, avatar_url FROM users WHERE id = %s",
            [user_id],
            fetch_one=True
        )
        return user
    except Exception as e:
        print(f"Token decode error: {e}")
        return None


@posts_bp.route('/posts', methods=['POST'])
def create_post():
    """Создание нового поста"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    data = request.get_json()
    content = data.get('content', '')
    post_type = data.get('post_type', 'text')
    media_urls = data.get('media_urls', [])

    if not content and not media_urls:
        return jsonify({'error': 'Пост не может быть пустым'}), 400

    post_id = uuid.uuid4()
    now = datetime.now()

    query = """
        INSERT INTO posts (id, user_id, content, post_type, media_urls, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id, user_id, content, post_type, media_urls, created_at, updated_at
    """

    try:
        post = db_service.execute_query(
            query,
            [str(post_id), user['id'], content, post_type, media_urls, now, now],
            fetch_one=True
        )

        if not post:
            return jsonify({'error': 'Ошибка при создании поста'}), 500

        # Получаем ПОЛНЫЕ данные пользователя
        full_user = db_service.execute_query(
            "SELECT id, username, display_name, avatar_url FROM users WHERE id = %s",
            [user['id']],
            fetch_one=True
        )

        response_post = {
            'id': post['id'],
            'user_id': post['user_id'],
            'content': post['content'],
            'post_type': post['post_type'],
            'media_urls': post['media_urls'],
            'created_at': post['created_at'].isoformat() if post['created_at'] else None,
            'updated_at': post['updated_at'].isoformat() if post['updated_at'] else None,
            'username': full_user['username'],
            'display_name': full_user['display_name'],
            'avatar_url': full_user['avatar_url'],
            'likes_count': 0,
            'comments_count': 0,
            'is_liked': False
        }

        return jsonify(response_post), 201

    except Exception as e:
        print(f"❌ Error creating post: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@posts_bp.route('/posts/<post_id>', methods=['GET'])
def get_post(post_id):
    """Получение одного поста"""
    try:
        query = """
            SELECT p.*, 
                   u.username, u.display_name, u.avatar_url,
                   COUNT(DISTINCT pl.id) as likes_count,
                   COUNT(DISTINCT c.id) as comments_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN post_likes pl ON p.id = pl.post_id
            LEFT JOIN comments c ON p.id = c.post_id
            WHERE p.id = %s
            GROUP BY p.id, u.id
        """

        post = db_service.execute_query(query, [post_id], fetch_one=True)

        if not post:
            return jsonify({'error': 'Пост не найден'}), 404

        # Проверяем, поставил ли текущий пользователь лайк
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            if user:
                like_check = db_service.execute_query(
                    "SELECT id FROM post_likes WHERE post_id = %s AND user_id = %s",
                    [post_id, user['id']],
                    fetch_one=True
                )
                post['is_liked'] = like_check is not None

        return jsonify(post), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@posts_bp.route('/profile/<user_id>/posts', methods=['GET'])
def get_user_posts(user_id):
    """Получение постов пользователя"""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)

        print(f"📝 Getting posts for user: {user_id}, limit: {limit}, offset: {offset}")

        query = """
            SELECT p.*, 
                   u.username, u.display_name, u.avatar_url,
                   COALESCE(pl.likes_count, 0) as likes_count,
                   COALESCE(c.comments_count, 0) as comments_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as likes_count
                FROM post_likes
                GROUP BY post_id
            ) pl ON p.id = pl.post_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as comments_count
                FROM comments
                GROUP BY post_id
            ) c ON p.id = c.post_id
            WHERE p.user_id = %s
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s
        """

        posts = db_service.execute_query(query, [user_id, limit, offset], fetch_all=True)

        print(f"📊 Found {len(posts) if posts else 0} posts")

        if not posts:
            posts = []

        # Конвертируем даты в строки для JSON
        for post in posts:
            if post.get('created_at'):
                post['created_at'] = post['created_at'].isoformat()
            if post.get('updated_at'):
                post['updated_at'] = post['updated_at'].isoformat()

        # Проверяем лайки для текущего пользователя
        auth_header = request.headers.get('Authorization')
        current_user = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            current_user = get_user_from_token(token)

        for post in posts:
            post['is_liked'] = False
            if current_user:
                like_check = db_service.execute_query(
                    "SELECT id FROM post_likes WHERE post_id = %s AND user_id = %s",
                    [post['id'], current_user['id']],
                    fetch_one=True
                )
                post['is_liked'] = like_check is not None

        return jsonify(posts), 200

    except Exception as e:
        print(f"❌ Error getting posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@posts_bp.route('/feed', methods=['GET'])
def get_feed():
    """Получение ленты постов (посты друзей)"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)

    query = """
        SELECT p.*, 
               u.username, u.display_name, u.avatar_url,
               COUNT(DISTINCT pl.id) as likes_count,
               COUNT(DISTINCT c.id) as comments_count,
               CASE WHEN f.follower_id IS NOT NULL THEN true ELSE false END as is_following
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN post_likes pl ON p.id = pl.post_id
        LEFT JOIN comments c ON p.id = c.post_id
        LEFT JOIN follows f ON f.following_id = u.id AND f.follower_id = %s
        WHERE p.user_id = %s OR f.follower_id IS NOT NULL
        GROUP BY p.id, u.id, f.follower_id
        ORDER BY p.created_at DESC
        LIMIT %s OFFSET %s
    """

    posts = db_service.execute_query(query, [user['id'], user['id'], limit, offset])

    # Проверяем лайки для текущего пользователя
    for post in posts:
        like_check = db_service.execute_query(
            "SELECT id FROM post_likes WHERE post_id = %s AND user_id = %s",
            [post['id'], user['id']],
            fetch_one=True
        )
        post['is_liked'] = like_check is not None

    return jsonify(posts), 200


@posts_bp.route('/posts/<post_id>/like', methods=['POST'])
def like_post(post_id):
    """Поставить/убрать лайк"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    # Проверяем, есть ли уже лайк
    existing = db_service.execute_query(
        "SELECT id FROM post_likes WHERE post_id = %s AND user_id = %s",
        [post_id, user['id']],
        fetch_one=True
    )

    if existing:
        # Убираем лайк
        db_service.execute_query(
            "DELETE FROM post_likes WHERE post_id = %s AND user_id = %s",
            [post_id, user['id']]
        )
        action = 'unliked'
    else:
        # Добавляем лайк
        like_id = uuid.uuid4()
        db_service.execute_query(
            "INSERT INTO post_likes (id, post_id, user_id) VALUES (%s, %s, %s)",
            [str(like_id), post_id, user['id']]
        )
        action = 'liked'

    # Обновляем счетчик лайков
    count = db_service.execute_query(
        "SELECT COUNT(*) as count FROM post_likes WHERE post_id = %s",
        [post_id],
        fetch_one=True
    )

    db_service.execute_query(
        "UPDATE posts SET likes_count = %s, updated_at = %s WHERE id = %s",
        [count['count'], datetime.now(), post_id]
    )

    return jsonify({
        'action': action,
        'likes_count': count['count']
    }), 200


@posts_bp.route('/posts/<post_id>', methods=['PUT'])
def update_post(post_id):
    """Обновление поста"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    data = request.get_json()
    content = data.get('content')

    if not content:
        return jsonify({'error': 'Пост не может быть пустым'}), 400

    # Проверяем, что пост принадлежит пользователю
    post_check = db_service.execute_query(
        "SELECT user_id FROM posts WHERE id = %s",
        [post_id],
        fetch_one=True
    )

    if not post_check:
        return jsonify({'error': 'Пост не найден'}), 404

    if post_check['user_id'] != user['id']:
        return jsonify({'error': 'Нет прав на редактирование'}), 403

    now = datetime.now()

    query = """
        UPDATE posts 
        SET content = %s, updated_at = %s
        WHERE id = %s
        RETURNING id, user_id, content, post_type, media_urls, created_at, updated_at
    """

    try:
        updated_post = db_service.execute_query(
            query,
            [content, now, post_id],
            fetch_one=True
        )

        if updated_post:
            # Получаем ПОЛНЫЕ данные пользователя
            full_user = db_service.execute_query(
                "SELECT id, username, display_name, avatar_url FROM users WHERE id = %s",
                [updated_post['user_id']],
                fetch_one=True
            )

            response_post = {
                'id': updated_post['id'],
                'user_id': updated_post['user_id'],
                'content': updated_post['content'],
                'post_type': updated_post['post_type'],
                'media_urls': updated_post['media_urls'],
                'created_at': updated_post['created_at'].isoformat() if updated_post['created_at'] else None,
                'updated_at': updated_post['updated_at'].isoformat() if updated_post['updated_at'] else None,
                'username': full_user['username'],
                'display_name': full_user['display_name'],
                'avatar_url': full_user['avatar_url'],
            }

        return jsonify(response_post), 200

    except Exception as e:
        print(f"❌ Error updating post: {e}")
        return jsonify({'error': str(e)}), 500


@posts_bp.route('/posts/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    """Удаление поста"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    # Проверяем, что пост принадлежит пользователю
    post_check = db_service.execute_query(
        "SELECT user_id FROM posts WHERE id = %s",
        [post_id],
        fetch_one=True
    )

    if not post_check:
        return jsonify({'error': 'Пост не найден'}), 404

    if post_check['user_id'] != user['id']:
        return jsonify({'error': 'Нет прав на удаление'}), 403

    try:
        # Удаляем лайки поста
        db_service.execute_query(
            "DELETE FROM post_likes WHERE post_id = %s",
            [post_id]
        )

        # Удаляем комментарии поста
        db_service.execute_query(
            "DELETE FROM comments WHERE post_id = %s",
            [post_id]
        )

        # Удаляем пост
        db_service.execute_query(
            "DELETE FROM posts WHERE id = %s",
            [post_id]
        )

        return jsonify({'message': 'Пост удален'}), 200

    except Exception as e:
        print(f"❌ Error deleting post: {e}")
        return jsonify({'error': str(e)}), 500