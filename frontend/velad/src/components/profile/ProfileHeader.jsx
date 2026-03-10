import React from 'react'
import { FaTwitch, FaCalendar, FaMapMarkerAlt, FaLink } from 'react-icons/fa'

const ProfileHeader = ({ 
  profile, 
  isOwnProfile, 
  isFollowing, 
  followersCount, 
  followingCount, 
  onFollow, 
  onEdit 
}) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="bg-gray-800 rounded-xl shadow-xl overflow-hidden">
      {/* Баннер */}
      <div className="h-48 bg-gradient-to-r from-purple-600 to-pink-600 relative">
        {profile.banner_url && (
          <img 
            src={profile.banner_url} 
            alt="Banner" 
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Аватар и основная информация */}
      <div className="px-6 pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end -mt-16">
          <div className="relative">
            <img
              src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name}&background=9146FF&color=fff&size=128`}
              alt={profile.display_name}
              className="w-32 h-32 rounded-full border-4 border-gray-800 bg-gray-700 object-cover"
            />
            {profile.is_live && (
              <span className="absolute bottom-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-gray-800 animate-pulse"></span>
            )}
          </div>
          
          <div className="mt-4 sm:mt-0 sm:ml-6 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {profile.display_name}
                </h1>
                <p className="text-gray-400">@{profile.username}</p>
              </div>
              
              <div className="mt-4 sm:mt-0">
                {isOwnProfile ? (
                  <button
                    onClick={onEdit}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Редактировать профиль
                  </button>
                ) : (
                  <button
                    onClick={onFollow}
                    className={`px-6 py-2 rounded-lg transition-colors ${
                      isFollowing
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {isFollowing ? 'Отписаться' : 'Подписаться'}
                  </button>
                )}
              </div>
            </div>

            {/* Статистика */}
            <div className="flex space-x-6 mt-4">
              <div className="text-center">
                <span className="block text-xl font-bold text-white">{followersCount}</span>
                <span className="text-sm text-gray-400">подписчиков</span>
              </div>
              <div className="text-center">
                <span className="block text-xl font-bold text-white">{followingCount}</span>
                <span className="text-sm text-gray-400">подписок</span>
              </div>
              <div className="text-center">
                <span className="block text-xl font-bold text-white">{profile.posts_count || 0}</span>
                <span className="text-sm text-gray-400">постов</span>
              </div>
            </div>
          </div>
        </div>

        {/* Био и информация */}
        <div className="mt-6 space-y-4">
          {profile.bio && (
            <p className="text-gray-300">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            {profile.twitch_login && (
              <a
                href={`https://twitch.tv/${profile.twitch_login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-purple-400 transition-colors"
              >
                <FaTwitch className="mr-2" />
                {profile.twitch_login}
              </a>
            )}
            
            {profile.location && (
              <span className="flex items-center">
                <FaMapMarkerAlt className="mr-2" />
                {profile.location}
              </span>
            )}
            
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-purple-400 transition-colors"
              >
                <FaLink className="mr-2" />
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            
            <span className="flex items-center">
              <FaCalendar className="mr-2" />
              Присоединился {formatDate(profile.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileHeader