import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import { Mail, Send, Inbox, LogOut, User, RefreshCw, Users, FileText } from 'lucide-react'
import { ThemeSwitch } from '../components/ThemeSwitch'
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
  const [templatesTab, setTemplatesTab] = useState<TemplateType>('body')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const [isEditingPreview, setIsEditingPreview] = useState(false)
  const htmlPreviewRef = useRef<HTMLDivElement | null>(null)

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
  type ComposePayload = typeof composeData & { attachments: File[] }

  const sendMutation = useMutation({
    mutationFn: async (emailData: ComposePayload) => {
      if (emailData.attachments && emailData.attachments.length > 0) {
        const formData = new FormData()
        formData.append('to_address', emailData.to_address)
        formData.append('subject', emailData.subject)
        formData.append('body', emailData.body)
        if (emailData.html_body) {
          formData.append('html_body', emailData.html_body)
        }
        emailData.attachments.forEach((file) => {
          formData.append('files', file)
        })
        const { data } = await api.post('/emails/send-with-attachments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
      } else {
        const { data } = await api.post('/emails/send', {
          to_address: emailData.to_address,
          subject: emailData.subject,
          body: emailData.body,
          html_body: emailData.html_body,
        })
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sent'] })
      setShowCompose(false)
      setComposeData({ to_address: '', subject: '', body: '', html_body: '' })
      setAttachments([])
      alert('Письмо отправлено!')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Ошибка отправки')
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
    if (!composeData.body && !composeData.html_body) {
      alert('Нужно указать либо текст письма, либо HTML (шаблон).')
      return
    }
    sendMutation.mutate({ ...composeData, attachments })
  }

  const handleAttachmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(files)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const emails = activeTab === 'inbox' ? inbox : sent

  const filteredTemplates = (templates || []).filter((t) => t.type === templatesTab)

  const toggleTemplateSelection = (template: EmailTemplate) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(template.id) ? prev.filter((id) => id !== template.id) : [...prev, template.id]
    )
  }

  const applySelectedTemplates = () => {
    if (!templates || selectedTemplateIds.length === 0) {
      setShowTemplatesModal(false)
      return
    }
    const selected = templates.filter((t) => selectedTemplateIds.includes(t.id))
    if (selected.length === 0) {
      setShowTemplatesModal(false)
      return
    }

    setComposeData((prev) => {
      let html = prev.html_body || ''

      const bodyTemplates = selected.filter((t) => t.type === 'body')
      const otherTemplates = selected.filter((t) => t.type !== 'body')

      if (bodyTemplates.length > 0) {
        // Берём первый выбранный шаблон основного письма как базовый контент
        html = bodyTemplates[0].html_content
      }

      const appendTemplate = (tpl: EmailTemplate) => {
        html = html
          ? `${html}\n<br />\n${tpl.html_content}`
          : tpl.html_content
      }

      otherTemplates.forEach(appendTemplate)

      return {
        ...prev,
        html_body: html,
      }
    })

    setShowTemplatesModal(false)
    setSelectedTemplateIds([])
  }

  useEffect(() => {
    if (!isEditingPreview && htmlPreviewRef.current) {
      htmlPreviewRef.current.innerHTML = composeData.html_body || ''
    }
  }, [composeData.html_body, isEditingPreview])

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
          <ThemeSwitch />
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
                      onClick={() => {
                        setSelectedTemplateIds([])
                        setShowTemplatesModal(true)
                      }}
                    >
                      <FileText size={16} />
                      Использовать шаблон
                    </button>
                  </div>
                </div>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  placeholder="Текст письма..."
                  rows={10}
                />
              </div>

              <div className="form-group">
                <label>Вложения (файлы, изображения)</label>
                <input
                  type="file"
                  multiple
                  onChange={handleAttachmentsChange}
                />
                {attachments.length > 0 && (
                  <ul className="attachments-list">
                    {attachments.map((file, idx) => (
                      <li key={idx}>
                        {file.name} ({Math.round(file.size / 1024)} КБ)
                      </li>
                    ))}
                  </ul>
                )}
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
                      ref={htmlPreviewRef}
                      className="html-preview-body"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) =>
                        setComposeData((prev) => ({
                          ...prev,
                          html_body: (e.currentTarget as HTMLDivElement).innerHTML,
                        }))
                      }
                      onFocus={() => setIsEditingPreview(true)}
                      onBlur={() => setIsEditingPreview(false)}
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
                filteredTemplates.map((tpl) => {
                  const isSelected = selectedTemplateIds.includes(tpl.id)
                  return (
                    <div
                      key={tpl.id}
                      className={`template-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleTemplateSelection(tpl)}
                    >
                      <div className="template-main">
                        <div className="template-name">{tpl.name}</div>
                        {tpl.description && (
                          <div className="template-description">{tpl.description}</div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowTemplatesModal(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={applySelectedTemplates}
                disabled={selectedTemplateIds.length === 0}
              >
                Применить выбранные
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

