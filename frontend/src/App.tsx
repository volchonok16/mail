import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import UserDashboard from './pages/UserDashboard'
import Profile from './pages/Profile'

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, token } = useAuthStore()
  
  if (!token) {
    return <Navigate to="/login" replace />
  }
  
  if (adminOnly && !user?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function App() {
  const { token, user } = useAuthStore()
  
  return (
    <Router>
      <Routes>
        <Route path="/login" element={token ? <Navigate to={user?.is_admin ? "/admin" : "/dashboard"} /> : <Login />} />
        
        <Route path="/admin" element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        
        <Route path="/" element={<Navigate to={token ? (user?.is_admin ? "/admin" : "/dashboard") : "/login"} replace />} />
      </Routes>
    </Router>
  )
}

export default App

