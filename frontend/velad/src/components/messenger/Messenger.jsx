// src/components/messenger/Messenger.jsx
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/supabase';
import { API_URL } from '../../config';
import socketService from '../../services/socket';
import './Messenger.css';

const Messenger = ({ currentUserId, otherUserId, otherUserName, otherUserAvatar, onClose }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Получаем сокет с проверкой подключения
  const getSocket = () => {
    const socket = socketService.getSocket();
    if (!socket || !socketService.isConnected()) {
      console.log('⚠️ WebSocket not connected, reconnecting...');
      const token = api.getToken();
      socketService.connect(token);
      return socketService.getSocket();
    }
    return socket;
  };

  // Загрузка диалогов
  const loadConversations = async () => {
  try {
    const token = api.getToken();
    const response = await fetch(`${API_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // 1. Проверяем, успешен ли ответ
    if (!response.ok) {
      console.error(`Ошибка загрузки диалогов: ${response.status}`);
      return []; 
    }
    
    const data = await response.json();
    
    // 2. Проверяем, что data — это массив
    if (!Array.isArray(data)) {
      console.error('Сервер вернул не массив для диалогов:', data);
      return []; 
    }
    
    setConversations(data);
    return data;
  } catch (err) {
    console.error('Error loading conversations:', err);
    return [];
  }
};

  // Загрузка сообщений
  const loadMessages = async (conversationId) => {
    try {
      const token = api.getToken();
      const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMessages(data || []);
      markAsRead(conversationId);
      scrollToBottom();
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  // Отметить как прочитанное
  const markAsRead = async (conversationId) => {
    try {
      const token = api.getToken();
      await fetch(`${API_URL}/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadConversations();
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  // Отправка сообщения
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    
    console.log("📤 Sending message...");
    console.log("WebSocket connected:", socketService.isConnected());
    
    setSending(true);
    
    // Создаем временное сообщение
    const tempMessage = {
      id: 'temp-' + Date.now(),
      sender_id: currentUserId,
      receiver_id: selectedConversation.other_user_id,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      is_temp: true
    };
    
    // Сразу добавляем сообщение в список
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();
    
    try {
      const token = api.getToken();
      const socket = getSocket();
      
      if (socket && socketService.isConnected()) {
        console.log("✅ Sending via WebSocket");
        socket.emit('send_message', {
          token: token,
          receiver_id: selectedConversation.other_user_id,
          content: tempMessage.content
        });
      } else {
        console.log("⚠️ WebSocket not connected, using REST fallback");
        // Fallback на REST
        const response = await fetch(`${API_URL}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            receiver_id: selectedConversation.other_user_id,
            content: tempMessage.content
          })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          // Заменяем временное сообщение на реальное
          setMessages(prev => prev.map(msg => 
            msg.id === tempMessage.id ? result : msg
          ));
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      // Удаляем временное сообщение при ошибке
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  };

  // При открытии диалога с otherUserId
  useEffect(() => {
      const initConversation = async () => {
      if (otherUserId) {
        const convs = await loadConversations();
        const existing = convs.length > 0 ? convs.find(c => c.other_user_id === otherUserId) : null;
        
        if (existing) {
          setSelectedConversation(existing);
          await loadMessages(existing.id);
        } else {
          const token = api.getToken();
          const response = await fetch(`${API_URL}/conversations/create`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ other_user_id: otherUserId })
          });
          
          if (response.ok) {
            const data = await response.json();
            const newConv = {
              id: data.id,
              other_user_id: otherUserId,
              other_user_name: otherUserName,
              other_user_avatar: otherUserAvatar,
              last_message: '',
              unread_count: 0
            };
            setSelectedConversation(newConv);
          }
        }
        setLoading(false);
      }
    };
    
    if (otherUserId) {
      initConversation();
    }
  }, [otherUserId, loadMessages, otherUserAvatar, otherUserName]);

  useEffect(() => {
  const loadAllConversations = async () => {
    console.log('🔍 Loading all conversations for messenger');
    const convs = await loadConversations();
    setConversations(convs);
    setLoading(false);
  };
  
  loadAllConversations();
}, []);

  useEffect(() => {
  const socket = socketService.getSocket();
  if (!socket) return;

  console.log("🔌 Setting up listeners, socket connected:", socket.connected);

  const handleNewMessage = (message) => {
    console.log('📩 New message received:', message);
    
    // Обновляем список диалогов
    loadConversations();
    
    // Проверяем, относится ли сообщение к текущему открытому диалогу
    if (selectedConversation && message.sender_id === selectedConversation.other_user_id) {
      console.log('✅ Message belongs to current conversation, adding to messages');
      
      setMessages(prev => {
        // Проверяем, нет ли уже такого сообщения
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      
      markAsRead(selectedConversation.id);
      scrollToBottom();
    } else if (!selectedConversation && message.receiver_id === currentUserId) {
      // Если диалог не открыт, но пришло новое сообщение - обновляем список диалогов
      console.log('📩 New message from unknown conversation, refreshing list');
      loadConversations();
    }
  };

  const handleMessageSent = (message) => {
    console.log('✅ Message sent confirmation:', message);
    
    // Обновляем список диалогов
    loadConversations();
    
    // Обновляем сообщение, если оно было временным
    setMessages(prev => prev.map(msg => 
      (msg.is_temp && msg.content === message.content && msg.sender_id === message.sender_id)
        ? { ...message, is_temp: false }
        : msg
    ));
  };

  socket.on('new_message', handleNewMessage);
  socket.on('message_sent', handleMessageSent);

  return () => {
    socket.off('new_message', handleNewMessage);
    socket.off('message_sent', handleMessageSent);
  };
}, [selectedConversation, currentUserId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="messenger">
        <div className="messenger-header">
          <h3>💬 Сообщения</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="messenger-loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="messenger">
      <div className="messenger-header">
        <h3>💬 Сообщения</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="messenger-body">
        {/* Список диалогов */}
        <div className="conversations-list">
          {conversations.length === 0 && !otherUserId ? (
            <div className="no-conversations">
              <p>Нет диалогов</p>
              <p className="hint">Напишите кому-нибудь первым!</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv.id}
                className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedConversation(conv);
                  loadMessages(conv.id);
                }}
              >
                <img 
                  src={conv.other_user_avatar || `https://ui-avatars.com/api/?name=${conv.other_user_name}&background=9146FF&color=fff&size=48`} 
                  alt={conv.other_user_name}
                />
                <div className="conv-info">
                  <h4>{conv.other_user_name}</h4>
                  <p className="last-message">{conv.last_message?.substring(0, 50) || 'Новое сообщение'}</p>
                </div>
                {conv.unread_count > 0 && <span className="unread-badge">{conv.unread_count}</span>}
              </div>
            ))
          )}
        </div>

        {/* Область сообщений */}
        {selectedConversation ? (
          <div className="messages-area">
            <div className="messages-header">
              <img 
                src={selectedConversation.other_user_avatar || `https://ui-avatars.com/api/?name=${selectedConversation.other_user_name}&background=9146FF&color=fff&size=40`} 
                alt=""
              />
              <h4>{selectedConversation.other_user_name}</h4>
            </div>

            <div className="messages-list">
              {messages.map((msg, index) => (
                <div 
                  key={msg.id || index}
                  className={`message ${msg.sender_id === currentUserId ? 'sent' : 'received'} ${msg.is_temp ? 'temp' : ''}`}
                >
                  <div className="message-content">
                    <p>{msg.content}</p>
                    <span className="message-time">
                      {msg.is_temp ? '⌛ Отправка...' : formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="message-input-form">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                disabled={sending}
              />
              <button type="submit" disabled={sending || !newMessage.trim()}>
                {sending ? '...' : 'Отправить'}
              </button>
            </form>
          </div>
        ) : (
  <div className="no-conversation-selected">
    {conversations.length === 0 ? (
      <div className="empty-state">
        <p>У вас пока нет диалогов</p>
        <p className="hint">Напишите кому-нибудь первым!</p>
      </div>
    ) : (
      <p>Выберите диалог, чтобы начать общение</p>
    )}
  </div>
)}
      </div>
    </div>
  );
};

export default Messenger;