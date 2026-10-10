/**
 * ============================================================================
 * PANKH CLUB - EVENT REGISTRATION & CHECK-IN SYSTEM
 * Full-Stack JavaScript Application with Firebase Firestore Integration
 * ============================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ==========================================================================
   1. FIREBASE CONFIGURATION & INITIALIZATION
   ==========================================================================
   Replace the placeholder values below with your Firebase Project credentials.
   To obtain these:
   1. Go to https://console.firebase.google.com/
   2. Create a Project -> Add Web App (`</>`)
   3. Enable Cloud Firestore in "Test Mode" or configure Rules
   4. Copy the firebaseConfig object into here.
   ========================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBTjGfIAXYAy46YUHw5EeYCM21AIHdlIVA",
  authDomain: "pankh-3f788.firebaseapp.com",
  projectId: "pankh-3f788",
  storageBucket: "pankh-3f788.firebasestorage.app",
  messagingSenderId: "36776778055",
  appId: "1:36776778055:web:5f28473229cec43b725462",
  measurementId: "G-457Q88DRNH"
};

// Check if credentials are placeholders
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY" && 
                     firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let db = null;
let isDemoMode = !isConfigured;

/* ==========================================================================
   2. ADMIN ACCESS CONTROL CONFIGURATION (METHOD B)
   You can change your secret admin password right here at any time!
   ========================================================================== */
export const ADMIN_SECRET_PASSWORD = "pankh@admin2026";
export const ADMIN_PASSWORD_HASH = "c90c7f41f158f08b3e3244a7425d382df1e148e862f9451ccf7311ed155c213f";
const ADMIN_AUTH_SESSION_KEY = "pankh_admin_authenticated";

async function computeSha256Hex(str) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

async function verifyAdminPassword(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return false;
  if (trimmed === ADMIN_SECRET_PASSWORD) return true;
  const hash = await computeSha256Hex(trimmed);
  return hash === ADMIN_PASSWORD_HASH;
}

function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_AUTH_SESSION_KEY) === "true";
}

function setAdminAuthenticated(status) {
  if (status) {
    sessionStorage.setItem(ADMIN_AUTH_SESSION_KEY, "true");
  } else {
    sessionStorage.removeItem(ADMIN_AUTH_SESSION_KEY);
  }
}

/* ==========================================================================
   3. AUDIO SYNTHESIZER (WEB AUDIO API)
   Generates real-time sound effects without external audio file dependencies.
   ========================================================================== */
let audioCtx = null;
let isAudioMuted = false;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Play pleasant two-tone chime for Access Granted
function playSuccessChime() {
  if (isAudioMuted) return;
  try {
    initAudioContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    // E5 then B5
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.setValueAtTime(987.77, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  } catch (err) {
    console.warn("Audio chime prevented:", err);
  }
}

// Play urgent warble alarm for Duplicate Entry Alert
function playDuplicateAlarm() {
  if (isAudioMuted) return;
  try {
    initAudioContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();

    osc1.type = "sawtooth";
    // Beep 1
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(440, now + 0.15);
    osc1.frequency.setValueAtTime(880, now + 0.3);
    osc1.frequency.setValueAtTime(440, now + 0.45);

    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.65);
  } catch (err) {
    console.warn("Duplicate alarm prevented:", err);
  }
}

/* ==========================================================================
   3. HYBRID BACKEND STORE (FIRESTORE + OFFLINE DEMO FALLBACK)
   Enables zero-friction testing when Firebase keys are not yet configured,
   and seamlessly utilizes Firestore when real keys are provided!
   ========================================================================== */
const LOCAL_STORAGE_KEY = "pankh_event_registrations";
const demoListeners = [];

function getLocalRegistrations() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveLocalRegistrations(list) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  demoListeners.forEach(cb => cb(list));
}

