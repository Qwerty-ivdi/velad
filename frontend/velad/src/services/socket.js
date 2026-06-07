// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.messageHandlers = new Set();  // ← Храним обработчики
    this.connectCallbacks = new Set(); // ← Колбэки при подключении
  }

  connect(token) {
    if (this.socket && this.connected) {
      console.log('Socket already connected');
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
    
    console.log('🔌 Connecting to WebSocket at:', socketUrl);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected, id:', this.socket.id);
      this.socket.emit('authenticate', { token });
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated:', data);
      this.connected = true;
      // Вызываем все колбэки подключения
      this.connectCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('auth_error', (error) => {
      console.error('❌ Socket auth error:', error);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.connected = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('new_message', (message) => {
      console.log('📩 New message via socket:', message);
      // Вызываем все обработчики сообщений
      this.messageHandlers.forEach(handler => handler(message));
    });

    return this.socket;
  }

  // Добавляем обработчик новых сообщений
  onNewMessage(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  // Добавляем колбэк при подключении
  onConnect(callback) {
    this.connectCallbacks.add(callback);
    if (this.connected) {
      callback({ user_id: localStorage.getItem('user_id') });
    }
    return () => this.connectCallbacks.delete(callback);
  }

  sendMessage(receiverId, content, token) {
    if (this.socket && this.connected) {
      this.socket.emit('send_message', { token, receiver_id: receiverId, content });
      return true;
    }
    return false;
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