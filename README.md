# Sahaya Setu (సహాయ సేతు)
## Smart Civic Response & Infrastructure Management Platform

Sahaya Setu is a comprehensive, production-grade **Citizen-to-Department Field Response Platform** built on the **MERN Stack** (MongoDB, Express.js, React.js, Node.js) with real-time **Socket.IO** WebSocket events, **Leaflet** OpenStreetMap geospatial coordination, and **Recharts** municipal analytics.

The system bridges citizens, municipal departments, operations administrators, and field response workforces across two primary operational modes:
1. **Normal Civic Mode:** Everyday public infrastructure issues (fallen electricity poles, power line damage, water pipeline leaks, road craters/potholes, garbage accumulation, streetlight outages, drainage clogs, fallen trees).
2. **Disaster Response Mode:** Extreme weather incidents (cyclones, flash floods, storm surges, collapsing walls) with life-threat severity prioritization, emergency zone overlays, safety advisories, and infrastructure restoration tracking.

---

## 🚀 Key Modules & Architecture

### 1. User Roles & Role-Based Access Control (RBAC)
- **Citizen:** Submits complaints with multi-photo uploads, auto-captured GPS coordinates + draggable Leaflet map pin, landmark details, pre-submission duplicate detection, real-time tracking, before-vs-after repair inspection, and two-way resolution verification (rate & close or reject & reopen).
- **Department Administrator:** Manages department queues, monitors interactive incident maps, rule-based employee auto-assignment scoring, employee workload tracking, SLA escalation management, and department re-routing.
- **Field Employee:** Mobile-optimized responsive interface, task acceptance/rejection with reasons, turn-by-turn external GPS navigation (Google Maps), workflow status progression (`Travelling` → `Arrived` → `Repair in Progress`), after-repair proof photo capture, and unable-to-complete escalation.
- **Super Administrator:** District-wide command center, disaster mode activation/deactivation, cross-department incident queues, municipal analytics, employee leaderboards, and department directory management.

### 2. End-to-End Field Response Workflow
```
[Citizen Submits Report]
        │
        ▼ (Auto GPS + Reverse Geocoding + Photo Evidence)
[Intelligent Department Routing] ──► (Simulated to Electricity / Water / Roads / Sanitation / Horticulture / Drainage)
        │
        ▼ (Real-time Socket.IO Alert)
[Department Admin Dashboard] ──► (Rule-Based Workforce Recommendation & Assignment)
        │
        ▼ (Push Notification to Field Worker)
[Field Employee Terminal] ──► [Accepts Task] ──► [GPS Navigation] ──► [Travelling] ──► [Arrived] ──► [In Progress]
        │
        ▼ (Uploads After-Repair Photograph Proof & Notes)
[Repair Marked Resolved]
        │
        ▼ (Notification Sent to Citizen)
[Two-Way Citizen Verification]
   ├── [Citizen Approves] ──► Rates 1-5 Stars & Complaint Officially Closed
   └── [Citizen Rejects]   ──► Reopened & Immediately Escalated to Department Administrator
```

---

## 🔑 Quick-Start Demo Credentials

A one-click demo switcher is built directly into the application header. You can also sign in with any of the pre-seeded accounts:

| Role | Email | Password | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Citizen** | `citizen@sahayasetu.gov.in` | `password123` | Submit issues, track tickets, inspect before/after proof, verify fixes |
| **Electricity Dept Admin** | `elec.admin@sahayasetu.gov.in` | `password123` | Power grid dispatch, assign linesmen, monitor map markers |
| **Water Dept Admin** | `water.admin@sahayasetu.gov.in` | `password123` | Pipeline leakage dispatch, manage plumbers |
| **Roads & Infra Admin** | `roads.admin@sahayasetu.gov.in` | `password123` | Pothole/road crater crews, heavy machinery coordination |
| **Field Worker (Electricity)** | `elec.field@sahayasetu.gov.in` | `password123` | Mobile field task execution, GPS navigation, proof photos |
| **Field Worker (Plumber)** | `water.field@sahayasetu.gov.in` | `password123` | Pipeline repair workflow, arrive on-site, complete tasks |
| **Field Worker (Road Crew)** | `roads.field@sahayasetu.gov.in` | `password123` | Asphalt patching and debris clearance |
| **Super Admin / Collector** | `admin@sahayasetu.gov.in` | `password123` | Full district control, activate disaster mode, analytics |

---

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js 5, MongoDB, Mongoose 9, JWT Authentication, bcryptjs, Socket.IO, Multer, Sharp.
- **Frontend:** React 19, Vite 8, React Router 7, Leaflet / OpenStreetMap, Recharts, Lucide Icons, Socket.IO Client.
- **Storage:** Cloudinary support with automatic local storage fallback (`uploads/reports/`, `uploads/resolutions/`).
- **Geocoding:** Reverse geocoding via OpenStreetMap Nominatim with local offline CSV dataset fallback.

---

## 💻 Installation & Setup

### Prerequisites
- **Node.js**: v18+ (tested on Node v22)
- **MongoDB**: MongoDB 6+ running locally on default port `27017` (`mongodb://127.0.0.1:27017/sahaya_setu`) or MongoDB Atlas connection string.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (optional, sane defaults are pre-configured):
```bash
cp .env.example .env
```

### 3. Seed Demo Data
Populate departments, demo accounts across all 4 roles, active disaster event, evidence photos, and realistic complaints:
```bash
npm run seed
```

### 4. Build React Frontend
Compile the production Vite bundle:
```bash
npm run build
```

### 5. Start Application Server
```bash
npm start
```
The application will run on **http://localhost:8000** with hot WebSocket events enabled.

---

## 🧪 Comprehensive Automated Test Suite

Run the full automated test suite (33 tests covering legacy disaster endpoints and upgraded smart civic response workflows):
```bash
npm test
```

Test breakdown:
- `tests/mern.test.js`: 26 integration tests verifying duplicate detection, photo integrity, SMS triggers, SLA escalations, and geocoding.
- `tests/smart_civic.test.js`: 7 end-to-end tests verifying JWT auth & RBAC, smart complaint routing, pre-submission duplicate detection, rule-based workforce assignment, field task execution with photo proof, citizen verification/reopen flow, and disaster mode declaration.
