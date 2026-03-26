import React, { useState, useEffect } from 'react'
import { api } from '../../lib/supabase'
import { FaHeart, FaRegHeart, FaTrash, FaReply } from 'react-icons/fa'
import { Link } from 'react-router-dom'

const CommentItem = ({ comment, token, currentUserId, onDelete, onLike, onReply, level = 0 }) => {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const formatDate = (date) => {
    const now = new Date()
    const commentDate = new Date(date)
    const diff = Math.floor((now - commentDate) / 1000 / 60)
    
    if (diff < 1) return 'только что'
    if (diff < 60) return `${diff} мин назад`
    if (diff < 1440) return `${Math.floor(diff / 60)} ч назад`
    return commentDate.toLocaleDateString('ru-RU')
  }

  const handleReply = async () => {
    if (!replyContent.trim()) return
    
    setSubmitting(true)
    try {
      const newReply = await api.createComment(token, comment.post_id, replyContent.trim(), comment.id)
      setReplyContent('')
      setShowReplyForm(false)
      if (onReply) onReply(newReply)
    } catch (err) {
      console.error('Error posting reply:', err)
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`comment-item level-${level}`} style={{ marginLeft: level * 20 }}>
      <Link to={`/profile/${comment.user_id}`} className="comment-avatar">
        <img 
          src={comment.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.display_name)}&background=9146FF&color=fff&size=32`}
          alt={comment.display_name}
        />
      </Link>
      <div className="comment-content">
        <div className="comment-header">
          <Link to={`/profile/${comment.user_id}`}>
            <span className="comment-author">{comment.display_name}</span>
          </Link>
          <span className="comment-date">• {formatDate(comment.created_at)}</span>
        </div>
        <p className="comment-text">{comment.content}</p>
        <div className="comment-actions">
          <button 
            className={`comment-like-btn ${comment.is_liked ? 'liked' : ''}`}
            onClick={() => onLike(comment.id)}
          >
            {comment.is_liked ? <FaHeart /> : <FaRegHeart />}
            <span>{comment.likes_count || 0}</span>
          </button>
          <button 
            className="comment-reply-btn"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            <FaReply /> Ответить
          </button>
          {currentUserId === comment.user_id && (
            <button 
              className="comment-delete-btn"
              onClick={() => onDelete(comment.id)}
            >
              <FaTrash /> Удалить
            </button>
          )}
        </div>
        
        {showReplyForm && (
          <div className="reply-form">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={`Ответить ${comment.display_name}...`}
              rows="2"
              disabled={submitting}
            />
            <div className="reply-actions">
              <button onClick={() => setShowReplyForm(false)} className="cancel-reply-btn">
                Отмена
              </button>
              <button 
                onClick={handleReply} 
                disabled={submitting || !replyContent.trim()}
                className="submit-reply-btn"
              >
                {submitting ? 'Отправка...' : 'Ответить'}
              </button>
            </div>
          </div>
        )}
        
        {comment.replies && comment.replies.length > 0 && (
          <div className="replies-container">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                token={token}
                currentUserId={currentUserId}
                onDelete={onDelete}
                onLike={onLike}
                onReply={onReply}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const CommentSection = ({ postId, token, currentUserId, onCommentCountChange }) => {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const loadComments = async () => {
    setLoading(true)
    try {
      const commentsList = await api.getComments(token, postId)
      setComments(commentsList)
    } catch (err) {
      console.error('Error loading comments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (expanded) {
      loadComments()
    }
  }, [expanded, postId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      const comment = await api.createComment(token, postId, newComment.trim())
      setComments([comment, ...comments])
      setNewComment('')
      if (onCommentCountChange) {
        onCommentCountChange(comments.length + 1)
      }
    } catch (err) {
      console.error('Error creating comment:', err)
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId) => {
    if (!window.confirm('Удалить комментарий?')) return
    
    try {
      await api.deleteComment(token, commentId)
      // Перезагружаем комментарии
      await loadComments()
    } catch (err) {
      console.error('Error deleting comment:', err)
      alert(err.message)
    }
  }

  const handleLike = async (commentId) => {
    try {
      await api.likeComment(token, commentId)
      // Перезагружаем комментарии для обновления счетчиков
      await loadComments()
    } catch (err) {
      console.error('Error liking comment:', err)
    }
  }

  const handleReply = async (newReply) => {
    // Обновляем комментарии после добавления ответа
    await loadComments()
    if (onCommentCountChange) {
      onCommentCountChange(comments.length + 1)
    }
  }

  const totalComments = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)

  return (
    <div className="comment-section">
      <button 
        className="show-comments-btn"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Скрыть комментарии' : `Показать комментарии`}
      </button>

      {expanded && (
        <div className="comments-container">
          <form onSubmit={handleSubmit} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Написать комментарий..."
              rows="2"
              disabled={submitting}
            />
            <button type="submit" disabled={submitting || !newComment.trim()}>
              {submitting ? 'Отправка...' : 'Отправить'}
            </button>
          </form>

          {loading ? (
            <div className="loading-comments">Загрузка комментариев...</div>
          ) : comments.length === 0 ? (
            <div className="no-comments">Пока нет комментариев. Будьте первым!</div>
          ) : (
            <div className="comments-list">
              {comments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  token={token}
                  currentUserId={currentUserId}
                  onDelete={handleDelete}
                  onLike={handleLike}
                  onReply={handleReply}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CommentSection