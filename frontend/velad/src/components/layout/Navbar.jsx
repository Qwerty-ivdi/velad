import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/supabase';
import { FaGamepad, FaHome, FaUser, FaSignOutAlt, FaBars, FaTimes, FaChevronDown, FaSearch, FaEnvelope } from 'react-icons/fa';
import Messenger from '../messenger/Messenger';
import '../../styles/navbar.css'
import { FaTwitch } from 'react-icons/fa';
import { FaChartLine } from 'react-icons/fa';

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showMessenger, setShowMessenger] = useState(false);

  const handleLogout = async () => {
    api.removeToken();
    api.removeUser();
    if (setUser) setUser(null);
    navigate('/login');
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-content">
            <Link to="/" className="navbar-logo">
              <FaGamepad className="navbar-logo-icon" />
              <span className="navbar-logo-text">Velad</span>
            </Link>

            <button className="navbar-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
            </button>

            <div className={`navbar-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
              <Link to="/" className={`navbar-link ${isActive('/') ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
                <FaHome /> Главная
              </Link>
              <Link to="/search" className={`navbar-link ${isActive('/search') ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
                <FaSearch /> Поиск
              </Link>
              <Link to="/streams" className={`navbar-link ${isActive('/streams') ? 'active' : ''}`}>
                <FaTwitch /> Стримы
              </Link>
              <Link to="/stats" className={`navbar-link ${isActive('/stats') ? 'active' : ''}`}>
                <FaChartLine /> Статистика
              </Link>
            </div>

            {user ? (
              <div className="navbar-user">
                {/* Кнопка мессенджера */}
                <button className="messenger-btn" onClick={() => setShowMessenger(true)}>
                  <FaEnvelope />
                </button>

                <div className="navbar-user-info" onClick={toggleDropdown}>
                  <img 
                    src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name || user.username}&background=9146FF&color=fff&size=40`} 
                    alt="Avatar" 
                    className="navbar-avatar" 
                  />
                  <span className="navbar-username">{user.display_name || user.username}</span>
                  <FaChevronDown className={`navbar-chevron ${isDropdownOpen ? 'open' : ''}`} />
                </div>

                {isDropdownOpen && (
                  <div className="dropdown-menu">
                    <Link to="/profile" className="dropdown-item" onClick={() => { setIsDropdownOpen(false); setIsMobileMenuOpen(false); }}>
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
                <Link to="/login" className="navbar-btn navbar-btn-login" onClick={() => setIsMobileMenuOpen(false)}>
                  Вход
                </Link>
                <Link to="/register" className="navbar-btn navbar-btn-register" onClick={() => setIsMobileMenuOpen(false)}>
                  Регистрация
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Мессенджер */}
      {showMessenger && (
        <Messenger 
          currentUserId={user?.id} 
          onClose={() => setShowMessenger(false)} 
        />
      )}
    </>
  );
};

export default Navbar;