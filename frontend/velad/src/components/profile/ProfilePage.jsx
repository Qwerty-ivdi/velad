import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { FaTwitch, FaCalendar, FaMapMarkerAlt, FaLink, FaEdit, FaUserFriends } from 'react-icons/fa'
import '../../styles/profile.css'

const ProfilePage = ({ user: currentUser }) => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    website: ''
  })

  useEffect(() => {
    if (!currentUser) {
      navigate('/login')
      return
    }
    fetchProfile()
  }, [currentUser, navigate])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      
      // Получаем профиль из БД
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError
      }

      if (profileData) {
        setProfile(profileData)
        setEditForm({
          display_name: profileData.display_name || '',
          bio: profileData.bio || '',
          location: profileData.location || '',
          website: profileData.website || ''
        })
      } else {
        // Если профиля нет, создаем
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: currentUser.id,
            username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0],
            display_name: currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0],
            email: currentUser.email,
            avatar_url: currentUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.email?.split('@')[0]}&background=9146FF&color=fff&size=128`
          })
          .select()
          .single()

        if (createError) throw createError
        setProfile(newProfile)
      }
    } catch (err) {
      setError(err.message)
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: editForm.display_name,
          bio: editForm.bio,
          location: editForm.location,
          website: editForm.website,
          updated_at: new Date()
        })
        .eq('id', currentUser.id)

      if (updateError) throw updateError
      
      setProfile({
        ...profile,
        ...editForm
      })
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
            {profile.is_live && <span className="live-indicator"></span>}
          </div>

          <div className="profile-details">
            <div className="profile-name">
              <h1>{profile.display_name}</h1>
              <p>@{profile.username}</p>
            </div>

            <button onClick={() => setIsEditing(true)} className="btn-edit">
              <FaEdit /> Редактировать
            </button>
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
              <span className="stat-value">{profile.posts_count || 0}</span>
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