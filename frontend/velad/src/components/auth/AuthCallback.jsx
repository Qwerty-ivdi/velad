import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../common/LoadingSpinner'

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
        // Проверяем/создаем профиль через триггер
        navigate('/profile')
      }
    }

    handleCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-6 py-4 rounded-lg">
          Ошибка: {error}. Перенаправление...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner />
    </div>
  )
}

export default AuthCallback