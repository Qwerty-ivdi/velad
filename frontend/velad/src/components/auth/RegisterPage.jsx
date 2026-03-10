import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { FaTwitch, FaUser, FaEnvelope, FaLock } from 'react-icons/fa'

const RegisterPage = () => {
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

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают')
      setLoading(false)
      return
    }

    // Регистрация через email
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          username: formData.username,
          display_name: formData.displayName,
          avatar_url: `https://ui-avatars.com/api/?name=${formData.displayName}&background=9146FF&color=fff&size=128`
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Создаем запись в profiles через триггер или напрямую
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          username: formData.username,
          display_name: formData.displayName,
          email: formData.email,
          avatar_url: `https://ui-avatars.com/api/?name=${formData.displayName}&background=9146FF&color=fff&size=128`
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
      }
    }

    setLoading(false)
  }

  const handleTwitchRegister = async () => {
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

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-gray-800 p-10 rounded-xl shadow-2xl">
        <div>
          <h1 className="text-center text-4xl font-extrabold text-white">
            Velad
          </h1>
          <h2 className="mt-6 text-center text-3xl font-bold text-white">
            Создать аккаунт
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Или{' '}
            <Link to="/login" className="font-medium text-purple-400 hover:text-purple-300">
              войдите в существующий
            </Link>
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleEmailRegister}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Имя пользователя
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="appearance-none relative block w-full px-3 py-3 pl-10 bg-gray-700 border border-gray-600 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Имя пользователя"
                />
              </div>
            </div>

            <div>
              <label htmlFor="displayName" className="sr-only">
                Отображаемое имя
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={formData.displayName}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-3 bg-gray-700 border border-gray-600 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Отображаемое имя"
              />
            </div>

            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none relative block w-full px-3 py-3 pl-10 bg-gray-700 border border-gray-600 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Пароль
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none relative block w-full px-3 py-3 pl-10 bg-gray-700 border border-gray-600 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Пароль"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Подтвердите пароль
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-3 bg-gray-700 border border-gray-600 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Подтвердите пароль"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </div>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-800 text-gray-400">Или продолжить с</span>
          </div>
        </div>

        <div>
          <button
            onClick={handleTwitchRegister}
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#9146FF] hover:bg-[#7B3FE4] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#9146FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FaTwitch className="mr-2 h-5 w-5" />
            Зарегистрироваться через Twitch
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Регистрируясь, вы соглашаетесь с нашими{' '}
          <a href="/terms" className="text-purple-400 hover:text-purple-300">
            Условиями использования
          </a>{' '}
          и{' '}
          <a href="/privacy" className="text-purple-400 hover:text-purple-300">
            Политикой конфиденциальности
          </a>
        </p>
      </div>
    </div>
  )
}

export default RegisterPage