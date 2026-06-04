from flask import Blueprint, request, jsonify, current_app
from app.services.db_service import db_service
from app.services.eventsub_service import eventsub_service
from datetime import datetime
import json

twitch_webhook_bp = Blueprint('twitch_webhook', __name__)


@twitch_webhook_bp.route('/webhooks/twitch', methods=['GET'])
def verify_webhook():
    """
    Twitch отправляет GET запрос для верификации webhook
    """
    challenge = request.args.get('hub.challenge')
    if challenge:
        return challenge, 200

    # Альтернативная верификация для EventSub
    mode = request.args.get('hub.mode')
    if mode == 'subscribe':
        challenge = request.args.get('hub.challenge')
        return challenge, 200

    return jsonify({'error': 'Not found'}), 404


@twitch_webhook_bp.route('/webhooks/twitch', methods=['POST'])
def handle_twitch_event():
    """
    Обработка событий от Twitch EventSub
    """
    try:
        # Получаем заголовки для проверки подписи
        message_id = request.headers.get('Twitch-Eventsub-Message-Id')
        message_type = request.headers.get('Twitch-Eventsub-Message-Type')
        message_signature = request.headers.get('Twitch-Eventsub-Message-Signature')
        message_timestamp = request.headers.get('Twitch-Eventsub-Message-Timestamp')

        # Получаем тело запроса
        body = request.get_data()
        body_json = request.get_json()

        print(f"📨 Received webhook: {message_type}")

        # Проверка подписи (опционально, но рекомендуется)
        # secret = current_app.config.get('SECRET_KEY')
        # if not eventsub_service.verify_signature(body, message_signature, secret):
        #     return jsonify({'error': 'Invalid signature'}), 403

        # Обработка верификации
        if message_type == 'webhook_callback_verification':
            challenge = body_json.get('challenge')
            if challenge:
                return challenge, 200

        # Обработка уведомлений
        if message_type == 'notification':
            event_data = body_json.get('event', {})
            subscription_type = body_json.get('subscription', {}).get('type')

            if subscription_type == 'channel.chat.message':
                handle_chat_message(event_data)
            elif subscription_type == 'stream.online':
                handle_stream_online(event_data)
            elif subscription_type == 'stream.offline':
                handle_stream_offline(event_data)

        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        print(f"❌ Error processing webhook: {e}")
        return jsonify({'error': str(e)}), 500


def handle_chat_message(event_data):
    """Обработка сообщения в чате"""
    try:
        broadcaster_id = event_data.get('broadcaster_user_id')
        broadcaster_name = event_data.get('broadcaster_user_login')
        chatter_id = event_data.get('chatter_user_id')
        chatter_name = event_data.get('chatter_user_name')
        message_text = event_data.get('message', {}).get('text', '')

        print(f"💬 Chat message from {chatter_name} in {broadcaster_name}: {message_text}")

        # Ищем пользователя в нашей БД
        user = db_service.execute_query(
            "SELECT id FROM users WHERE twitch_id = %s",
            [chatter_id], fetch_one=True
        )

        if user:
            # Обновляем статистику сообщений
            db_service.execute_query("""
                INSERT INTO stream_messages (user_id, streamer_name, message_count, last_message_at)
                VALUES (%s, %s, 1, %s)
                ON CONFLICT (user_id, streamer_name) 
                DO UPDATE SET 
                    message_count = stream_messages.message_count + 1,
                    last_message_at = %s,
                    updated_at = NOW()
            """, [user['id'], broadcaster_name, datetime.now(), datetime.now()])

            print(f"✅ Message tracked for user {user['id']}")
        else:
            print(f"⚠️ User {chatter_id} not found in database")

    except Exception as e:
        print(f"❌ Error handling chat message: {e}")


def handle_stream_online(event_data):
    """Обработка начала стрима"""
    broadcaster_id = event_data.get('broadcaster_user_id')
    broadcaster_name = event_data.get('broadcaster_user_login')
    print(f"🔴 Stream started: {broadcaster_name}")

    # Обновляем статус стримера
    db_service.execute_query(
        "UPDATE users SET is_live = TRUE WHERE twitch_id = %s",
        [broadcaster_id]
    )


def handle_stream_offline(event_data):
    """Обработка конца стрима"""
    broadcaster_id = event_data.get('broadcaster_user_id')
    broadcaster_name = event_data.get('broadcaster_user_login')
    print(f"⚫ Stream ended: {broadcaster_name}")

    # Обновляем статус стримера
    db_service.execute_query(
        "UPDATE users SET is_live = FALSE WHERE twitch_id = %s",
        [broadcaster_id]
    )