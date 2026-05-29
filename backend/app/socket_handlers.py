from flask_socketio import emit, join_room, leave_room
from flask import request, current_app
import jwt
import uuid
from datetime import datetime
from app.services.db_service import db_service

active_users = {}


def get_user_from_token(token):
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload.get('user_id')
    except Exception as e:
        print(f"Token decode error: {e}")
        return None


def register_socket_handlers(socketio, db_service):
    @socketio.on('connect')
    def handle_connect():
        token = request.args.get('token')
        print(f"🔌 Connect attempt with token: {token[:50]}..." if token else "No token")
        user_id = get_user_from_token(token)

        if user_id:
            active_users[request.sid] = user_id
            user_room = f'user_{user_id}'
            join_room(user_room)
            print(f"✅ User {user_id} connected, joined room {user_room}")
            emit('connected', {'message': 'Connected', 'user_id': user_id})
            return True
        print(f"❌ Connection rejected: invalid token")
        return False

    @socketio.on('disconnect')
    def handle_disconnect():
        user_id = active_users.pop(request.sid, None)
        if user_id:
            print(f"🔌 User {user_id} disconnected")
            emit('user_offline', {'user_id': user_id}, broadcast=True)

    @socketio.on('send_message')
    def handle_send_message(data):
        print("=" * 60)
        print("🔥 SEND_MESSAGE event received!")
        print(f"📦 Data: {data}")

        token = data.get('token')
        if not token:
            print("❌ No token in data")
            return

        sender_id = get_user_from_token(token)
        print(f"👤 Sender ID: {sender_id}")

        receiver_id = data.get('receiver_id')
        content = data.get('content', '').strip()

        print(f"📨 Receiver ID: {receiver_id}")
        print(f"💬 Content: {content}")

        if not sender_id or not receiver_id or not content:
            print("❌ Missing required fields")
            emit('error', {'message': 'Invalid data'})
            return

        # Находим или создаем диалог
        conv = db_service.execute_query("""
            SELECT id FROM conversations 
            WHERE (participant1_id = %s AND participant2_id = %s)
               OR (participant1_id = %s AND participant2_id = %s)
        """, [sender_id, receiver_id, receiver_id, sender_id], fetch_one=True)

        if not conv:
            conv_id = uuid.uuid4()
            now = datetime.now()
            db_service.execute_query("""
                INSERT INTO conversations (id, participant1_id, participant2_id, created_at, last_message_at)
                VALUES (%s, %s, %s, %s, %s)
            """, [str(conv_id), sender_id, receiver_id, now, now])
            conversation_id = str(conv_id)
            print(f"📁 Created new conversation: {conversation_id}")
        else:
            conversation_id = conv['id']
            print(f"📁 Existing conversation: {conversation_id}")

        # Сохраняем сообщение
        message_id = uuid.uuid4()
        now = datetime.now()
        db_service.execute_query("""
            INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
            VALUES (%s, %s, %s, %s, %s)
        """, [str(message_id), conversation_id, sender_id, content, now])
        print(f"💾 Message saved with ID: {message_id}")

        # Обновляем последнее сообщение
        db_service.execute_query("""
            UPDATE conversations SET last_message = %s, last_message_at = %s WHERE id = %s
        """, [content, now, conversation_id])

        # Получаем данные отправителя
        sender = db_service.execute_query(
            "SELECT id, username, display_name, avatar_url FROM users WHERE id = %s",
            [sender_id], fetch_one=True
        )

        message_data = {
            'id': str(message_id),
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'content': content,
            'created_at': now.isoformat(),
            'sender_username': sender['username'],
            'sender_display_name': sender['display_name'],
            'sender_avatar_url': sender['avatar_url']
        }

        # Отправляем получателю
        receiver_room = f'user_{receiver_id}'
        print(f"📤 Emitting 'new_message' to room: {receiver_room}")
        socketio.emit('new_message', message_data, room=receiver_room)

        # Подтверждаем отправителю
        print(f"📤 Emitting 'message_sent' to sender")
        socketio.emit('message_sent', message_data, room=request.sid)

        print("=" * 60)

    # Добавь эти функции в register_socket_handlers

    @socketio.on('get_profile')
    def handle_get_profile(data):
        print("🔥 get_profile event received!")  # Добавь для отладки
        token = data.get('token')
        user_id = get_user_from_token(token)
        profile_id = data.get('profile_id', user_id)

        print(f"Token: {token[:50]}...")
        print(f"User ID: {user_id}")
        print(f"Profile ID: {profile_id}")

        if not user_id:
            emit('error', {'message': 'Unauthorized'})
            return

        profile = db_service.execute_query("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, 
                   u.location, u.website, u.is_live, u.created_at,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
                   (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count,
                   EXISTS(SELECT 1 FROM follows WHERE follower_id = %s AND following_id = u.id) as is_following
            FROM users u
            WHERE u.id = %s
        """, [user_id, profile_id], fetch_one=True)

        print(f"Profile found: {profile is not None}")

        if profile:
            if profile.get('created_at'):
                profile['created_at'] = profile['created_at'].isoformat()
            emit('profile_data', profile)
        else:
            emit('error', {'message': 'Profile not found'})

    @socketio.on('update_profile')
    def handle_update_profile(data):
        """Обновление профиля"""
        token = data.get('token')
        user_id = get_user_from_token(token)

        if not user_id:
            emit('error', {'message': 'Unauthorized'})
            return

        allowed_fields = ['display_name', 'bio', 'location', 'website', 'avatar_url']
        update_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

        if not update_data:
            emit('error', {'message': 'No data to update'})
            return

        set_clause = ", ".join([f"{key} = %s" for key in update_data.keys()])
        values = list(update_data.values())
        values.append(user_id)

        query = f"""
            UPDATE users 
            SET {set_clause}, updated_at = NOW() 
            WHERE id = %s 
            RETURNING id, email, username, display_name, avatar_url, bio, location, website
        """

        updated_user = db_service.execute_query(query, values, fetch_one=True)

        if updated_user:
            # Оповещаем всех подписчиков об обновлении профиля
            emit('profile_updated', {
                'user_id': user_id,
                'profile': updated_user
            }, broadcast=True)

            emit('profile_update_success', updated_user)
        else:
            emit('error', {'message': 'Failed to update profile'})

    @socketio.on('follow_user')
    def handle_follow_user(data):
        """Подписка на пользователя"""
        token = data.get('token')
        follower_id = get_user_from_token(token)
        following_id = data.get('user_id')

        if not follower_id or not following_id:
            emit('error', {'message': 'Invalid data'})
            return

        if follower_id == following_id:
            emit('error', {'message': 'Cannot follow yourself'})
            return

        # Проверяем существование
        existing = db_service.execute_query(
            "SELECT id FROM follows WHERE follower_id = %s AND following_id = %s",
            [follower_id, following_id], fetch_one=True
        )

        if existing:
            emit('error', {'message': 'Already following'})
            return

        follow_id = uuid.uuid4()
        now = datetime.now()
        db_service.execute_query("""
            INSERT INTO follows (id, follower_id, following_id, created_at)
            VALUES (%s, %s, %s, %s)
        """, [str(follow_id), follower_id, following_id, now])

        # Получаем обновленные счетчики
        follower_count = db_service.execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE following_id = %s",
            [following_id], fetch_one=True
        )

        # Оповещаем пользователя о новом подписчике
        following_room = f'user_{following_id}'
        emit('user_followed', {
            'follower_id': follower_id,
            'following_id': following_id,
            'followers_count': follower_count['count']
        }, room=following_room)

        # Отправляем подтверждение подписчику
        emit('follow_success', {
            'following_id': following_id,
            'followers_count': follower_count['count']
        })

    @socketio.on('unfollow_user')
    def handle_unfollow_user(data):
        """Отписка от пользователя"""
        token = data.get('token')
        follower_id = get_user_from_token(token)
        following_id = data.get('user_id')

        if not follower_id or not following_id:
            emit('error', {'message': 'Invalid data'})
            return

        db_service.execute_query(
            "DELETE FROM follows WHERE follower_id = %s AND following_id = %s",
            [follower_id, following_id]
        )

        # Получаем обновленные счетчики
        follower_count = db_service.execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE following_id = %s",
            [following_id], fetch_one=True
        )

        # Оповещаем пользователя
        following_room = f'user_{following_id}'
        emit('user_unfollowed', {
            'follower_id': follower_id,
            'following_id': following_id,
            'followers_count': follower_count['count']
        }, room=following_room)

        emit('unfollow_success', {
            'following_id': following_id,
            'followers_count': follower_count['count']
        })

    @socketio.on('get_followers')
    def handle_get_followers(data):
        """Получение списка подписчиков"""
        token = data.get('token')
        user_id = get_user_from_token(token)
        target_id = data.get('user_id', user_id)

        if not user_id:
            emit('error', {'message': 'Unauthorized'})
            return

        followers = db_service.execute_query("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio,
                   f.created_at as followed_at,
                   EXISTS(SELECT 1 FROM follows WHERE follower_id = %s AND following_id = u.id) as is_following
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            WHERE f.following_id = %s
            ORDER BY f.created_at DESC
            LIMIT %s OFFSET %s
        """, [user_id, target_id, data.get('limit', 20), data.get('offset', 0)], fetch_all=True)

        emit('followers_list', followers or [])

    @socketio.on('get_following')
    def handle_get_following(data):
        """Получение списка подписок"""
        token = data.get('token')
        user_id = get_user_from_token(token)
        target_id = data.get('user_id', user_id)

        if not user_id:
            emit('error', {'message': 'Unauthorized'})
            return

        following = db_service.execute_query("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio,
                   f.created_at as followed_at,
                   EXISTS(SELECT 1 FROM follows WHERE follower_id = %s AND following_id = u.id) as is_following
            FROM follows f
            JOIN users u ON f.following_id = u.id
            WHERE f.follower_id = %s
            ORDER BY f.created_at DESC
            LIMIT %s OFFSET %s
        """, [user_id, target_id, data.get('limit', 20), data.get('offset', 0)], fetch_all=True)

        emit('following_list', following or [])