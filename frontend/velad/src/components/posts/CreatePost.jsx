// src/components/posts/CreatePost.jsx
import React, { useState } from 'react';
import { FaImage, FaTimes } from 'react-icons/fa';
import { API_URL } from '../../config';

const CreatePost = ({ token, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    console.log('📸 Uploading file:', files[0].name);
    console.log('🔑 Token exists:', !!token);
    console.log('🌐 API_URL:', API_URL);
    
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // НЕ ставьте Content-Type, браузер сам установит multipart/form-data
        },
        body: formData
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload error response:', errorData);
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Upload success:', data);
      setImages(prev => [...prev, data.url]);
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && images.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      // ИСПРАВЛЕНО: используем API_URL
      const response = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content.trim(),
          media_urls: images,
          post_type: images.length > 0 ? 'image' : 'text'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create post');
      }
      
      const newPost = await response.json();
      setContent('');
      setImages([]);
      if (onPostCreated) onPostCreated(newPost);
    } catch (err) {
      console.error('Create post error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="create-post">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Что нового? Поделись мыслями..."
          rows="3"
        />
        
        {images.length > 0 && (
          <div className="image-preview-list">
            {images.map((url, index) => (
              <div key={index} className="image-preview">
                <img src={url} alt={`preview-${index}`} />
                <button type="button" onClick={() => removeImage(index)}>
                  <FaTimes />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="create-post-actions">
          <label className="image-upload-btn">
            <FaImage />
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
          
          <button 
            type="submit" 
            disabled={uploading || (!content.trim() && images.length === 0)}
            className="create-post-btn"
          >
            {uploading ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
};

export default CreatePost;