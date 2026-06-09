// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentUserId = null;
    this.messageHandler = null;
    this.authHandlers = [];
    this.isConnecting = false;
  }

  connect(userId, token) {
    // Уже подключены к этому пользователю
    if (this.socket?.connected && this.currentUserId === userId) {
      console.log('✅ Socket already connected for user:', userId);
      return this.socket;
    }

    // Уже в процессе подключения
    if (this.isConnecting) {
      console.log('⏳ Socket already connecting, waiting...');
      return this.socket;
    }

    // Отключаемся от старого пользователя
    if (this.socket) {
      console.log(`🔌 Disconnecting from old user: ${this.currentUserId}`);
      this.disconnect();
    }

    this.isConnecting = true;
    this.currentUserId = userId;

    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production-c7d5.up.railway.app32452' 
      : 'http://localhost:5000';
    
    console.log(`🔌 Creating socket for user ${userId}`);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected, id:', this.socket.id);
      this.isConnecting = false;
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
      this.isConnecting = false;
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
      this.authHandlers = this.authHandlers.filter(h => h !== handler);
    };
  }

  offAuthenticated(handler) {
    this.authHandlers = this.authHandlers.filter(h => h !== handler);
  }

  disconnect() {
    this.isConnecting = false;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.currentUserId = null;
    this.messageHandler = null;
    this.authHandlers = [];
  }
}

const socketService = new SocketService();
export default socketService;