# Audit Monitor

Audit Monitor is a bilingual (Indonesian and English) workspace for audit teams. Admins review submissions, discuss comments with members, assign work targets, and track progress. Members can register, sign in with Google, update assigned work, and submit documents for review.

## Run locally

Requirements: Node.js 20+ and npm.

1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`.
2. Create a Neon project and set its PostgreSQL connection string as `DATABASE_URL` in `backend/.env`.
3. Create a Google OAuth 2.0 Web client ID. Add the local frontend origin (`http://localhost:5173`) to its authorized JavaScript origins. Set the same client ID in `backend/.env` (`GOOGLE_CLIENT_ID`) and `frontend/.env` (`VITE_GOOGLE_CLIENT_ID`).
4. Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `backend/.env`.
5. Set a long, random `JWT_SECRET` and set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the initial administrator.
6. In `backend/`, run `npm install` and then `npm run dev`.
7. Set `VITE_API_URL=http://localhost:3001/api`, then run `npm install` and `npm run dev` in `frontend/`.
8. Open `http://localhost:5173`.

The backend creates or updates the required tables in Neon at startup. Existing SQLite data is not automatically migrated; migrate existing accounts and submissions before switching a deployment to Neon. New document uploads are stored in Cloudinary, and their secure URLs are stored in Neon.

Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` before deploying. The development-only default password is not seeded in production. Admin accounts are provisioned through the backend environment and should not be created through public registration. A Google account that matches an existing verified email is linked to that account; new Google sign-ins receive the member role.

## Deploy to Vercel

The repository is configured as one Vercel project: Vercel builds the Vite frontend and routes `/api/*` to the Express serverless function in `api/index.js`.

1. Import this repository into Vercel and leave the project root directory set to the repository root. The included `vercel.json` configures install, build, output, API routing, and SPA fallback.
2. Add these backend environment variables in Vercel for each environment you deploy:
   - `DATABASE_URL` (Neon connection string)
   - `JWT_SECRET` (long, randomly generated secret)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`
   - `GOOGLE_CLIENT_ID`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
3. Add `VITE_GOOGLE_CLIENT_ID` with the same Google Web client ID. Set `VITE_API_URL=/api` if you want to explicitly configure the same-origin API URL; this is also the production default.
4. In Google Cloud OAuth settings, add the production Vercel domain (and any custom domain) to **Authorized JavaScript origins**. The Vercel domain is allowed by the API automatically. If you use a custom domain, add its origin to `CORS_ORIGINS` as well (comma-separated if there are multiple).
5. Deploy. The first API request initializes the Neon schema and provisions the configured administrator.

Vercel serverless functions have a smaller request-body limit than a persistent Express server. Large multipart document uploads may be rejected by the platform even though the local backend accepts files up to 10 MB.

## Work target lifecycle

Admins assign an audit objective to one registered member with instructions, reviewer, start and due dates, priority, and expected evidence. Target details track overall progress plus data collection, analysis, and workpaper progress; members also record audit status, blockers, impact, follow-up, and evidence needs. At 100%, the target is submitted for review. Admins can complete it or request a revision with feedback. The dashboard summarizes audit progress and status distribution. Coaching records are linked to targets and track guidance, follow-up owners, deadlines, status, and next review. The audit guide includes the status and progress definitions from the workbook. Members can attach audit documents to a target and see linked submissions and discussion.

## API overview

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a member account |
| POST | `/api/auth/login` | Public | Sign in with email and password |
| POST | `/api/auth/google` | Public | Verify a Google ID token and sign in |
| GET | `/api/auth/profile` | Signed in | Verify current account |
| GET | `/api/users` | Admin | List members and workload counts |
| GET/POST | `/api/targets` | Signed in / Admin for POST | List targets / assign a target |
| GET | `/api/targets/:id` | Admin or assigned member | View a target and its documents |
| PATCH | `/api/targets/:id/progress` | Assigned member | Update work progress and notes |
| PATCH | `/api/targets/:id/review` | Admin | Complete a target or request a revision |
| GET/POST | `/api/coaching` | Signed in / Admin for POST | List coaching records / record a coaching session |
| PATCH | `/api/coaching/:id` | Assigned member | Update coaching follow-up status and notes |
| GET | `/api/submissions` | Admin | List submitted documents |
| GET | `/api/submissions/mine` | Member | List own documents |
| POST | `/api/submissions` | Member | Upload a document to Cloudinary, optionally linked to a target |
| GET | `/api/submissions/:id` | Admin or document owner | View document and discussion |
| PATCH | `/api/submissions/:id/status` | Admin | Update document review status |
| POST | `/api/comments/:submission_id` | Admin | Comment on a document |
| POST | `/api/comments/:submission_id/:comment_id/replies` | Document owner | Reply to an admin comment |

## Stack

- Frontend: React 18, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: Neon serverless PostgreSQL
- Authentication: JWT, Google OAuth 2.0 ID-token verification
- Document uploads: Multer memory storage and Cloudinary

## Checks

- Frontend production build: `cd frontend && npm run build`
- Backend integration tests: `cd backend && npm test`
