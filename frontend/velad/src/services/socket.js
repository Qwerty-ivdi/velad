// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.callbacks = [];
  }

  connect(userId, token) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production.up.railway.app' 
      : 'http://localhost:5000';
    
    console.log(`🔌 Creating socket for user ${userId}`);
    
    this.socket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
  console.log('✅ Socket connected, id:', this.socket.id);
  console.log('📤 Sending authenticate with userId:', userId);
  this.socket.emit('authenticate', { token, userId });
});

    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated:', data);
    });

    this.socket.on('new_message', (message) => {
      console.log('📩 New message received:', message);
      this.callbacks.forEach(cb => cb(message));
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket error:', err.message);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    return this.socket;
  }

  onMessage(callback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.callbacks = [];
  }

  isConnected() {
    return this.socket?.connected === true;
  }
}

export default new SocketService();