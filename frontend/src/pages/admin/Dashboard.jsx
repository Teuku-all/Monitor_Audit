import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';

const STATUSES = ['Semua', 'Menunggu', 'Disetujui', 'Perlu Revisi'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('Semua');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [filter, search]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filter !== 'Semua') params.status = filter;
      if (search) params.search = search;

      const [subRes, statRes] = await Promise.all([
        api.get('/submissions', { params }),
        api.get('/submissions/stats'),
      ]);
      setSubmissions(subRes.data);
      setStats(statRes.data);
    } catch (err) {
      console.error(err);
      setError('Data belum dapat dimuat. Pastikan backend berjalan, lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Total Submission', value: stats.total ?? 0, color: 'text-accent' },
    { label: 'Menunggu Review', value: stats.menunggu ?? 0, color: 'text-yellow-400' },
    { label: 'Disetujui', value: stats.disetujui ?? 0, color: 'text-green-400' },
    { label: 'Perlu Revisi', value: stats.perluRevisi ?? 0, color: 'text-red-400' },
    { label: 'Total Member', value: stats.totalMembers ?? 0, color: 'text-blue-400' },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="page-container">
        <div className="page-heading flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Ringkasan workspace</span>
            <h1>Dashboard admin</h1>
            <p>Pantau pengiriman dan tindak lanjuti review audit tim.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#7EA0C5]/15 bg-[#7EA0C5]/[0.06] px-3 py-2 text-xs text-[#C2E8FF]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg> Panel kontrol
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="card stat-card">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter & Search */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            className="input sm:max-w-sm"
            placeholder="Cari judul atau nama member..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors border ${
                  filter === s
                    ? 'bg-accent border-accent text-white'
                    : 'bg-surface border-border text-gray-400 hover:border-accent/50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100"><span>{error}</span><button onClick={fetchData} className="shrink-0 font-semibold text-amber-200 hover:text-white">Coba lagi</button></div>}

        {/* Table */}
        <div className="table-wrap">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div><h2 className="text-sm font-semibold text-white">Submission terbaru</h2><p className="mt-1 text-xs text-gray-500">Daftar dokumen audit yang dikirim anggota</p></div>
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-gray-400">{submissions.length} item</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6">#</th>
                  <th className="text-left px-6">Judul</th>
                  <th className="text-left px-6">Member</th>
                  <th className="text-left px-6">Status</th>
                  <th className="text-left px-6">Tanggal</th>
                  <th className="text-left px-6">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-600">Memuat data...</td></tr>
                ) : submissions.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-600">Belum ada submission</td></tr>
                ) : submissions.map((s, i) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-gray-600">{i + 1}</td>
                    <td className="px-6 py-4 text-white font-medium max-w-xs truncate">{s.title}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white">{s.member_name}</p>
                        <p className="text-gray-600 text-xs">{s.member_email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={s.status} /></td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(s.submitted_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/admin/submissions/${s.id}`)}
                        className="text-accent hover:text-accent-hover text-sm font-medium transition-colors"
                      >
                        Detail →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
