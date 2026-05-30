from flask import Blueprint, request, jsonify
import requests
import urllib.parse

twitch_bp = Blueprint('twitch', __name__)

# Публичный client_id от Twitch.tv (работает без регистрации)
PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'


@twitch_bp.route('/streams/top', methods=['GET'])
def get_top_streams():
    """Получение популярных стримов"""
    try:
        limit = request.args.get('limit', 20, type=int)

        headers = {
            'Client-ID': PUBLIC_CLIENT_ID
        }

        url = f'https://api.twitch.tv/helix/streams?first={limit}'
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            streams = data.get('data', [])
            return jsonify(streams), 200
        else:
            print(f"Twitch API error: {response.status_code} - {response.text}")
            return jsonify([]), 200

    except Exception as e:
        print(f"Error getting top streams: {e}")
        return jsonify([]), 200


@twitch_bp.route('/streams/search', methods=['GET'])
def search_streams():
    """Поиск стримов по названию или игре"""
    try:
        query = request.args.get('q', '')

        print(f"Searching for: {query}")

        if not query:
            return jsonify([]), 200

        limit = request.args.get('limit', 20, type=int)

        headers = {
            'Client-ID': PUBLIC_CLIENT_ID
        }

        # Кодируем запрос для URL
        encoded_query = urllib.parse.quote(query)
        url = f'https://api.twitch.tv/helix/search/streams?query={encoded_query}&first={limit}'

        print(f"Request URL: {url}")

        response = requests.get(url, headers=headers)

        print(f"Response status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            streams = data.get('data', [])
            print(f"Found {len(streams)} streams")
            return jsonify(streams), 200
        else:
            print(f"Twitch API error: {response.status_code} - {response.text}")
            return jsonify([]), 200

    except Exception as e:
        print(f"Error searching streams: {e}")
        import traceback
        traceback.print_exc()
        return jsonify([]), 200


@twitch_bp.route('/streams/user/<username>', methods=['GET'])
def get_user_stream(username):
    """Получение информации о стриме пользователя"""
    try:
        headers = {'Client-ID': PUBLIC_CLIENT_ID}

        # Сначала получаем ID пользователя
        user_url = f'https://api.twitch.tv/helix/users?login={username}'
        user_response = requests.get(user_url, headers=headers)

        if user_response.status_code != 200:
            return jsonify({'is_live': False, 'error': 'User not found'}), 200

        user_data = user_response.json()
        if not user_data.get('data'):
            return jsonify({'is_live': False}), 200

        user_id = user_data['data'][0]['id']

        # Получаем информацию о стриме
        stream_url = f'https://api.twitch.tv/helix/streams?user_id={user_id}'
        stream_response = requests.get(stream_url, headers=headers)

        if stream_response.status_code == 200:
            stream_data = stream_response.json()
            if stream_data.get('data'):
                stream = stream_data['data'][0]
                return jsonify({
                    'is_live': True,
                    'id': stream['id'],
                    'user_id': stream['user_id'],
                    'user_login': stream['user_login'],
                    'user_name': stream['user_name'],
                    'game_id': stream['game_id'],
                    'game_name': stream['game_name'],
                    'title': stream['title'],
                    'viewer_count': stream['viewer_count'],
                    'started_at': stream['started_at'],
                    'thumbnail_url': stream['thumbnail_url']
                }), 200

        return jsonify({'is_live': False}), 200

    except Exception as e:
        print(f"Error getting user stream: {e}")
        return jsonify({'is_live': False, 'error': str(e)}), 200


@twitch_bp.route('/streams/game/<game_name>', methods=['GET'])
def get_streams_by_game(game_name):
    """Получение стримов по игре"""
    try:
        limit = request.args.get('limit', 20, type=int)

        headers = {'Client-ID': PUBLIC_CLIENT_ID}

        # Сначала получаем ID игры
        game_url = f'https://api.twitch.tv/helix/games?name={game_name}'
        game_response = requests.get(game_url, headers=headers)

        if game_response.status_code != 200:
            return jsonify([]), 200

        game_data = game_response.json()
        if not game_data.get('data'):
            return jsonify([]), 200

        game_id = game_data['data'][0]['id']

        # Получаем стримы по игре
        streams_url = f'https://api.twitch.tv/helix/streams?game_id={game_id}&first={limit}'
        streams_response = requests.get(streams_url, headers=headers)

        if streams_response.status_code == 200:
            data = streams_response.json()
            return jsonify(data.get('data', [])), 200

        return jsonify([]), 200

    except Exception as e:
        print(f"Error getting streams by game: {e}")
        return jsonify([]), 200