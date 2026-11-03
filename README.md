# 🕉️ Tirvona
### Sacred Ashram Booking & Management Platform

**Tirvona** is a state-of-the-art, government-compliant digital accommodation booking and counter management platform designed for holy stays and spiritual retreats across the Indian subcontinent (e.g., Rishikesh, Haridwar, Vrindavan, Varanasi). It eliminates manual paper counter logs to provide safe, verified, and transparent accommodation for pilgrims, managed under the Digital India guidelines in partnership with the Ministry of Tourism & IT Division, Government of India.

---

## 📂 Project Structure

Each app has its own `package.json`; there is no workspace at the root. Folder names are kept as
they are because the production deploy (VPS paths, pm2, the server's `.env`) depends on them.

| Folder | What it is | Deployed |
|---|---|---|
| [`Newbackend/`](Newbackend/README.md) | The only backend: NestJS API (port 5000, prefix `/api`) and Socket.IO, on Supabase Postgres | VPS (api.tirvona.com) |
| [`frontend/`](frontend/README.md) | Main React web app: public website and every dashboard (Super Admin, HR / Executive, owners, staff) | VPS (www.tirvona.com) |
| [`SmarID/`](SmarID/README.md) | Smart Contact page (public QR identity card), built into `frontend` as `/smart-contact.html` | With `frontend` |
| [`leadTirvona/`](leadTirvona/README.md) | "Ashram Lead" app for field agents; backend: the `lead-collection` module | Not by this repo's workflows |
| `shared/` | CSS/TS shared by the UIs: tables, forms, status badges, typography, responsive rules, dashboard navbar | With `frontend` |
| `deploy/nginx/` | nginx config installed on the VPS by every deploy | With every deploy |
| `.github/workflows/` | `ci.yml` (checks on every push and PR), `deploy.yml` (deploys `main` to the VPS) | — |
| [`docs/`](docs/README.md) | Design notes, audits and runbooks: day-stay, database cleanup, SEO, WhatsApp | — |

Inside the backend, each business area is one folder in `Newbackend/src/modules/` (ashrams,
bookings, temples, food, providers = pandits, hr, lead-collection, seo, …). Database migrations are
in `Newbackend/database/migrations/`.

---

## 🛠️ Technology Stack

### Frontend
*   **Core**: React 19, TypeScript, Vite
*   **Styling**: TailwindCSS v4, Custom CSS-variable variables (Deep Navy `#0B192C` & Elegant Gold `#D4AF37`)
*   **Transitions**: Framer Motion
*   **State & Queries**: TanStack React Query, Axios, React Hook Form
*   **Routing**: React Router DOM (v7)

### Backend
*   **Core**: Node.js, NestJS, TypeScript
*   **Real-time Update**: Socket.io (live booking lifecycle events to customer & owner)
*   **Database**: Supabase PostgreSQL (see `Newbackend/README.md`)
*   **Authentication**: JWT (JSON Web Tokens), bcryptjs
*   **Payments**: Razorpay (order create + server-side signature verification; demo fallback when keys absent)
*   **File Uploads**: Multer + Cloudinary (`POST /api/uploads`; returns secure URLs)

---

## 👥 Portals & Features

1.  **Pilgrim Portal (Customer)**:
    *   Dynamic stay search with advanced filtering (city, date, capacity, AC/Non-AC).
    *   Custom spiritual services booking (Meals, Prasad, Parking, Lockers, direct donations).
    *   Generates a unique 6-digit **Check-In Code** for cardless paper desk check-in.
2.  **Ashram Owner Portal (Trustee)**:
    *   Property Registration Wizard (Trust deed, fire safety certificate, land ownership uploads).
    *   Dynamic inventory management calendar and dynamic peak-season pricing overrides (e.g. Kumbh Mela multiplier).
3.  **On-Site Staff Portal**:
    *   **Reception desk**: Verify 6-digit pilgrim codes and check them in/out.
    *   **Housekeeping desk**: Real-time room clean/dirty/maintenance status tracking.
4.  **Government Official Portal**:
    *   Inspection verification queue for District Officers.
    *   State/National statistics, trust audit log tracking, and property suspension controls.

---

## 🚀 Installation & Local Setup

### Prerequisites
*   Node.js (v18+)
*   NPM (v9+)
*   Supabase project (PostgreSQL 17)

### 1. Clone the repository
```bash
git clone https://github.com/monktribein/tirvona.git
cd tirvona
```

### 2. Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd Newbackend
    ```
2.  Install dependencies:
    ```bash
    npm ci
    ```
3.  Configure environment variables. Copy `Newbackend/.env.example` to `Newbackend/.env` and fill in real values:
    ```env
    PORT=5000
    NODE_ENV=development
    SUPABASE_DB_URL="your_supabase_session_pooler_url"   # Supabase → Connect → Session pooler (port 5432)
    SUPABASE_POOL_MAX=10
    REDIS_URL="your_redis_connection_string"
    JWT_SECRET="a_long_random_secret"   # generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
    JWT_EXPIRES_IN="30d"
    CLIENT_URL="http://localhost:5173"
    CORS_ORIGINS="http://localhost:5173" # comma-separated allowed origins
    ```
    > **Security:** The server refuses to boot in production if `SUPABASE_DB_URL` or `JWT_SECRET` are missing, and never falls back to a hardcoded secret. Use a dedicated least-privilege DB user and rotate any credential that has ever been shared or committed.
4.  Start the development server:
    ```bash
    npm run start:dev
    ```

### 3. Frontend Setup
1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm ci
    ```
3.  Start the dev server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:5173](http://localhost:5173) in your browser.
