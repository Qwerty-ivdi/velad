// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.messageHandler = null;
    this.authHandlers = [];
  }

  connect(userId, token) {
  // Если уже есть сокет с другим пользователем — переподключаемся
  if (this.socket && this.currentUserId !== userId) {
    console.log(`🔄 User changed from ${this.currentUserId} to ${userId}, reconnecting...`);
    this.disconnect();
  }

    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.disconnect();
    }

    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production-c7d5.up.railway.app' 
      : 'http://localhost:5000';
    
    console.log(`🔌 Creating socket for user ${userId}`);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      secure: true,
      rejectUnauthorized: false
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected, id:', this.socket.id);
      this.socket.emit('authenticate', { token, userId });
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated:', data);
      this.connected = true;
      this.authHandlers.forEach(handler => handler(data));
    });

    this.socket.on('new_message', (message) => {
      console.log('📩 New message received:', message);
      if (this.messageHandler) {
        this.messageHandler(message);
      }
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket error:', err.message);
      this.connected = false;
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      this.connected = false;
    });

    return this.socket;
  }

  isConnected() {
    return this.connected && this.socket?.connected === true;
  }

  onMessage(handler) {
    this.messageHandler = handler;
    return () => { this.messageHandler = null; };
  }

  onAuthenticated(handler) {
    this.authHandlers.push(handler);
    return () => {
      this.offAuthenticated(handler);
    };
  }

  offAuthenticated(handler) {
    this.authHandlers = this.authHandlers.filter(h => h !== handler);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.messageHandler = null;
      this.authHandlers = [];
    }
  }
}

const socketService = new SocketService();
export default socketService;