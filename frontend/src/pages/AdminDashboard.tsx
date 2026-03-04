import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import { Users, LogOut, UserPlus, Trash2, Edit, Shield, ShieldOff, Mail } from 'lucide-react'
import './AdminDashboard.css'

interface User {
  id: number
  email: string
  username: string
  full_name: string
  phone?: string
  is_admin: boolean
  created_at: string
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    phone: '',
    password: '',
  })
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    phone: '',
    password: '',
    is_admin: false,
  })

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<User[]>('/admin/users')
      return data
    },
  })

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (userData: typeof formData) => {
      const { data } = await api.post('/admin/users', userData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreateForm(false)
      setFormData({ full_name: '', username: '', phone: '', password: '' })
      alert('Пользователь создан успешно!')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка создания пользователя')
    },
  })

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/admin/users/${userId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      alert('Пользователь удален')
    },
  })

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number, data: typeof editFormData }) => {
      const { data: response } = await api.put(`/admin/users/${userId}`, data)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowEditForm(false)
      setEditingUser(null)
      alert('Пользователь обновлен!')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка обновления пользователя')
    },
  })

  // Toggle admin mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: number, makeAdmin: boolean }) => {
      if (makeAdmin) {
        await api.post(`/admin/users/${userId}/make-admin`)
      } else {
        await api.post(`/admin/users/${userId}/remove-admin`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка изменения статуса админа')
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setEditFormData({
      full_name: user.full_name,
      phone: user.phone || '',
      password: '',
      is_admin: user.is_admin,
    })
    setShowEditForm(true)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingUser) {
      const updateData: any = {}
      if (editFormData.full_name) updateData.full_name = editFormData.full_name
      if (editFormData.phone) updateData.phone = editFormData.phone
      if (editFormData.password) updateData.password = editFormData.password
      updateData.is_admin = editFormData.is_admin
      
      updateMutation.mutate({ userId: editingUser.id, data: updateData })
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-container">
      <nav className="admin-nav">
        <div className="nav-brand">
          <h1>Админ-панель</h1>
          <span className="domain">alexol.io</span>
        </div>
        <div className="nav-user">
          <span>{user?.email}</span>
          <button onClick={() => navigate('/dashboard')} className="btn-mail">
            <Mail size={20} />
            Моя почта
          </button>
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={20} />
            Выйти
          </button>
        </div>
      </nav>

      <div className="admin-content">
        <div className="content-header">
          <div className="header-title">
            <Users size={24} />
            <h2>Управление пользователями</h2>
          </div>
          <button onClick={() => setShowCreateForm(true)} className="btn-create">
            <UserPlus size={20} />
            Создать пользователя
          </button>
        </div>

        {showCreateForm && (
          <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Создание пользователя</h3>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>ФИО</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Иванов Иван Иванович"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Логин</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="IIvanov"
                    required
                  />
                  <small>Email будет: {formData.username}@alexol.io</small>
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

                <div className="form-group">
                  <label>Пароль</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary">
                    Отмена
                  </button>
                  <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditForm && editingUser && (
          <div className="modal-overlay" onClick={() => setShowEditForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Редактирование пользователя</h3>
              <p className="edit-user-email">{editingUser.email}</p>
              <form onSubmit={handleUpdate}>
                <div className="form-group">
                  <label>ФИО</label>
                  <input
                    type="text"
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                <div className="form-group">
                  <label>Телефон</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="+7 900 123-45-67"
                  />
                </div>

                <div className="form-group">
                  <label>Новый пароль (оставьте пустым, если не нужно менять)</label>
                  <input
                    type="password"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editFormData.is_admin}
                      onChange={(e) => setEditFormData({ ...editFormData, is_admin: e.target.checked })}
                    />
                    <span>Администратор</span>
                  </label>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowEditForm(false)} className="btn-secondary">
                    Отмена
                  </button>
                  <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="users-table">
          {isLoading ? (
            <div className="loading">Загрузка...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ФИО</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th>Роль</th>
                  <th>Дата создания</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.phone || '—'}</td>
                    <td>
                      <span className={`badge ${user.is_admin ? 'badge-admin' : 'badge-user'}`}>
                        {user.is_admin ? 'Админ' : 'Пользователь'}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEdit(user)}
                          className="btn-edit"
                          title="Редактировать"
                        >
                          <Edit size={16} />
                        </button>
                        
                        {user.is_admin ? (
                          <button
                            onClick={() => {
                              if (confirm(`Снять права админа с ${user.full_name}?`)) {
                                toggleAdminMutation.mutate({ userId: user.id, makeAdmin: false })
                              }
                            }}
                            className="btn-admin-toggle"
                            title="Снять права админа"
                            disabled={toggleAdminMutation.isPending}
                          >
                            <ShieldOff size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`Сделать ${user.full_name} админом?`)) {
                                toggleAdminMutation.mutate({ userId: user.id, makeAdmin: true })
                              }
                            }}
                            className="btn-admin-toggle make-admin"
                            title="Сделать админом"
                            disabled={toggleAdminMutation.isPending}
                          >
                            <Shield size={16} />
                          </button>
                        )}
                        
                        {!user.is_admin && (
                          <button
                            onClick={() => {
                              if (confirm(`Удалить пользователя ${user.full_name}?`)) {
                                deleteMutation.mutate(user.id)
                              }
                            }}
                            className="btn-delete"
                            title="Удалить"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

