# app/socket_handlers.py
from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from datetime import datetime
import uuid


def register_socket_handlers(socketio, db_service):
    @socketio.on('connect')
    def handle_connect():
        """Клиент подключился"""
        print(f"🔌 Client connected: {request.sid}")
        emit('connected', {'message': 'Connected to server'})

    @socketio.on('disconnect')
    def handle_disconnect():
        """Клиент отключился"""
        print(f"🔌 Client disconnected: {request.sid}")

    @socketio.on('authenticate')
    def handle_authenticate(data):
        """Аутентификация клиента"""
        token = data.get('token')
        if not token:
            emit('auth_error', {'error': 'No token provided'})
            return

        try:
            # Декодируем JWT
            payload = decode_token(token)
            user_id = payload.get('sub')

            if not user_id:
                emit('auth_error', {'error': 'Invalid token'})
                return

            # Сохраняем user_id в сессии
            from flask import session
            session['user_id'] = user_id

            # Присоединяем к комнате пользователя
            join_room(user_id)

            print(f"✅ User {user_id} authenticated")
            emit('authenticated', {'user_id': user_id})
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            emit('auth_error', {'error': str(e)})

    @socketio.on('send_message')
    def handle_send_message(data):
        """Отправка сообщения"""
        try:
            token = data.get('token')
            receiver_id = data.get('receiver_id')
            content = data.get('content')

            if not token or not receiver_id or not content:
                emit('error', {'error': 'Missing fields'})
                return

            # Декодируем токен
            payload = decode_token(token)
            sender_id = payload.get('sub')

            if not sender_id:
                emit('error', {'error': 'Invalid token'})
                return

            print(f"📨 Sending message from {sender_id} to {receiver_id}: {content}")

            # Сохраняем в БД
            message_id = uuid.uuid4()
            now = datetime.now()

            # Находим или создаем диалог
            conv = db_service.execute_query("""
                SELECT id FROM conversations 
                WHERE (participant1_id = %s AND participant2_id = %s)
                   OR (participant1_id = %s AND participant2_id = %s)
            """, [sender_id, receiver_id, receiver_id, sender_id], fetch_one=True)

            if not conv:
                conv_id = uuid.uuid4()
                db_service.execute_query("""
                    INSERT INTO conversations (id, participant1_id, participant2_id, created_at, last_message_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, [str(conv_id), sender_id, receiver_id, now, now])
                conversation_id = str(conv_id)
            else:
                conversation_id = conv['id']

            # Сохраняем сообщение
            db_service.execute_query("""
                INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, [str(message_id), conversation_id, sender_id, content, now])

            # Обновляем последнее сообщение
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

            message_data = {
                'id': str(message_id),
                'sender_id': sender_id,
                'receiver_id': receiver_id,
                'content': content,
                'created_at': now.isoformat(),
                'sender_username': sender_data.get('username'),
                'sender_display_name': sender_data.get('display_name'),
                'sender_avatar_url': sender_data.get('avatar_url')
            }

            # Отправляем получателю
            emit('new_message', message_data, room=receiver_id)
            # Подтверждаем отправителю
            emit('message_sent', message_data, room=sender_id)

            print(f"✅ Message sent")

        except Exception as e:
            print(f"❌ Error sending message: {e}")
            import traceback
            traceback.print_exc()
            emit('error', {'error': str(e)})