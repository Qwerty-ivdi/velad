import React, { useState } from 'react'
import { api } from '../../lib/supabase'
import { FaHeart, FaRegHeart, FaComment, FaShare, FaEdit, FaTrash, FaTimes, FaCheck } from 'react-icons/fa'
import { Link } from 'react-router-dom'

const Post = ({ post, token, isOwnPost = false, onPostUpdate, onPostDelete }) => {
  const [liked, setLiked] = useState(post.is_liked || false)
  const [likesCount, setLikesCount] = useState(post.likes_count || 0)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const formatDate = (date) => {
    const now = new Date()
    const postDate = new Date(date)
    const diff = Math.floor((now - postDate) / 1000 / 60)
    
    if (diff < 1) return 'только что'
    if (diff < 60) return `${diff} мин назад`
    if (diff < 1440) return `${Math.floor(diff / 60)} ч назад`
    return postDate.toLocaleDateString('ru-RU')
  }

  const handleLike = async () => {
    if (loading) return
    
    setLoading(true)
    try {
      const result = await api.likePost(token, post.id)
      setLiked(result.action === 'liked')
      setLikesCount(result.likes_count)
    } catch (err) {
      console.error('Like error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async () => {
  if (!editContent.trim()) return
  
  setLoading(true)
  try {
    const updated = await api.updatePost(token, post.id, editContent.trim())
    
    // Обновляем пост с сохранением всех данных
    const updatedPost = {
      ...post,  // Сохраняем все существующие данные
      content: updated.content,
      updated_at: updated.updated_at
    }
    
    setIsEditing(false)
    if (onPostUpdate) onPostUpdate(updatedPost)
  } catch (err) {
    console.error('Edit error:', err)
    alert(err.message)
  } finally {
    setLoading(false)
  }
}

  const handleDelete = async () => {
    setLoading(true)
    try {
      await api.deletePost(token, post.id)
      if (onPostDelete) onPostDelete(post.id)
    } catch (err) {
      console.error('Delete error:', err)
      alert(err.message)
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="post-card">
      <div className="post-header">
        <Link to={`/profile/${post.user_id}`} className="post-avatar">
          <img 
            src={post.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.display_name || post.username)}&background=9146FF&color=fff&size=48&bold=true`} 
            alt=""
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.display_name || post.username)}&background=9146FF&color=fff&size=48&bold=true`
            }}
          />
        </Link>
        <div className="post-author">
          <Link to={`/profile/${post.user_id}`}>
            <h3>{post.display_name}</h3>
          </Link>
          <span>@{post.username} • {formatDate(post.created_at)}</span>
        </div>
        
        {/* Кнопки редактирования/удаления (только для своих постов) */}
        {isOwnPost && (
          <div className="post-actions">
            {!isEditing && (
              <>
                <button 
                  className="post-action-btn edit-btn"
                  onClick={() => setIsEditing(true)}
                  disabled={loading}
                  title="Редактировать"
                >
                  <FaEdit />
                </button>
                <button 
                  className="post-action-btn delete-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  title="Удалить"
                >
                  <FaTrash />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Режим редактирования */}
      {isEditing ? (
        <div className="post-edit-mode">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="edit-textarea"
            rows="3"
            autoFocus
          />
          <div className="edit-actions">
            <button 
              className="cancel-edit-btn"
              onClick={() => {
                setIsEditing(false)
                setEditContent(post.content || '')
              }}
              disabled={loading}
            >
              <FaTimes /> Отмена
            </button>
            <button 
              className="save-edit-btn"
              onClick={handleEdit}
              disabled={loading || !editContent.trim()}
            >
              <FaCheck /> {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="post-content">
            <p>{post.content}</p>
            {post.media_urls && post.media_urls.length > 0 && (
              <div className="post-media">
                {post.media_urls.map((url, i) => (
                  <img 
                    key={i} 
                    src={url} 
                    alt={`media-${i}`}
                    onError={(e) => {
                      console.error('Failed to load image:', url)
                      e.target.style.display = 'none'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          
          <div className="post-stats">
            <button 
              className={`like-btn ${liked ? 'liked' : ''}`} 
              onClick={handleLike}
              disabled={loading}
            >
              {liked ? <FaHeart /> : <FaRegHeart />}
              <span>{likesCount}</span>
            </button>
            <button className="comment-btn">
              <FaComment />
              <span>{post.comments_count || 0}</span>
            </button>
            <button className="share-btn">
              <FaShare />
            </button>
          </div>
        </>
      )}
      
      {/* Модальное окно подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Удалить пост?</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Вы уверены, что хотите удалить этот пост? Это действие нельзя отменить.</p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Отмена
              </button>
              <button 
                className="btn-danger" 
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Post