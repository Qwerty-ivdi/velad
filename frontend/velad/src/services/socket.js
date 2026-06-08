// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.messageHandler = null;
  }

  connect(userId, token) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    if (this.socket) {
      this.disconnect();
    }

    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production.up.railway.app' 
      : 'http://localhost:5000';
    
    console.log(`🔌 Creating socket for user ${userId}`);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
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
      this.connected = true;
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
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.messageHandler = null;
    }
  }
}

const socketService = new SocketService();
export default socketService;