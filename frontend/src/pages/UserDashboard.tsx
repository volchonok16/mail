import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import { Mail, Send, Inbox, LogOut, User, RefreshCw, Users } from 'lucide-react'
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

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async (emailData: typeof composeData) => {
      const { data } = await api.post('/emails/send', emailData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sent'] })
      setShowCompose(false)
      setComposeData({ to_address: '', subject: '', body: '' })
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
    sendMutation.mutate(composeData)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const emails = activeTab === 'inbox' ? inbox : sent

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
                <label>Сообщение</label>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  placeholder="Текст письма..."
                  rows={10}
                  required
                />
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

