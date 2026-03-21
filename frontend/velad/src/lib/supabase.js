// src/lib/api.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'

export const api = {
  // Аутентификация
  async register(data) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  async login(data) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  async logout(token) {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    return response.json()
  },

  // Профиль
  async getProfile(token) {
    const response = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return response.json()
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
    return response.json()
  },

  async checkUsername(username) {
    const response = await fetch(`${API_URL}/profile/username/${username}`)
    return response.json()
  }
}