// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentUserId = null;
    this.reconnectTimer = null;
    this.messageHandlers = new Map(); // Храним обработчики по пользователям
  }

  connect(userId, token) {
    // Если уже подключены с этим пользователем — возвращаем
    if (this.socket && this.currentUserId === userId && this.socket.connected) {
      console.log(`✅ Socket already connected for user ${userId}`);
      return this.socket;
    }

    // Если подключены с другим пользователем — переподключаемся
    if (this.socket) {
      console.log(`🔄 Switching socket from user ${this.currentUserId} to ${userId}`);
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
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 10000,
      query: { userId }, // Передаём userId в query
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log(`✅ Socket connected for user ${userId}`);
      this.socket.emit('authenticate', { token, userId });
    });

    this.socket.on('authenticated', (data) => {
      console.log(`✅ Socket authenticated for user ${userId}`);
    });

    this.socket.on('new_message', (message) => {
      // Вызываем обработчики только для этого пользователя
      const handlers = this.messageHandlers.get(userId) || [];
      handlers.forEach(handler => handler(message));
    });

    this.socket.on('connect_error', (error) => {
      console.error(`❌ Socket error for user ${userId}:`, error.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected for user ${userId}:`, reason);
    });

    return this.socket;
  }

  onNewMessage(userId, handler) {
    if (!this.messageHandlers.has(userId)) {
      this.messageHandlers.set(userId, []);
    }
    this.messageHandlers.get(userId).push(handler);
    
    // Возвращаем функцию для отписки
    return () => {
      const handlers = this.messageHandlers.get(userId);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      }
    };
  }

  sendMessage(receiverId, content, token) {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ Socket not connected, using REST fallback');
      return false;
    }
    
    this.socket.emit('send_message', { token, receiver_id: receiverId, content });
    return true;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.currentUserId = null;
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket?.connected === true;
  }
}

export default new SocketService();