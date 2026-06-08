from flask_socketio import emit, join_room
from flask_jwt_extended import decode_token
from flask import request
import uuid
from datetime import datetime

socket_users = {}  # sid → user_id


def register_socket_handlers(socketio, db_service):
    @socketio.on('connect')
    def handle_connect():
        print(f"🔌 Client connected: {request.sid}")

    @socketio.on('disconnect')
    def handle_disconnect():
        if request.sid in socket_users:
            user_id = socket_users[request.sid]
            print(f"🔌 User {user_id} disconnected")
            del socket_users[request.sid]

    @socketio.on('authenticate')
    def handle_auth(data):
        token = data.get('token')
        try:
            payload = decode_token(token)
            user_id = payload.get('sub')
            socket_users[request.sid] = user_id
            print(f"✅ User {user_id} authenticated, sid: {request.sid}")
            emit('authenticated', {'user_id': user_id})
        except Exception as e:
            print(f"❌ Auth error: {e}")
            emit('auth_error', {'error': str(e)})

    @socketio.on('join_room')
    def handle_join_room(data):
        """Вход в комнату (диалог)"""
        room_id = data.get('room_id')
        if room_id:
            join_room(room_id)
            user_id = socket_users.get(request.sid, 'unknown')
            print(f"✅ User {user_id} joined room: {room_id}")
            emit('joined', {'room_id': room_id})

    @socketio.on('send_message')
    def handle_send_message(data):
        try:
            sender_id = socket_users.get(request.sid)
            receiver_id = data.get('receiver_id')
            content = data.get('content')

            if not sender_id or not receiver_id or not content:
                emit('error', {'error': 'Missing fields'}, room=request.sid)
                return

            print(f"📨 Private message from {sender_id} to {receiver_id}: {content[:50]}")

            # Находим или создаём диалог
            conv = db_service.execute_query("""
                SELECT id FROM conversations 
                WHERE (participant1_id = %s AND participant2_id = %s)
                   OR (participant1_id = %s AND participant2_id = %s)
            """, [sender_id, receiver_id, receiver_id, sender_id], fetch_one=True)

            if conv:
                conversation_id = conv['id']
            else:
                conv_id = uuid.uuid4()
                now = datetime.now()
                db_service.execute_query("""
                    INSERT INTO conversations (id, participant1_id, participant2_id, created_at, last_message_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, [str(conv_id), sender_id, receiver_id, now, now])
                conversation_id = str(conv_id)

            # Сохраняем сообщение в БД
            message_id = uuid.uuid4()
            now = datetime.now()
            db_service.execute_query("""
                INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, [str(message_id), conversation_id, sender_id, content, now])

            # Обновляем последнее сообщение в диалоге
            db_service.execute_query("""
                UPDATE conversations 
                SET last_message = %s, last_message_at = %s 
                WHERE id = %s
            """, [content, now, conversation_id])

            # Получаем данные отправителя
            sender_data = db_service.execute_query(
                "SELECT id, username, display_name, avatar_url FROM users WHERE id = %s",
                [sender_id], fetch_one=True
            )

            # Формируем сообщение для отправки
            message_data = {
                'id': str(message_id),
                'sender_id': sender_id,
                'receiver_id': receiver_id,
                'conversation_id': conversation_id,
                'content': content,
                'created_at': now.isoformat(),
                'sender_username': sender_data.get('username'),
                'sender_display_name': sender_data.get('display_name'),
                'sender_avatar_url': sender_data.get('avatar_url')
            }

            # ✅ ОТПРАВЛЯЕМ В КОМНАТУ ДИАЛОГА (ОБЩУЮ ДЛЯ ДВУХ ПОЛЬЗОВАТЕЛЕЙ)
            room_name = f"conversation_{conversation_id}"
            emit('new_message', message_data, room=room_name)

            # Отправляем подтверждение отправителю
            emit('message_sent', message_data, room=request.sid)

            print(f"✅ Message sent to room: {room_name}")

        except Exception as e:
            print(f"❌ Error in send_message: {e}")
            import traceback
            traceback.print_exc()
            emit('error', {'error': str(e)}, room=request.sid)