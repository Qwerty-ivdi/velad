import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { FaTwitch, FaUser, FaEnvelope, FaLock } from 'react-icons/fa'
import '../../styles/auth.css'

const RegisterPage = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleEmailRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Валидация
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      setLoading(false)
      return
    }

    try {
      // 1. Регистрация пользователя в Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
            display_name: formData.displayName,
            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.displayName)}&background=9146FF&color=fff&size=128`
          }
        }
      })

      if (signUpError) {
        throw signUpError
      }

      if (!authData.user) {
        throw new Error('Ошибка при создании пользователя')
      }

      // 2. Ждем создания профиля (триггер сработает автоматически)
      // Делаем небольшую задержку, чтобы триггер успел сработать
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 3. Проверяем, создался ли профиль
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (profileError) {
        // Если профиль не создался, создаем вручную
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            username: formData.username,
            display_name: formData.displayName,
            email: formData.email,
            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.displayName)}&background=9146FF&color=fff&size=128`
          })

        if (insertError) {
          console.error('Error creating profile:', insertError)
        }
      }

      // 4. Перенаправляем на страницу профиля
      navigate('/profile')
      
    } catch (err) {
      setError(err.message || 'Ошибка при регистрации')
      console.error('Registration error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTwitchRegister = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Velad</h1>
        <h2 className="auth-subtitle">Создать аккаунт</h2>
        
        <div className="auth-link">
          Или <Link to="/login">войдите в существующий</Link>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailRegister}>
          <div className="form-group">
            <div className="input-with-icon">
              <FaUser className="input-icon" />
              <input
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="form-input"
                placeholder="Имя пользователя"
              />
            </div>
          </div>

          <div className="form-group">
            <input
              name="displayName"
              type="text"
              required
              value={formData.displayName}
              onChange={handleChange}
              className="form-input"
              placeholder="Отображаемое имя"
            />
          </div>

          <div className="form-group">
            <div className="input-with-icon">
              <FaEnvelope className="input-icon" />
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                placeholder="Email"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-with-icon">
              <FaLock className="input-icon" />
              <input
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                placeholder="Пароль"
              />
            </div>
          </div>

          <div className="form-group">
            <input
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="form-input"
              placeholder="Подтвердите пароль"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="divider">
          <span>Или продолжить с</span>
        </div>

        <button
          onClick={handleTwitchRegister}
          disabled={loading}
          className="btn btn-twitch"
        >
          <FaTwitch /> Зарегистрироваться через Twitch
        </button>

        <p className="terms-text">
          Регистрируясь, вы соглашаетесь с нашими{' '}
          <a href="/terms">Условиями использования</a>{' '}
          и{' '}
          <a href="/privacy">Политикой конфиденциальности</a>
        </p>
      </div>
    </div>
  )
}

export default RegisterPage