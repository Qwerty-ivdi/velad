// src/lib/supabase.js
import { API_URL } from '../config.js';

export const api = {
  getTwitchToken: async (accessToken) => {
    try {
      const response = await fetch(`${API_URL}/twitch-token`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get Twitch token');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting Twitch token:', error);
      return { has_token: false };
    }
  },
  // ==================== РЕПОСТЫ ====================
  async repostPost(token, postId, content = '') {
    const response = await fetch(`${API_URL}/posts/${postId}/repost`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка создания репоста');
    return result;
  },

  async getUserReposts(userId, token) {
    const response = await fetch(`${API_URL}/profile/${userId}/reposts`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения репостов');
    return result;
  },

  async removeRepost(token, postId) {
    const response = await fetch(`${API_URL}/posts/${postId}/repost`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка удаления репоста');
    return result;
  },

  async getReposts(token, postId) {
    const response = await fetch(`${API_URL}/posts/${postId}/reposts`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения репостов');
    return result.reposts;
  },

   // ==================== АУТЕНТИФИКАЦИЯ ====================
  async register(data) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка регистрации');
    return result;
  },

  async login(data) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка входа');
    return result;
  },

  async getProfile(token) {
    console.log('📡 getProfile called with token:', token ? token.substring(0, 50) + '...' : 'null');
    
    if (!token) {
      throw new Error('No token provided');
    }
    
    const response = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('📡 Profile response status:', response.status);
    
    if (response.status === 401) {
      // Токен просрочен или невалиден
      throw new Error('Token expired');
    }
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Ошибка получения профиля');
    }
    
    const result = await response.json();
    console.log('📡 Profile response data:', result);
    return result;
  },

  // ==================== ХРАНЕНИЕ ТОКЕНА ====================
  setToken(token) {
    localStorage.setItem('access_token', token);
  },

  getToken() {
    return localStorage.getItem('access_token');
  },

  removeToken() {
    localStorage.removeItem('access_token');
  },

  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  removeUser() {
    localStorage.removeItem('user');
  },

  // ==================== МЕССЕНДЖЕР ====================
  async getConversations(token) {
    const response = await fetch(`${API_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения диалогов');
    return result;
  },

  async getConversationMessages(token, conversationId) {
    const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения сообщений');
    return result;
  },

  // ==================== ПРОФИЛЬ ====================
  
  async getUserById(userId) {
    const response = await fetch(`${API_URL}/profile/${userId}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения пользователя');
    return result;
  },

  async updateProfile(token, data) {
    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка обновления профиля');
    return result;
  },

  // ==================== КОММЕНТАРИИ ====================
  async getComments(token, postId, limit = 50) {
    const response = await fetch(`${API_URL}/posts/${postId}/comments?limit=${limit}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения комментариев');
    return result;
  },

  async createComment(token, postId, content, parentId = null) {
    const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, parent_id: parentId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка создания комментария');
    return result;
  },

  async deleteComment(token, commentId) {
    const response = await fetch(`${API_URL}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка удаления комментария');
    return result;
  },

  async likeComment(token, commentId) {
    const response = await fetch(`${API_URL}/comments/${commentId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка');
    return result;
  },

  // ==================== ПОСТЫ ====================
  async updatePost(token, postId, content) {
    const response = await fetch(`${API_URL}/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка редактирования поста');
    return result;
  },

  async deletePost(token, postId) {
    const response = await fetch(`${API_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка удаления поста');
    return result;
  },

  async createPost(token, data) {
    const response = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('Create post error:', result);
      throw new Error(result.error || 'Ошибка создания поста');
    }
    return result;
  },

  async getUserPosts(userId, token, limit = 20, offset = 0) {
    try {
      const url = `${API_URL}/profile/${userId}/posts?limit=${limit}&offset=${offset}`;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(url, { headers });
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || 'Ошибка получения постов');
      
      return result.map(post => ({
        ...post,
        username: post.username || 'user',
        display_name: post.display_name || 'Пользователь',
        avatar_url: post.avatar_url || null
      }));
    } catch (err) {
      console.error('getUserPosts error:', err);
      throw err;
    }
  },

  async likePost(token, postId) {
    const response = await fetch(`${API_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка');
    return result;
  },

  // ==================== ЗАГРУЗКА ИЗОБРАЖЕНИЙ ====================
  async uploadImage(token, file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка загрузки');
    return result;
  },

  // ==================== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ====================
  async searchUsers(token, query, limit = 20) {
    const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка поиска');
    return result.users;
  },

  // ==================== ПОДПИСКИ ====================
  async followUser(token, userId) {
    const response = await fetch(`${API_URL}/users/${userId}/follow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка');
    return result;
  },

  async unfollowUser(token, userId) {
    const response = await fetch(`${API_URL}/users/${userId}/unfollow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка');
    return result;
  },

  async getFollowers(token, userId, limit = 20, offset = 0) {
    const response = await fetch(`${API_URL}/users/${userId}/followers?limit=${limit}&offset=${offset}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения подписчиков');
    return result.followers || [];
  },

  async getFollowing(token, userId, limit = 20, offset = 0) {
    const response = await fetch(`${API_URL}/users/${userId}/following?limit=${limit}&offset=${offset}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения подписок');
    return result.following || [];
  },

  // ==================== СТАТИСТИКА ====================
  async getUserStats(userId) {
    const response = await fetch(`${API_URL}/profile/${userId}/stats`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения статистики');
    return result;
  },

  async getProfileWithFollowStatus(token, userId) {
    const response = await fetch(`${API_URL}/profile/${userId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка получения профиля');
    return result;
  }
};

// ==================== TWITCH AUTH ====================
export const twitchAuth = {
  login: () => {
    const url = `${API_URL}/auth/twitch/login`;
    console.log('🔍 LOGIN URL:', url);
    window.location.href = `${API_URL}/auth/twitch/login`;
  },
  register: () => {
    window.location.href = `${API_URL}/auth/twitch/login`;
  }
};