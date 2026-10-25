import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import AdminDetail from './pages/admin/Detail';
import MemberDashboard from './pages/member/Dashboard';
import MemberUpload from './pages/member/Upload';
import MemberDetail from './pages/member/Detail';

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/member'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/submissions/:id" element={
            <ProtectedRoute role="admin"><AdminDetail /></ProtectedRoute>
          } />

          {/* Member Routes */}
          <Route path="/member" element={
            <ProtectedRoute role="member"><MemberDashboard /></ProtectedRoute>
          } />
          <Route path="/member/upload" element={
            <ProtectedRoute role="member"><MemberUpload /></ProtectedRoute>
          } />
          <Route path="/member/submissions/:id" element={
            <ProtectedRoute role="member"><MemberDetail /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
