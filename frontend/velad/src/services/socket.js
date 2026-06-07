// src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.messageHandlers = new Set();
    this.connectCallbacks = new Set();
    this.disconnectCallbacks = new Set();
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
  }

  connect(token) {
    // Уже подключены
    if (this.socket && this.connected && this.socket.connected) {
      return this.socket;
    }

    // Есть сокет, но отключён — чистим
    if (this.socket) {
      this.cleanup();
      this.socket = null;
    }

    const isProduction = window.location.hostname !== 'localhost';
    const socketUrl = isProduction 
      ? 'https://velad-production.up.railway.app' 
      : 'http://localhost:5000';
    
    console.log('🔌 Creating new socket connection');

    this.socket = io(socketUrl, {
      transports: ['websocket'], // только WebSocket, без polling
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      forceNew: true,
      pingInterval: 25000,   // сервер шлёт ping каждые 25 сек
      pingTimeout: 60000,    // таймаут 60 сек
      upgrade: false         // не пытаемся апгрейдить с polling
    });

    // Основные обработчики
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.socket.emit('authenticate', { token });
      this.startHeartbeat();
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated');
      this.connected = true;
      this.connectCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('new_message', (message) => {
      this.messageHandlers.forEach(handler => handler(message));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.connected = false;
      this.stopHeartbeat();
      this.disconnectCallbacks.forEach(cb => cb(reason));
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('⚠️ Max reconnects reached, stopping');
        this.disconnect();
      }
    });

    return this.socket;
  }

  // Клиентский heartbeat (дополнительная проверка)
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        // Проверяем, что сокет жив
        if (this.socket.connected) {
          this.socket.emit('ping');
        } else {
          console.warn('⚠️ Socket seems dead, will reconnect');
          this.connected = false;
        }
      }
    }, 30000); // каждые 30 секунд
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  cleanup() {
    this.stopHeartbeat();
    this.messageHandlers.clear();
    this.connectCallbacks.clear();
    this.disconnectCallbacks.clear();
    
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
  }

  onNewMessage(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnect(callback) {
    this.connectCallbacks.add(callback);
    if (this.connected) {
      callback({ user_id: localStorage.getItem('user_id') });
    }
    return () => this.connectCallbacks.delete(callback);
  }

  onDisconnect(callback) {
    this.disconnectCallbacks.add(callback);
    return () => this.disconnectCallbacks.delete(callback);
  }

  sendMessage(receiverId, content, token) {
    if (!this.socket || !this.connected) {
      console.warn('⚠️ Cannot send message: socket not connected');
      return false;
    }
    
    this.socket.emit('send_message', { token, receiver_id: receiverId, content });
    return true;
  }

  disconnect() {
    this.cleanup();
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.connected && this.socket?.connected === true;
  }
}

const socketService = new SocketService();
export default socketService;