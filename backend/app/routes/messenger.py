import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from app.services.db_service import db_service
from app.routes.profile import get_user_from_token

messenger_bp = Blueprint('messenger', __name__)


@messenger_bp.route('/conversations', methods=['GET'])
def get_conversations():
    """Получить список диалогов текущего пользователя"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    conversations = db_service.execute_query("""
        SELECT c.*,
               CASE 
                   WHEN c.participant1_id = %s THEN u2.id
                   ELSE u1.id
               END as other_user_id,
               CASE 
                   WHEN c.participant1_id = %s THEN u2.display_name
                   ELSE u1.display_name
               END as other_user_name,
               CASE 
                   WHEN c.participant1_id = %s THEN u2.avatar_url
                   ELSE u1.avatar_url
               END as other_user_avatar,
               c.last_message,
               c.last_message_at,
               (SELECT COUNT(*) FROM messages 
                WHERE conversation_id = c.id AND sender_id != %s AND is_read = FALSE) as unread_count
        FROM conversations c
        JOIN users u1 ON c.participant1_id = u1.id
        JOIN users u2 ON c.participant2_id = u2.id
        WHERE c.participant1_id = %s OR c.participant2_id = %s
        ORDER BY c.last_message_at DESC
    """, [user['id'], user['id'], user['id'], user['id'], user['id'], user['id']], fetch_all=True)

    return jsonify(conversations or []), 200


@messenger_bp.route('/conversations/<conversation_id>/messages', methods=['GET'])
def get_messages(conversation_id):
    """Получить сообщения диалога"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    messages = db_service.execute_query("""
        SELECT m.*, u.username, u.display_name, u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = %s
        ORDER BY m.created_at ASC
        LIMIT 100
    """, [conversation_id], fetch_all=True)

    return jsonify(messages or []), 200


@messenger_bp.route('/conversations/create', methods=['POST'])
def create_conversation():
    """Создать диалог с пользователем"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    other_user_id = data.get('other_user_id')

    if not other_user_id:
        return jsonify({'error': 'other_user_id required'}), 400

    # Проверяем, существует ли уже диалог
    existing = db_service.execute_query("""
        SELECT id FROM conversations 
        WHERE (participant1_id = %s AND participant2_id = %s)
           OR (participant1_id = %s AND participant2_id = %s)
    """, [user['id'], other_user_id, other_user_id, user['id']], fetch_one=True)

    if existing:
        return jsonify({'id': existing['id']}), 200

    # Создаем новый диалог
    conv_id = uuid.uuid4()
    now = datetime.now()
    db_service.execute_query("""
        INSERT INTO conversations (id, participant1_id, participant2_id, created_at, last_message_at)
        VALUES (%s, %s, %s, %s, %s)
    """, [str(conv_id), user['id'], other_user_id, now, now])

    return jsonify({'id': str(conv_id)}), 201


@messenger_bp.route('/messages', methods=['POST'])
def send_message():
    """Отправить сообщение через REST"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    sender = get_user_from_token(token)

    if not sender:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    receiver_id = data.get('receiver_id')
    content = data.get('content', '').strip()

    if not receiver_id or not content:
        return jsonify({'error': 'receiver_id and content required'}), 400

    # Находим или создаем диалог
    conv = db_service.execute_query("""
        SELECT id FROM conversations 
        WHERE (participant1_id = %s AND participant2_id = %s)
           OR (participant1_id = %s AND participant2_id = %s)
    """, [sender['id'], receiver_id, receiver_id, sender['id']], fetch_one=True)

    if not conv:
        conv_id = uuid.uuid4()
        now = datetime.now()
        db_service.execute_query("""
            INSERT INTO conversations (id, participant1_id, participant2_id, created_at, last_message_at)
            VALUES (%s, %s, %s, %s, %s)
        """, [str(conv_id), sender['id'], receiver_id, now, now])
        conversation_id = str(conv_id)
    else:
        conversation_id = conv['id']

    # Сохраняем сообщение
    message_id = uuid.uuid4()
    now = datetime.now()
    db_service.execute_query("""
        INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
        VALUES (%s, %s, %s, %s, %s)
    """, [str(message_id), conversation_id, sender['id'], content, now])

    # Обновляем последнее сообщение в диалоге
    db_service.execute_query("""
        UPDATE conversations 
        SET last_message = %s, last_message_at = %s 
        WHERE id = %s
    """, [content, now, conversation_id])

    # Получаем данные отправителя
    sender_data = db_service.execute_query(
        "SELECT id, username, display_name, avatar_url FROM users WHERE id = %s",
        [sender['id']], fetch_one=True
    )

    return jsonify({
        'id': str(message_id),
        'sender_id': sender['id'],
        'receiver_id': receiver_id,
        'content': content,
        'created_at': now.isoformat(),
        'sender_username': sender_data['username'],
        'sender_display_name': sender_data['display_name'],
        'sender_avatar_url': sender_data['avatar_url']
    }), 201


@messenger_bp.route('/conversations/<conversation_id>/read', methods=['POST'])
def mark_conversation_read(conversation_id):
    """Отметить все сообщения в диалоге как прочитанные"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Обновляем сообщения, где пользователь получатель
    db_service.execute_query("""
        UPDATE messages 
        SET is_read = TRUE, read_at = %s
        WHERE conversation_id = %s AND sender_id != %s AND is_read = FALSE
    """, [datetime.now(), conversation_id, user['id']])

    return jsonify({'message': 'Marked as read'}), 200