import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function BrandMark({ className = '' }) {
  return (
    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5482B4] to-[#052659] text-white shadow-lg shadow-[#011025]/50 ${className}`}>
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/member');
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Periksa koneksi dan data akun Anda.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-10 flex items-center justify-center">
      <div className="grid w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#052659]/95 shadow-[0_35px_100px_rgba(0,0,0,.42)] lg:min-h-[650px] lg:grid-cols-[1.04fr_.96fr]">
        <section className="relative hidden overflow-hidden bg-[#052659] px-12 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_12%,rgba(84,130,180,.28),transparent_46%),radial-gradient(ellipse_at_90%_85%,rgba(194,232,255,.12),transparent_42%)]" />
          <div className="absolute -right-24 top-20 h-80 w-80 rounded-full border border-white/[0.06]" />
          <div className="absolute -right-8 top-36 h-48 w-48 rounded-full border border-white/[0.06]" />
          <div className="relative z-10 flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-[15px] font-semibold text-white">Audit Monitor</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[.15em] text-slate-400">Team workspace</p>
            </div>
          </div>

          <div className="relative z-10 max-w-lg py-12">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#7EA0C5]/20 bg-[#7EA0C5]/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#C2E8FF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7EA0C5]" /> Audit workflow
            </span>
            <h1 className="text-[42px] font-semibold leading-[1.12] tracking-[-.045em] text-white xl:text-[48px]">
              Semua proses audit, <span className="text-[#7EA0C5]">lebih terarah.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-slate-400">
              Kirim dokumen, pantau progres review, dan tindak lanjuti masukan admin dalam satu ruang kerja.
            </p>

            <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#011025]/75 p-5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">Alur kerja sederhana</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { num: '01', title: 'Kirim', desc: 'Unggah dokumen' },
                  { num: '02', title: 'Review', desc: 'Admin meninjau' },
                  { num: '03', title: 'Tindak lanjut', desc: 'Lihat hasilnya' },
                ].map((item, index) => (
                  <div key={item.num} className="relative">
                    {index < 2 && <span className="absolute left-9 top-3 hidden h-px w-[calc(100%-20px)] bg-white/10 xl:block" />}
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5482B4]/10 text-[10px] font-semibold text-[#C2E8FF]">{item.num}</span>
                    <p className="mt-3 text-[12px] font-semibold text-slate-200">{item.title}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs text-slate-600">Audit Monitor · Ruang kerja tim yang lebih terorganisir</p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-[390px]">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <BrandMark />
              <div>
                <p className="font-semibold text-white">Audit Monitor</p>
                <p className="mt-0.5 text-xs text-slate-500">Platform monitoring kinerja tim</p>
              </div>
            </div>
            <span className="eyebrow">Selamat datang kembali</span>
            <h2 className="text-[28px] font-semibold tracking-[-.04em] text-white">Masuk ke workspace</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Gunakan akun Anda untuk melanjutkan pekerjaan audit.</p>

            {error && (
              <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="email">Alamat email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  className="input"
                  placeholder="nama@perusahaan.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="input"
                  placeholder="Masukkan password Anda"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn-primary mt-2 w-full !py-3" disabled={loading}>
                {loading ? 'Memeriksa akun...' : 'Masuk ke workspace'}
                {!loading && <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6 6 6-6 6" /></svg>}
              </button>
            </form>

            <div className="mt-8 border-t border-white/[0.08] pt-6">
              <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-300/10 text-amber-200">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200">Akun demo administrator</p>
                  <p className="mt-1 break-all text-xs text-slate-400">admin@audit.com <span className="text-slate-600">·</span> admin123</p>
                </div>
              </div>
              <p className="mt-4 text-center text-sm text-slate-500">
                Belum punya akun? <Link to="/register" className="font-semibold text-[#7EA0C5] hover:text-white">Daftar sebagai member</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
