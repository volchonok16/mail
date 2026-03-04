import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import { Mail, Send, Inbox, LogOut, User, RefreshCw, Users, FileText, PlusCircle, Trash2, Edit } from 'lucide-react'
import './UserDashboard.css'

interface Email {
  id: number
  from_address: string
  to_address: string
  subject: string
  body: string
  html_body?: string
  is_read: boolean
  is_sent: boolean
  received_at: string
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

export default function UserDashboard() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox')
  const [showCompose, setShowCompose] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [composeData, setComposeData] = useState({
    to_address: '',
    subject: '',
    body: '',
    html_body: '',
  })
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [showManageTemplatesModal, setShowManageTemplatesModal] = useState(false)
  const [templatesTab, setTemplatesTab] = useState<TemplateType>('body')
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'body' as TemplateType,
    description: '',
    html_content: '',
  })

  // Fetch inbox
  const { data: inbox } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => {
      const { data } = await api.get<Email[]>('/emails/inbox')
      return data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch sent
  const { data: sent } = useQuery({
    queryKey: ['sent'],
    queryFn: async () => {
      const { data } = await api.get<Email[]>('/emails/sent')
      return data
    },
  })

  // Templates
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get<EmailTemplate[]>('/templates')
      return data
    },
  })

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async (emailData: typeof composeData) => {
      const { data } = await api.post('/emails/send', emailData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sent'] })
      setShowCompose(false)
      setComposeData({ to_address: '', subject: '', body: '', html_body: '' })
      alert('Письмо отправлено!')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка отправки')
    },
  })

  // Template mutations
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

  // Delete email mutation
  const deleteMutation = useMutation({
    mutationFn: async (emailId: number) => {
      await api.delete(`/emails/${emailId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['sent'] })
      setSelectedEmail(null)
      alert('Письмо удалено')
    },
  })

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    sendMutation.mutate(composeData)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const emails = activeTab === 'inbox' ? inbox : sent

  const filteredTemplates = (templates || []).filter((t) => t.type === templatesTab)

  const applyTemplate = (template: EmailTemplate) => {
    if (template.type === 'body') {
      setComposeData((prev) => ({
        ...prev,
        html_body: template.html_content,
      }))
    } else if (template.type === 'signature') {
      setComposeData((prev) => ({
        ...prev,
        html_body: prev.html_body
          ? `${prev.html_body}\n<br />\n${template.html_content}`
          : template.html_content,
      }))
    } else {
      setComposeData((prev) => ({
        ...prev,
        html_body: prev.html_body
          ? `${prev.html_body}\n<br />\n${template.html_content}`
          : template.html_content,
      }))
    }
    setShowTemplatesModal(false)
  }

  const openCreateTemplate = (type: TemplateType) => {
    setEditingTemplate(null)
    setTemplateForm({
      name: '',
      type,
      description: '',
      html_content: composeData.html_body || '',
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
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <Mail size={32} />
          <div>
            <h1>Почта</h1>
            <span className="domain">alexol.io</span>
          </div>
        </div>
        <div className="nav-actions">
          {user?.is_admin && (
            <button onClick={() => navigate('/admin')} className="btn-admin-panel">
              <Users size={20} />
              Управление пользователями
            </button>
          )}
          <button onClick={() => navigate('/profile')} className="btn-profile">
            <User size={20} />
            Профиль
          </button>
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={20} />
            Выйти
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="sidebar">
          <button onClick={() => setShowCompose(true)} className="btn-compose">
            <Send size={20} />
            Написать письмо
          </button>

          <div className="sidebar-menu">
            <button
              className={`menu-item ${activeTab === 'inbox' ? 'active' : ''}`}
              onClick={() => setActiveTab('inbox')}
            >
              <Inbox size={20} />
              Входящие
              {inbox && inbox.filter(e => !e.is_read).length > 0 && (
                <span className="badge">{inbox.filter(e => !e.is_read).length}</span>
              )}
            </button>
            <button
              className={`menu-item ${activeTab === 'sent' ? 'active' : ''}`}
              onClick={() => setActiveTab('sent')}
            >
              <Send size={20} />
              Отправленные
            </button>
          </div>

          <div className="user-info">
            {user?.avatar_url && (
              <img src={user.avatar_url} alt="Avatar" className="user-avatar" />
            )}
            <div>
              <div className="user-name">{user?.full_name}</div>
              <div className="user-email">{user?.email}</div>
              {user?.is_admin && <div className="user-role">Администратор</div>}
            </div>
          </div>
        </div>

        <div className="main-content">
          <div className="content-header">
            <h2>{activeTab === 'inbox' ? 'Входящие' : 'Отправленные'}</h2>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: [activeTab] })
              }}
              className="btn-refresh"
            >
              <RefreshCw size={20} />
            </button>
          </div>

          <div className="emails-list">
            {!emails || emails.length === 0 ? (
              <div className="empty-state">
                <Mail size={48} />
                <p>Нет писем</p>
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.id}
                  className={`email-item ${!email.is_read && !email.is_sent ? 'unread' : ''}`}
                  onClick={() => setSelectedEmail(email)}
                >
                  <div className="email-from">
                    {email.is_sent ? email.to_address : email.from_address}
                  </div>
                  <div className="email-subject">{email.subject || '(Без темы)'}</div>
                  <div className="email-preview">{email.body.substring(0, 100)}...</div>
                  <div className="email-date">
                    {new Date(email.received_at).toLocaleString('ru-RU')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal compose-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Новое письмо</h3>
            <form onSubmit={handleSend}>
              <div className="form-group">
                <label>Кому</label>
                <input
                  type="email"
                  value={composeData.to_address}
                  onChange={(e) => setComposeData({ ...composeData, to_address: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Тема</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  placeholder="Тема письма"
                  required
                />
              </div>

              <div className="form-group">
                <div className="compose-header-row">
                  <label>Сообщение</label>
                  <div className="compose-actions-right">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setShowTemplatesModal(true)}
                    >
                      <FileText size={16} />
                      Использовать шаблон
                    </button>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        setShowManageTemplatesModal(true)
                        setTemplatesTab('body')
                      }}
                    >
                      <PlusCircle size={16} />
                      Управление шаблонами
                    </button>
                  </div>
                </div>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  placeholder="Текст письма..."
                  rows={10}
                  required
                />
              </div>

              <div className="form-group">
                <label>HTML-версия (опционально)</label>
                <textarea
                  value={composeData.html_body}
                  onChange={(e) => setComposeData({ ...composeData, html_body: e.target.value })}
                  placeholder="HTML содержимое письма. Сюда подставляются выбранные шаблоны."
                  rows={10}
                />
                {composeData.html_body && (
                  <div className="html-preview">
                    <div className="html-preview-label">Предпросмотр HTML</div>
                    <div
                      className="html-preview-body"
                      dangerouslySetInnerHTML={{ __html: composeData.html_body }}
                    />
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowCompose(false)} className="btn-secondary">
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={sendMutation.isPending}>
                  {sendMutation.isPending ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTemplatesModal && (
        <div className="modal-overlay" onClick={() => setShowTemplatesModal(false)}>
          <div className="modal templates-modal" onClick={(e) => e.stopPropagation()}>
            <div className="templates-header">
              <h3>Выбрать шаблон</h3>
              <div className="templates-tabs">
                <button
                  type="button"
                  className={templatesTab === 'body' ? 'active' : ''}
                  onClick={() => setTemplatesTab('body')}
                >
                  Основное письмо
                </button>
                <button
                  type="button"
                  className={templatesTab === 'signature' ? 'active' : ''}
                  onClick={() => setTemplatesTab('signature')}
                >
                  Подпись
                </button>
                <button
                  type="button"
                  className={templatesTab === 'other' ? 'active' : ''}
                  onClick={() => setTemplatesTab('other')}
                >
                  Другое
                </button>
              </div>
            </div>
            <div className="templates-list">
              {filteredTemplates.length === 0 ? (
                <p className="empty-state-text">Нет шаблонов для выбранного типа.</p>
              ) : (
                filteredTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="template-item"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <div className="template-main">
                      <div className="template-name">{tpl.name}</div>
                      {tpl.description && (
                        <div className="template-description">{tpl.description}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
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

      {showManageTemplatesModal && (
        <div className="modal-overlay" onClick={() => setShowManageTemplatesModal(false)}>
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
                    <select
                      value={templateForm.type}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          type: e.target.value as TemplateType,
                        })
                      }
                    >
                      <option value="body">Основное письмо</option>
                      <option value="signature">Подпись</option>
                      <option value="other">Другое</option>
                    </select>
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
                onClick={() => setShowManageTemplatesModal(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEmail && (
        <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
          <div className="modal email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="email-header">
              <div>
                <div className="email-subject-large">{selectedEmail.subject || '(Без темы)'}</div>
                <div className="email-meta">
                  <strong>От:</strong> {selectedEmail.from_address}<br />
                  <strong>Кому:</strong> {selectedEmail.to_address}<br />
                  <strong>Дата:</strong> {new Date(selectedEmail.received_at).toLocaleString('ru-RU')}
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm('Удалить письмо?')) {
                    deleteMutation.mutate(selectedEmail.id)
                  }
                }}
                className="btn-delete-email"
              >
                Удалить
              </button>
            </div>
            <div className="email-body">
              {selectedEmail.html_body ? (
                <div dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }} />
              ) : (
                <pre>{selectedEmail.body}</pre>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setSelectedEmail(null)} className="btn-secondary">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

