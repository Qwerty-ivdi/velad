// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentUserId = null;
    this.callbacks = [];
  }

  connect(userId, token) {
    if (this.socket?.connected && this.currentUserId === userId) {
      console.log('Socket already connected');
      return this.socket;
    }

    if (this.socket) {
      this.disconnect();
    }

    this.currentUserId = userId;
    
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

  isConnected() {
    return this.socket?.connected === true;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.callbacks = [];
    this.currentUserId = null;
  }
}

// Делаем глобальным для отладки
if (typeof window !== 'undefined') {
  window.socketService = new SocketService();
}

const socketService = new SocketService();
export default socketService;