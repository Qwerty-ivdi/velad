// src/components/common/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaTv, FaChartBar, FaEnvelope, FaUser, FaSignOutAlt, FaTwitch, FaHome, FaBell } from 'react-icons/fa';

const Navbar = ({ user, onLogout, onOpenMessenger }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/" className="brand-link">
            <FaTwitch className="brand-icon" />
            <span className="brand-name">Velad</span>
          </Link>
        </div>

        <div className="navbar-links">
          <Link to="/streams" className={`nav-link ${isActive('/streams') ? 'active' : ''}`}>
            <FaTv />
            <span>Стримы</span>
          </Link>
          <Link to="/search" className={`nav-link ${isActive('/search') ? 'active' : ''}`}>
            <FaSearch />
            <span>Поиск</span>
          </Link>
          {user && (
            <Link to="/stats" className={`nav-link ${isActive('/stats') ? 'active' : ''}`}>
              <FaChartBar />
              <span>Статистика</span>
            </Link>
          )}
        </div>

        <div className="navbar-user">
          {user ? (
            <>
              <button 
                className="nav-icon-btn messenger-btn" 
                onClick={onOpenMessenger}
                title="Сообщения"
              >
                <FaEnvelope />
              </button>
              <div className="user-menu">
                <Link to="/profile" className="user-avatar">
                  <img 
                    src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=9146FF&color=fff&size=32`} 
                    alt={user.display_name}
                  />
                  <span className="user-name">{user.display_name}</span>
                </Link>
              </div>
              <button onClick={onLogout} className="logout-btn" title="Выйти">
                <FaSignOutAlt />
              </button>
            </>
          ) : (
            <button onClick={() => navigate('/login')} className="login-btn">
              Войти
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;