from flask import Blueprint, request, jsonify
from app.services.db_service import db_service
from app.routes.profile import get_user_from_token
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import uuid

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/track/view/start', methods=['POST'])
@jwt_required()
def start_watch_session():
    """Начать отслеживание просмотра стрима"""
    try:
        user_id = get_jwt_identity()
        print(f"🎬 Starting watch session for user: {user_id}")

        data = request.get_json()
        print(f"📦 Request data: {data}")

        streamer_name = data.get('streamer_name')
        print(f"📺 Streamer name: {streamer_name}")

        if not streamer_name:
            return jsonify({'error': 'streamer_name required'}), 400

        session_id = uuid.uuid4()
        print(f"🆕 Generated session_id: {session_id}")

        # Удаляем старые сессии
        db_service.execute_query("""
            DELETE FROM active_watch_sessions WHERE user_id = %s
        """, [user_id])

        # Создаём новую сессию
        db_service.execute_query("""
            INSERT INTO active_watch_sessions (id, user_id, streamer_name, start_time, last_heartbeat)
            VALUES (%s, %s, %s, %s, %s)
        """, [str(session_id), user_id, streamer_name, datetime.now(), datetime.now()])

        print(f"✅ Started watch session for user {user_id} on {streamer_name}")
        print(f"📤 Returning session_id: {str(session_id)}")

        return jsonify({'session_id': str(session_id)}), 200

    except Exception as e:
        print(f"❌ Error starting watch session: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@stats_bp.route('/track/view/heartbeat', methods=['POST'])
@jwt_required()
def watch_heartbeat():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        session_id = data.get('session_id')
        duration_seconds = data.get('duration', 30)

        if not session_id:
            return jsonify({'error': 'session_id required'}), 400

        # Получаем streamer_name из активной сессии
        session = db_service.execute_query(
            "SELECT streamer_name FROM active_watch_sessions WHERE id = %s AND user_id = %s AND is_active = TRUE",
            [session_id, user_id], fetch_one=True
        )

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        streamer_name = session['streamer_name']

        # Обновляем stream_views
        db_service.execute_query("""
            INSERT INTO stream_views (user_id, streamer_name, watch_duration_seconds, last_watched, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id, streamer_name) 
            DO UPDATE SET 
                watch_duration_seconds = stream_views.watch_duration_seconds + %s,
                last_watched = %s,
                updated_at = %s
        """, [user_id, streamer_name, duration_seconds, datetime.now(), datetime.now(),
              duration_seconds, datetime.now(), datetime.now()])

        # Обновляем heartbeat
        db_service.execute_query(
            "UPDATE active_watch_sessions SET last_heartbeat = %s WHERE id = %s",
            [datetime.now(), session_id]
        )

        return jsonify({'message': 'Heartbeat received'}), 200

    except Exception as e:
        print(f"❌ Error in heartbeat: {e}")
        return jsonify({'error': str(e)}), 500


@stats_bp.route('/track/view/end', methods=['POST'])
@jwt_required()  # 👈 ДОБАВЬТЕ ЭТО
def end_watch_session():
    """Завершить отслеживание просмотра"""
    try:
        user_id = get_jwt_identity()  # 👈 ИСПОЛЬЗУЙТЕ ЭТО
        data = request.get_json()
        session_id = data.get('session_id')

        if not session_id:
            return jsonify({'error': 'session_id required'}), 400

        db_service.execute_query(
            "UPDATE active_watch_sessions SET is_active = FALSE WHERE id = %s AND user_id = %s",
            [session_id, user_id]
        )

        print(f"✅ Ended watch session {session_id} for user {user_id}")
        return jsonify({'message': 'Session ended'}), 200

    except Exception as e:
        print(f"❌ Error ending watch session: {e}")
        return jsonify({'error': str(e)}), 500


@stats_bp.route('/track/message', methods=['POST'])
@jwt_required()
def track_message():
    """Отследить сообщение в чате стримера"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        streamer_name = data.get('streamer_name')

        if not streamer_name:
            return jsonify({'error': 'streamer_name required'}), 400

        # Обновляем счётчик сообщений в таблице stream_messages
        db_service.execute_query("""
            INSERT INTO stream_messages (user_id, streamer_name, message_count, last_message_at, updated_at)
            VALUES (%s, %s, 1, %s, %s)
            ON CONFLICT (user_id, streamer_name) 
            DO UPDATE SET 
                message_count = stream_messages.message_count + 1,
                last_message_at = %s,
                updated_at = %s
        """, [user_id, streamer_name, datetime.now(), datetime.now(),
              datetime.now(), datetime.now()])

        print(f"✅ Tracked message for user {user_id} in {streamer_name}")
        return jsonify({'message': 'Message tracked'}), 200

    except Exception as e:
        print(f"❌ Error tracking message: {e}")
        return jsonify({'error': str(e)}), 500


@stats_bp.route('/yearly', methods=['GET'])
@jwt_required()
def get_yearly_stats():
    """Получить годовую статистику пользователя"""
    try:
        user_id = get_jwt_identity()
        year = request.args.get('year', type=int, default=datetime.now().year)

        print(f"📡 Getting yearly stats for user: {user_id}, year: {year}")

        # Получаем статистику просмотров из таблицы stream_views
        watch_stats = db_service.execute_query("""
            SELECT 
                streamer_name,
                watch_duration_seconds as watch_seconds
            FROM stream_views
            WHERE user_id = %s
            ORDER BY watch_duration_seconds DESC
            LIMIT 10
        """, [user_id], fetch_all=True)

        # Получаем общую статистику просмотров
        total_stats = db_service.execute_query("""
            SELECT 
                COALESCE(SUM(watch_duration_seconds), 0) as total_seconds,
                COUNT(DISTINCT streamer_name) as unique_streamers
            FROM stream_views
            WHERE user_id = %s
        """, [user_id], fetch_one=True)

        # Получаем статистику сообщений из таблицы stream_messages
        message_stats = db_service.execute_query("""
            SELECT 
                streamer_name,
                message_count
            FROM stream_messages
            WHERE user_id = %s
            ORDER BY message_count DESC
            LIMIT 10
        """, [user_id], fetch_all=True)

        # Получаем общее количество сообщений
        total_messages = db_service.execute_query("""
            SELECT 
                COALESCE(SUM(message_count), 0) as total_messages
            FROM stream_messages
            WHERE user_id = %s
        """, [user_id], fetch_one=True)

        # Обработка результатов
        total_seconds = total_stats.get('total_seconds', 0) if total_stats else 0
        unique_streamers = total_stats.get('unique_streamers', 0) if total_stats else 0

        total_hours = round(total_seconds / 3600, 1)
        total_minutes = round((total_seconds % 3600) / 60)

        total_msgs = total_messages.get('total_messages', 0) if total_messages else 0

        # Формируем ответ
        response_data = {
            'total_stats': {
                'total_seconds': total_seconds,
                'total_hours': total_hours,
                'total_minutes': total_minutes,
                'unique_streamers': unique_streamers
            },
            'message_stats': {
                'total_messages': total_msgs
            },
            'top_streamers': [],
            'top_chatters': []
        }

        # Добавляем топ стримеров по просмотрам
        if watch_stats:
            response_data['top_streamers'] = [
                {
                    'streamer_name': s.get('streamer_name'),
                    'watch_hours': round(s.get('watch_seconds', 0) / 3600, 1),
                    'watch_minutes': round((s.get('watch_seconds', 0) % 3600) / 60)
                }
                for s in watch_stats if s.get('streamer_name')
            ]

        # Добавляем топ стримеров по сообщениям
        if message_stats:
            response_data['top_chatters'] = [
                {
                    'streamer_name': s.get('streamer_name'),
                    'message_count': s.get('message_count', 0)
                }
                for s in message_stats if s.get('streamer_name')
            ]

        print(f"✅ Returning stats for user {user_id}")
        return jsonify(response_data), 200

    except Exception as e:
        print(f"❌ Error getting yearly stats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



@stats_bp.route('/twitch-status', methods=['GET'])
@jwt_required()
def get_twitch_status():
    """Проверить, подключён ли Twitch аккаунт"""
    try:
        user_id = get_jwt_identity()
        print(f"📡 Checking Twitch status for user: {user_id}")

        user = db_service.execute_query("""
            SELECT twitch_id, twitch_login, twitch_access_token
            FROM users WHERE id = %s
        """, [user_id], fetch_one=True)

        return jsonify({
            'connected': bool(user and user.get('twitch_id') and user.get('twitch_access_token')),
            'twitch_login': user.get('twitch_login') if user else None
        }), 200

    except Exception as e:
        print(f"❌ Error checking Twitch status: {e}")
        return jsonify({'connected': False, 'error': str(e)}), 200