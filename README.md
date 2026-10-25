# 🔍 Audit Monitor Platform

Platform monitoring kinerja audit tim dengan dua peran: **Admin** dan **Member**.

---

## 🚀 Cara Menjalankan

### Prasyarat
- Node.js v22+
- npm

---

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

Server berjalan di: `http://localhost:3001`

**Akun Admin default:**
- Email: `admin@audit.com`
- Password: `admin123`

---

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App berjalan di: `http://localhost:5173`

---

## 📁 Struktur Project

```
audit-monitor/
├── backend/
│   ├── src/
│   │   ├── config/db.js          ← SQLite init & seed
│   │   ├── middleware/
│   │   │   ├── auth.js           ← JWT verify
│   │   │   ├── roleCheck.js      ← Guard by role
│   │   │   └── upload.js         ← Multer config
│   │   ├── controllers/          ← Business logic
│   │   └── routes/               ← Express routes
│   ├── uploads/                  ← File dokumen tersimpan
│   ├── .env
│   └── server.js
│
└── frontend/
    └── src/
        ├── api/axios.js           ← Axios + interceptor
        ├── context/AuthContext    ← Global auth state
        ├── components/            ← Navbar, Badge, Guard
        └── pages/
            ├── Login.jsx
            ├── admin/             ← Dashboard + Detail
            └── member/            ← Dashboard + Upload + Detail
```

---

## 🔌 API Endpoints

| Method | Endpoint | Role | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/auth/register` | Public | Daftar akun |
| POST | `/api/auth/login` | Public | Login, dapat JWT |
| GET | `/api/auth/profile` | Both | Profil user |
| GET | `/api/submissions` | Admin | Semua submission |
| GET | `/api/submissions/stats` | Admin | Statistik ringkas |
| GET | `/api/submissions/mine` | Member | Submission sendiri |
| GET | `/api/submissions/:id` | Both | Detail submission |
| POST | `/api/submissions` | Member | Upload submission |
| PATCH | `/api/submissions/:id/status` | Admin | Ubah status |
| POST | `/api/comments/:submission_id` | Admin | Tambah komentar |
| POST | `/api/comments/:submission_id/:comment_id/replies` | Member pemilik submission | Balas komentar admin |
| GET | `/api/comments/:submission_id` | Both | Lihat komentar |

---

## 🎨 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken) |
| Upload | Multer |

---

## 🌐 Mendaftarkan Akun Member

Karena belum ada halaman register di UI, gunakan endpoint langsung:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Budi Santoso","email":"budi@email.com","password":"password123","role":"member"}'
```
