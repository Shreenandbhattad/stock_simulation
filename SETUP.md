# AWIFS Stock Simulation — Setup Guide

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `awifs-stock-sim`
3. Disable Google Analytics (not needed) → **Create project**

## Step 2: Enable Authentication

1. In Firebase Console → **Authentication** → **Get started**
2. Click **Email/Password** → Enable it → **Save**

## Step 3: Enable Firestore

1. Firebase Console → **Firestore Database** → **Create database**
2. Choose **Start in production mode** → select your region → **Done**

## Step 4: Get Your Firebase Config

1. Firebase Console → **Project Settings** (gear icon) → **Your apps**
2. Click **</>** (Web) → register app as `awifs-web`
3. Copy the `firebaseConfig` values

## Step 5: Create Your .env File

Copy `.env.example` to `.env` and fill in your values:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=awifs-stock-sim.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=awifs-stock-sim
VITE_FIREBASE_STORAGE_BUCKET=awifs-stock-sim.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Step 6: Deploy Firestore Rules & Indexes

Install Firebase CLI (one time):
```bash
npm install -g firebase-tools
firebase login
firebase init
```
When prompted:
- Select **Firestore** and **Hosting**
- Use existing project: `awifs-stock-sim`
- Firestore rules file: `firestore.rules` (accept default)
- Public directory: `dist`
- Configure as SPA: **Yes**

Then deploy rules:
```bash
firebase deploy --only firestore
```

## Step 7: Create the Admin Account

1. Firebase Console → **Authentication** → **Add user**
2. Enter admin email (e.g. `admin@awifs.com`) and a strong password
3. Copy the **UID** shown in the Users list
4. Go to **Firestore Database** → Start collection `admins`
5. Document ID = the UID you copied
6. Add field: `email` (string) = `admin@awifs.com`
7. Add field: `role` (string) = `admin`

## Step 8: Create Team Accounts

For each team:
1. Firebase Console → **Authentication** → **Add user**
2. Enter their email and a temporary password
3. Copy their UID
4. Go to **Firestore** → collection `teams`
5. New document, ID = their UID, fields:
   ```
   teamName: "Team Name Here"
   email: "team@email.com"
   role: "team"
   cashBalance: 100000
   holdings: {}
   totalPortfolioValue: 100000
   createdAt: (timestamp - click the timestamp option)
   ```

Share each team's email + password with them.

## Step 9: Run Locally

```bash
npm run dev
```
Open http://localhost:5173

Login as admin → **Game Control** → **Initialize Game** → **Seed 18 Stocks**

## Step 10: Deploy to Firebase Hosting

```bash
npm run build
firebase deploy
```

Your site will be live at `https://awifs-stock-sim.web.app`

## Step 11: Connect Your Custom Domain

1. Firebase Console → **Hosting** → **Add custom domain**
2. Enter your domain → follow the DNS instructions
3. SSL certificate is automatic and free

---

## How to Run a Competition

1. **Before the event**: Create all team accounts, seed stocks with real prices
2. **Start**: Admin logs in → Game Control → **Start Round 1** (trading opens)
3. **Between rounds**: Click **Pause Trading** → go to **Publish News** → write news flash + price effects → **Publish**
4. **Repeat**: Start next round, pause, publish news after each round
5. **End**: Click **End Game** → final leaderboard is frozen

## Stock Prices Tips

- Initial prices should be close to real market prices for realism
- News effects: small = ±2-5%, moderate = ±5-15%, big shock = ±15-30%
- Set `brokerInventory` high enough (500-1000 per stock) so teams can trade freely
