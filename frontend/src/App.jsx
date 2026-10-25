import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import AdminDetail from './pages/admin/Detail';
import MemberDashboard from './pages/member/Dashboard';
import MemberUpload from './pages/member/Upload';
import MemberDetail from './pages/member/Detail';
import Targets from './pages/Targets';
import TargetDetail from './pages/TargetDetail';
import Submissions from './pages/Submissions';
import Members from './pages/admin/Members';

function RootRedirect() {
  const { user, loading, authError, retrySession } = useAuth();
  if (loading) return <div className="loading-state" role="status"><span className="spinner"/>Memverifikasi sesi...</div>;
  if (authError) return <div className="auth-shell"><section className="panel auth-card"><h1>Sesi belum dapat diverifikasi</h1><button className="btn-primary" onClick={retrySession}>Coba lagi</button></section></div>;
  return <Navigate to={user ? (user.role === 'admin' ? '/admin' : '/member') : '/login'} replace />;
}
function Workspace() { return <Layout />; }

export default function App() {
  return <LanguageProvider><AuthProvider><BrowserRouter><Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route element={<ProtectedRoute role="admin"><Workspace /></ProtectedRoute>}>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/targets" element={<Targets />} />
      <Route path="/admin/targets/:id" element={<TargetDetail />} />
      <Route path="/admin/submissions" element={<Submissions />} />
      <Route path="/admin/submissions/:id" element={<AdminDetail />} />
      <Route path="/admin/members" element={<Members />} />
    </Route>
    <Route element={<ProtectedRoute role="member"><Workspace /></ProtectedRoute>}>
      <Route path="/member" element={<MemberDashboard />} />
      <Route path="/member/targets" element={<Targets />} />
      <Route path="/member/targets/:id" element={<TargetDetail />} />
      <Route path="/member/submissions" element={<Submissions />} />
      <Route path="/member/upload" element={<MemberUpload />} />
      <Route path="/member/submissions/:id" element={<MemberDetail />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></AuthProvider></LanguageProvider>;
}
