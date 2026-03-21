import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/supabase'

const AuthCallback = ({ setUser }) => {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleCallback = async () => {
      // Получаем параметры из URL
      const params = new URLSearchParams(window.location.search)
      const access_token = params.get('access_token')
      
      if (access_token) {
        api.setToken(access_token)
        try {
          const profile = await api.getProfile(access_token)
          api.setUser(profile)
          if (setUser) setUser(profile)
          navigate('/profile')
        } catch (err) {
          setError(err.message)
        }
      } else {
        setError('Не удалось получить токен авторизации')
      }
    }

    handleCallback()
  }, [navigate, setUser])

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2 className="auth-subtitle">Ошибка авторизации</h2>
          <div className="auth-error">{error}</div>
          <button onClick={() => navigate('/login')} className="btn btn-primary">
            Вернуться на главную
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h2 className="auth-subtitle">Вход через Twitch</h2>
        <div className="spinner" style={{ margin: '1rem auto' }}></div>
        <p>Перенаправление...</p>
      </div>
    </div>
  )
}

export default AuthCallback