import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import ProfileHeader from './ProfileHeader'
import ProfileTabs from './ProfileTabs'
import EditProfileModal from './EditProfileModal'
import LoadingSpinner from '../common/LoadingSpinner'

const ProfilePage = ({ user: currentUser }) => {
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const profileId = userId || currentUser?.id

  useEffect(() => {
    if (profileId) {
      fetchProfile()
      fetchPosts()
      fetchFollowStats()
      if (currentUser && profileId !== currentUser.id) {
        checkFollowStatus()
      }
    }
  }, [profileId, currentUser])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          display_name,
          avatar_url,
          username
        ),
        likes:post_likes(count),
        comments:comments(count)
      `)
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })

    if (!error) {
      setPosts(data)
    }
  }

  const fetchFollowStats = async () => {
    // Получаем количество подписчиков
    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileId)

    // Получаем количество подписок
    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId)

    setFollowersCount(followers || 0)
    setFollowingCount(following || 0)
  }

  const checkFollowStatus = async () => {
    const { data } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', currentUser.id)
      .eq('following_id', profileId)
      .single()

    setIsFollowing(!!data)
  }

  const handleFollow = async () => {
    if (isFollowing) {
      // Отписаться
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', profileId)
      setIsFollowing(false)
      setFollowersCount(prev => prev - 1)
    } else {
      // Подписаться
      await supabase
        .from('follows')
        .insert({
          follower_id: currentUser.id,
          following_id: profileId
        })
      setIsFollowing(true)
      setFollowersCount(prev => prev + 1)
    }
  }

  const handleUpdateProfile = async (updatedData) => {
    const { error } = await supabase
      .from('profiles')
      .update(updatedData)
      .eq('id', profileId)

    if (!error) {
      setProfile({ ...profile, ...updatedData })
      setIsEditing(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (error) return <div className="text-red-500 text-center p-8">{error}</div>
  if (!profile) return <div className="text-white text-center p-8">Профиль не найден</div>

  const isOwnProfile = currentUser?.id === profileId

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        followersCount={followersCount}
        followingCount={followingCount}
        onFollow={handleFollow}
        onEdit={() => setIsEditing(true)}
      />

      <ProfileTabs posts={posts} profileId={profileId} />

      {isEditing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setIsEditing(false)}
          onSave={handleUpdateProfile}
        />
      )}
    </div>
  )
}

export default ProfilePage