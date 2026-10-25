import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

function BrandMark({ className = '' }) {
  return (
    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5482B4] to-[#052659] text-white shadow-lg shadow-[#011025]/50 ${className}`}>
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Konfirmasi password belum sama.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setSuccess('Akun berhasil dibuat. Silakan masuk dengan email dan password Anda.');
    } catch (err) {
      setError(err.response?.data?.message || 'Pendaftaran gagal. Periksa koneksi, lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-10 flex items-center justify-center">
      <div className="grid w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#052659]/95 shadow-[0_35px_100px_rgba(0,0,0,.42)] lg:min-h-[680px] lg:grid-cols-[1.04fr_.96fr]">
        <section className="relative hidden overflow-hidden bg-[#052659] px-12 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_12%,rgba(84,130,180,.28),transparent_46%),radial-gradient(ellipse_at_90%_85%,rgba(194,232,255,.12),transparent_42%)]" />
          <div className="absolute -right-24 top-20 h-80 w-80 rounded-full border border-white/[0.06]" />
          <div className="relative z-10 flex items-center gap-3">
            <BrandMark />
            <div><p className="text-[15px] font-semibold text-white">Audit Monitor</p><p className="mt-0.5 text-[10px] uppercase tracking-[.15em] text-slate-400">Team workspace</p></div>
          </div>

          <div className="relative z-10 max-w-lg py-12">
            <span className="eyebrow">Mulai bersama tim</span>
            <h1 className="text-[42px] font-semibold leading-[1.12] tracking-[-.045em] text-white xl:text-[48px]">
              Siapkan ruang kerja audit <span className="text-[#7EA0C5]">Anda.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-slate-400">
              Buat akun member untuk mengirim dokumen dan mengikuti perkembangan review dari administrator.
            </p>
            <div className="mt-9 space-y-3">
              {[
                'Simpan semua submission audit dalam satu tempat',
                'Pantau status review secara langsung',
                'Baca feedback dan tindak lanjuti revisi',
              ].map(item => (
                <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12 4 4L19 6" /></svg>
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <p className="relative z-10 text-xs text-slate-600">Audit Monitor · Ruang kerja tim yang lebih terorganisir</p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-[390px]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandMark />
              <div><p className="font-semibold text-white">Audit Monitor</p><p className="mt-0.5 text-xs text-slate-500">Platform monitoring kinerja tim</p></div>
            </div>
            <span className="eyebrow">Pendaftaran member</span>
            <h2 className="text-[28px] font-semibold tracking-[-.04em] text-white">Buat akun baru</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Isi data berikut untuk mulai menggunakan workspace.</p>

            {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">{error}</div>}
            {success && (
              <div role="status" className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-sm text-emerald-100">
                <p>{success}</p>
                <button onClick={() => navigate('/login')} className="mt-3 font-semibold text-emerald-200 underline underline-offset-4 hover:text-white">Ke halaman masuk</button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label className="label" htmlFor="name">Nama lengkap</label>
                <input id="name" type="text" autoComplete="name" className="input" placeholder="Nama Anda" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={100} required />
              </div>
              <div>
                <label className="label" htmlFor="email">Alamat email</label>
                <input id="email" type="email" autoComplete="email" className="input" placeholder="nama@perusahaan.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="password">Password</label>
                  <input id="password" type="password" autoComplete="new-password" className="input" placeholder="Minimal 8 karakter" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={8} required />
                </div>
                <div>
                  <label className="label" htmlFor="confirmPassword">Ulangi password</label>
                  <input id="confirmPassword" type="password" autoComplete="new-password" className="input" placeholder="Ulangi password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} minLength={8} required />
                </div>
              </div>
              <p className="-mt-1 text-[11px] leading-5 text-slate-500">Password harus terdiri dari minimal 8 karakter.</p>
              <button type="submit" className="btn-primary w-full !py-3" disabled={loading || Boolean(success)}>
                {loading ? 'Membuat akun...' : 'Buat akun member'}
                {!loading && <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6 6 6-6 6" /></svg>}
              </button>
            </form>

            <p className="mt-7 border-t border-white/[0.08] pt-6 text-center text-sm text-slate-500">
              Sudah punya akun? <Link to="/login" className="font-semibold text-[#7EA0C5] hover:text-white">Masuk di sini</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
