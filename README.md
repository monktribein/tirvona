# 🕉️ Tirvona (Ashray Bharat)
### Sacred Ashram Booking & Management Platform

**Tirvona** is a state-of-the-art, government-compliant digital accommodation booking and counter management platform designed for holy stays and spiritual retreats across the Indian subcontinent (e.g., Rishikesh, Haridwar, Vrindavan, Varanasi). It eliminates manual paper counter logs to provide safe, verified, and transparent accommodation for pilgrims, managed under the Digital India guidelines in partnership with the Ministry of Tourism & IT Division, Government of India.

---

## 📂 Project Structure

The project is structured as a monorepo containing two main modules:
*   **`/backend`**: Express REST API & Socket.io server integrated with MongoDB Atlas using Mongoose.
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
*   **Core**: Node.js, Express, ES Modules
*   **Real-time Update**: Socket.io
*   **Database**: MongoDB Atlas via Mongoose
*   **Authentication**: JWT (JSON Web Tokens), bcryptjs
*   **Utilities**: Multer, Cloudinary

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
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure environment variables by creating a `.env` file:
    ```env
    PORT=5000
    MONGODB_URI="your_mongodb_atlas_connection_string"
    JWT_SECRET="your_jwt_secret_key"
    ```
4.  Seed the database with default demo data:
    ```bash
    node src/scripts/seed.js
    ```
5.  Start the development server:
    ```bash
    npm run dev
    ```

### 3. Frontend Setup
1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the dev server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📋 Default Seeding Credentials
All accounts are configured with the password `admin123` by default:

| Role | Email | Description |
|---|---|---|
| **Pilgrim / Customer** | `pilgrim@tirvona.com` | Guest booking portal testing. |
| **Ashram Owner** | `owner@tirvona.com` | Ashram Trust management dashboard. |
| **District Officer** | `officer@tirvona.com` | Local magistrate inspection & verification. |
| **Super Admin** | `admin@tirvona.com` | Global platform configuration and audit logs. |
| **Ashram Manager** | `manager@tirvona.com` | On-site operations manager. |
| **Front Desk Reception**| `reception@tirvona.com`| Receptionist room allocator. |
| **Housekeeping Head** | `housekeeping@tirvona.com`| Rooms status board. |
