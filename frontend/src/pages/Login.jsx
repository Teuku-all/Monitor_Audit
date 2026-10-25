import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const errors = {
    credentials: t('Email atau kata sandi belum sesuai. Silakan coba lagi.', 'Your email or password is incorrect. Please try again.'),
    connection: t('Belum dapat terhubung ke server. Periksa koneksi dan coba lagi.', 'Unable to reach the server. Check your connection and try again.'),
    failed: t('Belum dapat masuk. Silakan coba lagi sebentar.', 'Unable to sign in. Please try again shortly.'),
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/member', { replace: true });
    } catch (err) {
      setError([400, 401].includes(err.response?.status) ? 'credentials' : err.response ? 'failed' : 'connection');
    } finally { setLoading(false); }
  }

  return <AuthLayout>
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#052659]">{t('Selamat datang kembali', 'Welcome back')}</p>
    <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[#052659]">{t('Masuk ke ruang kerja', 'Sign in to your workspace')}</h2>
    <p className="mt-3 text-sm leading-6 text-slate-500">{t('Lanjutkan pekerjaan dan pantau kemajuan tim Anda.', 'Pick up where you left off and follow your team’s progress.')}</p>
    {error && <div role="alert" className="alert alert-error mt-6">{errors[error]}</div>}
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div><label className="label" htmlFor="login-email">{t('Alamat email', 'Email address')}</label><input id="login-email" type="email" autoComplete="username" className="input" placeholder={t('nama@perusahaan.com', 'name@company.com')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} maxLength={254} required disabled={loading}/></div>
      <div><div className="mb-2 flex items-center justify-between gap-3"><label className="label !mb-0" htmlFor="login-password">{t('Kata sandi', 'Password')}</label><button type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} className="text-xs font-medium text-[#052659] hover:text-[#052659]">{showPassword ? t('Sembunyikan', 'Hide') : t('Tampilkan', 'Show')}</button></div><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="input" placeholder={t('Masukkan kata sandi', 'Enter your password')} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required disabled={loading}/></div>
      <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>{loading ? t('Memeriksa akun...', 'Signing in...') : t('Masuk', 'Sign in')}<span aria-hidden="true">&rarr;</span></button>
    </form>
    <p className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">{t('Belum punya akun?', 'New here?')} <Link to="/register" className="font-semibold text-[#052659] underline-offset-4 hover:underline">{t('Buat akun', 'Create an account')}</Link></p>
  </AuthLayout>;
}
