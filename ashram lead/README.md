# 🔒 Ashram Lead Field Verification UI System (Tirvona)

A complete, standalone **Ashram Lead Field Verification UI System** designed for field agents who physically visit ashrams and collect onboarding data.

> ⚠️ **STRICT ISOLATION GUARANTEE**:
> All files reside exclusively inside the `ashram lead/` directory. Zero files in `/frontend`, `/Newbackend`, or root directories have been modified. No APIs or external databases are connected.

---

## 🧱 Folder Structure

```
ashram lead/
 ├── index.html
 ├── package.json
 ├── vite.config.js
 ├── README.md
 └── src/
     ├── components/
     │   ├── Navbar.jsx
     │   ├── LocationPicker.jsx
     │   ├── ImageUploader.jsx
     │   ├── LeadCard.jsx
     │   ├── ApprovedAshramCard.jsx
     │   └── Toast.jsx
     ├── pages/
     │   ├── CreateLeadPage.jsx
     │   ├── ViewLeadsPage.jsx
     │   └── ApprovedAshramsPage.jsx
     ├── hooks/
     │   └── useAshramLeads.js
     ├── utils/
     │   ├── storage.js
     │   └── formatters.js
     ├── App.jsx
     ├── main.jsx
     └── styles.css
```

---

## 🎯 Features Implemented

1. **📍 Location Capture**:
   - Geolocation API integration with high accuracy (`navigator.geolocation.getCurrentPosition`).
   - Captures `latitude` and `longitude` with live status indicator and Google Maps preview link.

2. **⏰ Auto Date & Time**:
   - Auto-captures current timestamp on field lead creation (Read-only UI).

3. **🏠 Ashram Details Form**:
   - Fields: Ashram Name, Address, City, State, Owner Name, Contact Number.

4. **📝 Discussion Notes**:
   - Textarea for recording meeting notes and special onboarding requirements.

5. **🤝 Owner Interest Selection**:
   - Options: `Interested`, `Not Interested`, `Follow-up Required`.

6. **👨‍💼 Meeting Request Toggle**:
   - Conditional inputs when owner requests a follow-up meeting with Tirvona team:
     - Preferred Date & Time (`meetingTime`)
     - Meeting Mode (`Call` / `In-person`)

7. **📸 Image Upload & Preview**:
   - Multiple image file upload using Base64 data conversion for offline capability.
   - Live thumbnail gallery with remove button.

8. **📤 LocalStorage Submit (`ashram_leads`)**:
   - Saves lead document with `status: "pending"` into `localStorage` key `ashram_leads`.

9. **📊 Leads Dashboard Page**:
   - Card UI showing Ashram Name, City & State, Owner & Contact, Captured Date, Interest badge, Meeting request, Discussion notes, attached photos, and GPS Map link.
   - Filter by status (`All`, `Pending`, `Approved`) and search by name/city.

10. **🧑‍💼 Admin Simulation ("Approve" Action)**:
    - Click "Approve & Convert to Ashram" on any pending lead card to convert `status` → `"approved"`.

11. **🔁 Approved Ashram Simulation (`approved_ashrams`)**:
    - Converts approved leads into standard Tirvona Ashram MongoDB GeoJSON point documents (`[lng, lat]`) and persists them under `localStorage` key `"approved_ashrams"`.

---

## 🧾 Future-Ready Data Structure

```json
{
  "id": "lead-1723120000001",
  "name": "Parmarth Niketan Ashram",
  "location": {
    "address": "Main Road, Swargashram",
    "city": "Rishikesh",
    "state": "Uttarakhand",
    "coordinates": {
      "lat": 30.1205,
      "lng": 78.3135
    }
  },
  "contact": {
    "phone": "+91 98765 43210",
    "ownerName": "Swami Chidanand Saraswati"
  },
  "notes": "Visited ashram during evening Ganga Aarti...",
  "interest": "Interested",
  "meeting": {
    "requested": true,
    "time": "2026-08-12T11:00",
    "mode": "In-person"
  },
  "images": [],
  "status": "pending",
  "createdAt": "2026-08-08T09:30:00.000Z"
}
```

---

## 🚀 Running the App

```bash
# Navigate to ashram lead directory
cd "ashram lead"

# Option A: Install dependencies and run dev server
npm install
npm run dev

# Option B: Or open index.html directly in browser
```
