import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import { Users, Mail, X } from 'lucide-react'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAdminChoice, setShowAdminChoice] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: tokenData } = await api.post('/auth/login', {
        email,
        password,
      })

      // Get user data
      const { data: userData } = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })

      setAuth(userData, tokenData.access_token)
      
      // If admin, show choice popup, otherwise go to dashboard
      if (userData.is_admin) {
        setShowAdminChoice(true)
      } else {
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  const handleChoice = (path: string) => {
    setShowAdminChoice(false)
    navigate(path)
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Почтовый сервер</h1>
        <h2>alexol.io</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@alexol.io"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>

      {/* Admin Choice Popup */}
      {showAdminChoice && (
        <div className="modal-overlay">
          <div className="admin-choice-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => handleChoice('/dashboard')}>
              <X size={24} />
            </button>
            
            <h2>Куда вы хотите перейти?</h2>
            
            <div className="choice-buttons">
              <button
                className="choice-btn admin-btn"
                onClick={() => handleChoice('/admin')}
              >
                <div className="choice-icon">
                  <Users size={40} />
                </div>
                <h3>Управление пользователями</h3>
                <p>Создание и редактирование пользователей</p>
              </button>

              <button
                className="choice-btn mail-btn"
                onClick={() => handleChoice('/dashboard')}
              >
                <div className="choice-icon">
                  <Mail size={40} />
                </div>
                <h3>Моя почта</h3>
                <p>Отправка и получение писем</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

