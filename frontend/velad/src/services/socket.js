// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(token) {
    if (this.socket && this.connected) {
      return this.socket;
    }

    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production.up.railway.app' 
      : 'http://localhost:5000';
    
    console.log('🔌 Connecting to WebSocket at:', socketUrl);
    
    // Используем polling если websocket не работает
    this.socket = io(socketUrl, {
      transports: ['polling', 'websocket'],  // polling как fallback
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.socket.emit('authenticate', { token });
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Authenticated:', data);
      this.connected = true;
    });

    this.socket.on('auth_error', (error) => {
      console.error('❌ Auth error:', error);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
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