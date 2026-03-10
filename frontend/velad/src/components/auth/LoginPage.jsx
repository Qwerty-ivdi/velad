import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { FaTwitch, FaEnvelope, FaLock } from 'react-icons/fa'
import '../../styles/auth.css'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  const handleTwitchLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: window.location.origin + '/auth/callback'
      }
    })
    
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Введите email для сброса пароля')
      return
    }
    
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/callback'
    })
    
    if (error) {
      setError(error.message)
    } else {
      setMessage('Проверьте почту для сброса пароля')
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Velad</h1>
        <h2 className="auth-subtitle">Вход в аккаунт</h2>
        
        <div className="auth-link">
          Или <Link to="/register">зарегистрируйтесь</Link>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        {message && (
          <div className="auth-success">
            {message}
          </div>
        )}

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

          <div className="forgot-password">
            <button type="button" onClick={handlePasswordReset}>
              Забыли пароль?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="divider">
          <span>Или продолжить с</span>
        </div>

        <button
          onClick={handleTwitchLogin}
          disabled={loading}
          className="btn btn-twitch"
          style={{ width: '100%' }}
        >
          <FaTwitch /> Войти через Twitch
        </button>
      </div>
    </div>
  )
}

export default LoginPage