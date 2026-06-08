// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(token, userId) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production.up.railway.app' 
      : 'http://localhost:5000';
    
    console.log('🔌 Connecting to WebSocket:', socketUrl);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
      this.socket.emit('authenticate', { token });
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Authenticated:', data);
      this.isConnected = true;
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

export default new SocketService();