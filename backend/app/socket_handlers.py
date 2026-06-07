# app/socket_handlers.py
from flask import request
from flask_socketio import emit, join_room
from flask_jwt_extended import decode_token
from datetime import datetime
import uuid

def register_socket_handlers(socketio, db_service):

    @socketio.on('connect')
    def handle_connect():
        print(f"🔌 Client connected: {request.sid}")

    @socketio.on('disconnect')
    def handle_disconnect():
        print(f"🔌 Client disconnected: {request.sid}")

    @socketio.on('authenticate')
    def handle_authenticate(data):
        token = data.get('token')
        if not token:
            emit('auth_error', {'error': 'No token provided'})
            return

        try:
            # ✅ Используем decode_token из flask_jwt_extended
            payload = decode_token(token)
            user_id = payload.get('sub')

            if not user_id:
                emit('auth_error', {'error': 'Invalid token: no sub claim'})
                return

            # Присоединяем к комнате пользователя
            join_room(user_id)
            print(f"✅ User {user_id} authenticated, socket: {request.sid}")
            emit('authenticated', {'user_id': user_id})

        except Exception as e:
            print(f"❌ Auth error: {e}")
            emit('auth_error', {'error': str(e)})