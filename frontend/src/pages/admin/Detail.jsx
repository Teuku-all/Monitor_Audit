import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';

const STATUSES = ['Menunggu', 'Disetujui', 'Perlu Revisi'];
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || 'http://localhost:3001/uploads';

export default function AdminDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchDetail(); }, [id]);

  async function fetchDetail() {
    try {
      const res = await api.get(`/submissions/${id}`);
      setData(res.data);
      setStatus(res.data.status);
    } catch { navigate('/admin'); }
    finally { setLoading(false); }
  }

  async function handleStatusChange(newStatus) {
    setStatus(newStatus);
    try {
      await api.patch(`/submissions/${id}/status`, { status: newStatus });
      setMsg('Status berhasil diperbarui.');
      fetchDetail();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Gagal memperbarui status.');
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/comments/${id}`, { body: comment });
      setComment('');
      setMsg('Komentar berhasil ditambahkan.');
      fetchDetail();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Gagal mengirim komentar.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center text-gray-500">Memuat...</div>;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="page-container max-w-[1050px]">
        <button onClick={() => navigate('/admin')} className="back-link">
          ← Kembali ke Dashboard
        </button>

        {msg && (
          <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-lg text-accent text-sm">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-white">{data.title}</h1>
                  <p className="text-gray-500 text-sm mt-1">
                    Oleh {data.member_name} • {new Date(data.submitted_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                  </p>
                </div>
                <StatusBadge status={data.status} />
              </div>
              {data.description && (
                <p className="text-gray-400 text-sm leading-relaxed">{data.description}</p>
              )}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-gray-500 mb-2">Dokumen Terlampir</p>
                <a
                  href={`${UPLOADS_URL}/${data.file_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-accent hover:text-accent-hover text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {data.file_name}
                </a>
              </div>
            </div>

            {/* Comments */}
            <div className="card">
              <h2 className="font-semibold text-white mb-4">Komentar Admin</h2>
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {data.comments?.length === 0 ? (
                  <p className="text-gray-600 text-sm">Belum ada komentar.</p>
                ) : data.comments?.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-bg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-accent text-sm font-medium">{c.admin_name}</span>
                      <span className="text-gray-600 text-xs">
                        {new Date(c.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed">{c.body}</p>
                    {c.replies?.length > 0 && (
                      <div className="mt-3 space-y-2 border-l border-[#5482B4]/40 pl-3">
                        {c.replies.map(reply => (
                          <div key={reply.id} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-[#C2E8FF]">{reply.author_name} <span className="ml-1 font-normal text-gray-500">Member</span></span>
                              <span className="text-[10px] text-gray-600">{new Date(reply.created_at).toLocaleDateString('id-ID')}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={handleComment} className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Tulis komentar..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? '...' : 'Kirim'}
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card">
              <h3 className="font-semibold text-white mb-4">Ubah Status</h3>
              <div className="space-y-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors border ${
                      status === s
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'bg-bg border-border text-gray-400 hover:border-accent/50'
                    }`}
                  >
                    {s === 'Menunggu' && '🕐 '}{s === 'Disetujui' && '✅ '}{s === 'Perlu Revisi' && '🔄 '}{s}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white mb-3">Info Member</h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-500">Nama</p>
                <p className="text-white font-medium">{data.member_name}</p>
                <p className="text-gray-500 mt-2">Email</p>
                <p className="text-white">{data.member_email}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
