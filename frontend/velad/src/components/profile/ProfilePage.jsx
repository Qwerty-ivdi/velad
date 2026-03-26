import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/supabase'
import Post from '../posts/Post'
import CreatePost from '../posts/CreatePost'
import UserListItem from '../users/UserListItem'
import { FaTwitch, FaCalendar, FaMapMarkerAlt, FaLink, FaEdit } from 'react-icons/fa'
import '../../styles/profile.css'

const ProfilePage = ({ user: currentUser, setUser }) => {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [loadingFollowers, setLoadingFollowers] = useState(false)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    website: ''
  })

  const profileId = userId || currentUser?.id
  const isOwnProfile = currentUser && profileId === currentUser.id

  // Загрузка профиля
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true)
      let profileData
      
      if (isOwnProfile) {
        const token = api.getToken()
        if (!token) throw new Error('Нет токена авторизации')
        profileData = await api.getProfile(token)
      } else {
        profileData = await api.getUserById(profileId)
      }
      
      setProfile(profileData)
      setFollowersCount(profileData.followers_count || 0)
      setFollowingCount(profileData.following_count || 0)
      
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
  }, [profileId, isOwnProfile])

  // Загрузка постов
  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true)
    try {
      const token = api.getToken()
      const userPosts = await api.getUserPosts(profileId, token)
      setPosts(userPosts)
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoadingPosts(false)
    }
  }, [profileId])

  // Загрузка подписчиков
  const fetchFollowers = useCallback(async () => {
    setLoadingFollowers(true)
    try {
      const token = api.getToken()
      const followersList = await api.getFollowers(token, profileId)
      setFollowers(followersList)
    } catch (err) {
      console.error('Error loading followers:', err)
    } finally {
      setLoadingFollowers(false)
    }
  }, [profileId])

  // Загрузка подписок
  const fetchFollowing = useCallback(async () => {
    setLoadingFollowers(true)
    try {
      const token = api.getToken()
      const followingList = await api.getFollowing(token, profileId)
      setFollowing(followingList)
    } catch (err) {
      console.error('Error loading following:', err)
    } finally {
      setLoadingFollowers(false)
    }
  }, [profileId])

  // Проверка статуса подписки (для чужого профиля)
  const checkFollowStatus = useCallback(async () => {
    if (!currentUser || isOwnProfile) return
    
    try {
      const token = api.getToken()
      const result = await api.searchUsers(token, profile?.username || '')
      const userFromSearch = result.find(u => u.id === profileId)
      if (userFromSearch) {
        setIsFollowing(userFromSearch.is_following || false)
      }
    } catch (err) {
      console.error('Error checking follow status:', err)
    }
  }, [profileId, profile?.username, currentUser, isOwnProfile])

  // Подписка/отписка
  const handleFollow = async () => {
    try {
      const token = api.getToken()
      if (isFollowing) {
        await api.unfollowUser(token, profileId)
        setIsFollowing(false)
        setFollowersCount(prev => prev - 1)
        // Обновляем списки подписчиков и подписок
        if (activeTab === 'followers') fetchFollowers()
        if (activeTab === 'following') fetchFollowing()
      } else {
        await api.followUser(token, profileId)
        setIsFollowing(true)
        setFollowersCount(prev => prev + 1)
        // Обновляем списки подписчиков и подписок
        if (activeTab === 'followers') fetchFollowers()
        if (activeTab === 'following') fetchFollowing()
      }
    } catch (err) {
      console.error('Follow error:', err)
    }
  }

  // Обработчики для постов
  const handlePostUpdate = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p))
  }

  const handlePostDelete = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const handleLikeUpdate = (postId, isLiked, newLikesCount) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, is_liked: isLiked, likes_count: newLikesCount }
        : post
    ))
  }

  const handlePostCreated = (newPost) => {
    const completePost = {
      ...newPost,
      username: profile?.username,
      display_name: profile?.display_name,
      avatar_url: profile?.avatar_url,
      likes_count: 0,
      comments_count: 0,
      is_liked: false
    }
    setPosts([completePost, ...posts])
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
      
      setProfile(prev => ({ ...prev, ...updated.user }))
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

  const formatDate = (date) => {
    if (!date) return 'недавно'
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Загрузка всех данных при изменении profileId
  useEffect(() => {
    if (!currentUser && !userId) {
      navigate('/login')
      return
    }
    if (profileId) {
      fetchProfile()
    }
  }, [profileId, currentUser, userId, navigate, fetchProfile])

  // Загрузка постов при загрузке профиля
  useEffect(() => {
    if (profile) {
      fetchPosts()
      checkFollowStatus()
    }
  }, [profile, fetchPosts, checkFollowStatus])

  // Загрузка списков при смене активной вкладки
  useEffect(() => {
    if (activeTab === 'followers' && profileId) {
      fetchFollowers()
    }
    if (activeTab === 'following' && profileId) {
      fetchFollowing()
    }
  }, [activeTab, profileId, fetchFollowers, fetchFollowing])

  // Обновление подписчиков/подписок при изменении статуса подписки
  useEffect(() => {
    if (activeTab === 'followers') fetchFollowers()
    if (activeTab === 'following') fetchFollowing()
  }, [followersCount, followingCount, activeTab, fetchFollowers, fetchFollowing])

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
              src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name}&background=9146FF&color=fff&size=128`}
              alt={profile.display_name}
            />
          </div>

          <div className="profile-details">
            <div className="profile-name">
              <h1>{profile.display_name}</h1>
              <p>@{profile.username}</p>
            </div>

            {isOwnProfile ? (
              <button onClick={() => setIsEditing(true)} className="btn-edit">
                <FaEdit /> Редактировать
              </button>
            ) : (
              <button 
                onClick={handleFollow} 
                className={`btn-follow ${isFollowing ? 'following' : ''}`}
              >
                {isFollowing ? 'Отписаться' : 'Подписаться'}
              </button>
            )}
          </div>

          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-value">{followersCount}</span>
              <span className="stat-label">подписчиков</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{followingCount}</span>
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

      <div className="profile-tabs">
        <button 
          className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Посты ({posts.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setActiveTab('followers')}
        >
          Подписчики ({followersCount})
        </button>
        <button 
          className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          Подписки ({followingCount})
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'posts' && (
          <div className="posts-list">
            {isOwnProfile && (
              <CreatePost 
                token={api.getToken()} 
                onPostCreated={handlePostCreated}
              />
            )}
            
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
                  onLikeUpdate={handleLikeUpdate}
                />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'followers' && (
          <div className="followers-list">
            {loadingFollowers ? (
              <div className="loading">Загрузка...</div>
            ) : followers.length === 0 ? (
              <div className="empty-list">Нет подписчиков</div>
            ) : (
              followers.map(follower => (
                <UserListItem 
                  key={follower.id} 
                  user={follower} 
                  token={api.getToken()}
                  currentUserId={currentUser?.id}
                  onFollowChange={(userId, isNowFollowing) => {
                    setFollowers(prev => prev.map(f => 
                      f.id === userId ? { ...f, is_following: isNowFollowing } : f
                    ))
                    // Обновляем счетчик подписчиков в профиле
                    if (userId === profileId) {
                      setFollowersCount(prev => isNowFollowing ? prev + 1 : prev - 1)
                    }
                  }}
                />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'following' && (
          <div className="following-list">
            {loadingFollowers ? (
              <div className="loading">Загрузка...</div>
            ) : following.length === 0 ? (
              <div className="empty-list">Нет подписок</div>
            ) : (
              following.map(follow => (
                <UserListItem 
                  key={follow.id} 
                  user={follow} 
                  token={api.getToken()}
                  currentUserId={currentUser?.id}
                  onFollowChange={(userId, isNowFollowing) => {
                    setFollowing(prev => prev.map(f => 
                      f.id === userId ? { ...f, is_following: isNowFollowing } : f
                    ))
                  }}
                />
              ))
            )}
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