import React, { useState } from 'react';
import { Link } from 'react-router-dom'
import { api } from '../../lib/supabase'
import { FaSearch, FaUserPlus, FaUserCheck } from 'react-icons/fa'
import '../../styles/search.css'

const SearchPage = ({ token }) => {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    
    setSearching(true)
    setLoading(true)
    try {
      const results = await api.searchUsers(token, query)
      setUsers(results)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async (userId, isFollowing) => {
  try {
    if (isFollowing) {
      await api.unfollowUser(token, userId)
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          return { 
            ...u, 
            is_following: false,
            followers_count: (u.followers_count || 0) - 1
          }
        }
        return u
      }))
    } else {
      await api.followUser(token, userId)
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          return { 
            ...u, 
            is_following: true,
            followers_count: (u.followers_count || 0) + 1
          }
        }
        return u
      }))
    }
  } catch (err) {
    console.error('Follow error:', err)
  }
}

  

  return (
    <div className="search-container">
      <div className="search-header">
        <h1>Поиск пользователей</h1>
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Введите имя пользователя..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={!query.trim()}>
            Найти
          </button>
        </div>
      </div>

      <div className="search-results">
        {searching && loading && (
          <div className="loading-spinner">Поиск...</div>
        )}
        
        {!loading && users.length === 0 && searching && (
          <div className="no-results">
            <p>Пользователи не найдены</p>
            <p className="hint">Попробуйте изменить поисковый запрос</p>
          </div>
        )}
        
        {users.map(user => (
          <div key={user.id} className="user-card">
            <Link to={`/profile/${user.id}`} className="user-avatar">
              <img 
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=9146FF&color=fff&size=64`}
                alt={user.display_name}
              />
            </Link>
            <div className="user-info">
              <Link to={`/profile/${user.id}`}>
                <h3>{user.display_name}</h3>
              </Link>
              <p className="username">@{user.username}</p>
              {user.bio && <p className="bio">{user.bio.substring(0, 100)}</p>}
              <div className="user-stats">
                <span>📊 {user.followers_count || 0} подписчиков</span>
                <span>📌 {user.following_count || 0} подписок</span>
              </div>
            </div>
            <button 
              className={`follow-btn ${user.is_following ? 'following' : ''}`}
              onClick={() => handleFollow(user.id, user.is_following)}
            >
              {user.is_following ? <FaUserCheck /> : <FaUserPlus />}
              {user.is_following ? 'Подписан' : 'Подписаться'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SearchPage