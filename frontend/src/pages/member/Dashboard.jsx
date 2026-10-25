import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function MemberDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/submissions/mine')
      .then(r => setSubmissions(r.data))
      .catch(() => setError('Dokumen belum dapat dimuat. Periksa koneksi backend dan coba lagi.'))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    total: submissions.length,
    menunggu: submissions.filter(s => s.status === 'Menunggu').length,
    disetujui: submissions.filter(s => s.status === 'Disetujui').length,
    revisi: submissions.filter(s => s.status === 'Perlu Revisi').length,
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="page-container max-w-[1050px]">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Ruang kerja member</span>
            <h1 className="text-3xl font-bold tracking-tight text-white">Halo, {user?.name?.split(' ')[0]}</h1>
            <p className="mt-2 text-sm text-gray-400">Pantau status dokumen dan progres review audit Anda.</p>
          </div>
          <button onClick={() => navigate('/member/upload')} className="btn-primary w-full sm:w-auto">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Kirim dokumen audit
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: 'Total dokumen', value: counts.total, color: 'text-[#7EA0C5]' },
            { label: 'Menunggu review', value: counts.menunggu, color: 'text-amber-300' },
            { label: 'Disetujui', value: counts.disetujui, color: 'text-emerald-300' },
            { label: 'Perlu revisi', value: counts.revisi, color: 'text-rose-300' },
          ].map(s => (
            <div key={s.label} className="card stat-card">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p>{s.label}</p>
            </div>
          ))}
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">{error} <button onClick={() => { setLoading(true); setError(''); api.get('/submissions/mine').then(r => setSubmissions(r.data)).catch(() => setError('Dokumen belum dapat dimuat. Periksa koneksi backend dan coba lagi.')).finally(() => setLoading(false)); }} className="ml-2 font-semibold text-amber-200">Coba lagi</button></div>}

        <section className="table-wrap">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div><h2 className="font-semibold text-white">Riwayat dokumen</h2><p className="mt-1 text-xs text-gray-500">Semua pengiriman audit Anda</p></div>
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-gray-400">{submissions.length} item</span>
          </div>
          {loading ? (
            <div className="py-16 text-center text-gray-500"><span className="mx-auto mb-3 block h-6 w-6 animate-spin rounded-full border-2 border-[#7EA0C5]/20 border-t-[#7EA0C5]" />Memuat dokumen...</div>
          ) : submissions.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#7EA0C5]/10 bg-[#7EA0C5]/[0.06] text-[#C2E8FF]">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="font-medium text-slate-200">Belum ada dokumen audit</p>
              <p className="mt-1 text-sm text-gray-500">Kirim dokumen pertama Anda untuk memulai proses review.</p>
              <button onClick={() => navigate('/member/upload')} className="btn-primary mt-5 text-sm">Kirim dokumen pertama</button>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {submissions.map(s => (
                <div key={s.id} className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="mr-4 min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{s.title}</p>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {new Date(s.submitted_at).toLocaleDateString('id-ID', { dateStyle: 'long' })} · {s.file_name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-start">
                    <StatusBadge status={s.status} />
                    <button onClick={() => navigate(`/member/submissions/${s.id}`)} className="text-sm font-medium text-[#7EA0C5] transition-colors hover:text-white">
                      Lihat detail <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
