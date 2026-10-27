import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';

export default function Register() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const errors = {
    mismatch: t('Konfirmasi kata sandi belum sama.', 'Your passwords do not match.'),
    name: t('Masukkan nama lengkap Anda.', 'Please enter your full name.'),
    duplicate: t('Email ini sudah terdaftar. Silakan masuk dengan akun Anda.', 'This email is already registered. Please sign in to your account.'),
    validation: t('Periksa data Anda. Kata sandi harus terdiri dari minimal 12 karakter.', 'Check your details. Your password must contain at least 12 characters.'),
    disabled: t('Pendaftaran publik dinonaktifkan. Hubungi administrator audit.', 'Public registration is disabled. Contact your audit administrator.'),
    connection: t('Belum dapat terhubung ke server. Periksa koneksi dan coba lagi.', 'Unable to reach the server. Check your connection and try again.'),
    failed: t('Akun belum dapat dibuat. Silakan coba lagi.', 'Unable to create your account. Please try again.'),
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading || success) return;
    setError('');
    if (!form.name.trim()) { setError('name'); return; }
    if (form.password !== form.confirmPassword) { setError('mismatch'); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', { name: form.name.trim(), email: form.email.trim(), password: form.password });
      setSuccess(true);
      setForm({ name: '', email: '', password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.code === 'REGISTRATION_DISABLED' ? 'disabled' : err.response?.status === 409 ? 'duplicate' : err.response?.status === 400 ? 'validation' : err.response ? 'failed' : 'connection');
    } finally { setLoading(false); }
  }

  return <AuthLayout>
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#052659]">{t('Mulai bersama tim', 'Get started with your team')}</p>
    <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[#052659]">{t('Buat akun Anda', 'Create your account')}</h2>
    <p className="mt-3 text-sm leading-6 text-slate-500">{t('Daftar sebagai anggota untuk menerima target dan mengirim dokumen audit.', 'Join as a member to receive targets and submit your audit documents.')}</p>
    {error && <div role="alert" className="alert alert-error mt-5">{errors[error]}</div>}
    {success ? <div role="status" className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <span aria-hidden="true" className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-700">✓</span>
      <h3 className="font-semibold text-emerald-900">{t('Akun Anda siap digunakan', 'Your account is ready')}</h3>
      <p className="mt-2 text-sm leading-6 text-emerald-800">{t('Data akun telah tersimpan. Masuk dengan email dan kata sandi Anda untuk mulai bekerja.', 'Your account has been saved. Sign in with your email and password to get started.')}</p>
      <Link to="/login" className="btn-primary mt-5 w-full">{t('Masuk ke akun', 'Sign in to your account')}<span aria-hidden="true">&rarr;</span></Link>
    </div> : <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      <div><label className="label" htmlFor="register-name">{t('Nama lengkap', 'Full name')}</label><input id="register-name" autoComplete="name" className="input" placeholder={t('Nama lengkap Anda', 'Your full name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={100} required disabled={loading}/></div>
      <div><label className="label" htmlFor="register-email">{t('Alamat email', 'Email address')}</label><input id="register-email" type="email" autoComplete="email" className="input" placeholder={t('nama@perusahaan.com', 'name@company.com')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} maxLength={254} required disabled={loading}/></div>
      <div><label className="label" htmlFor="register-password">{t('Kata sandi', 'Password')}</label><input id="register-password" type="password" autoComplete="new-password" className="input" placeholder={t('Minimal 12 karakter', 'At least 12 characters')} aria-describedby="password-hint" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={12} maxLength={72} required disabled={loading}/><p id="password-hint" className="mt-1.5 text-[11px] text-slate-500">{t('Gunakan minimal 12 karakter untuk kata sandi Anda.', 'Use at least 12 characters for your password.')}</p></div>
      <div><label className="label" htmlFor="register-confirm">{t('Konfirmasi kata sandi', 'Confirm password')}</label><input id="register-confirm" type="password" autoComplete="new-password" className="input" placeholder={t('Ulangi kata sandi', 'Repeat your password')} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} minLength={12} maxLength={72} required disabled={loading}/></div>
      <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>{loading ? t('Membuat akun...', 'Creating your account...') : t('Buat akun', 'Create account')}<span aria-hidden="true">&rarr;</span></button>
    </form>}
    <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">{t('Sudah punya akun?', 'Already have an account?')} <Link to="/login" className="font-semibold text-[#052659] underline-offset-4 hover:underline">{t('Masuk', 'Sign in')}</Link></p>
  </AuthLayout>;
}
