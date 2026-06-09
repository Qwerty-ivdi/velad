// src/components/messenger/Messenger.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const isMounted = useRef(true);

  const loadConversations = useCallback(async () => {
    try {
      const token = api.getToken();
      if (!token) return [];

      const response = await fetch(`${API_URL}/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return [];

      const data = await response.json();
      if (Array.isArray(data) && isMounted.current) {
        setConversations(data);
        return data;
      }
      return [];
    } catch (err) {
      console.error('Error loading conversations:', err);
      return [];
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const token = api.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      if (isMounted.current) {
        setMessages(data || []);
        scrollToBottom();
      }
      
      await fetch(`${API_URL}/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      loadConversations();
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, [loadConversations]);

  // ========== WEBSOCKET ПОДКЛЮЧЕНИЕ ==========
useEffect(() => {
  if (!currentUserId) return;
  
  const token = api.getToken();
  if (!token) return;
  
  // Подключаем сокет (метод сам проверит, нужно ли переподключаться)
  socketService.connect(currentUserId, token);
  
  const unsubscribe = socketService.onMessage((message) => {
    console.log('📩 New message via WebSocket:', message);
    loadConversations();
    
    if (selectedConversation && message.conversation_id === selectedConversation.id) {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      scrollToBottom();
    }
  });
  
  const handleAuthenticated = () => {
    console.log('✅ Authenticated, joining rooms...');
    // Входим в комнату выбранного диалога
    if (selectedConversation?.id) {
      const roomName = `conversation_${selectedConversation.id}`;
      socketService.socket?.emit('join_room', { room_id: roomName });
    }
  };
  
  socketService.onAuthenticated(handleAuthenticated);
  
  return () => {
    unsubscribe();
    socketService.offAuthenticated(handleAuthenticated);
    // НЕ отключаем сокет при размонтировании компонента!
    // socketService.disconnect();
  };
}, [currentUserId, selectedConversation, loadConversations]);

  // ========== ЗАГРУЗКА ДИАЛОГОВ И ВХОД В КОМНАТЫ ==========
  useEffect(() => {
    const loadAndJoin = async () => {
      const token = api.getToken();
      if (!token) {
        if (isMounted.current) setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/conversations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && isMounted.current) {
            setConversations(data);
            
            // Входим в комнаты всех диалогов
            if (socketService.isConnected() && data.length > 0) {
              data.forEach(conv => {
                const roomName = `conversation_${conv.id}`;
                console.log(`🔗 Auto-joining room: ${roomName}`);
                socketService.socket?.emit('join_room', { room_id: roomName });
              });
            }
          }
        }
      } catch (err) {
        console.error('Error loading conversations:', err);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };
    
    loadAndJoin();
  }, []); // Только при монтировании

  // ========== ИНИЦИАЛИЗАЦИЯ ДИАЛОГА С ДРУГИМ ПОЛЬЗОВАТЕЛЕМ ==========
  useEffect(() => {
    if (!otherUserId) return;

    const initConversation = async () => {
      const convs = await loadConversations();
      const existing = convs.find(c => c.other_user_id === otherUserId);

      if (existing) {
        setSelectedConversation(existing);
        await loadMessages(existing.id);
        // Вход в комнату
        const roomName = `conversation_${existing.id}`;
        socketService.socket?.emit('join_room', { room_id: roomName });
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
          // Вход в новую комнату
          const roomName = `conversation_${data.id}`;
          socketService.socket?.emit('join_room', { room_id: roomName });
        }
      }
    };

    initConversation();
  }, [otherUserId, otherUserName, otherUserAvatar, loadConversations, loadMessages]);

  // ========== ОТПРАВКА СООБЩЕНИЯ ==========
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    if (!selectedConversation) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const token = api.getToken();
      
      if (socketService.isConnected()) {
        console.log('📤 Sending via WebSocket');
        socketService.socket?.emit('send_message', {
          receiver_id: selectedConversation.other_user_id,
          content: messageContent
        });
      } else {
        // REST fallback
        const tempMessage = {
          id: 'temp-' + Date.now(),
          sender_id: currentUserId,
          receiver_id: selectedConversation?.other_user_id,
          content: messageContent,
          created_at: new Date().toISOString(),
          is_temp: true
        };
        setMessages(prev => [...prev, tempMessage]);
        scrollToBottom();
        
        const response = await fetch(`${API_URL}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            receiver_id: selectedConversation.other_user_id,
            content: messageContent
          })
        });

        if (response.ok) {
          const result = await response.json();
          setMessages(prev => prev.map(msg =>
            msg.id === tempMessage.id ? result : msg
          ));
          loadConversations();
        } else {
          throw new Error('Failed to send');
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

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

  // Очистка при размонтировании
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
                  console.log(`🔄 Switching to conversation: ${conv.id}`);
                  setSelectedConversation(conv);
                  loadMessages(conv.id);
                  const roomName = `conversation_${conv.id}`;
                  socketService.socket?.emit('join_room', { room_id: roomName });
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