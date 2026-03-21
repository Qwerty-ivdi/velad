from flask import Blueprint, request, jsonify, g
from app.services.supabase_service import supabase_service
from app.utils.decorators import require_auth

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    """
    Получение профиля пользователя
    """
    try:
        user_id = g.user_id
        supabase = supabase_service.get_client()
        
        response = supabase.table('profiles')\
            .select('*')\
            .eq('id', user_id)\
            .execute()
        
        if not response.data:
            return jsonify({'error': 'Профиль не найден'}), 404
        
        return jsonify(response.data[0]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/<user_id>', methods=['GET'])
def get_profile_by_id(user_id):
    """
    Получение профиля по ID
    """
    try:
        supabase = supabase_service.get_client()
        
        response = supabase.table('profiles')\
            .select('*')\
            .eq('id', user_id)\
            .execute()
        
        if not response.data:
            return jsonify({'error': 'Профиль не найден'}), 404
        
        # Не возвращаем приватные данные
        profile = response.data[0]
        return jsonify(profile), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    """
    Обновление профиля
    Ожидает: {
        "display_name": "New Name",
        "bio": "About me",
        "location": "Moscow",
        "website": "https://example.com"
    }
    """
    try:
        user_id = g.user_id
        data = request.get_json()
        
        supabase = supabase_service.get_client()
        
        # Разрешенные поля для обновления
        allowed_fields = ['display_name', 'bio', 'location', 'website', 'avatar_url']
        update_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}
        
        if not update_data:
            return jsonify({'error': 'Нет данных для обновления'}), 400
        
        response = supabase.table('profiles')\
            .update(update_data)\
            .eq('id', user_id)\
            .execute()
        
        if response.error:
            return jsonify({'error': 'Ошибка при обновлении профиля'}), 500
        
        return jsonify({
            'message': 'Профиль обновлен',
            'profile': response.data[0] if response.data else {}
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/username/<username>', methods=['GET'])
def check_username(username):
    """
    Проверка доступности имени пользователя
    """
    try:
        supabase = supabase_service.get_client()
        
        response = supabase.table('profiles')\
            .select('id')\
            .eq('username', username)\
            .execute()
        
        return jsonify({
            'available': len(response.data) == 0,
            'username': username
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/<user_id>/stats', methods=['GET'])
def get_user_stats(user_id):
    """
    Получение статистики пользователя
    """
    try:
        supabase = supabase_service.get_client()
        
        # Количество подписчиков
        followers_response = supabase.table('follows')\
            .select('*', count='exact')\
            .eq('following_id', user_id)\
            .execute()
        
        # Количество подписок
        following_response = supabase.table('follows')\
            .select('*', count='exact')\
            .eq('follower_id', user_id)\
            .execute()
        
        # Количество постов
        posts_response = supabase.table('posts')\
            .select('*', count='exact')\
            .eq('user_id', user_id)\
            .execute()
        
        return jsonify({
            'followers_count': followers_response.count or 0,
            'following_count': following_response.count or 0,
            'posts_count': posts_response.count or 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500