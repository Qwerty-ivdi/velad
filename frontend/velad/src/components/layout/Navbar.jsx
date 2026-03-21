import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../../lib/supabase'
import { 
  FaGamepad, 
  FaHome, 
  FaUser, 
  FaSignOutAlt, 
  FaBars, 
  FaTimes, 
  FaChevronDown,
  FaStream,      // ← добавляем
  FaUsers        // ← добавляем
} from 'react-icons/fa'
import '../../styles/navbar.css'

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const handleLogout = async () => {
    api.removeToken()
    api.removeUser()
    if (setUser) setUser(null)
    navigate('/login')
    setIsDropdownOpen(false)
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          {/* Логотип */}
          <Link to="/" className="navbar-logo">
            <FaGamepad className="navbar-logo-icon" />
            <span className="navbar-logo-text">Velad</span>
          </Link>

          {/* Кнопка бургер-меню для мобильных */}
          <button className="navbar-menu-btn" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>

          {/* Навигационные ссылки (десктоп) */}
          <div className={`navbar-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <Link 
              to="/" 
              className={`navbar-link ${isActive('/') ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <FaHome /> Главная
            </Link>
            <Link 
              to="/streams" 
              className={`navbar-link ${isActive('/streams') ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <FaStream /> Стримы
            </Link>
            <Link 
              to="/community" 
              className={`navbar-link ${isActive('/community') ? 'active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <FaUsers /> Сообщество
            </Link>
          </div>

          {/* Кнопки авторизации / профиль */}
          {user ? (
            <div className="navbar-user" onClick={toggleDropdown}>
              <img
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name || user.username}&background=9146FF&color=fff&size=40`}
                alt="Avatar"
                className="navbar-avatar"
              />
              <span className="navbar-username">
                {user.display_name || user.username}
              </span>
              <FaChevronDown className={`navbar-chevron ${isDropdownOpen ? 'open' : ''}`} />
              
              {/* Выпадающее меню */}
              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <Link to="/profile" className="dropdown-item" onClick={() => {
                    setIsDropdownOpen(false)
                    setIsMobileMenuOpen(false)
                  }}>
                    <FaUser /> Профиль
                  </Link>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                    <FaSignOutAlt /> Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`navbar-buttons ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
              <Link 
                to="/login" 
                className="navbar-btn navbar-btn-login"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Вход
              </Link>
              <Link 
                to="/register" 
                className="navbar-btn navbar-btn-register"
                onClick={() => setIsMobileMenuOpen(false)}
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