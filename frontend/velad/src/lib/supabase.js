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

  async getProfile(token) {
    const response = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Ошибка получения профиля')
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

// Для обратной совместимости (чтобы не ломать старый код)
export const supabase = {
  auth: {
    signUp: async ({ email, password, options }) => {
      try {
        const result = await api.register({
          email,
          password,
          username: options?.data?.username || email.split('@')[0],
          display_name: options?.data?.display_name || email.split('@')[0]
        })
        return { data: { user: result.user }, error: null }
      } catch (error) {
        return { data: null, error: { message: error.message } }
      }
    },
    signInWithPassword: async ({ email, password }) => {
      try {
        const result = await api.login({ email, password })
        api.setToken(result.access_token)
        api.setUser(result.user)
        return { data: { user: result.user, session: { access_token: result.access_token } }, error: null }
      } catch (error) {
        return { data: null, error: { message: error.message } }
      }
    },
    signOut: async () => {
      api.removeToken()
      api.removeUser()
      return { error: null }
    },
    getSession: async () => {
      const token = api.getToken()
      const user = api.getUser()
      if (!token) return { data: { session: null } }
      return { data: { session: { access_token: token, user } }, error: null }
    }
  },
  from: () => ({
    insert: async () => ({ data: null, error: null }),
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: null }),
        execute: async () => ({ data: [], error: null })
      })
    })
  })
}