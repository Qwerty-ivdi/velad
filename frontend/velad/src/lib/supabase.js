// src/lib/supabase.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'

export const api = {
  // Аутентификация
  async register(data) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Ошибка регистрации')
    return result
  },

  async login(data) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Ошибка входа')
    return result
  },

  // Профиль
  async getProfile(token) {
    const response = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Ошибка получения профиля')
    return result
  },

  async getUserById(userId) {
    const response = await fetch(`${API_URL}/profile/${userId}`)
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Ошибка получения пользователя')
    return result
  },

  async updateProfile(token, data) {
    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Ошибка обновления профиля')
    return result
  },

  // Комментарии
async getComments(token, postId, limit = 20, offset = 0) {
  const response = await fetch(`${API_URL}/posts/${postId}/comments?limit=${limit}&offset=${offset}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка получения комментариев')
  return result
},

async createComment(token, postId, content, parentId = null) {
  const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content, parent_id: parentId })
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка создания комментария')
  return result
},

async deleteComment(token, commentId) {
  const response = await fetch(`${API_URL}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка удаления комментария')
  return result
},

async likeComment(token, commentId) {
  const response = await fetch(`${API_URL}/comments/${commentId}/like`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка')
  return result
},

  // Посты
async updatePost(token, postId, content) {
  const response = await fetch(`${API_URL}/posts/${postId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка редактирования поста')
  return result
},

async deletePost(token, postId) {
  const response = await fetch(`${API_URL}/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка удаления поста')
  return result
},

  async createPost(token, data) {  // ← только один createPost!
    const response = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    const result = await response.json()
    if (!response.ok) {
      console.error('Create post error:', result)
      throw new Error(result.error || 'Ошибка создания поста')
    }
    return result
  },

  async getUserPosts(userId, token, limit = 20, offset = 0) {
  try {
    const url = `${API_URL}/profile/${userId}/posts?limit=${limit}&offset=${offset}`
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
    const response = await fetch(url, { headers })
    const result = await response.json()
    
    if (!response.ok) throw new Error(result.error || 'Ошибка получения постов')
    
    // Убеждаемся, что каждый пост имеет поля пользователя
    return result.map(post => ({
      ...post,
      username: post.username || 'user',
      display_name: post.display_name || 'Пользователь',
      avatar_url: post.avatar_url || null
    }))
  } catch (err) {
    console.error('getUserPosts error:', err)
    throw err
  }
},

  async likePost(token, postId) {
    const response = await fetch(`${API_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Ошибка')
    return result
  },

  async uploadImage(token, file) {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Ошибка загрузки')
    return result
  },

  // Поиск пользователей
async searchUsers(token, query, limit = 20) {
  const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка поиска')
  return result.users
},

// Подписка/отписка
async followUser(token, userId) {
  const response = await fetch(`${API_URL}/users/${userId}/follow`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка')
  return result
},

async unfollowUser(token, userId) {
  const response = await fetch(`${API_URL}/users/${userId}/unfollow`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка')
  return result
},

async getFollowers(token, userId, limit = 20, offset = 0) {
  const response = await fetch(`${API_URL}/users/${userId}/followers?limit=${limit}&offset=${offset}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка')
  return result.followers || []
},

async getFollowing(token, userId, limit = 20, offset = 0) {
  const response = await fetch(`${API_URL}/users/${userId}/following?limit=${limit}&offset=${offset}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка')
  return result.following || []
},

async likePost(token, postId) {
  const response = await fetch(`${API_URL}/posts/${postId}/like`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка')
  return result  
},

async getProfileWithFollowStatus(token, userId) {
  const response = await fetch(`${API_URL}/profile/${userId}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ошибка получения профиля')
  return result
},

  // Хранение токена
  setToken(token) {
    localStorage.setItem('access_token', token)
  },

  getToken() {
    return localStorage.getItem('access_token')
  },

  removeToken() {
    localStorage.removeItem('access_token')
  },

  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user))
  },

  getUser() {
    const user = localStorage.getItem('user')
    return user ? JSON.parse(user) : null
  },

  removeUser() {
    localStorage.removeItem('user')
  }
}