import requests
from datetime import datetime, timedelta
from flask import current_app


class TwitchService:
    def __init__(self):
        self.client_id = None
        self.client_secret = None
        self.app_access_token = None
        self.token_expires_at = None

    def init_app(self, app):
        self.client_id = app.config['TWITCH_CLIENT_ID']
        self.client_secret = app.config['TWITCH_CLIENT_SECRET']

    def get_app_access_token(self):
        """Получение app access token для серверных запросов"""
        if self.app_access_token and self.token_expires_at > datetime.now():
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
            self.token_expires_at = datetime.now() + timedelta(seconds=result['expires_in'])
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

    def get_user_by_login(self, login, access_token=None):
        """Получение информации о пользователе по логину"""
        if not access_token:
            access_token = self.get_app_access_token()

        url = f"https://api.twitch.tv/helix/users?login={login}"
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

    def get_stream_info(self, user_id, access_token=None):
        """Получение информации о стриме пользователя"""
        if not access_token:
            access_token = self.get_app_access_token()

        url = f"https://api.twitch.tv/helix/streams?user_id={user_id}"
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

    def get_followed_streams(self, user_id, access_token):
        """Получение стримов пользователей, на которых подписан текущий пользователь"""
        url = f"https://api.twitch.tv/helix/streams/followed?user_id={user_id}"
        headers = {
            'Client-ID': self.client_id,
            'Authorization': f'Bearer {access_token}'
        }

        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json().get('data', [])
        return []

    def refresh_user_token(self, refresh_token):
        """Обновление пользовательского токена"""
        url = "https://id.twitch.tv/oauth2/token"
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }

        response = requests.post(url, data=data)
        if response.status_code == 200:
            return response.json()
        return None


twitch_service = TwitchService()