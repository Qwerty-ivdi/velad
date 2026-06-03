// src/services/socket.js
import { io } from 'socket.io-client';
import { API_URL } from '../config';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(token) {
    if (this.socket && this.connected) {
      return this.socket;
    }

    // Определяем URL для WebSocket
    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production.up.railway.app' 
      : 'http://localhost:5000';
    
    console.log('🔌 Connecting to WebSocket at:', socketUrl);
    
    this.socket = io(socketUrl, {
      query: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected to:', socketUrl);
      this.connected = true;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.connected = false;
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      this.connected = false;
    });

    // Добавляем обработчик ошибок
    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.connected && this.socket?.connected;
  }
}

const socketService = new SocketService();
export default socketService;