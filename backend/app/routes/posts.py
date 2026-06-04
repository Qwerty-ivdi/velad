from flask import Blueprint, request, jsonify, current_app
from app.services.db_service import db_service
from app.config import Config
import uuid
from datetime import datetime
import os
import base64
import json
from pathlib import Path

# Настройки для загрузки
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

posts_bp = Blueprint('posts', __name__)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def ensure_array(value):
    """Гарантирует, что значение является массивом"""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        # Пробуем распарсить как JSON
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
            return [parsed] if parsed else []
        except:
            # Если не JSON, возможно это уже data:image строка
            if value.startswith('data:image'):
                return [value]
            return []
    if isinstance(value, dict):
        return list(value.values()) if value else []
    return []


@posts_bp.route('/upload', methods=['POST'])
def upload_image():
    """Загрузка изображения — сохраняем как base64"""
    print("=" * 50)
    print("🔥 UPLOAD IMAGE CALLED")

    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]

    try:
        import jwt
        payload = jwt.decode(
            token,
            current_app.config['SECRET_KEY'],
            algorithms=['HS256']
        )
        user_id = payload.get('sub')
        if not user_id:
            return jsonify({'error': 'Неверный токен'}), 401

        user = db_service.execute_query(
            "SELECT id, username, display_name, avatar_url FROM users WHERE id = %s",
            [user_id], fetch_one=True
        )
        if not user:
            return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        print(f"❌ Error decoding token: {e}")
        return jsonify({'error': 'Authentication failed'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'Нет файла'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Файл не выбран'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Неподдерживаемый формат файла'}), 400

    file_data = file.read()
    file_size = len(file_data)

    if file_size > MAX_FILE_SIZE:
        return jsonify({'error': f'Файл слишком большой. Максимум {MAX_FILE_SIZE // (1024 * 1024)}MB'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    mime_map = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }
    mime_type = mime_map.get(ext, 'image/jpeg')

    base64_string = base64.b64encode(file_data).decode('utf-8')
    data_url = f"data:{mime_type};base64,{base64_string}"

    print(f"✅ Image converted to base64, size: {len(data_url)} chars")

    return jsonify({
        'url': data_url,
        'filename': file.filename
    }), 200


def get_user_from_token(token):
    """Получение пользователя из JWT токена"""
    import jwt
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload.get('sub')
        if user_id:
            user = db_service.execute_query(
                "SELECT id, username, display_name, avatar_url FROM users WHERE id = %s",
                [user_id], fetch_one=True
            )
            return user
        return None
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

    # Гарантируем, что media_urls - массив
    if not isinstance(media_urls, list):
        media_urls = [media_urls] if media_urls else []

    if not content and not media_urls:
        return jsonify({'error': 'Пост не может быть пустым'}), 400

    post_id = uuid.uuid4()
    now = datetime.now()

    # Преобразуем массив в JSON строку для PostgreSQL
    media_json = json.dumps(media_urls)

    query = """
        INSERT INTO posts (id, user_id, content, post_type, media_urls, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
        RETURNING id, user_id, content, post_type, media_urls, created_at, updated_at
    """

    try:
        post = db_service.execute_query(
            query,
            [str(post_id), user['id'], content, post_type, media_json, now, now],
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

        # Нормализуем media_urls в ответе
        returned_media = ensure_array(post.get('media_urls'))

        response_post = {
            'id': post['id'],
            'user_id': post['user_id'],
            'content': post['content'],
            'post_type': post['post_type'],
            'media_urls': returned_media,
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

        # Нормализуем media_urls
        post['media_urls'] = ensure_array(post.get('media_urls'))

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

        posts = db_service.execute_query("""
            SELECT 
                p.id, p.user_id, p.content, p.post_type, p.media_urls,
                p.likes_count, p.comments_count, p.reposts_count,
                p.created_at, p.updated_at,
                u.username, u.display_name, u.avatar_url,
                NULL as repost_of, NULL as repost_comment,
                NULL as original_author_id, NULL as original_author_name,
                NULL as original_author_username, NULL as original_author_avatar,
                NULL as original_content
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = %s
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s
        """, [user_id, limit, offset], fetch_all=True)

        # Нормализуем media_urls для каждого поста
        for post in posts:
            post['media_urls'] = ensure_array(post.get('media_urls'))

        return jsonify(posts or []), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@posts_bp.route('/feed', methods=['GET'])
def get_feed():
    """Лента постов (включая репосты подписок)"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)

    following = db_service.execute_query(
        "SELECT following_id FROM follows WHERE follower_id = %s",
        [user['id']], fetch_all=True
    )
    following_ids = [f['following_id'] for f in following] + [user['id']]

    if not following_ids:
        return jsonify([]), 200

    placeholders = ','.join(['%s'] * len(following_ids))

    query = f"""
        SELECT 
            p.id as post_id,
            p.user_id as author_id,
            p.content,
            p.media_urls,
            p.likes_count,
            p.comments_count,
            p.reposts_count,
            p.created_at,
            u.username as author_username,
            u.display_name as author_display_name,
            u.avatar_url as author_avatar,
            r.id as repost_id,
            r.content as repost_comment,
            r.original_post_id,
            ou.id as original_author_id,
            ou.username as original_author_username,
            ou.display_name as original_author_display_name,
            ou.avatar_url as original_author_avatar,
            op.content as original_content,
            op.media_urls as original_media_urls,
            CASE WHEN pl.id IS NOT NULL THEN true ELSE false END as is_liked,
            CASE WHEN r2.id IS NOT NULL THEN true ELSE false END as is_reposted
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN reposts r ON r.user_id = u.id AND r.original_post_id = p.id
        LEFT JOIN posts op ON r.original_post_id = op.id
        LEFT JOIN users ou ON op.user_id = ou.id
        LEFT JOIN post_likes pl ON pl.post_id = COALESCE(r.id, p.id) AND pl.user_id = %s
        LEFT JOIN reposts r2 ON r2.original_post_id = COALESCE(r.original_post_id, p.id) AND r2.user_id = %s
        WHERE p.user_id IN ({placeholders})
        ORDER BY p.created_at DESC
        LIMIT %s OFFSET %s
    """

    params = [user['id'], user['id']] + following_ids + [limit, offset]
    results = db_service.execute_query(query, params, fetch_all=True)

    posts = []
    for row in results:
        if row.get('repost_id'):
            posts.append({
                'id': row['repost_id'],
                'user_id': row['author_id'],
                'type': 'repost',
                'repost_of': row['original_post_id'],
                'repost_comment': row['repost_comment'] or '',
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'likes_count': row['likes_count'] or 0,
                'comments_count': row['comments_count'] or 0,
                'reposts_count': row['reposts_count'] or 0,
                'is_liked': row['is_liked'] or False,
                'is_reposted': row['is_reposted'] or False,
                'display_name': row['author_display_name'],
                'username': row['author_username'],
                'avatar_url': row['author_avatar'],
                'original_author_id': row['original_author_id'],
                'original_author_name': row['original_author_display_name'],
                'original_author_username': row['original_author_username'],
                'original_author_avatar': row['original_author_avatar'],
                'original_content': row['original_content'],
                'original_media_urls': ensure_array(row.get('original_media_urls'))
            })
        else:
            posts.append({
                'id': row['post_id'],
                'user_id': row['author_id'],
                'type': 'post',
                'content': row['content'],
                'media_urls': ensure_array(row.get('media_urls')),
                'likes_count': row['likes_count'] or 0,
                'comments_count': row['comments_count'] or 0,
                'reposts_count': row['reposts_count'] or 0,
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'is_liked': row['is_liked'] or False,
                'is_reposted': row['is_reposted'] or False,
                'display_name': row['author_display_name'],
                'username': row['author_username'],
                'avatar_url': row['author_avatar']
            })

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

    existing = db_service.execute_query(
        "SELECT id FROM post_likes WHERE post_id = %s AND user_id = %s",
        [post_id, user['id']],
        fetch_one=True
    )

    if existing:
        db_service.execute_query(
            "DELETE FROM post_likes WHERE post_id = %s AND user_id = %s",
            [post_id, user['id']]
        )
        action = 'unliked'
    else:
        like_id = uuid.uuid4()
        db_service.execute_query(
            "INSERT INTO post_likes (id, post_id, user_id) VALUES (%s, %s, %s)",
            [str(like_id), post_id, user['id']]
        )
        action = 'liked'

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
                'media_urls': ensure_array(updated_post.get('media_urls')),
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
        db_service.execute_query(
            "DELETE FROM post_likes WHERE post_id = %s",
            [post_id]
        )
        db_service.execute_query(
            "DELETE FROM comments WHERE post_id = %s",
            [post_id]
        )
        db_service.execute_query(
            "DELETE FROM posts WHERE id = %s",
            [post_id]
        )

        return jsonify({'message': 'Пост удален'}), 200

    except Exception as e:
        print(f"❌ Error deleting post: {e}")
        return jsonify({'error': str(e)}), 500


@posts_bp.route('/posts/<post_id>/comments', methods=['GET'])
def get_comments(post_id):
    """Получить комментарии к посту с иерархией ответов"""
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)

        # Получаем корневые комментарии (без parent_id)
        root_comments = db_service.execute_query("""
            SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, 
                   c.level, c.replies_count, c.created_at, c.updated_at,
                   u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes_count
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = %s AND c.parent_id IS NULL
            ORDER BY c.created_at DESC
            LIMIT %s OFFSET %s
        """, [post_id, limit, offset], fetch_all=True)

        # Получаем текущего пользователя для проверки лайков
        auth_header = request.headers.get('Authorization')
        current_user = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            current_user = get_user_from_token(token)

        # Для каждого корневого комментария получаем ответы
        for comment in root_comments:
            comment['is_liked'] = False
            if current_user:
                like_check = db_service.execute_query(
                    "SELECT id FROM comment_likes WHERE comment_id = %s AND user_id = %s",
                    [comment['id'], current_user['id']],
                    fetch_one=True
                )
                comment['is_liked'] = like_check is not None

            # Получаем ответы на комментарий
            comment['replies'] = get_comment_replies(comment['id'], current_user)

        return jsonify(root_comments or []), 200

    except Exception as e:
        print(f"❌ Error getting comments: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def get_comment_replies(comment_id, current_user=None, max_depth=3):
    """Рекурсивно получить все ответы на комментарий"""
    try:
        replies = db_service.execute_query("""
            SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, 
                   c.level, c.replies_count, c.created_at, c.updated_at,
                   u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes_count
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.parent_id = %s
            ORDER BY c.created_at ASC
        """, [comment_id], fetch_all=True)

        for reply in replies:
            reply['is_liked'] = False
            if current_user:
                like_check = db_service.execute_query(
                    "SELECT id FROM comment_likes WHERE comment_id = %s AND user_id = %s",
                    [reply['id'], current_user['id']],
                    fetch_one=True
                )
                reply['is_liked'] = like_check is not None

            # Рекурсивно получаем ответы на ответы (до max_depth)
            if reply['level'] < max_depth:
                reply['replies'] = get_comment_replies(reply['id'], current_user, max_depth)
            else:
                reply['replies'] = []

        return replies
    except Exception as e:
        print(f"❌ Error getting replies: {e}")
        return []


@posts_bp.route('/posts/<post_id>/comments', methods=['POST'])
def create_comment(post_id):
    """Создать комментарий или ответ на комментарий"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    data = request.get_json()
    content = data.get('content', '').strip()
    parent_id = data.get('parent_id')  # может быть None для корневых комментариев

    if not content:
        return jsonify({'error': 'Комментарий не может быть пустым'}), 400

    # Проверяем, существует ли пост
    post_check = db_service.execute_query(
        "SELECT id FROM posts WHERE id = %s",
        [post_id],
        fetch_one=True
    )

    if not post_check:
        return jsonify({'error': 'Пост не найден'}), 404

    # Если это ответ на комментарий, проверяем существование родительского комментария
    if parent_id:
        parent_check = db_service.execute_query(
            "SELECT id, level FROM comments WHERE id = %s AND post_id = %s",
            [parent_id, post_id],
            fetch_one=True
        )

        if not parent_check:
            return jsonify({'error': 'Родительский комментарий не найден'}), 404

        # Проверяем глубину вложенности (максимум 3 уровня)
        if parent_check['level'] >= 3:
            return jsonify({'error': 'Максимальная глубина вложенности комментариев - 3 уровня'}), 400

    comment_id = uuid.uuid4()
    now = datetime.now()

    query = """
        INSERT INTO comments (id, post_id, user_id, parent_id, content, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id, post_id, user_id, parent_id, content, level, replies_count, created_at, updated_at
    """

    try:
        comment = db_service.execute_query(
            query,
            [str(comment_id), post_id, user['id'], parent_id, content, now, now],
            fetch_one=True
        )

        # Добавляем данные пользователя
        comment['username'] = user['username']
        comment['display_name'] = user['display_name']
        comment['avatar_url'] = user['avatar_url']
        comment['likes_count'] = 0
        comment['is_liked'] = False
        comment['replies'] = []

        # Обновляем счетчик комментариев в посте
        comments_count = db_service.execute_query(
            "SELECT COUNT(*) as count FROM comments WHERE post_id = %s",
            [post_id],
            fetch_one=True
        )
        db_service.execute_query(
            "UPDATE posts SET comments_count = %s, updated_at = %s WHERE id = %s",
            [comments_count['count'], now, post_id]
        )

        return jsonify(comment), 201

    except Exception as e:
        print(f"❌ Error creating comment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@posts_bp.route('/comments/<comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    """Удалить комментарий и все его ответы"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    # Проверяем, принадлежит ли комментарий пользователю
    comment_check = db_service.execute_query(
        "SELECT post_id, user_id FROM comments WHERE id = %s",
        [comment_id],
        fetch_one=True
    )

    if not comment_check:
        return jsonify({'error': 'Комментарий не найден'}), 404

    if comment_check['user_id'] != user['id']:
        return jsonify({'error': 'Нет прав на удаление'}), 403

    post_id = comment_check['post_id']

    # Удаляем все лайки комментария и его ответов
    # Это автоматически сделает ON DELETE CASCADE

    # Удаляем комментарий (все ответы удалятся по CASCADE)
    db_service.execute_query(
        "DELETE FROM comments WHERE id = %s",
        [comment_id]
    )

    # Обновляем счетчик комментариев в посте
    comments_count = db_service.execute_query(
        "SELECT COUNT(*) as count FROM comments WHERE post_id = %s",
        [post_id],
        fetch_one=True
    )
    db_service.execute_query(
        "UPDATE posts SET comments_count = %s WHERE id = %s",
        [comments_count['count'], post_id]
    )

    return jsonify({'message': 'Комментарий удален'}), 200


@posts_bp.route('/comments/<comment_id>/like', methods=['POST'])
def like_comment(comment_id):
    """Лайк/дизлайк комментария"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    # Проверяем, существует ли комментарий
    comment_check = db_service.execute_query(
        "SELECT id FROM comments WHERE id = %s",
        [comment_id],
        fetch_one=True
    )

    if not comment_check:
        return jsonify({'error': 'Комментарий не найден'}), 404

    # Проверяем, есть ли уже лайк
    existing = db_service.execute_query(
        "SELECT id FROM comment_likes WHERE comment_id = %s AND user_id = %s",
        [comment_id, user['id']],
        fetch_one=True
    )

    if existing:
        # Убираем лайк
        db_service.execute_query(
            "DELETE FROM comment_likes WHERE comment_id = %s AND user_id = %s",
            [comment_id, user['id']]
        )
        action = 'unliked'
    else:
        # Добавляем лайк
        like_id = uuid.uuid4()
        db_service.execute_query(
            "INSERT INTO comment_likes (id, comment_id, user_id) VALUES (%s, %s, %s)",
            [str(like_id), comment_id, user['id']]
        )
        action = 'liked'

    # Получаем обновленное количество лайков
    count = db_service.execute_query(
        "SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = %s",
        [comment_id],
        fetch_one=True
    )

    return jsonify({
        'action': action,
        'likes_count': count['count']
    }), 200


@posts_bp.route('/comments/<comment_id>/replies', methods=['GET'])
def get_comment_replies_endpoint(comment_id):
    """Получить ответы на комментарий"""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)

        auth_header = request.headers.get('Authorization')
        current_user = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            current_user = get_user_from_token(token)

        replies = db_service.execute_query("""
            SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, 
                   c.level, c.replies_count, c.created_at, c.updated_at,
                   u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes_count
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.parent_id = %s
            ORDER BY c.created_at ASC
            LIMIT %s OFFSET %s
        """, [comment_id, limit, offset], fetch_all=True)

        for reply in replies:
            reply['is_liked'] = False
            if current_user:
                like_check = db_service.execute_query(
                    "SELECT id FROM comment_likes WHERE comment_id = %s AND user_id = %s",
                    [reply['id'], current_user['id']],
                    fetch_one=True
                )
                reply['is_liked'] = like_check is not None

        return jsonify(replies or []), 200

    except Exception as e:
        print(f"❌ Error getting replies: {e}")
        return jsonify({'error': str(e)}), 500


@posts_bp.route('/posts/<post_id>/repost', methods=['POST'])
def repost_post(post_id):
    """Создать репост поста"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    data = request.get_json()
    content = data.get('content', '')

    # Проверяем, существует ли пост
    original_post = db_service.execute_query(
        "SELECT * FROM posts WHERE id = %s",
        [post_id], fetch_one=True
    )

    if not original_post:
        return jsonify({'error': 'Пост не найден'}), 404

    # Проверяем, не сделал ли пользователь уже репост
    existing = db_service.execute_query(
        "SELECT id FROM reposts WHERE original_post_id = %s AND user_id = %s",
        [post_id, user['id']], fetch_one=True
    )

    if existing:
        return jsonify({'error': 'Вы уже сделали репост этого поста'}), 400

    # Создаем репост
    repost_id = uuid.uuid4()
    now = datetime.now()

    db_service.execute_query("""
        INSERT INTO reposts (id, original_post_id, user_id, content, created_at)
        VALUES (%s, %s, %s, %s, %s)
    """, [str(repost_id), post_id, user['id'], content, now])

    # Обновляем счетчик репостов
    db_service.execute_query(
        "UPDATE posts SET reposts_count = reposts_count + 1 WHERE id = %s",
        [post_id]
    )

    # Получаем автора оригинального поста
    author = db_service.execute_query(
        "SELECT username, display_name FROM users WHERE id = %s",
        [original_post['user_id']], fetch_one=True
    )

    return jsonify({
        'message': 'Репост создан',
        'repost': {
            'id': str(repost_id),
            'original_post_id': post_id,
            'user_id': user['id'],
            'content': content,
            'created_at': now.isoformat(),
            'author': {
                'username': user['username'],
                'display_name': user['display_name'],
                'avatar_url': user['avatar_url']
            },
            'original_author': author
        }
    }), 201


@posts_bp.route('/posts/<post_id>/repost', methods=['DELETE'])
def remove_repost(post_id):
    """Удалить репост"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Требуется авторизация'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'Неверный токен'}), 401

    db_service.execute_query(
        "DELETE FROM reposts WHERE original_post_id = %s AND user_id = %s",
        [post_id, user['id']]
    )

    # Обновляем счетчик репостов
    db_service.execute_query(
        "UPDATE posts SET reposts_count = reposts_count - 1 WHERE id = %s",
        [post_id]
    )

    return jsonify({'message': 'Репост удален'}), 200


@posts_bp.route('/posts/<post_id>/reposts', methods=['GET'])
def get_reposts(post_id):
    """Получить список репостов поста"""
    try:
        reposts = db_service.execute_query("""
            SELECT r.*, u.username, u.display_name, u.avatar_url
            FROM reposts r
            JOIN users u ON r.user_id = u.id
            WHERE r.original_post_id = %s
            ORDER BY r.created_at DESC
        """, [post_id], fetch_all=True)

        return jsonify({'reposts': reposts or []}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@posts_bp.route('/profile/<user_id>/reposts', methods=['GET'])
def get_user_reposts(user_id):
    """Получение репостов пользователя с изображениями"""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)

        reposts = db_service.execute_query("""
            SELECT 
                r.id, r.user_id, r.original_post_id, r.content as repost_comment,
                r.created_at,
                u.username, u.display_name, u.avatar_url,
                op.content as original_content,
                op.media_urls as original_media_urls,
                op.post_type as original_post_type,
                ou.id as original_author_id,
                ou.username as original_author_username,
                ou.display_name as original_author_name,
                ou.avatar_url as original_author_avatar,
                op.likes_count as original_likes_count,
                op.comments_count as original_comments_count,
                op.reposts_count as original_reposts_count
            FROM reposts r
            JOIN users u ON r.user_id = u.id
            JOIN posts op ON r.original_post_id = op.id
            JOIN users ou ON op.user_id = ou.id
            WHERE r.user_id = %s
            ORDER BY r.created_at DESC
            LIMIT %s OFFSET %s
        """, [user_id, limit, offset], fetch_all=True)

        # Форматируем как посты для фронтенда
        formatted = []
        for r in reposts:
            formatted.append({
                'id': r['id'],
                'user_id': r['user_id'],
                'type': 'repost',
                'repost_of': r['original_post_id'],
                'repost_comment': r['repost_comment'] or '',
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'display_name': r['display_name'],
                'username': r['username'],
                'avatar_url': r['avatar_url'],
                'original_author_id': r['original_author_id'],
                'original_author_name': r['original_author_name'],
                'original_author_username': r['original_author_username'],
                'original_author_avatar': r['original_author_avatar'],
                'original_content': r['original_content'],
                'original_media_urls': r['original_media_urls'] or [],  # ← ДОБАВЛЕНО!
                'original_post_type': r['original_post_type'],
                'likes_count': 0,
                'comments_count': 0,
                'reposts_count': 0,
                'is_liked': False,
                'is_reposted': True
            })

        return jsonify(formatted), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e)}), 500