// Unified Database Service
const DataService = {
  async addRegistration(docData) {
    if (!isDemoMode && db) {
      const docRef = await addDoc(collection(db, "event_registrations"), {
        ...docData,
        created_at: serverTimestamp()
      });
      return docRef.id;
    } else {
      const list = getLocalRegistrations();
      const newDoc = {
        id: "local_" + Math.random().toString(36).substr(2, 9),
        ...docData,
        created_at: new Date().toISOString()
      };
      list.push(newDoc);
      saveLocalRegistrations(list);
      return newDoc.id;
    }
  },

  async findByUniqueCode(code) {
    const normalized = (code || "").trim().toUpperCase();
    if (!isDemoMode && db) {
      const q = query(collection(db, "event_registrations"), where("unique_code", "==", normalized));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docItem = snap.docs[0];
      return { id: docItem.id, ...docItem.data() };
    } else {
      const list = getLocalRegistrations();
      return list.find(item => item.unique_code.toUpperCase() === normalized) || null;
    }
  },

  async findByUSN(usn) {
    const normalized = (usn || "").trim().toUpperCase();
    if (!isDemoMode && db) {
      const q = query(collection(db, "event_registrations"), where("usn", "==", normalized));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docItem = snap.docs[0];
      return { id: docItem.id, ...docItem.data() };
    } else {
      const list = getLocalRegistrations();
      return list.find(item => item.usn.toUpperCase() === normalized) || null;
    }
  },

  async recordCheckIn(docId, currentCount) {
    const newCount = (currentCount || 0) + 1;
    const isDuplicate = newCount > 1;

    if (!isDemoMode && db) {
      const targetRef = doc(db, "event_registrations", docId);
      await updateDoc(targetRef, {
        entry_count: increment(1),
        last_scanned_at: serverTimestamp(),
        last_status: isDuplicate ? "duplicate" : "granted"
      });
    } else {
      const list = getLocalRegistrations();
      const index = list.findIndex(item => item.id === docId);
      if (index !== -1) {
        list[index].entry_count = newCount;
        list[index].last_scanned_at = new Date().toISOString();
        list[index].last_status = isDuplicate ? "duplicate" : "granted";
        saveLocalRegistrations(list);
      }
    }
    return newCount;
  },

  async resetEntryCount(docId) {
    if (!isDemoMode && db) {
      const targetRef = doc(db, "event_registrations", docId);
      await updateDoc(targetRef, {
        entry_count: 0,
        last_status: "pending"
      });
    } else {
      const list = getLocalRegistrations();
      const index = list.findIndex(item => item.id === docId);
      if (index !== -1) {
        list[index].entry_count = 0;
        list[index].last_status = "pending";
        saveLocalRegistrations(list);
      }
    }
  },

  async deleteRecord(docId) {
    if (!isDemoMode && db) {
      await deleteDoc(doc(db, "event_registrations", docId));
    } else {
      const list = getLocalRegistrations().filter(item => item.id !== docId);
      saveLocalRegistrations(list);
    }
  },

  listenRegistrations(callback) {
    if (!isDemoMode && db) {
      return onSnapshot(collection(db, "event_registrations"), (snapshot) => {
        const records = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(records, snapshot.docChanges());
      }, (err) => {
        console.error("Firestore live listener error:", err);
      });
    } else {
      demoListeners.push(callback);
      // Immediate initial fire
      callback(getLocalRegistrations(), []);
      return () => {
        const i = demoListeners.indexOf(callback);
        if (i !== -1) demoListeners.splice(i, 1);
      };
    }
  }
};

/* ==========================================================================
   4. APPLICATION STATE & HELPERS
   ========================================================================== */
let allRegistrations = [];
let currentFilterYear = "all";
let currentFilterStatus = "all";
let currentSearchTerm = "";
let html5QrScanner = null;
let isScannerRunning = false;
let resumeTimerInterval = null;
let lastKnownDuplicateIds = new Set();

// Generate Random Alphanumeric Event Code (e.g. EVT-8X2P)
function generateUniqueCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude confusing 0/O, 1/I
  let code = "EVT-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// USN Validation Regex: standard college format (e.g., 1MS21CS045) or general uppercase 8-12 alphanumeric
const USN_REGEX = /^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}$/i;
const FLEXIBLE_USN_REGEX = /^[0-9A-Z]{6,12}$/i;

function validateUSN(usn) {
  const trimmed = (usn || "").trim();
  return USN_REGEX.test(trimmed) || FLEXIBLE_USN_REGEX.test(trimmed);
}

// Format Year label
function formatYearName(year) {
  const y = Number(year);
  switch (y) {
    case 1: return "1st Year";
    case 2: return "2nd Year";
    case 3: return "3rd Year";
    case 4: return "4th Year";
    default: return `${year}th Year`;
  }
}

