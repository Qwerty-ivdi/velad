import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/supabase'
import Post from '../posts/Post'
import CreatePost from '../posts/CreatePost'
import { FaTwitch, FaCalendar, FaMapMarkerAlt, FaLink, FaEdit } from 'react-icons/fa'
import '../../styles/profile.css'

const ProfilePage = ({ user: currentUser, setUser }) => {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('posts')
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    website: ''
  })

  // Определяем, свой ли это профиль
  const profileId = userId || currentUser?.id
  const isOwnProfile = currentUser && profileId === currentUser.id

 useEffect(() => {
  if (!currentUser && !userId) {
    navigate('/login')
    return
  }
  if (profileId) {
    fetchProfile()
  }
}, [profileId, currentUser, navigate]) 

useEffect(() => {
  if (profile) {
    fetchPosts()
  }
}, [profile])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      let profileData
      
      if (isOwnProfile) {
        // Свой профиль - используем токен
        const token = api.getToken()
        if (!token) {
          throw new Error('Нет токена авторизации')
        }
        profileData = await api.getProfile(token)
      } else {
        // Чужой профиль - запрос по ID
        profileData = await api.getUserById(profileId)
      }
      
      setProfile(profileData)
      setEditForm({
        display_name: profileData.display_name || '',
        bio: profileData.bio || '',
        location: profileData.location || '',
        website: profileData.website || ''
      })
    } catch (err) {
      setError(err.message)
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePostUpdate = (updatedPost) => {
  setPosts(prevPosts => 
    prevPosts.map(post => 
      post.id === updatedPost.id ? updatedPost : post
    )
  )
}

const handlePostDelete = (postId) => {
  setPosts(prevPosts => prevPosts.filter(post => post.id !== postId))
}

  const fetchPosts = async () => {
    setLoadingPosts(true)
    try {
      const token = api.getToken()
      const userPosts = await api.getUserPosts(profile.id, token)
      setPosts(userPosts)
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoadingPosts(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const token = api.getToken()
      const updated = await api.updateProfile(token, {
        display_name: editForm.display_name,
        bio: editForm.bio,
        location: editForm.location,
        website: editForm.website
      })
      
      setProfile(updated.user)
      if (setUser && isOwnProfile) {
        setUser({ ...currentUser, ...updated.user })
      }
      setIsEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePostCreated = (newPost) => {
  // Убеждаемся, что новый пост содержит все нужные поля
  const completePost = {
    ...newPost,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    likes_count: 0,
    comments_count: 0,
    is_liked: false
  }
  
  setPosts([completePost, ...posts])
  
}

  const formatDate = (date) => {
    if (!date) return 'недавно'
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="spinner"></div>
        <p>Загрузка профиля...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-error">
        <p>Ошибка: {error}</p>
        <button onClick={fetchProfile} className="btn btn-primary">Повторить</button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="profile-error">
        <p>Профиль не найден</p>
        <button onClick={fetchProfile} className="btn btn-primary">Обновить</button>
      </div>
    )
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-banner">
          {profile.banner_url && <img src={profile.banner_url} alt="Banner" />}
        </div>

        <div className="profile-info">
          <div className="profile-avatar">
  <img
    src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || profile.username)}&background=9146FF&color=fff&size=128&bold=true`}
    alt={profile.display_name}
    onError={(e) => {
      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || profile.username)}&background=9146FF&color=fff&size=128&bold=true`
    }}
  />
</div>

          <div className="profile-details">
            <div className="profile-name">
              <h1>{profile.display_name}</h1>
              <p>@{profile.username}</p>
            </div>

            {isOwnProfile && (
              <button onClick={() => setIsEditing(true)} className="btn-edit">
                <FaEdit /> Редактировать
              </button>
            )}
          </div>

          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-value">{profile.followers_count || 0}</span>
              <span className="stat-label">подписчиков</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{profile.following_count || 0}</span>
              <span className="stat-label">подписок</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{posts.length}</span>
              <span className="stat-label">постов</span>
            </div>
          </div>

          {profile.bio && (
            <div className="profile-bio">
              <p>{profile.bio}</p>
            </div>
          )}

          <div className="profile-meta">
            {profile.twitch_login && (
              <a
                href={`https://twitch.tv/${profile.twitch_login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="meta-item"
              >
                <FaTwitch /> {profile.twitch_login}
              </a>
            )}
            {profile.location && (
              <span className="meta-item">
                <FaMapMarkerAlt /> {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="meta-item"
              >
                <FaLink /> {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <span className="meta-item">
              <FaCalendar /> Присоединился {formatDate(profile.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="profile-tabs">
          <button className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>
            Посты ({posts.length})
          </button>
          <button className={`tab-button ${activeTab === 'followers' ? 'active' : ''}`} onClick={() => setActiveTab('followers')}>
            Подписчики ({profile.followers_count || 0})
          </button>
          <button className={`tab-button ${activeTab === 'following' ? 'active' : ''}`} onClick={() => setActiveTab('following')}>
            Подписки ({profile.following_count || 0})
          </button>
        
        <button 
          className={`tab-button ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          О себе
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'posts' && (
          <div className="posts-list">
            {/* Форма создания поста (только для своего профиля) */}
            {isOwnProfile && (
              <CreatePost 
                token={api.getToken()} 
                onPostCreated={handlePostCreated}
              />
            )}
            
            {/* Список постов */}
            {loadingPosts ? (
              <div className="loading">Загрузка постов...</div>
            ) : posts.length === 0 ? (
              <div className="empty-posts">
                <p>У пользователя пока нет постов</p>
                {isOwnProfile && (
                  <p>Напишите что-нибудь, чтобы поделиться с сообществом!</p>
                )}
              </div>
            ) : (
              posts.map(post => (
                 <Post 
                  key={post.id} 
                  post={post} 
                  token={api.getToken()}
                  isOwnPost={isOwnProfile}
                  onPostUpdate={handlePostUpdate}
                  onPostDelete={handlePostDelete}
                />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'about' && (
          <div className="about-content">
            <p><strong>О себе:</strong> {profile.bio || 'Не заполнено'}</p>
            <p><strong>Местоположение:</strong> {profile.location || 'Не указано'}</p>
            <p><strong>Сайт:</strong> {profile.website ? (
              <a href={profile.website} target="_blank" rel="noopener noreferrer">
                {profile.website}
              </a>
            ) : 'Не указан'}</p>
            <p><strong>Присоединился:</strong> {formatDate(profile.created_at)}</p>
          </div>
        )}
      </div>

      {/* Модальное окно редактирования */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Редактировать профиль</h2>
              <button className="modal-close" onClick={() => setIsEditing(false)}>×</button>
            </div>
            <form onSubmit={handleUpdateProfile}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Отображаемое имя</label>
                  <input
                    type="text"
                    value={editForm.display_name}
                    onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">О себе</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                    className="form-input"
                    rows="4"
                    placeholder="Расскажите о себе..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Местоположение</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                    className="form-input"
                    placeholder="Город, страна"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Веб-сайт</label>
                  <input
                    type="url"
                    value={editForm.website}
                    onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                    className="form-input"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                  Отмена
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage