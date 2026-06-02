from flask import Blueprint, request, jsonify
import requests
from app.services.twitch_service import twitch_service

twitch_bp = Blueprint('twitch', __name__)


def get_twitch_headers():
    """Получить headers для Twitch API с токеном"""
    access_token = twitch_service.get_app_access_token()
    if not access_token:
        return None

    return {
        'Client-ID': twitch_service.client_id,
        'Authorization': f'Bearer {access_token}'
    }


def get_user_info(username):
    """Получение информации о пользователе Twitch"""
    try:
        headers = get_twitch_headers()
        if not headers:
            return None

        url = f'https://api.twitch.tv/helix/users?login={username}'
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            if data.get('data'):
                return data['data'][0]
        return None
    except Exception as e:
        print(f"Error getting user info: {e}")
        return None


@twitch_bp.route('/streams/top', methods=['GET'])
def get_top_streams():
    """Получение популярных стримов"""
    try:
        limit = request.args.get('limit', 20, type=int)

        headers = get_twitch_headers()
        if not headers:
            return jsonify({'error': 'Twitch API not configured'}), 500

        url = f'https://api.twitch.tv/helix/streams?first={limit}'

        print(f"📡 Fetching top streams from Twitch API...")
        response = requests.get(url, headers=headers)

        print(f"📊 Response status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            streams = data.get('data', [])

            # Добавляем аватарки
            for stream in streams:
                user_login = stream.get('user_login')
                if user_login:
                    user_info = get_user_info(user_login)
                    if user_info:
                        stream['profile_image_url'] = user_info.get('profile_image_url', '')
                        stream['display_name'] = user_info.get('display_name', user_login)
                    else:
                        stream['profile_image_url'] = ''
                        stream['display_name'] = user_login

            print(f"✅ Found {len(streams)} streams")
            return jsonify(streams), 200
        else:
            print(f"❌ Twitch API error: {response.status_code} - {response.text}")
            return jsonify({'error': 'Failed to fetch streams'}), 500

    except Exception as e:
        print(f"❌ Error in get_top_streams: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@twitch_bp.route('/streams/search', methods=['GET'])
def search_streams():
    """Поиск стримов по названию или игре"""
    try:
        query = request.args.get('q', '')
        limit = request.args.get('limit', 20, type=int)

        if not query:
            return jsonify([]), 200

        headers = get_twitch_headers()
        if not headers:
            return jsonify([]), 200

        url = f'https://api.twitch.tv/helix/search/streams?query={query}&first={limit}'
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            streams = data.get('data', [])

            for stream in streams:
                user_login = stream.get('user_login')
                if user_login:
                    user_info = get_user_info(user_login)
                    if user_info:
                        stream['profile_image_url'] = user_info.get('profile_image_url', '')
                        stream['display_name'] = user_info.get('display_name', user_login)

            return jsonify(streams), 200
        else:
            return jsonify([]), 200

    except Exception as e:
        print(f"❌ Error searching streams: {e}")
        return jsonify([]), 200


@twitch_bp.route('/streams/search/channel', methods=['GET'])
def search_channel():
    """Поиск стрима по имени канала"""
    try:
        channel_name = request.args.get('q', '')

        if not channel_name:
            return jsonify([]), 200

        headers = get_twitch_headers()
        if not headers:
            return jsonify([]), 200

        # Сначала получаем ID канала
        user_url = f'https://api.twitch.tv/helix/users?login={channel_name}'
        user_response = requests.get(user_url, headers=headers)

        if user_response.status_code != 200:
            return jsonify([]), 200

        user_data = user_response.json()
        if not user_data.get('data'):
            return jsonify([]), 200

        user_id = user_data['data'][0]['id']
        profile_image = user_data['data'][0].get('profile_image_url', '')
        display_name = user_data['data'][0].get('display_name', channel_name)

        # Получаем стрим канала
        stream_url = f'https://api.twitch.tv/helix/streams?user_id={user_id}'
        stream_response = requests.get(stream_url, headers=headers)

        if stream_response.status_code == 200:
            stream_data = stream_response.json()
            if stream_data.get('data'):
                stream = stream_data['data'][0]
                stream['profile_image_url'] = profile_image
                stream['display_name'] = display_name
                return jsonify([stream]), 200

        return jsonify([]), 200

    except Exception as e:
        print(f"❌ Error searching channel: {e}")
        return jsonify([]), 200


@twitch_bp.route('/streams/search/all', methods=['GET'])
def search_all():
    """Поиск стримов по имени канала, названию стрима или игре"""
    try:
        query = request.args.get('q', '')
        limit = request.args.get('limit', 20, type=int)

        if not query:
            return jsonify([]), 200

        headers = get_twitch_headers()
        if not headers:
            return jsonify([]), 200

        results = []

        # 1. Поиск по имени канала
        user_url = f'https://api.twitch.tv/helix/users?login={query}'
        user_response = requests.get(user_url, headers=headers)

        if user_response.status_code == 200:
            user_data = user_response.json()
            if user_data.get('data'):
                user_id = user_data['data'][0]['id']
                stream_url = f'https://api.twitch.tv/helix/streams?user_id={user_id}'
                stream_response = requests.get(stream_url, headers=headers)

                if stream_response.status_code == 200:
                    stream_data = stream_response.json()
                    if stream_data.get('data'):
                        stream = stream_data['data'][0]
                        stream['profile_image_url'] = user_data['data'][0].get('profile_image_url', '')
                        stream['display_name'] = user_data['data'][0].get('display_name', query)
                        results.extend(stream_data['data'])

        # 2. Если не нашли по имени канала, ищем по названию стрима/игре
        if len(results) == 0:
            search_url = f'https://api.twitch.tv/helix/search/streams?query={query}&first={limit}'
            search_response = requests.get(search_url, headers=headers)

            if search_response.status_code == 200:
                search_data = search_response.json()
                streams = search_data.get('data', [])

                # Добавляем аватарки
                for stream in streams:
                    user_login = stream.get('user_login')
                    if user_login:
                        user_info = get_user_info(user_login)
                        if user_info:
                            stream['profile_image_url'] = user_info.get('profile_image_url', '')
                            stream['display_name'] = user_info.get('display_name', user_login)

                results = streams

        return jsonify(results), 200

    except Exception as e:
        print(f"❌ Error in search_all: {e}")
        return jsonify([]), 200


@twitch_bp.route('/streams/user/<username>', methods=['GET'])
def get_user_stream(username):
    """Получение информации о стриме пользователя"""
    try:
        headers = get_twitch_headers()
        if not headers:
            return jsonify({'is_live': False, 'error': 'No token'}), 200

        # Получаем ID пользователя
        user_url = f'https://api.twitch.tv/helix/users?login={username}'
        user_response = requests.get(user_url, headers=headers)

        print(f"🔍 User API response: {user_response.status_code}")

        if user_response.status_code != 200:
            return jsonify({'is_live': False, 'error': 'User API failed'}), 200

        user_data = user_response.json()
        if not user_data.get('data'):
            return jsonify({'is_live': False, 'error': 'User not found'}), 200

        user_id = user_data['data'][0]['id']
        profile_image = user_data['data'][0].get('profile_image_url', '')
        display_name = user_data['data'][0].get('display_name', username)

        # Получаем стрим
        stream_url = f'https://api.twitch.tv/helix/streams?user_id={user_id}'
        stream_response = requests.get(stream_url, headers=headers)

        print(f"📡 Stream API response: {stream_response.status_code}")

        if stream_response.status_code == 200:
            stream_data = stream_response.json()
            print(f"📊 Stream data: {stream_data}")

            if stream_data.get('data') and len(stream_data['data']) > 0:
                stream = stream_data['data'][0]
                stream['profile_image_url'] = profile_image
                stream['display_name'] = display_name
                return jsonify({'is_live': True, 'stream': stream}), 200

        return jsonify({'is_live': False}), 200

    except Exception as e:
        print(f"❌ Error getting user stream: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'is_live': False, 'error': str(e)}), 200