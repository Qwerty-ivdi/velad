import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { FaHome, FaUser, FaSignOutAlt, FaTwitch } from 'react-icons/fa'

const Navbar = ({ user }) => {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">Velad</span>
          </Link>

          {user ? (
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <FaHome className="inline mr-1" />
                Главная
              </Link>
              <Link
                to="/profile"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <FaUser className="inline mr-1" />
                Профиль
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <FaSignOutAlt className="inline mr-1" />
                Выйти
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Вход
              </Link>
              <Link
                to="/register"
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Регистрация
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar