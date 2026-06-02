import requests
import json
import hmac
import hashlib
from flask import current_app
from datetime import datetime


class EventSubService:
    def __init__(self):
        self.client_id = None
        self.client_secret = None
        self.app_access_token = None
        self.token_expires_at = None

    def init_app(self, app):
        self.client_id = app.config.get('TWITCH_CLIENT_ID')
        self.client_secret = app.config.get('TWITCH_CLIENT_SECRET')

    def get_app_access_token(self):
        """Получение App Access Token для EventSub API"""
        if self.app_access_token and self.token_expires_at and datetime.now() < self.token_expires_at:
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
            from datetime import timedelta
            self.token_expires_at = datetime.now() + timedelta(seconds=result['expires_in'])
            return self.app_access_token
        return None

    def create_subscription(self, broadcaster_id, callback_url, subscription_type='channel.chat.message'):
        """Создание подписки на события чата"""
        access_token = self.get_app_access_token()
        if not access_token:
            return None

        url = "https://api.twitch.tv/helix/eventsub/subscriptions"
        headers = {
            'Client-ID': self.client_id,
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }

        # Конфигурация подписки
        body = {
            "type": subscription_type,
            "version": "1",
            "condition": {
                "broadcaster_user_id": broadcaster_id,
                "user_id": broadcaster_id
            },
            "transport": {
                "method": "webhook",
                "callback": callback_url,
                "secret": current_app.config.get('SECRET_KEY')
            }
        }

        response = requests.post(url, headers=headers, json=body)
        return response.json()

    def delete_subscription(self, subscription_id):
        """Удаление подписки"""
        access_token = self.get_app_access_token()
        if not access_token:
            return False

        url = f"https://api.twitch.tv/helix/eventsub/subscriptions?id={subscription_id}"
        headers = {
            'Client-ID': self.client_id,
            'Authorization': f'Bearer {access_token}'
        }

        response = requests.delete(url, headers=headers)
        return response.status_code == 204

    def get_subscriptions(self):
        """Получение всех подписок"""
        access_token = self.get_app_access_token()
        if not access_token:
            return []

        url = "https://api.twitch.tv/helix/eventsub/subscriptions"
        headers = {
            'Client-ID': self.client_id,
            'Authorization': f'Bearer {access_token}'
        }

        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json().get('data', [])
        return []

    def verify_signature(self, body, signature, secret):
        """Проверка подписи webhook"""
        expected = hmac.new(
            secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)


eventsub_service = EventSubService()