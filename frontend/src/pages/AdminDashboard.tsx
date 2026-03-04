import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import { Users, LogOut, UserPlus, Trash2, Edit, Shield, ShieldOff, Mail, FileText } from 'lucide-react'
import { ThemeSwitch } from '../components/ThemeSwitch'
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

type TemplateType = 'body' | 'signature' | 'other'

interface EmailTemplate {
  id: number
  name: string
  type: TemplateType
  description?: string
  html_content: string
  created_at: string
  updated_at: string
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

  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [templatesTab, setTemplatesTab] = useState<TemplateType>('body')
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'body' as TemplateType,
    description: '',
    html_content: '',
  })

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<User[]>('/admin/users')
      return data
    },
  })

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get<EmailTemplate[]>('/templates')
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

  // Template mutations (admin-only)
  const createTemplateMutation = useMutation({
    mutationFn: async (payload: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data } = await api.post<EmailTemplate>('/templates', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setEditingTemplate(null)
      setTemplateForm({ name: '', type: 'body', description: '', html_content: '' })
      alert('Шаблон сохранён')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка сохранения шаблона')
    },
  })

  const updateTemplateMutation = useMutation({
    mutationFn: async (payload: { id: number; data: Partial<EmailTemplate> }) => {
      const { data } = await api.put<EmailTemplate>(`/templates/${payload.id}`, payload.data)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setEditingTemplate(null)
      setTemplateForm({ name: '', type: 'body', description: '', html_content: '' })
      alert('Шаблон обновлён')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка обновления шаблона')
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/templates/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      alert('Шаблон удалён')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка удаления шаблона')
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

  const filteredTemplates = (templates || []).filter((t) => t.type === templatesTab)

  const openCreateTemplate = (type: TemplateType) => {
    setEditingTemplate(null)
    setTemplateForm({
      name: '',
      type,
      description: '',
      html_content: '',
    })
  }

  const startEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setTemplateForm({
      name: template.name,
      type: template.type,
      description: template.description || '',
      html_content: template.html_content,
    })
  }

  const handleTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        data: {
          name: templateForm.name,
          type: templateForm.type,
          description: templateForm.description,
          html_content: templateForm.html_content,
        },
      })
    } else {
      createTemplateMutation.mutate({
        name: templateForm.name,
        type: templateForm.type,
        description: templateForm.description,
        html_content: templateForm.html_content,
      } as any)
    }
  }

  return (
    <div className="admin-container">
      <nav className="admin-nav">
        <div className="nav-brand">
          <h1>Админ-панель</h1>
          <span className="domain">alexol.io</span>
        </div>
        <div className="nav-user">
          <ThemeSwitch />
          <span>{user?.email}</span>
          <button
            onClick={() => {
              setShowTemplatesModal(true)
              setTemplatesTab('body')
              openCreateTemplate('body')
            }}
            className="btn-templates"
          >
            <FileText size={20} />
            Управлять шаблонами писем
          </button>
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
        {showTemplatesModal && (
          <div className="modal-overlay" onClick={() => setShowTemplatesModal(false)}>
            <div className="modal templates-manage-modal" onClick={(e) => e.stopPropagation()}>
              <div className="templates-header">
                <h3>Шаблоны писем</h3>
                <div className="templates-tabs">
                  <button
                    type="button"
                    className={templatesTab === 'body' ? 'active' : ''}
                    onClick={() => {
                      setTemplatesTab('body')
                      openCreateTemplate('body')
                    }}
                  >
                    Основное письмо
                  </button>
                  <button
                    type="button"
                    className={templatesTab === 'signature' ? 'active' : ''}
                    onClick={() => {
                      setTemplatesTab('signature')
                      openCreateTemplate('signature')
                    }}
                  >
                    Подпись
                  </button>
                  <button
                    type="button"
                    className={templatesTab === 'other' ? 'active' : ''}
                    onClick={() => {
                      setTemplatesTab('other')
                      openCreateTemplate('other')
                    }}
                  >
                    Другое
                  </button>
                </div>
              </div>

              <div className="templates-manage-content">
                <div className="templates-list">
                  {filteredTemplates.length === 0 ? (
                    <p className="empty-state-text">Пока нет шаблонов.</p>
                  ) : (
                    filteredTemplates.map((tpl) => (
                      <div key={tpl.id} className="template-item-row">
                        <div className="template-main">
                          <div className="template-name">{tpl.name}</div>
                          {tpl.description && (
                            <div className="template-description">{tpl.description}</div>
                          )}
                        </div>
                        <div className="template-actions">
                          <button
                            type="button"
                            className="icon-button"
                            title="Редактировать"
                            onClick={() => startEditTemplate(tpl)}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            title="Удалить"
                            onClick={() => {
                              if (confirm(`Удалить шаблон "${tpl.name}"?`)) {
                                deleteTemplateMutation.mutate(tpl.id)
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="template-form">
                  <h4>{editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}</h4>
                  <form onSubmit={handleTemplateSubmit}>
                    <div className="form-group">
                      <label>Название</label>
                      <input
                        type="text"
                        value={templateForm.name}
                        onChange={(e) =>
                          setTemplateForm({ ...templateForm, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Тип шаблона</label>
                      <div className="template-type-group">
                        <button
                          type="button"
                          className={`type-pill ${templateForm.type === 'body' ? 'active' : ''}`}
                          onClick={() => setTemplateForm({ ...templateForm, type: 'body' })}
                        >
                          Основное письмо
                        </button>
                        <button
                          type="button"
                          className={`type-pill ${templateForm.type === 'signature' ? 'active' : ''}`}
                          onClick={() => setTemplateForm({ ...templateForm, type: 'signature' })}
                        >
                          Подпись
                        </button>
                        <button
                          type="button"
                          className={`type-pill ${templateForm.type === 'other' ? 'active' : ''}`}
                          onClick={() => setTemplateForm({ ...templateForm, type: 'other' })}
                        >
                          Другое
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Описание (необязательно)</label>
                      <input
                        type="text"
                        value={templateForm.description}
                        onChange={(e) =>
                          setTemplateForm({ ...templateForm, description: e.target.value })
                        }
                        placeholder="Например: шаблон коммерческого предложения"
                      />
                    </div>
                    <div className="form-group">
                      <label>HTML содержимое</label>
                      <textarea
                        value={templateForm.html_content}
                        onChange={(e) =>
                          setTemplateForm({
                            ...templateForm,
                            html_content: e.target.value,
                          })
                        }
                        rows={8}
                        required
                      />
                      {templateForm.html_content && (
                        <div className="html-preview">
                          <div className="html-preview-label">Предпросмотр шаблона</div>
                          <div
                            className="html-preview-body"
                            dangerouslySetInnerHTML={{ __html: templateForm.html_content }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setEditingTemplate(null)
                          openCreateTemplate(templatesTab)
                        }}
                      >
                        Очистить форму
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={
                          createTemplateMutation.isPending ||
                          updateTemplateMutation.isPending
                        }
                      >
                        {editingTemplate
                          ? updateTemplateMutation.isPending
                            ? 'Сохранение...'
                            : 'Сохранить изменения'
                          : createTemplateMutation.isPending
                          ? 'Создание...'
                          : 'Создать шаблон'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowTemplatesModal(false)}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

