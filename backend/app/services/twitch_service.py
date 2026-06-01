import requests
from flask import current_app


class TwitchService:
    def __init__(self):
        self.client_id = None
        self.client_secret = None
        self.app_access_token = None

    def init_app(self, app):
        self.client_id = app.config.get('TWITCH_CLIENT_ID')
        self.client_secret = app.config.get('TWITCH_CLIENT_SECRET')
        print(f"✅ Twitch service initialized with Client ID: {self.client_id[:10]}...")

    def get_app_access_token(self):
        """Получение app access token для серверных запросов"""
        if self.app_access_token:
            return self.app_access_token

        url = "https://id.twitch.tv/oauth2/token"
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'client_credentials'
        }
        response = requests.post(url, data=data)
        if response.status_code == 200:
            result = response.json()
            self.app_access_token = result['access_token']
            return self.app_access_token
        return None

    def get_user_info(self, access_token):
        """Получение информации о пользователе по токену"""
        url = "https://api.twitch.tv/helix/users"
        headers = {
            'Client-ID': self.client_id,
            'Authorization': f'Bearer {access_token}'
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data['data']:
                return data['data'][0]
        return None

    def get_stream_info(self, user_login):
        """Получение информации о стриме по логину"""
        access_token = self.get_app_access_token()
        if not access_token:
            return None

        # Сначала получаем ID пользователя
        headers = {
            'Client-ID': self.client_id,
            'Authorization': f'Bearer {access_token}'
        }
        user_url = f"https://api.twitch.tv/helix/users?login={user_login}"
        user_response = requests.get(user_url, headers=headers)

        if user_response.status_code != 200:
            return None

        user_data = user_response.json()
        if not user_data.get('data'):
            return None

        user_id = user_data['data'][0]['id']

        # Получаем информацию о стриме
        stream_url = f"https://api.twitch.tv/helix/streams?user_id={user_id}"
        stream_response = requests.get(stream_url, headers=headers)

        if stream_response.status_code == 200:
            stream_data = stream_response.json()
            if stream_data.get('data'):
                return stream_data['data'][0]

        return None


twitch_service = TwitchService()