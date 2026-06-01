from flask import Blueprint, request, jsonify
from app.services.db_service import db_service
from app.routes.profile import get_user_from_token
from datetime import datetime, timedelta
import uuid

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/stats/yearly', methods=['GET'])
def get_yearly_stats():
    """Получить годовую статистику пользователя"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    year = request.args.get('year', datetime.now().year, type=int)

    # Топ стримеров по времени просмотра
    top_streamers = db_service.execute_query("""
        SELECT 
            streamer_id,
            streamer_name,
            watch_time_minutes,
            ROUND(watch_time_minutes / 60.0, 1) as watch_time_hours,
            last_watched
        FROM stream_views
        WHERE user_id = %s
        ORDER BY watch_time_minutes DESC
        LIMIT 10
    """, [user['id']], fetch_all=True)

    # Общая статистика
    total_stats = db_service.execute_query("""
        SELECT 
            COUNT(DISTINCT streamer_id) as unique_streamers,
            SUM(watch_time_minutes) as total_minutes,
            SUM(watch_time_minutes) / 60.0 as total_hours
        FROM stream_views
        WHERE user_id = %s
    """, [user['id']], fetch_one=True)

    # Топ эмодзи/реакций
    top_reactions = db_service.execute_query("""
        SELECT reaction_type, SUM(count) as total_count
        FROM stream_reactions
        WHERE user_id = %s
        GROUP BY reaction_type
        ORDER BY total_count DESC
        LIMIT 5
    """, [user['id']], fetch_all=True)

    # Любимый день недели для просмотров
    favorite_day = db_service.execute_query("""
        SELECT 
            EXTRACT(DOW FROM last_watched) as day_of_week,
            COUNT(*) as watch_count
        FROM stream_views
        WHERE user_id = %s
        GROUP BY EXTRACT(DOW FROM last_watched)
        ORDER BY watch_count DESC
        LIMIT 1
    """, [user['id']], fetch_one=True)

    days_map = {0: 'Понедельник', 1: 'Вторник', 2: 'Среда',
                3: 'Четверг', 4: 'Пятница', 5: 'Суббота', 6: 'Воскресенье'}

    return jsonify({
        'year': year,
        'top_streamers': top_streamers or [],
        'total_stats': {
            'unique_streamers': total_stats.get('unique_streamers', 0) if total_stats else 0,
            'total_minutes': total_stats.get('total_minutes', 0) if total_stats else 0,
            'total_hours': round(total_stats.get('total_hours', 0), 1) if total_stats else 0
        },
        'top_reactions': top_reactions or [],
        'favorite_day': days_map.get(favorite_day.get('day_of_week', 0),
                                     'Не определен') if favorite_day else 'Не определен'
    }), 200


@stats_bp.route('/stats/track_view', methods=['POST'])
def track_stream_view():
    """Отследить просмотр стрима"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    streamer_id = data.get('streamer_id')
    streamer_name = data.get('streamer_name')
    watch_minutes = data.get('watch_minutes', 1)

    if not streamer_id:
        return jsonify({'error': 'streamer_id required'}), 400

    # Обновляем или создаём запись просмотра
    existing = db_service.execute_query(
        "SELECT id, watch_time_minutes FROM stream_views WHERE user_id = %s AND streamer_id = %s",
        [user['id'], streamer_id], fetch_one=True
    )

    if existing:
        db_service.execute_query("""
            UPDATE stream_views 
            SET watch_time_minutes = watch_time_minutes + %s,
                last_watched = NOW(),
                updated_at = NOW()
            WHERE id = %s
        """, [watch_minutes, existing['id']])
    else:
        db_service.execute_query("""
            INSERT INTO stream_views (id, user_id, streamer_id, streamer_name, watch_time_minutes, last_watched)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, [str(uuid.uuid4()), user['id'], streamer_id, streamer_name, watch_minutes, datetime.now()])

    return jsonify({'message': 'View tracked'}), 200


@stats_bp.route('/stats/add_reaction', methods=['POST'])
def add_reaction():
    """Добавить реакцию/эмодзи на стримера"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    streamer_id = data.get('streamer_id')
    reaction_type = data.get('reaction_type')  # например, '❤️', '😂', '🔥', '👏'

    if not streamer_id or not reaction_type:
        return jsonify({'error': 'streamer_id and reaction_type required'}), 400

    existing = db_service.execute_query("""
        SELECT id, count FROM stream_reactions 
        WHERE user_id = %s AND streamer_id = %s AND reaction_type = %s
    """, [user['id'], streamer_id, reaction_type], fetch_one=True)

    if existing:
        db_service.execute_query(
            "UPDATE stream_reactions SET count = count + 1 WHERE id = %s",
            [existing['id']]
        )
    else:
        db_service.execute_query("""
            INSERT INTO stream_reactions (id, user_id, streamer_id, reaction_type, count)
            VALUES (%s, %s, %s, %s, %s)
        """, [str(uuid.uuid4()), user['id'], streamer_id, reaction_type, 1])

    return jsonify({'message': 'Reaction added'}), 200