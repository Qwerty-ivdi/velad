// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production.up.railway.app' 
      : 'http://localhost:5000';
    
    console.log('🔌 Connecting WebSocket...');

    this.socket = io(socketUrl, {
      transports: ['websocket'],        // ТОЛЬКО websocket, НЕ polling
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 10000,
      path: '/socket.io/',              // явный путь
      upgrades: false,                  // не апгрейдить с polling
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.socket.emit('authenticate', { token });
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated');
      this.connected = true;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket error:', error.message);
      // Не блокируем другие запросы
    });

    return this.socket;
  }

  // Остальные методы...
}

export default new SocketService();