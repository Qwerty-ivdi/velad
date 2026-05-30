# backend/app/services/twitch_service.py
import requests


class TwitchProxyService:
    def __init__(self):
        # Используем публичный API от ttv-api (не требует регистрации)
        self.base_url = 'https://api.ttv-api.com/v1'

    def get_channel_info(self, username):
        """Получение информации о канале"""
        try:
            response = requests.get(f"{self.base_url}/channel/{username}")
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Error getting channel info: {e}")
            return None

    def get_stream_status(self, username):
        """Получение статуса стрима"""
        try:
            response = requests.get(f"{self.base_url}/stream/{username}")
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Error getting stream status: {e}")
            return None


# Альтернативный вариант - использование публичного Twitch Helix API
class TwitchPublicService:
    def __init__(self):
        # Публичный client_id от Twitch.tv (работает без регистрации)
        self.client_id = 'kimne78kx3ncx6brgo4mv6wki5h1ko'
        self.helix_url = 'https://api.twitch.tv/helix'

    def get_stream_info(self, username):
        """Получение информации о стриме по имени пользователя"""
        headers = {'Client-ID': self.client_id}

        # Сначала получаем ID пользователя
        user_url = f"{self.helix_url}/users?login={username}"
        user_response = requests.get(user_url, headers=headers)

        if user_response.status_code != 200:
            return None

        user_data = user_response.json()
        if not user_data.get('data'):
            return None

        user_id = user_data['data'][0]['id']

        # Получаем информацию о стриме
        stream_url = f"{self.helix_url}/streams?user_id={user_id}"
        stream_response = requests.get(stream_url, headers=headers)

        if stream_response.status_code == 200:
            stream_data = stream_response.json()
            if stream_data.get('data'):
                stream = stream_data['data'][0]
                return {
                    'id': stream['id'],
                    'user_id': stream['user_id'],
                    'user_login': stream['user_login'],
                    'user_name': stream['user_name'],
                    'game_id': stream['game_id'],
                    'game_name': stream['game_name'],
                    'title': stream['title'],
                    'viewer_count': stream['viewer_count'],
                    'started_at': stream['started_at'],
                    'thumbnail_url': stream['thumbnail_url'],
                    'is_live': True
                }
        return None

    def get_top_streams(self, limit=10):
        """Получение популярных стримов"""
        headers = {'Client-ID': self.client_id}
        url = f"{self.helix_url}/streams?first={limit}"
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            return data.get('data', [])
        return []

    def get_game_info(self, game_name):
        """Получение информации об игре"""
        headers = {'Client-ID': self.client_id}
        url = f"{self.helix_url}/games?name={game_name}"
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            if data.get('data'):
                return data['data'][0]
        return None

    def search_streams(self, query, limit=20):
        """Поиск стримов по названию или игре"""
        headers = {'Client-ID': self.client_id}
        url = f"{self.helix_url}/search/streams?query={query}&first={limit}"
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            return response.json().get('data', [])
        return []


# Создаем экземпляры для использования
twitch_proxy_service = TwitchProxyService()
twitch_public_service = TwitchPublicService()