/* ==========================================================================
   5. INITIALIZATION & ROUTING
   ========================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  setupConnectionStatus();
  setupNavigation();
  setupRegistrationForm();
  setupScannerView();
  setupAdminDashboard();
  setupAdminAuth();
  listenToDatabase();

  // Listen to audio unlocks on initial click
  document.addEventListener("click", initAudioContext, { once: true });
});

function setupConnectionStatus() {
  const pill = document.getElementById("connection-status-pill");
  const label = document.getElementById("status-label");

  if (!isConfigured) {
    isDemoMode = true;
    pill.classList.remove("connected");
    pill.classList.add("warning");
    label.textContent = "Offline Demo Mode (Ready)";
    label.title = "Using local storage fallback. Enter your Firebase API keys in app.js to connect to Cloud Firestore.";
    console.info("Firebase keys are placeholders. Operating in local real-time mode.");
  } else {
    try {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      isDemoMode = false;
      pill.classList.add("connected");
      label.textContent = "Firestore Live";
      console.log("Firebase initialized successfully with Cloud Firestore.");
    } catch (err) {
      console.error("Firebase init failed:", err);
      isDemoMode = true;
      pill.classList.add("error");
      label.textContent = "Offline Fallback";
    }
  }
}

// Update Admin View Visibility based on Session Auth State
function updateAdminAuthStateUI() {
  const lockScreen = document.getElementById("admin-lock-screen");
  const authContent = document.getElementById("admin-authenticated-content");
  const passInput = document.getElementById("admin-pass-input");
  const errorText = document.getElementById("admin-pass-error");

  if (!lockScreen || !authContent) return;

  if (isAdminAuthenticated()) {
    lockScreen.style.display = "none";
    authContent.style.display = "block";
    updateDashboardCounters();
    renderRegistrationsTable();
  } else {
    lockScreen.style.display = "flex";
    authContent.style.display = "none";
    if (passInput) {
      passInput.value = "";
      setTimeout(() => passInput.focus(), 80);
    }
    if (errorText) {
      errorText.style.display = "none";
      errorText.textContent = "";
    }
  }
}

// Navigation Tab Switcher with Hash Sync
function setupNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  const views = document.querySelectorAll(".app-view");

  function switchTab(targetId) {
    tabs.forEach(tab => {
      const isTarget = tab.getAttribute("data-target") === targetId;
      tab.classList.toggle("active", isTarget);
      tab.setAttribute("aria-selected", isTarget ? "true" : "false");
    });

    views.forEach(view => {
      view.classList.toggle("active", view.id === targetId);
    });

    // Admin view auth state handling
    if (targetId === "view-admin") {
      updateAdminAuthStateUI();
    }

    // Camera auto-handling
    if (targetId === "view-scanner") {
      // Don't auto-start camera until user permits or clicks start, but prepare cameras
      prepareCameraList();
    } else {
      if (isScannerRunning) {
        stopScanner();
      }
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-target");
      const hash = targetId.replace("view-", "");
      window.location.hash = hash;
      switchTab(targetId);
    });
  });

  // Handle URL hash & clean path changes (#register, #scanner, #admin or /scanner, /admin)
  function handleRoute() {
    const hash = (window.location.hash || "").replace("#", "").toLowerCase();
    const path = (window.location.pathname || "").replace(/^\//, "").toLowerCase();
    const route = hash || path;

    if (route.includes("scanner")) {
      switchTab("view-scanner");
    } else if (route.includes("admin")) {
      switchTab("view-admin");
    } else {
      switchTab("view-register");
    }
  }

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("popstate", handleRoute);
  handleRoute();
}

/* ==========================================================================
   6. SECTION 2: STUDENT REGISTRATION LOGIC
   ========================================================================== */
