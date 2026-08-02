# 🕉️ Tirvona (Ashray Bharat)
### Sacred Ashram Booking & Management Platform

**Tirvona** is a state-of-the-art, government-compliant digital accommodation booking and counter management platform designed for holy stays and spiritual retreats across the Indian subcontinent (e.g., Rishikesh, Haridwar, Vrindavan, Varanasi). It eliminates manual paper counter logs to provide safe, verified, and transparent accommodation for pilgrims, managed under the Digital India guidelines in partnership with the Ministry of Tourism & IT Division, Government of India.

---

## 📂 Project Structure

The project is structured as a monorepo containing two main modules:
*   **`/Newbackend`**: NestJS REST API and Socket.IO server integrated with MongoDB Atlas using Mongoose.
*   **`/frontend`**: React 19 SPA styled with TailwindCSS v4 and Framer Motion for smooth micro-animations.

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
*   **Database**: MongoDB Atlas via Mongoose
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
*   MongoDB Atlas Cluster

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
    MONGODB_URI="your_mongodb_atlas_connection_string"
    MONGODB_DB_NAME="tirvona"
    REDIS_URL="your_redis_connection_string"
    JWT_SECRET="a_long_random_secret"   # generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
    JWT_EXPIRES_IN="30d"
    CLIENT_URL="http://localhost:5173"
    CORS_ORIGINS="http://localhost:5173" # comma-separated allowed origins
    ```
    > **Security:** The server refuses to boot in production if `MONGODB_URI` or `JWT_SECRET` are missing, and never falls back to a hardcoded secret. Use a dedicated least-privilege DB user and rotate any credential that has ever been shared or committed.
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
