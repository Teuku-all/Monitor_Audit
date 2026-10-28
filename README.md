# SIGAP

SIGAP (Sistem Informasi Gerak Audit Progresif) is a bilingual (Indonesian and English) workspace for audit teams. Admins review submissions, discuss comments with members, assign work targets, and track progress. Members can register, sign in with Google, update assigned work, and submit documents for review.

## Run locally

Requirements: Node.js 20+ and npm.

1. Copy the root `.env.example` to a single root `.env`. Both frontend and backend read configuration from this file; keep `.env` private and do not commit it.
2. Create a Neon project and set its PostgreSQL connection string as `DATABASE_URL` in the root `.env`.
3. Create a Google OAuth 2.0 Web client ID. Add the local frontend origin (`http://localhost:5173`) to its authorized JavaScript origins. Set the same client ID in `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` in the root `.env`.
4. Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the root `.env`.
5. Set a random `JWT_SECRET` of at least 20 characters and set a password of at least 8 characters in `ADMIN_PASSWORD` for the initial administrator.
6. In `backend/`, run `npm install` and then `npm run dev`.
7. Keep `VITE_API_URL=/api` in the root `.env`. The Vite development proxy forwards `/api` to the local backend, and Vercel routes `/api` to the deployed backend. Then run `npm install` and `npm run dev` in `frontend/`.
8. Open `http://localhost:5173`.

The backend creates or updates the required tables in Neon at startup. Existing SQLite data is not automatically migrated; migrate existing accounts and submissions before switching a deployment to Neon. New document uploads are stored as authenticated Cloudinary assets and are downloaded only through an authorized API endpoint.

Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` before deploying. The development-only default password is not seeded in production. Admin accounts are provisioned through the backend environment and should not be created through public registration. Public registration is disabled in production unless `ALLOW_PUBLIC_REGISTRATION=true` and `VITE_ALLOW_REGISTRATION=true` are deliberately configured. Google login can access an existing matching account; creation of a new Google member follows the same registration setting.

## Deploy to Vercel

The repository is configured as one Vercel project: Vercel builds the Vite frontend and routes `/api/*` to the Express serverless function in `api/index.js`.

1. Import this repository into Vercel and leave the project root directory set to the repository root. The included `vercel.json` configures install, build, output, API routing, and SPA fallback.
2. Add these backend environment variables in Vercel for each environment you deploy (Vercel does not load the local root `.env` file):
   - `DATABASE_URL` (Neon connection string)
   - `JWT_SECRET` (random value of at least 20 characters)
   - `SESSION_HOURS` (optional, defaults to 4 and accepts 1–24)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 8 characters; at most 72 bytes)
   - `GOOGLE_CLIENT_ID`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
3. Add `VITE_GOOGLE_CLIENT_ID` with the same Google Web client ID. The production build always uses the same-origin `/api` endpoint.
   Keep `ALLOW_PUBLIC_REGISTRATION` and `VITE_ALLOW_REGISTRATION` disabled for an internal audit workspace.
4. In Google Cloud OAuth settings, add the production Vercel domain (and any custom domain) to **Authorized JavaScript origins**. The canonical production Vercel hostname is allowed by the API automatically. Add custom domains to `CORS_ORIGINS` (comma-separated if there are multiple). Preview deployments are not trusted by default; only add one explicitly if it is isolated from production data.
5. Deploy. The first API request initializes the Neon schema and provisions the configured administrator.

Vercel serverless functions have a smaller request-body limit than a persistent Express server. Large multipart document uploads may be rejected by the platform even though the local backend accepts files up to 10 MB.

## Work target lifecycle

Admins assign an audit objective to one registered member with instructions, reviewer, start and due dates, priority, and expected evidence. Target details track overall progress plus data collection, analysis, and workpaper progress; members also record audit status, blockers, impact, follow-up, and evidence needs. At 100%, the target is submitted for review. Admins can complete it or request a revision with feedback. The dashboard summarizes audit progress and status distribution. Coaching records are linked to targets and track guidance, follow-up owners, deadlines, status, and next review. The audit guide includes the status and progress definitions from the workbook. Members can attach audit documents to a target and see linked submissions and discussion.

The target form accepts a manually typed audit title and audit objective. Selecting an existing audit title from the suggestions links the objective to its program and fills its dates. Custom titles are saved independently and can be grouped into a program later. Startup automatically adds the optional `targets.audit_title` column to existing databases.

## API overview

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a member account |
| POST | `/api/auth/login` | Public | Sign in with email and password |
| POST | `/api/auth/google` | Public | Verify a Google ID token and sign in |
| POST | `/api/auth/logout` | Signed in | End the current session |
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
| GET | `/api/submissions/:id/file` | Admin or document owner | Download a protected document |
| PATCH | `/api/submissions/:id/status` | Admin | Update document review status |
| POST | `/api/comments/:submission_id` | Admin | Comment on a document |
| POST | `/api/comments/:submission_id/:comment_id/replies` | Document owner | Reply to an admin comment |

## Stack

- Frontend: React 18, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: Neon serverless PostgreSQL
- Authentication: short-lived JWT in an HttpOnly cookie, Google OAuth 2.0 ID-token verification
- Document uploads: content validation, Multer memory storage, and authenticated Cloudinary assets

## Security notes

- Web session tokens are not exposed to browser JavaScript. Unsafe cookie-authenticated API calls also require an allowed `Origin`.
- Login and registration attempts are rate limited. Production responses include anti-framing, MIME sniffing, referrer, permissions, HTTPS, and Content Security Policy headers.
- File names, sizes, extensions, and binary signatures are validated. Document metadata never exposes the Cloudinary URL; downloads are authorized by role and ownership.
- Files uploaded before authenticated Cloudinary storage was enabled may still have their old public Cloudinary URL. Re-upload or migrate those legacy assets in Cloudinary before treating them as private.

## Audit acceleration monitoring

- Admins can create an audit program with a 45-working-day default, then add audit titles and group work objectives and PICs under each title. The target date skips weekends; national holidays are not excluded, and admins can adjust dates.
- Each target supports overall progress, data/analysis/workpaper stages, auditee data requests with PIC and due/received/verified dates, escalation and direct-handover records, work-hour logs, and an update history.
- Schedule alerts show green when on schedule, yellow within three calendar days of the due date, and red after the due date while the audit remains incomplete. Targets with no progress update for more than seven days appear in weekly attention lists.
- Program KPIs calculate on-time completion by audit title against the 95% target and compare with an optional historical baseline. The quality indicator is first-pass approval on work objectives, using a reviewer checklist for procedures, evidence, and conclusions. It is a review-process proxy, not a substitute for substantive audit quality assessment. Baselines remain blank until historical data is supplied.

## Checks

- Frontend production build: `cd frontend && npm run build`
- Backend integration tests: `cd backend && npm test`
