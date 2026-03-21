import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const AuthCallback = () => {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        setError(error.message)
        setTimeout(() => navigate('/login'), 3000)
        return
      }

      if (data.session) {
        // Ждем создания профиля через триггер
        await new Promise(resolve => setTimeout(resolve, 1500))
        navigate('/profile')
      }
    }

    handleCallback()
  }, [navigate])

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