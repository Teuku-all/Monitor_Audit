# Audit Monitor

Audit Monitor is a bilingual (Indonesian and English) workspace for audit teams. Admins review submissions, discuss comments with members, assign work targets, and track progress. Members register an account, update assigned work, and submit documents for review.

## Run locally

Requirements: Node.js 20+ and npm.

1. Copy `backend/.env.example` to `backend/.env` and set a long, random `JWT_SECRET`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` if you want to choose the initial administrator credentials.
2. In `backend/`, run `npm install` and then `npm run dev`.
3. Copy `frontend/.env.example` to `frontend/.env` if needed. Set `VITE_API_URL=http://localhost:3001/api` and `VITE_UPLOADS_URL=http://localhost:3001/uploads`.
4. In `frontend/`, run `npm install` and `npm run dev`, then open `http://localhost:5173`.

The SQLite database is created at `backend/src/config/database.db` by default. Existing accounts and submissions are retained when the additive target migration runs. Uploaded files are stored under `backend/uploads/` by default.

For a fresh local database in development, the default administrator is `admin@audit.com` with password `admin123`. Change these credentials before deploying. In production, set both `ADMIN_EMAIL` and `ADMIN_PASSWORD`; the development password is not seeded in production.

Members can register from the sign-in page. Admin accounts are provisioned through the backend environment and should not be created through public registration.

## Work target lifecycle

Admins assign a target to one registered member with instructions, priority, and a due date. The assigned member updates progress and notes; at 100%, the target is submitted for review. Admins can complete it or request a revision with feedback. Members can attach audit documents to a target and see linked submissions and discussion.

## API overview

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a member account |
| POST | `/api/auth/login` | Public | Sign in and receive a JWT |
| GET | `/api/auth/profile` | Signed in | Verify current account |
| GET | `/api/users` | Admin | List members and workload counts |
| GET/POST | `/api/targets` | Signed in / Admin for POST | List targets / assign a target |
| GET | `/api/targets/:id` | Admin or assigned member | View a target and its documents |
| PATCH | `/api/targets/:id/progress` | Assigned member | Update work progress and notes |
| PATCH | `/api/targets/:id/review` | Admin | Complete a target or request a revision |
| GET | `/api/submissions` | Admin | List submitted documents |
| GET | `/api/submissions/mine` | Member | List own documents |
| POST | `/api/submissions` | Member | Upload a document, optionally linked to a target |
| GET | `/api/submissions/:id` | Admin or document owner | View document and discussion |
| PATCH | `/api/submissions/:id/status` | Admin | Update document review status |
| POST | `/api/comments/:submission_id` | Admin | Comment on a document |
| POST | `/api/comments/:submission_id/:comment_id/replies` | Document owner | Reply to an admin comment |

## Stack

- Frontend: React 18, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: SQLite (`better-sqlite3`)
- Authentication: JWT
- Document uploads: Multer

## Checks

- Frontend production build: `cd frontend && npm run build`
- Backend integration tests: `cd backend && npm test`
