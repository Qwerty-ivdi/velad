from flask import Blueprint, request, jsonify, current_app
from app.services.twitch_service import twitch_service
from app.services.db_service import db_service
from app.routes.profile import get_user_from_token

twitch_bp = Blueprint('twitch', __name__)


@twitch_bp.route('/streams/followed', methods=['GET'])
def get_followed_streams():
    """Получение стримов пользователей, на которых подписан текущий пользователь"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Проверяем, есть ли у пользователя Twitch токен
    user_data = db_service.execute_query(
        "SELECT twitch_access_token, twitch_id FROM users WHERE id = %s",
        [user['id']], fetch_one=True
    )

    if not user_data or not user_data.get('twitch_access_token'):
        return jsonify({'streams': [], 'error': 'Twitch account not connected'}), 200

    streams = twitch_service.get_followed_streams(
        user_data['twitch_id'],
        user_data['twitch_access_token']
    )

    return jsonify({'streams': streams}), 200


@twitch_bp.route('/streams/user/<user_id>', methods=['GET'])
def get_user_stream(user_id):
    """Получение информации о стриме пользователя"""
    # Получаем twitch_id пользователя
    user_data = db_service.execute_query(
        "SELECT twitch_id FROM users WHERE id = %s",
        [user_id], fetch_one=True
    )

    if not user_data or not user_data.get('twitch_id'):
        return jsonify({'stream': None, 'message': 'User not connected to Twitch'}), 200

    stream_info = twitch_service.get_stream_info(user_data['twitch_id'])

    if stream_info:
        # Сохраняем информацию о стриме в БД
        db_service.execute_query("""
            INSERT INTO streams (user_id, twitch_stream_id, title, game_name, 
                               viewer_count, started_at, is_live, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (twitch_stream_id) DO UPDATE SET
                title = EXCLUDED.title,
                game_name = EXCLUDED.game_name,
                viewer_count = EXCLUDED.viewer_count,
                is_live = EXCLUDED.is_live,
                updated_at = NOW()
        """, [user_id, stream_info['id'], stream_info['title'],
              stream_info['game_name'], stream_info['viewer_count'],
              stream_info['started_at'], True])

        # Обновляем статус пользователя
        db_service.execute_query(
            "UPDATE users SET is_live = TRUE WHERE id = %s",
            [user_id]
        )
    else:
        # Пользователь не стримит
        db_service.execute_query(
            "UPDATE users SET is_live = FALSE WHERE id = %s",
            [user_id]
        )

    return jsonify({'stream': stream_info}), 200


@twitch_bp.route('/user/twitch', methods=['GET'])
def get_current_user_twitch():
    """Получение Twitch информации текущего пользователя"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    user_data = db_service.execute_query(
        "SELECT twitch_id, twitch_login, is_live FROM users WHERE id = %s",
        [user['id']], fetch_one=True
    )

    return jsonify({
        'twitch_connected': bool(user_data.get('twitch_id')),
        'twitch_login': user_data.get('twitch_login'),
        'is_live': user_data.get('is_live', False)
    }), 200


@twitch_bp.route('/streams/live', methods=['GET'])
def get_all_live_streams():
    """Получение всех активных стримов из БД"""
    streams = db_service.execute_query("""
        SELECT s.*, u.username, u.display_name, u.avatar_url
        FROM streams s
        JOIN users u ON s.user_id = u.id
        WHERE s.is_live = TRUE
        ORDER BY s.viewer_count DESC
    """, fetch_all=True)

    return jsonify({'streams': streams or []}), 200