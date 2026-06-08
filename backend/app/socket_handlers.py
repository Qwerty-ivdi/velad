from flask_socketio import emit, join_room
from flask_jwt_extended import decode_token
from flask import request


socket_users = {}  # sid → user_id


def register_socket_handlers(socketio, db_service):
    @socketio.on('authenticate')
    def handle_auth(data):
        token = data.get('token')
        payload = decode_token(token)
        user_id = payload.get('sub')
        socket_users[request.sid] = user_id
        emit('authenticated', {'user_id': user_id})

    @socketio.on('join_conversation')
    def handle_join(data):
        conv_id = data.get('conversation_id')
        if conv_id:
            join_room(conv_id)
            emit('joined', {'conversation_id': conv_id})

    @socketio.on('private_message')
    def handle_private_message(data):
        sender_id = socket_users.get(request.sid)
        receiver_id = data.get('receiver_id')
        content = data.get('content')

        # Находим conversation_id по участникам
        conv = db_service.execute_query("""
            SELECT id FROM conversations 
            WHERE (participant1_id = %s AND participant2_id = %s)
               OR (participant1_id = %s AND participant2_id = %s)
        """, [sender_id, receiver_id, receiver_id, sender_id], fetch_one=True)

        if conv:
            conversation_id = conv['id']

            # Сохраняем в БД
            db_service.execute_query("""
                INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, [str(uuid.uuid4()), conversation_id, sender_id, content, datetime.now()])

            # Отправляем в комнату диалога
            emit('new_message', {
                'sender_id': sender_id,
                'content': content,
                'conversation_id': conversation_id
            }, room=conversation_id)