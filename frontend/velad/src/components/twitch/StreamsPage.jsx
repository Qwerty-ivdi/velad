import React, { useState, useEffect } from 'react';
import TwitchStreamCard from './TwitchStreamCard';
import { FaSearch, FaTwitch, FaFire } from 'react-icons/fa';
import { API_URL } from '../../config';
import '../../styles/twitch.css';

const StreamsPage = () => {
  const [streams, setStreams] = useState([]);
  const [topStreams, setTopStreams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('top');

  const loadTopStreams = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/twitch/streams/top?limit=20`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setTopStreams(data);
      } else {
        console.error('API returned non-array:', data);
        setTopStreams([]);
        setError('Получены некорректные данные от сервера');
      }
    } catch (err) {
      console.error('Error loading top streams:', err);
      setError(err.message);
      setTopStreams([]);
    } finally {
      setLoading(false);
    }
  };

  const searchStreams = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/twitch/streams/search?q=${encodeURIComponent(searchQuery)}`);
      let results = await response.json();
      
      if (results.length === 0) {
        const channelResponse = await fetch(`${API_URL}/twitch/streams/search/channel?q=${encodeURIComponent(searchQuery)}`);
        results = await channelResponse.json();
      }
      
      if (Array.isArray(results)) {
        setStreams(results);
      } else {
        setStreams([]);
        setError('Получены некорректные данные от сервера');
      }
    } catch (err) {
      console.error('Error searching streams:', err);
      setError(err.message);
      setStreams([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    loadTopStreams();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setActiveTab('search');
    searchStreams();
  };

  return (
    <div className="streams-page">
      <div className="streams-header">
        <h1><FaTwitch /> Стримы на Twitch</h1>
        <form onSubmit={handleSearch} className="streams-search">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Поиск стримов по игре, названию или имени канала..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit">Найти</button>
        </form>
      </div>

      <div className="streams-tabs">
        <button 
          className={`tab-btn ${activeTab === 'top' ? 'active' : ''}`}
          onClick={() => setActiveTab('top')}
        >
          <FaFire /> Популярные стримы
        </button>
        <button 
          className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <FaSearch /> Поиск {searchQuery && `: "${searchQuery}"`}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>Ошибка: {error}</p>
          <button onClick={() => activeTab === 'top' ? loadTopStreams() : searchStreams()} className="retry-btn">
            Повторить
          </button>
        </div>
      )}

      <div className="streams-grid">
        {activeTab === 'top' && (
          <>
            {loading ? (
              <div className="loading-streams">Загрузка стримов...</div>
            ) : topStreams.length === 0 ? (
              <div className="no-streams">
                <p>Нет активных стримов</p>
                <p className="hint">Попробуйте обновить страницу позже</p>
              </div>
            ) : (
              topStreams.map(stream => (
                <TwitchStreamCard key={stream.id} stream={stream} />
              ))
            )}
          </>
        )}

        {activeTab === 'search' && (
          <>
            {searching ? (
              <div className="loading-streams">Поиск стримов...</div>
            ) : streams.length === 0 ? (
              <div className="no-streams">
                <p>Стримы не найдены</p>
                <p className="hint">Попробуйте изменить поисковый запрос</p>
              </div>
            ) : (
              streams.map(stream => (
                <TwitchStreamCard key={stream.id} stream={stream} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StreamsPage;