function setupRegistrationForm() {
  const form = document.getElementById("student-registration-form");
  const usnInput = document.getElementById("reg-usn");
  const nameInput = document.getElementById("reg-name");
  const yearSelect = document.getElementById("reg-year");
  const branchSelect = document.getElementById("reg-branch");
  const submitBtn = document.getElementById("btn-submit-registration");
  const formCard = document.getElementById("registration-form-card");
  const ticketCard = document.getElementById("registration-ticket-card");
  const btnRegisterAnother = document.getElementById("btn-register-another");
  const btnCopyCode = document.getElementById("btn-copy-code");
  const btnDownloadPass = document.getElementById("btn-download-pass");

  // Force uppercase for USN input
  usnInput.addEventListener("input", () => {
    usnInput.value = usnInput.value.toUpperCase().replace(/\s/g, "");
    validateField(usnInput, validateUSN(usnInput.value), "error-usn");
  });

  nameInput.addEventListener("input", () => {
    validateField(nameInput, nameInput.value.trim().length >= 2, "error-name");
  });

  yearSelect.addEventListener("change", () => {
    validateField(yearSelect, !!yearSelect.value, "error-year");
  });

  branchSelect.addEventListener("change", () => {
    validateField(branchSelect, !!branchSelect.value, "error-branch");
  });

  function validateField(elem, isValid, errorId) {
    const group = elem.closest(".form-group");
    const errorElem = document.getElementById(errorId);
    if (!isValid) {
      group.classList.add("has-error");
      elem.classList.add("invalid");
    } else {
      group.classList.remove("has-error");
      elem.classList.remove("invalid");
    }
    return isValid;
  }

  // Handle Form Submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    initAudioContext();

    const usn = usnInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();
    const year = parseInt(yearSelect.value, 10);
    const branch = branchSelect.value;

    const isUsnValid = validateField(usnInput, validateUSN(usn), "error-usn");
    const isNameValid = validateField(nameInput, name.length >= 2, "error-name");
    const isYearValid = validateField(yearSelect, !isNaN(year) && year >= 1 && year <= 4, "error-year");
    const isBranchValid = validateField(branchSelect, !!branch, "error-branch");

    if (!isUsnValid || !isNameValid || !isYearValid || !isBranchValid) {
      return;
    }

    // Toggle button loading state
    submitBtn.disabled = true;
    submitBtn.querySelector(".btn-text").textContent = "Registering...";
    submitBtn.querySelector(".btn-spinner").style.display = "inline-block";

    try {
      // Check if student already registered
      const existing = await DataService.findByUSN(usn);
      if (existing) {
        const confirmReuse = confirm(
          `USN ${usn} is already registered as "${existing.name}".\n\nWould you like to view the existing event pass?`
        );
        if (confirmReuse) {
          renderGeneratedTicket(existing);
          formCard.style.display = "none";
          ticketCard.style.display = "block";
        }
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-text").textContent = "Register & Generate Pass";
        submitBtn.querySelector(".btn-spinner").style.display = "none";
        return;
      }

      // 1. Generate unique alphanumeric code
      const uniqueCode = generateUniqueCode();

      // 2. Prepare Firestore document data as strictly specified
      const registrationData = {
        usn: usn,
        name: name,
        year: year,
        branch: branch,
        unique_code: uniqueCode,
        entry_count: 0
      };

      // Save to Database
      await DataService.addRegistration(registrationData);

      // 3. Render and display pass with QR code
      renderGeneratedTicket(registrationData);
      formCard.style.display = "none";
      ticketCard.style.display = "block";
      ticketCard.scrollIntoView({ behavior: "smooth" });

      // Reset form fields
      form.reset();

    } catch (err) {
      console.error("Registration error:", err);
      alert("Failed to submit registration. Error: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector(".btn-text").textContent = "Register & Generate Pass";
      submitBtn.querySelector(".btn-spinner").style.display = "none";
    }
  });

  // Render QR Code and pass details
  function renderGeneratedTicket(data) {
    document.getElementById("ticket-unique-code").textContent = data.unique_code;
    document.getElementById("ticket-student-name").textContent = data.name;
    document.getElementById("ticket-student-usn").textContent = data.usn;
    document.getElementById("ticket-student-year").textContent = formatYearName(data.year);
    document.getElementById("ticket-student-branch").textContent = data.branch;

    // Render QR Code using QRCode library
    const qrContainer = document.getElementById("qrcode-canvas-container");
    qrContainer.innerHTML = ""; // Clear previous QR

    new QRCode(qrContainer, {
      text: data.unique_code,
      width: 190,
      height: 190,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  // Copy unique code button
  btnCopyCode.addEventListener("click", () => {
    const code = document.getElementById("ticket-unique-code").textContent;
    navigator.clipboard.writeText(code).then(() => {
      btnCopyCode.innerHTML = "✓";
      setTimeout(() => {
        btnCopyCode.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      }, 1500);
    });
  });

  // Download pass as image
  btnDownloadPass.addEventListener("click", () => {
    const qrImg = document.querySelector("#qrcode-canvas-container img");
    if (qrImg && qrImg.src) {
      const a = document.createElement("a");
      a.href = qrImg.src;
      a.download = `PANKH-PASS-${document.getElementById("ticket-student-usn").textContent}.png`;
      a.click();
    } else {
      window.print();
    }
  });

  // Register another student button
  btnRegisterAnother.addEventListener("click", () => {
    ticketCard.style.display = "none";
    formCard.style.display = "block";
    formCard.scrollIntoView({ behavior: "smooth" });
  });
}

/* ==========================================================================
   7. SECTION 4: VOLUNTEER CHECK-IN SCANNER LOGIC
   ========================================================================== */
function setupScannerView() {
  const toggleBtn = document.getElementById("btn-toggle-camera");
  const toggleText = document.getElementById("btn-toggle-camera-text");
  const cameraSelect = document.getElementById("camera-selection");
  const manualForm = document.getElementById("form-manual-checkin");
  const manualInput = document.getElementById("manual-code-input");
  const overlay = document.getElementById("scan-result-overlay");

  const modalGranted = document.getElementById("result-granted");
  const modalDuplicate = document.getElementById("result-duplicate");
  const modalInvalid = document.getElementById("result-invalid");

  const btnNextGranted = document.getElementById("btn-next-scan-granted");
  const btnNextDuplicate = document.getElementById("btn-next-scan-duplicate");
  const btnNextInvalid = document.getElementById("btn-next-scan-invalid");

  // Camera Toggle
  toggleBtn.addEventListener("click", async () => {
    initAudioContext();
    if (isScannerRunning) {
      await stopScanner();
      toggleText.textContent = "Start Camera";
    } else {
      const cameraId = cameraSelect.value;
      await startScanner(cameraId);
      toggleText.textContent = "Stop Camera";
    }
  });

  // Camera Selection Change
  cameraSelect.addEventListener("change", async () => {
    if (isScannerRunning) {
      await stopScanner();
      await startScanner(cameraSelect.value);
    }
  });

  // Resume scanning buttons
  btnNextGranted.addEventListener("click", dismissResultModal);
  btnNextDuplicate.addEventListener("click", dismissResultModal);
  btnNextInvalid.addEventListener("click", dismissResultModal);

  function dismissResultModal() {
    if (resumeTimerInterval) {
      clearInterval(resumeTimerInterval);
      resumeTimerInterval = null;
    }
    overlay.style.display = "none";
    modalGranted.style.display = "none";
    modalDuplicate.style.display = "none";
    modalInvalid.style.display = "none";
  }

  // Manual Check-in Submission
  manualForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    initAudioContext();
    const code = manualInput.value.trim().toUpperCase();
    if (!code) return;
    await processScannedCode(code);
    manualInput.value = "";
  });
}

