# 🌐 Making PANKH Live 24/7 (Free Cloud Hosting Guide)

To keep the **PANKH Club Event Registration & Check-In Portal** online **24/7/365** (so anyone can access it from their phone or laptop without you needing to run your computer), you can deploy it to free global cloud hosting.

Because PANKH is a modern web application (Vanilla HTML5 + CSS3 + ES Modules) with Firebase Firestore as its cloud database, it requires **zero server maintenance** and costs **$0/month** to host 24/7 with 99.99% uptime.

---

## ⚡ Option 1: Netlify Drop (Fastest — Live in 10 Seconds, No Git Needed)

If you want the site live right now without setting up Git accounts or running CLI commands:

1. Open your browser and go to **[app.netlify.com/drop](https://app.netlify.com/drop)**.
2. Drag and drop the `pankh` project folder directly into the browser window.
3. Your site is deployed immediately with an HTTPS URL like `https://pankh-club.netlify.app`.
4. It is live **24/7** immediately with free SSL!

---

## ⚡ Option 2: Vercel (Recommended — Automatic Updates via GitHub)

Vercel provides edge delivery, instant caching, and custom domain support. This project includes a pre-configured [`vercel.json`](./vercel.json) that automatically configures mobile camera permissions (`Permissions-Policy: camera=*`) for the Volunteer QR scanner.

### Step 1: Ensure your repo is on GitHub
1. Go to [github.com/new](https://github.com/new) and create a new repository named `pankh`.
2. Push your code:
   ```powershell
   git remote set-url origin https://github.com/YOUR_USERNAME/pankh.git
   git push -u origin main
   ```

### Step 2: Connect to Vercel
1. Go to **[vercel.com/new](https://vercel.com/new)**.
2. Sign in with GitHub.
3. Select the `pankh` repository and click **Import**.
4. Leave all settings default (Preset: *Other*, Root Directory: `./`).
5. Click **Deploy**.
6. Your site is live 24/7 at `https://pankh.vercel.app`! Every future `git push` automatically redeploys.

---

## ⚡ Option 3: GitHub Pages (100% Free inside GitHub)

This repository now contains a pre-built GitHub Actions workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

1. Push your repository to GitHub.
2. In your GitHub repository:
   - Click **Settings** (top tab).
   - In the left sidebar, click **Pages**.
   - Under **Build and deployment** -> **Source**, select **GitHub Actions**.
3. GitHub will automatically trigger the deployment workflow.
4. Your site will be online 24/7 at:
   `https://<YOUR_GITHUB_USERNAME>.github.io/pankh/`

---

## 💾 Setting up 24/7 Cloud Database (Firebase Firestore)

For student registrations and check-ins to synchronize across all attendees and volunteer phones 24/7:

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create a free project (e.g. `pankh-club-events`).
3. Click **Add App** -> **Web (`</>`)**.
4. Enable **Cloud Firestore** in "Test Mode" (or set your security rules).
5. Open [`app.js`](./app.js) and replace lines 34–41 with your project's `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "pankh-club-events.firebaseapp.com",
     projectId: "pankh-club-events",
     storageBucket: "pankh-club-events.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
6. Commit and push:
   ```powershell
   git add app.js
   git commit -m "Add production Firebase credentials"
   git push
   ```
*(If Firebase credentials are not provided, the app will run in demo/offline mode using browser LocalStorage).*
