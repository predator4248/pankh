# PANKH Club - Event Registration & Real-Time Check-In System

A modern, high-performance web-based Event Pass Registration and Reverse QR Check-In portal built for college club events using **HTML5, Vanilla CSS (Light Theme), Vanilla JavaScript (ES Modules), and Google Firebase (Firestore)**.

---

## 🌟 Key Features

1. **Student Registration Portal**:
   - Clean, light-themed form validating USN, Student Name, Academic Year (1-4), and Branch.
   - Real-time client-side regex formatting and validation for college USN format.
   - Generation of random alphanumeric entry codes (`EVT-XXXX`).
   - Instant dynamic QR code generation using `qrcode.js`.
   - Official downloadable Event Pass with screenshot reminder for attendees.

2. **Volunteer Check-In Scanner Page (Mobile-Optimized Reverse QR Scanning)**:
   - High-performance live camera scanner powered by `html5-qrcode` with custom reticle and laser guide.
   - **Access Granted Screen**: Flashes a large **GREEN** modal on first scan (`entry_count == 0`), increments `entry_count` to 1, displays student details, and plays a chime sound.
   - **Warning Duplicate Entry Screen**: Flashes a large **RED** modal when `entry_count >= 1`, increments `entry_count`, warns the gate volunteer, and sounds an alarm buzzer.
   - Fallback manual code input for attendees with cracked screens or low battery.

3. **Admin Dashboard & Live Segregation**:
   - Real-time Firestore synchronization (`onSnapshot`) updating counters and table instantly.
   - **Year-Based Table Row Color Coding** (strictly adhering to design specs):
     - **1st Year**: `#E3F2FD` (Light Blue)
     - **2nd Year**: `#E8F5E9` (Light Green)
     - **3rd Year**: `#FFF3E0` (Light Orange)
     - **4th Year**: `#FFEBEE` (Light Red)
   - Live Counter Cards: Total Registrations, Active Check-Ins, Pending Arrivals, and Duplicate Entry Alerts.
   - Year segregation filter chips, status filters, and live search.
   - **Real-Time Duplicate Alarm System**: Web Audio API siren alert and top notification banner when an attendee attempts duplicate gate entry.
   - CSV Export & 1-Click Sample Data Seeder.

---

## 🗄️ 1. Firebase Firestore Database Structure

### Collection: `event_registrations`

Each document in `event_registrations` contains:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `usn` | `String` | University Seat Number (e.g. `"1MS21CS045"`) |
| `name` | `String` | Student's full name (e.g. `"Aarav Sharma"`) |
| `year` | `Number` | Academic Year: `1`, `2`, `3`, or `4` |
| `branch` | `String` | Branch or department (e.g. `"Computer Science (CSE)"`) |
| `unique_code` | `String` | Auto-generated alphanumeric event code (e.g. `"EVT-8X2P"`) |
| `entry_count` | `Number` | Number of gate entries (defaults to `0`) |
| `created_at` | `Timestamp` | Registration timestamp (`serverTimestamp()`) |
| `last_scanned_at` | `Timestamp` | Last time ticket was scanned at the gate |
| `last_status` | `String` | `"pending"`, `"granted"`, or `"duplicate"` |

---

## 🚀 2. Firebase Setup & Initialization Guide

Follow these steps to link your Firebase Firestore project:

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it (e.g., `pankh-event-system`).
3. Click **Continue** (Google Analytics is optional).

### Step 2: Register a Web App
1. On your project overview page, click the Web icon (`</>`).
2. Enter an app nickname (e.g., `Pankh Web App`).
3. Click **Register app**.
4. You will see your `firebaseConfig` object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "pankh-event-system.firebaseapp.com",
     projectId: "pankh-event-system",
     storageBucket: "pankh-event-system.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```

### Step 3: Create Firestore Database
1. In the Firebase Console left menu, navigate to **Build > Firestore Database**.
2. Click **Create database**.
3. Choose a location closest to your users.
4. Select **Start in test mode** for development (or configure production rules below).

### Step 4: Configure Firestore Security Rules
Go to the **Rules** tab in Firestore and apply the following rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /event_registrations/{document=**} {
      // Allow reading and writing for event registration and volunteer scanning
      allow read, write: if true;
    }
  }
}
```

### Step 5: Update `app.js`
Open `app.js` and paste your `firebaseConfig` object at the top:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_ACTUAL_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_ACTUAL_PROJECT_ID",
  storageBucket: "YOUR_ACTUAL_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
};
```

> **Note:** If `firebaseConfig` contains placeholder keys, the application automatically activates **Offline Demo Mode** using local storage and simulated real-time synchronization so you can test all features immediately without any setup errors!

---

## 💻 3. Running Locally

Because ES Modules and Web Camera APIs require either `http://` or `https://` (not `file://`), run a local web server:

### Option A: Using Node.js (npx)
```bash
npx serve .
# or
npx http-server -p 8080
```

### Option B: Using Python 3
```bash
python -m http.server 8000
```

Open your browser at `http://localhost:8000`.

---

## 📱 4. Testing Reverse QR Scanning & Duplicate Entry Alerts

1. **Student Registration**:
   - Go to the **Student Registration** tab (`#register`).
   - Enter a USN (e.g., `1MS21CS045`), Name, Year (e.g., `3rd Year`), and Branch.
   - Click **Register & Generate Pass**.
   - Your QR code and unique code (e.g. `EVT-8X2P`) will appear on the pass.

2. **First Check-In (Access Granted)**:
   - Go to the **Volunteer Scanner** tab (`#scanner`).
   - Either point a mobile device camera at the generated QR code, or paste the code into the **manual check-in box** below the video.
   - A full-screen **GREEN "ACCESS GRANTED"** modal pops up with student information and a pleasant success chime.
   - `entry_count` is updated from `0` to `1`.

3. **Duplicate Entry Attempt (Security Warning)**:
   - Scan or enter the same code a second time.
   - A full-screen **RED "WARNING: DUPLICATE ENTRY"** modal appears displaying the attempt count (`Attempt #2`).
   - An audible alarm buzzer plays.
   - On the **Admin Dashboard** tab, a real-time warning banner flashes alerting the organizers that this USN has attempted duplicate entry!