async function prepareCameraList() {
  const cameraSelect = document.getElementById("camera-selection");
  try {
    const devices = await Html5Qrcode.getCameras();
    cameraSelect.innerHTML = "";

    if (devices && devices.length > 0) {
      devices.forEach((device, index) => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent = device.label || `Camera ${index + 1}`;
        // Prefer back camera by default
        if (/back|environment/i.test(device.label)) {
          option.selected = true;
        }
        cameraSelect.appendChild(option);
      });
    } else {
      cameraSelect.innerHTML = `<option value="">No cameras detected</option>`;
    }
  } catch (err) {
    console.warn("Unable to enumerate cameras:", err);
    cameraSelect.innerHTML = `<option value="">Camera access restricted</option>`;
  }
}

async function startScanner(cameraId) {
  const toggleText = document.getElementById("btn-toggle-camera-text");
  try {
    if (!html5QrScanner) {
      html5QrScanner = new Html5Qrcode("qr-reader");
    }

    const config = {
      fps: 10,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1.0
    };

    const targetCamera = cameraId ? cameraId : { facingMode: "environment" };

    await html5QrScanner.start(
      targetCamera,
      config,
      onScanSuccess,
      onScanFailure
    );

    isScannerRunning = true;
    toggleText.textContent = "Stop Camera";
  } catch (err) {
    console.error("Camera start error:", err);
    alert("Camera permission denied or camera not accessible: " + err.message);
    isScannerRunning = false;
    toggleText.textContent = "Start Camera";
  }
}

async function stopScanner() {
  const toggleText = document.getElementById("btn-toggle-camera-text");
  if (html5QrScanner && isScannerRunning) {
    try {
      await html5QrScanner.stop();
    } catch (err) {
      console.warn("Camera stop error:", err);
    }
  }
  isScannerRunning = false;
  toggleText.textContent = "Start Camera";
}

let isProcessingScan = false;

function onScanSuccess(decodedText) {
  if (isProcessingScan) return;
  // If result overlay is already visible, ignore
  const overlay = document.getElementById("scan-result-overlay");
  if (overlay && overlay.style.display !== "none") return;

  processScannedCode(decodedText);
}

function onScanFailure(error) {
  // Silent frame miss
}

// Core Verification Workflow
async function processScannedCode(rawCode) {
  isProcessingScan = true;
  initAudioContext();

  const code = (rawCode || "").trim().toUpperCase();
  const overlay = document.getElementById("scan-result-overlay");
  const modalGranted = document.getElementById("result-granted");
  const modalDuplicate = document.getElementById("result-duplicate");
  const modalInvalid = document.getElementById("result-invalid");

  try {
    // 1. Query Database for unique_code
    const registration = await DataService.findByUniqueCode(code);

    overlay.style.display = "flex";
    modalGranted.style.display = "none";
    modalDuplicate.style.display = "none";
    modalInvalid.style.display = "none";

    if (!registration) {
      // 2. Unrecognized Code
      document.getElementById("invalid-code-scanned").textContent = code;
      modalInvalid.style.display = "block";
      addRecentScanLog(code, "Unknown", false, 0);
      return;
    }

    const currentCount = Number(registration.entry_count || 0);

    if (currentCount === 0) {
      // 3. FIRST TIME ENTRY: ACCESS GRANTED
      await DataService.recordCheckIn(registration.id, currentCount);

      // Play pleasant success chime
      playSuccessChime();

      // Populate Granted Screen
      document.getElementById("granted-name").textContent = registration.name;
      document.getElementById("granted-usn").textContent = registration.usn;
      document.getElementById("granted-year").textContent = formatYearName(registration.year);
      document.getElementById("granted-branch").textContent = registration.branch;

      modalGranted.style.display = "block";
      addRecentScanLog(registration.usn, registration.name, true, 1);

      // 3-second auto-resume timer
      let timeLeft = 3;
      const timerSpan = document.getElementById("granted-timer");
      timerSpan.textContent = timeLeft;

      if (resumeTimerInterval) clearInterval(resumeTimerInterval);
      resumeTimerInterval = setInterval(() => {
        timeLeft -= 1;
        if (timerSpan) timerSpan.textContent = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(resumeTimerInterval);
          resumeTimerInterval = null;
          overlay.style.display = "none";
          modalGranted.style.display = "none";
        }
      }, 1000);

    } else {
      // 4. DUPLICATE ENTRY: FLASH LARGE RED WARNING SCREEN
      const newCount = await DataService.recordCheckIn(registration.id, currentCount);

      // Play urgent duplicate siren
      playDuplicateAlarm();

      // Populate Duplicate Screen
      document.getElementById("duplicate-name").textContent = registration.name;
      document.getElementById("duplicate-usn").textContent = registration.usn;
      document.getElementById("duplicate-count").textContent = newCount;
      document.getElementById("dup-attempt-count-badge").textContent = `Attempt #${newCount} Detected!`;

      modalDuplicate.style.display = "block";
      addRecentScanLog(registration.usn, registration.name, false, newCount);

      // Also trigger duplicate alert banner for admin viewers
      triggerAdminDuplicateAlert(registration, newCount);
    }

  } catch (err) {
    console.error("Check-in error:", err);
    alert("Error processing check-in: " + err.message);
  } finally {
    setTimeout(() => {
      isProcessingScan = false;
    }, 1200);
  }
}

