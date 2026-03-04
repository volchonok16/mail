import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import { ArrowLeft, Upload, Save } from 'lucide-react'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    password: '',
    confirmPassword: '',
  })
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: updatedUser } = await api.put('/profile', data)
      return updatedUser
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      alert('Профиль обновлен!')
      setFormData({ ...formData, password: '', confirmPassword: '' })
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка обновления профиля')
    },
  })

  // Upload avatar mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      if (user) {
        setUser({ ...user, avatar_url: data.avatar_url })
      }
      alert('Аватар обновлен!')
      setAvatarFile(null)
      setAvatarPreview(null)
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка загрузки аватара')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      alert('Пароли не совпадают')
      return
    }

    const updateData: any = {
      full_name: formData.full_name,
      phone: formData.phone,
    }

    if (formData.password) {
      updateData.password = formData.password
    }

    updateMutation.mutate(updateData)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarUpload = () => {
    if (avatarFile) {
      uploadAvatarMutation.mutate(avatarFile)
    }
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={20} />
          Назад
        </button>
        <h1>Профиль</h1>
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <div className="avatar-section">
            <div className="avatar-wrapper">
              {(avatarPreview || user?.avatar_url) ? (
                <img
                  src={avatarPreview || user?.avatar_url}
                  alt="Avatar"
                  className="profile-avatar"
                />
              ) : (
                <div className="avatar-placeholder">
                  {user?.full_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="avatar-actions">
              <label htmlFor="avatar-input" className="btn-upload">
                <Upload size={20} />
                Выбрать фото
              </label>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              
              {avatarFile && (
                <button
                  onClick={handleAvatarUpload}
                  className="btn-primary"
                  disabled={uploadAvatarMutation.isPending}
                >
                  {uploadAvatarMutation.isPending ? 'Загрузка...' : 'Сохранить фото'}
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={user?.email}
                disabled
                className="input-disabled"
              />
              <small>Email нельзя изменить</small>
            </div>

            <div className="form-group">
              <label>ФИО</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Телефон</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 900 123-45-67"
              />
            </div>

            <div className="form-divider">
              <span>Изменить пароль (оставьте пустым, если не хотите менять)</span>
            </div>

            <div className="form-group">
              <label>Новый пароль</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <div className="form-group">
              <label>Подтвердите пароль</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn-save"
              disabled={updateMutation.isPending}
            >
              <Save size={20} />
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

