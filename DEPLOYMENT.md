# 🚀 Deploying PANKH to Vercel (Free 24/7 Cloud Hosting)

This guide walks you through deploying the **PANKH Club Event Registration & Check-In Portal** to **Vercel** with automatic HTTPS and instant global CDN delivery.

---

## ⚡ Option 1: 1-Click GitHub Import (Recommended)

Because your code is already pushed to GitHub at [github.com/predator4248/pankh](https://github.com/predator4248/pankh), this is the fastest and easiest method:

1. Go to **[vercel.com/new](https://vercel.com/new)**.
2. Sign in with your GitHub account.
3. Under **Import Git Repository**, find `pankh` and click **Import**.
4. Configure the project:
   - **Framework Preset**: *Other*
   - **Root Directory**: `./` (leave default)
   - **Build & Development Settings**: Leave empty / defaults (this is a static front-end web app)
5. Click **Deploy**.
6. In ~15–30 seconds, your site is live with a public URL like:
   `https://pankh.vercel.app` (or `https://pankh-predator4248.vercel.app`)

> **✨ Automatic CI/CD**: Every time you run `git push origin main`, Vercel will automatically trigger a new deployment and update your live site!

---

## 💻 Option 2: Deploy directly via Terminal (Vercel CLI)

If you prefer to deploy from your command line:

1. Run:
   ```powershell
   pnpm dlx vercel
   ```
2. Follow the interactive prompts:
   - **Set up and deploy?**: `Y`
   - **Which scope?**: Select your account
   - **Link to existing project?**: `N`
   - **What's your project's name?**: `pankh`
   - **In which directory is your code located?**: `./`
3. To deploy directly to production:
   ```powershell
   pnpm dlx vercel --prod
   ```

---

## ⚙️ Configuration Details (`vercel.json`)

The repository includes a pre-configured [`vercel.json`](./vercel.json):

```json
{
  "version": 2,
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=*"
        }
      ]
    }
  ]
}
```

### Why this is important:
- **`cleanUrls: true`**: Cleans up URLs for a professional look.
- **`Permissions-Policy: camera=*`**: Ensures modern mobile browsers allow full access to the device camera for the **Volunteer QR Scanner** (`html5-qrcode`) over HTTPS without permission blocks.
- **Security Headers**: Adds XSS protection, anti-clickjacking frameguard, and MIME sniffing protection.

---

## 🔑 Firebase Configuration Reminder

Once deployed on Vercel:
1. If you haven't yet connected your live Firebase project, open `app.js` and paste your `firebaseConfig` keys into line 14:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_ACTUAL_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```
2. In the [Firebase Console](https://console.firebase.google.com/):
   - Go to **Authentication** > **Settings** > **Authorized Domains** (if auth is enabled).
   - Add your Vercel domain (e.g. `pankh.vercel.app`).
   - In Firestore, ensure your read/write rules allow event operations.
3. Commit and push:
   ```bash
   git add app.js
   git commit -m "Configure Firebase credentials"
   git push origin main
   ```
   Vercel will instantly redeploy with your live database!
