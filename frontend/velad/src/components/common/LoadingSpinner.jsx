import React from 'react'

const LoadingSpinner = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <div className="mt-4 text-center text-gray-400">Загрузка...</div>
      </div>
    </div>
  )
}

export default LoadingSpinner