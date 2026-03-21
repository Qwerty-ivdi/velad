import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../lib/supabase'  // ← импорт api
import { FaTwitch, FaEnvelope, FaLock } from 'react-icons/fa'
import '../../styles/auth.css'

const LoginPage = ({ setUser }) => {  // ← добавляем setUser
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const result = await api.login({ email, password })
      api.setToken(result.access_token)
      api.setUser(result.user)
      if (setUser) {
        setUser(result.user)
      }
      navigate('/profile')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTwitchLogin = async () => {
    setLoading(true)
    window.location.href = 'http://localhost:5000/api/auth/twitch/auth'
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Velad</h1>
        <h2 className="auth-subtitle">Вход в аккаунт</h2>
        
        <div className="auth-link">
          Или <Link to="/register">зарегистрируйтесь</Link>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleEmailLogin}>
          <div className="form-group">
            <div className="input-with-icon">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-with-icon">
              <FaLock className="input-icon" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Пароль"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="divider"><span>Или продолжить с</span></div>

        <button onClick={handleTwitchLogin} disabled={loading} className="btn btn-twitch">
          <FaTwitch /> Войти через Twitch
        </button>
      </div>
    </div>
  )
}

export default LoginPage