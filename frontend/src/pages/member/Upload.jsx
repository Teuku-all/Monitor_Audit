import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';

export default function MemberUpload() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '' });
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function handleFile(f) {
    if (!f) return;
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError('Format file tidak didukung. Gunakan PDF, Word, Excel, atau gambar.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Ukuran file maksimal 10 MB.');
      return;
    }
    setError('');
    setFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!file) { setError('Pilih file untuk diunggah.'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('file', file);

      await api.post('/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess('Submission berhasil dikirim! Mengarahkan ke dashboard...');
      setTimeout(() => navigate('/member'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengunggah submission.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="page-container max-w-[760px]">
        <button onClick={() => navigate('/member')} className="back-link">
          ← Kembali ke Dashboard
        </button>

        <div className="page-heading">
          <span className="eyebrow">Pengiriman dokumen</span>
          <h1>Upload dokumen audit</h1>
          <p>Unggah dokumen audit Anda agar dapat direview admin.</p>
        </div>

        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
            ✅ {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="label">Judul Submission *</label>
            <input
              type="text"
              className="input"
              placeholder="Contoh: Laporan Audit Q3 2024"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Deskripsi</label>
            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="Tambahkan catatan atau deskripsi singkat..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="label">File Dokumen *</label>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('fileInput').click(); } }}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer ${
                dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('fileInput').click()}
            >
              {file ? (
                <div>
                  <div className="w-12 h-12 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-gray-500 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300"
                  >
                    Hapus file
                  </button>
                </div>
              ) : (
                <div>
                  <div className="w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-gray-400 font-medium">Drag & drop atau klik untuk pilih file</p>
                  <p className="text-gray-600 text-xs mt-1">PDF, Word, Excel, atau gambar — Maks. 10 MB</p>
                </div>
              )}
            </div>
            <input
              id="fileInput"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/member')} className="btn-secondary flex-1">
              Batal
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Mengunggah...' : 'Upload Submission'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