// Volunteer Recent Activity Feed
function addRecentScanLog(identifier, name, isSuccess, count) {
  const container = document.getElementById("recent-scans-container");
  const countChip = document.getElementById("scan-count-chip");

  const emptyState = container.querySelector(".empty-recent-state");
  if (emptyState) emptyState.remove();

  const item = document.createElement("div");
  item.className = `recent-scan-chip ${isSuccess ? "is-granted" : "is-duplicate"}`;

  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  item.innerHTML = `
    <div>
      <strong>${identifier}</strong> &bull; ${name}
      <div style="font-size: 0.72rem; color: #64748b;">${timeStr}</div>
    </div>
    <div>
      <span class="status-pill ${isSuccess ? "status-admitted" : "status-duplicate"}">
        ${isSuccess ? "Granted (1st)" : `Duplicate #${count}`}
      </span>
    </div>
  `;

  container.prepend(item);

  const totalScans = container.querySelectorAll(".recent-scan-chip").length;
  countChip.textContent = `${totalScans} scanned`;
}

/* ==========================================================================
   8. SECTION 3: ADMIN DASHBOARD & REAL-TIME ALERTS
   ========================================================================== */
function setupAdminDashboard() {
  const searchInput = document.getElementById("admin-search-input");
  const yearChips = document.querySelectorAll(".chip-filter");
  const statusFilter = document.getElementById("admin-status-filter");
  const btnExport = document.getElementById("btn-export-csv");
  const btnSeed = document.getElementById("btn-seed-sample");
  const btnSilenceAudio = document.getElementById("btn-silence-audio");
  const btnDismissAlert = document.getElementById("btn-dismiss-alert");
  const modalPass = document.getElementById("admin-pass-modal");
  const btnClosePass = document.getElementById("btn-close-pass-modal");

  // Search filter
  searchInput.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value.trim().toLowerCase();
    renderRegistrationsTable();
  });

  // Year filter chips
  yearChips.forEach(chip => {
    chip.addEventListener("click", () => {
      yearChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilterYear = chip.getAttribute("data-year");
      renderRegistrationsTable();
    });
  });

  // Status select filter
  statusFilter.addEventListener("change", (e) => {
    currentFilterStatus = e.target.value;
    renderRegistrationsTable();
  });

  // Export to CSV
  btnExport.addEventListener("click", exportTableToCSV);

  // Quick Sample Data Generator
  btnSeed.addEventListener("click", seedSampleData);

  // Silence alert audio button
  btnSilenceAudio.addEventListener("click", () => {
    isAudioMuted = !isAudioMuted;
    btnSilenceAudio.textContent = isAudioMuted ? "Unmute Audio" : "Mute Audio";
  });

  // Dismiss alert banner
  btnDismissAlert.addEventListener("click", () => {
    document.getElementById("global-duplicate-banner").style.display = "none";
  });

  // Close inspection modal
  btnClosePass.addEventListener("click", () => {
    modalPass.style.display = "none";
  });
  modalPass.addEventListener("click", (e) => {
    if (e.target === modalPass) modalPass.style.display = "none";
  });
}

// Admin Authentication Controller (Method B)
function setupAdminAuth() {
  const formAuth = document.getElementById("form-admin-auth");
  const passInput = document.getElementById("admin-pass-input");
  const btnToggle = document.getElementById("btn-toggle-admin-pass");
  const errorText = document.getElementById("admin-pass-error");
  const lockCard = document.querySelector(".admin-lock-card");
  const btnLock = document.getElementById("btn-admin-lock");
  const btnLogin = document.getElementById("btn-admin-login");

  // Show/Hide password toggle
  if (btnToggle && passInput) {
    btnToggle.addEventListener("click", () => {
      const isPassword = passInput.type === "password";
      passInput.type = isPassword ? "text" : "password";
      const iconEye = btnToggle.querySelector(".icon-eye");
      const iconEyeOff = btnToggle.querySelector(".icon-eye-off");
      if (iconEye && iconEyeOff) {
        iconEye.style.display = isPassword ? "none" : "block";
        iconEyeOff.style.display = isPassword ? "block" : "none";
      }
    });
  }

  // Handle Login submission
  if (formAuth) {
    formAuth.addEventListener("submit", async (e) => {
      e.preventDefault();
      initAudioContext();

      const inputVal = (passInput.value || "").trim();
      if (!inputVal) {
        showAuthError("Please enter the administrator passcode.");
        return;
      }

      btnLogin.disabled = true;

      const isValid = await verifyAdminPassword(inputVal);

      if (isValid) {
        setAdminAuthenticated(true);
        updateAdminAuthStateUI();
        btnLogin.disabled = false;
      } else {
        btnLogin.disabled = false;
        showAuthError("Incorrect password. Access denied.");
        if (lockCard) {
          lockCard.classList.remove("lock-shake");
          void lockCard.offsetWidth; // Trigger reflow
          lockCard.classList.add("lock-shake");
        }
        passInput.select();
      }
    });
  }

  function showAuthError(msg) {
    if (errorText) {
      errorText.textContent = msg;
      errorText.style.display = "block";
    }
  }

  // Handle Lock / Logout Button
  if (btnLock) {
    btnLock.addEventListener("click", () => {
      setAdminAuthenticated(false);
      updateAdminAuthStateUI();
    });
  }
}

// Real-Time Listener to Firestore `event_registrations`
function listenToDatabase() {
  DataService.listenRegistrations((records, docChanges) => {
    allRegistrations = records;
    updateDashboardCounters();
    renderRegistrationsTable();

    // Check for incoming duplicate events from other devices in real-time!
    checkForDuplicateAlerts(records, docChanges);
  });
}

// Duplicate Detection & Organizer Audio/Visual Alerts
function checkForDuplicateAlerts(records, docChanges) {
  records.forEach(student => {
    const count = Number(student.entry_count || 0);
    if (count > 1) {
      const isNewAttempt = !lastKnownDuplicateIds.has(`${student.id}_${count}`);
      if (isNewAttempt) {
        lastKnownDuplicateIds.add(`${student.id}_${count}`);
        triggerAdminDuplicateAlert(student, count);
      }
    }
  });
}

function triggerAdminDuplicateAlert(student, count) {
  // 1. Play real-time audio alert siren
  playDuplicateAlarm();

  // 2. Display visual warning banner
  const banner = document.getElementById("global-duplicate-banner");
  const message = document.getElementById("duplicate-banner-message");
  message.innerHTML = `Student <strong>${student.name}</strong> (USN: <code>${student.usn}</code>, Year: ${student.year}) has attempted gate entry <strong>${count} times</strong>!`;
  banner.style.display = "flex";

  // 3. Highlight navigation badge
  const badge = document.getElementById("nav-duplicate-badge");
  const dupCount = allRegistrations.filter(r => (r.entry_count || 0) > 1).length;
  badge.textContent = dupCount > 0 ? dupCount : "!";
  badge.style.display = "inline-block";
}

// Live Counter Cards
function updateDashboardCounters() {
  const total = allRegistrations.length;
  const checkedIn = allRegistrations.filter(r => (r.entry_count || 0) >= 1).length;
  const pending = allRegistrations.filter(r => (r.entry_count || 0) === 0).length;
  const duplicates = allRegistrations.filter(r => (r.entry_count || 0) > 1).length;

  document.getElementById("stat-total-reg").textContent = total;
  document.getElementById("stat-total-checked").textContent = checkedIn;
  document.getElementById("stat-total-pending").textContent = pending;
  document.getElementById("stat-total-duplicates").textContent = duplicates;

  // Year breakdown counts on filter chips
  for (let y = 1; y <= 4; y++) {
    const yCount = allRegistrations.filter(r => Number(r.year) === y).length;
    const elem = document.getElementById(`count-year-${y}`);
    if (elem) elem.textContent = yCount;
  }
}

// Render Table with REQUIRED CSS Color Coding
function renderRegistrationsTable() {
  const tbody = document.getElementById("registrations-tbody");
  const countDisplay = document.getElementById("table-record-count");

  // Filter list
  let filtered = allRegistrations.filter(student => {
    // Year filter
    if (currentFilterYear !== "all" && Number(student.year) !== Number(currentFilterYear)) {
      return false;
    }

    // Status filter
    const count = Number(student.entry_count || 0);
    if (currentFilterStatus === "checked-in" && count === 0) return false;
    if (currentFilterStatus === "pending" && count > 0) return false;
    if (currentFilterStatus === "duplicates" && count <= 1) return false;

    // Search query
    if (currentSearchTerm) {
      const matchUSN = (student.usn || "").toLowerCase().includes(currentSearchTerm);
      const matchName = (student.name || "").toLowerCase().includes(currentSearchTerm);
      const matchCode = (student.unique_code || "").toLowerCase().includes(currentSearchTerm);
      const matchBranch = (student.branch || "").toLowerCase().includes(currentSearchTerm);
      if (!matchUSN && !matchName && !matchCode && !matchBranch) {
        return false;
      }
    }

    return true;
  });

  // Sort by Year ascending, then Name
  filtered.sort((a, b) => {
    if (a.year !== b.year) return Number(a.year) - Number(b.year);
    return (a.name || "").localeCompare(b.name || "");
  });

  countDisplay.textContent = `Showing ${filtered.length} of ${allRegistrations.length} registrations`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: #64748b;">
          No registration records found matching the current filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";

  filtered.forEach((student, index) => {
    const tr = document.createElement("tr");

    // REQUIRED COLOR-CODED ROW CLASS BASED ON YEAR:
    // 1st Year: #E3F2FD, 2nd Year: #E8F5E9, 3rd Year: #FFF3E0, 4th Year: #FFEBEE
    const yearNum = Number(student.year);
    tr.className = `row-year-${yearNum}`;

    const entryCount = Number(student.entry_count || 0);

    // Status Badge
    let statusBadgeHtml = "";
    if (entryCount === 0) {
      statusBadgeHtml = `<span class="status-pill status-pending">Not Arrived (0)</span>`;
    } else if (entryCount === 1) {
      statusBadgeHtml = `<span class="status-pill status-admitted">Admitted (1)</span>`;
    } else {
      statusBadgeHtml = `<span class="status-pill status-duplicate">⚠️ Duplicate (${entryCount}x)</span>`;
    }

    tr.innerHTML = `
      <td><strong>${index + 1}</strong></td>
      <td class="font-mono" style="font-weight: 700;">${student.usn}</td>
      <td><strong>${student.name}</strong></td>
      <td>
        <span class="badge-year badge-year-${yearNum}">
          ${formatYearName(yearNum)}
        </span>
      </td>
      <td>${student.branch}</td>
      <td><span class="font-mono" style="font-weight: 600; color: #4f46e5;">${student.unique_code}</span></td>
      <td><strong>${entryCount}</strong></td>
      <td>${statusBadgeHtml}</td>
      <td>
        <div class="table-actions">
          <button class="btn-table-icon" title="View Pass QR" data-action="view-qr" data-id="${student.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button class="btn-table-icon" title="Reset Entry Count to 0" data-action="reset" data-id="${student.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
          </button>
          <button class="btn-table-icon btn-del" title="Delete Registration" data-action="delete" data-id="${student.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </td>
    `;

    // Row Action Handlers
    tr.querySelector('[data-action="view-qr"]').addEventListener("click", () => openAdminPassModal(student));
    tr.querySelector('[data-action="reset"]').addEventListener("click", async () => {
      if (confirm(`Reset entry count for ${student.name} (${student.usn}) to 0?`)) {
        await DataService.resetEntryCount(student.id);
      }
    });
    tr.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (confirm(`Are you sure you want to delete registration for ${student.name} (${student.usn})?`)) {
        await DataService.deleteRecord(student.id);
      }
    });

    tbody.appendChild(tr);
  });
}

// Open Pass Modal in Admin
function openAdminPassModal(student) {
  const modal = document.getElementById("admin-pass-modal");
  const body = document.getElementById("admin-pass-modal-body");

  body.innerHTML = `
    <div style="text-align: center;">
      <div id="admin-modal-qr" style="display: flex; justify-content: center; margin-bottom: 1rem;"></div>
      <h4 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.25rem;">${student.name}</h4>
      <p style="font-family: var(--font-mono); font-weight: 700; color: #4f46e5; margin-bottom: 0.5rem;">${student.unique_code}</p>
      <div style="font-size: 0.88rem; color: #475569; margin-bottom: 1rem;">
        USN: <strong>${student.usn}</strong> &bull; ${formatYearName(student.year)} &bull; ${student.branch}
      </div>
      <div style="background: #f8fafc; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem;">
        Current Entry Count: <strong>${student.entry_count || 0}</strong>
      </div>
    </div>
  `;

  new QRCode(document.getElementById("admin-modal-qr"), {
    text: student.unique_code,
    width: 180,
    height: 180,
    colorDark: "#0f172a",
    colorLight: "#ffffff"
  });

  modal.style.display = "flex";
}

// Export Table to CSV
function exportTableToCSV() {
  if (allRegistrations.length === 0) {
    alert("No records to export.");
    return;
  }

  const headers = ["USN", "Name", "Year", "Branch", "Unique_Code", "Entry_Count", "Last_Status"];
  const rows = allRegistrations.map(r => [
    `"${r.usn}"`,
    `"${r.name}"`,
    r.year,
    `"${r.branch}"`,
    `"${r.unique_code}"`,
    r.entry_count || 0,
    `"${r.last_status || 'pending'}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `event_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Seed Sample Students (1 student per academic year to preview all 4 row colors!)
async function seedSampleData() {
  const samples = [
    { usn: "1MS24CS101", name: "Aarav Sharma", year: 1, branch: "Computer Science (CSE)", unique_code: "EVT-1A9F", entry_count: 0 },
    { usn: "1MS23EC042", name: "Priya Nair", year: 2, branch: "Electronics & Comm (ECE)", unique_code: "EVT-2B8E", entry_count: 1 },
    { usn: "1MS22IS088", name: "Rahul Verma", year: 3, branch: "Information Science (ISE)", unique_code: "EVT-3C7D", entry_count: 0 },
    { usn: "1MS21ME015", name: "Sneha Kulkarni", year: 4, branch: "Mechanical Engg (ME)", unique_code: "EVT-4D6C", entry_count: 2 }
  ];

  for (const sample of samples) {
    await DataService.addRegistration(sample);
  }
}
