# AWIFS Stock Market Simulation Platform

A real-time, browser-based stock trading competition platform built for AWIFS. Teams compete by buying and selling stocks through a central broker, with prices moving dynamically based on actual trade activity and admin-published news flashes.

**Live deployment:** `awifs.co.in`

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Feature List](#feature-list)
3. [Architecture Overview](#architecture-overview)
4. [Tech Stack](#tech-stack)
5. [Database Schema](#database-schema)
6. [The Math](#the-math)
7. [Real-Time System](#real-time-system)
8. [Security Model](#security-model)
9. [Admin Capabilities](#admin-capabilities)
10. [Team Capabilities](#team-capabilities)
11. [Environment Setup](#environment-setup)
12. [Deployment](#deployment)

---

## What It Does

AWIFS runs as a multi-round stock trading game. Before the game, an admin sets up teams, stocks, round durations, and pre-schedules news flashes. During each round, trading opens and teams buy or sell shares from a central broker — there is no peer-to-peer trading. Every trade moves the price slightly (demand/supply mechanics). When a news flash fires, prices jump by the configured percentage. At the end of each round the timer auto-pauses trading. A live leaderboard ranks all teams by total portfolio value throughout the game.

---

## Feature List

### Teams
- Email + password login (no self-registration — admin creates all accounts)
- Personal dashboard with cash balance, holdings table, and total portfolio value
- Live stock market with real-time prices and bid/ask via a central broker
- Trade modal showing estimated total, available inventory, and current holdings
- Sell button only visible when the team actually holds that stock
- Full trade history (buy/sell log with prices and round numbers)
- Live news feed with the latest headline highlighted
- Scrolling news ticker at the bottom of every page
- Round countdown timer in the top bar, synced from the server clock

### Admin
- Create teams (bulk or one at a time) — uses Supabase Admin API, no email sent, no rate limits
- Edit team name and cash balance at any time
- Delete teams (cascades: transactions → team row → auth user)
- Reset individual teams to starting cash with empty holdings
- Add, edit, price, and toggle active/inactive stocks
- Publish news flashes: headline, body, affected stocks with % change — fires instantly to all teams
- Schedule news flashes per round — auto-publish on "Start Round"
- Set round durations before the game starts
- Start / Pause / Resume / End Game controls
- Server-side timer: start/pause/resume all use the database clock so all browsers see the same countdown
- View and clear all transaction history
- Delete and edit published news items

---

## Architecture Overview

```
Browser (Team)          Browser (Admin)
     │                       │
     └──────────┬────────────┘
                │ HTTPS
        ┌───────▼────────┐
        │   React SPA    │
        │ Vite + Router  │
        └───────┬────────┘
                │ Supabase JS Client
        ┌───────▼─────────────────┐
        │        Supabase         │
        │  ┌─────────────────┐   │
        │  │  PostgreSQL DB  │   │
        │  │  RLS Policies   │   │
        │  │  SQL Functions  │   │
        │  └────────┬────────┘   │
        │  ┌────────▼────────┐   │
        │  │  Realtime WS    │   │
        │  │ (postgres_changes│  │
        │  │  subscriptions) │   │
        │  └─────────────────┘   │
        │  Supabase Auth          │
        └─────────────────────────┘
```

**Routing:** HashRouter (`/#/login`, `/#/dashboard`, `/#/admin`) for GitHub Pages compatibility.

**State:** No Redux or Zustand — all state lives in custom React hooks that subscribe to Supabase real-time channels. Each hook opens one WebSocket subscription and re-renders connected components on any database change.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 18.3.1 |
| Build tool | Vite | 6.x |
| Routing | React Router DOM | 6.x |
| Styling | Tailwind CSS + inline styles | 3.4.x |
| Backend / DB | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth (email/password) | — |
| Real-time | Supabase Realtime (WebSocket) | — |
| Notifications | react-hot-toast | 2.4.1 |
| Deployment | GitHub Pages via GitHub Actions | — |

**Bundle size:** ~441 KB JS (121 KB gzipped), 11.6 KB CSS.

---

## Database Schema

### Tables

#### `admins`
Stores admin user UIDs. Checked at login to assign the `admin` role.

```sql
id          uuid  PRIMARY KEY  REFERENCES auth.users(id)
email       text
created_at  timestamptz  DEFAULT now()
```

#### `teams`
One row per team. Holdings stored as a JSONB object keyed by stock symbol.

```sql
id                    uuid  PRIMARY KEY   -- matches auth.users(id)
team_name             text  NOT NULL
email                 text
cash_balance          numeric  DEFAULT 100000
holdings              jsonb    DEFAULT '{}'   -- e.g. {"TCS": 50, "HDFC": 100}
total_portfolio_value numeric  DEFAULT 100000
created_at            timestamptz  DEFAULT now()
```

#### `game_state`
Single row (`id = 'current'`). Acts as the global control panel.

```sql
id                    text  PRIMARY KEY  DEFAULT 'current'
status                text  DEFAULT 'waiting'   -- waiting | active | paused | ended
trading_enabled       boolean  DEFAULT false
round_number          integer  DEFAULT 0
round_end_time        timestamptz  NULL          -- set server-side via RPC
timer_paused_remaining integer   NULL            -- seconds left when paused
round_durations       jsonb     DEFAULT '{}'     -- {1: 600, 2: 900, ...} (seconds)
scheduled_news        jsonb     DEFAULT '[]'     -- pre-scheduled news per round
updated_at            timestamptz  DEFAULT now()
```

#### `stocks`
One row per listed stock. Broker inventory tracks available supply.

```sql
symbol                text  PRIMARY KEY
name                  text
current_price         numeric
previous_price        numeric
price_change_percent  numeric  DEFAULT 0
broker_inventory      integer  DEFAULT 0
is_active             boolean  DEFAULT true
updated_at            timestamptz  DEFAULT now()
```

#### `news`
Published news flashes. Shown in the ticker and news panel.

```sql
id            uuid  PRIMARY KEY  DEFAULT gen_random_uuid()
headline      text
body          text  DEFAULT ''
round         integer  DEFAULT 0
affected_stocks jsonb  DEFAULT '[]'  -- [{symbol, changePercent}, ...]
published_at  timestamptz  DEFAULT now()
```

#### `transactions`
Immutable trade log. One row per buy or sell.

```sql
id              uuid  PRIMARY KEY  DEFAULT gen_random_uuid()
team_id         uuid  REFERENCES teams(id) ON DELETE CASCADE
team_name       text
symbol          text
type            text  CHECK (type IN ('buy', 'sell'))
quantity        integer
price_per_share numeric
total_value     numeric
round           integer  DEFAULT 0
created_at      timestamptz  DEFAULT now()
```

---

## The Math

### Portfolio Value

Every team's `total_portfolio_value` is recalculated after every trade and every price change:

```
total_portfolio_value = cash_balance + Σ (holdings[symbol] × current_price[symbol])
```

This is a dot product of the holdings vector and the current price vector, plus remaining cash. Implemented as a PostgreSQL function that joins the team's JSONB holdings against the stocks table:

```sql
-- pseudocode of recalculate_portfolio()
SELECT SUM(qty::integer * s.current_price)
FROM jsonb_each_text(v_team.holdings) AS h(symbol, qty)
JOIN stocks s ON s.symbol = h.symbol
INTO v_stock_value;

UPDATE teams SET total_portfolio_value = v_team.cash_balance + v_stock_value
WHERE id = p_team_id;
```

### Trade Execution

When a team buys `Q` shares of stock `S` at price `P`:

```
total_cost       = P × Q
new_cash_balance = cash_balance − total_cost
new_holdings[S]  = holdings[S] + Q (or Q if not held before)
```

When a team sells `Q` shares:

```
total_proceeds   = P × Q
new_cash_balance = cash_balance + total_proceeds
new_holdings[S]  = holdings[S] − Q (removed from JSONB if reaches 0)
```

All of this runs inside a single PostgreSQL transaction with `FOR UPDATE` row locks on both the team and stock rows, preventing race conditions when multiple teams trade simultaneously.

### Dynamic Pricing (Demand & Supply)

Every trade moves the stock price. The price impact is proportional to the trade size relative to the broker's available inventory, with a sensitivity multiplier and a per-trade cap:

```
price_impact = min( (Q / broker_inventory) × sensitivity , max_impact )

sensitivity = 0.25   (25% move if entire inventory traded at once)
max_impact  = 0.10   (single trade capped at 10% price move)
```

**On a buy:**
```
new_price = current_price × (1 + price_impact)
```

**On a sell:**
```
new_price = current_price × (1 − price_impact)
```

**Floor:** Price cannot go below ₹1.00.

**Example:** Stock has 1,000 shares available at ₹500. A team buys 200 shares:
```
price_impact = min((200 / 1000) × 0.25, 0.10) = min(0.05, 0.10) = 0.05
new_price    = 500 × (1 + 0.05) = ₹525
```

This naturally discourages market manipulation — a team that buys aggressively raises the price against themselves, making each subsequent share more expensive.

### News Flash Price Change

When admin publishes a news flash with a `changePercent` for a stock:

```
new_price         = round(current_price × (1 + changePercent / 100), 2)
price_change_pct  = changePercent   (stored directly)
previous_price    = current_price   (snapshot before change)
```

After all stock prices update, `recalculate_all_portfolios()` runs to update every team's portfolio value.

### Timer

Round timers are set server-side using the database clock to avoid browser clock skew between the admin's machine and team machines:

```sql
-- set_game_timer(p_seconds)
UPDATE game_state
SET round_end_time = now() + (p_seconds || ' seconds')::interval
WHERE id = 'current';
```

Clients compute remaining seconds locally:
```
seconds_left = max(0, floor((round_end_time − Date.now()) / 1000))
```

Pause captures remaining time server-side:
```sql
-- pause_round_timer()
SELECT extract(epoch from (round_end_time − now()))::integer INTO v_rem;
UPDATE game_state SET timer_paused_remaining = v_rem, round_end_time = NULL;
```

Resume restores from stored remaining seconds:
```sql
-- resume_round_timer()
UPDATE game_state
SET round_end_time = now() + (timer_paused_remaining || ' seconds')::interval,
    timer_paused_remaining = NULL;
```

---

## Real-Time System

Every data view updates live without polling. Each custom hook opens a Supabase Realtime subscription:

```
useGameState()      → postgres_changes on game_state   (INSERT, UPDATE, DELETE)
useStocks()         → postgres_changes on stocks        (INSERT, UPDATE, DELETE)
useLeaderboard()    → postgres_changes on teams         (UPDATE)
useNews()           → postgres_changes on news          (INSERT, UPDATE, DELETE)
useTeamPortfolio()  → postgres_changes on teams         (UPDATE, filter: id=eq.{uid})
useTransactions()   → postgres_changes on transactions  (INSERT, DELETE)
```

Each hook fetches initial data on mount, then applies real-time patches as the database changes. Subscriptions are cleaned up on component unmount.

**Timer** does not use a database subscription — it receives `round_end_time` as a prop passed down from the nearest `useGameState()` call, running a `setInterval` tick every second. This avoids duplicate WebSocket subscriptions per page.

---

## Security Model

### Authentication

- All users authenticate via Supabase Auth (email + password)
- On login, `AuthContext` checks the `admins` table first — if the user's UID is there, role = `admin`, otherwise role = `team`
- Teams cannot self-register — accounts are created exclusively by the admin via the service role API key

### Row-Level Security

Every table has RLS enabled. Policies:

| Table | Who can SELECT | Who can INSERT/UPDATE/DELETE |
|-------|---------------|------------------------------|
| `admins` | Own row only | — |
| `game_state` | Any authenticated user | Admins only |
| `stocks` | Any authenticated user | Admins only |
| `news` | Any authenticated user | Admins only |
| `teams` | Any authenticated user | Admins only (via service role) |
| `transactions` | Own transactions (or admin) | Own team (via `execute_trade`) |

### Atomic Trades

`execute_trade()` runs as a PostgreSQL function with `SECURITY DEFINER` (runs with DB owner privileges, bypassing RLS for the trade transaction). It uses `SELECT ... FOR UPDATE` to lock both the team row and the stock row before writing, preventing double-spends or inventory overselling when concurrent trades arrive.

### Two Supabase Clients

The frontend initialises two clients:

- **`supabase`** — anon key, persists session, used for all team and read operations
- **`supabaseAdmin`** — service role key, no session persistence, used only for admin team creation and deletion (calls `auth.admin.*` API)

The service role key is never exposed to team users — it is only loaded in admin-controlled contexts and is injected at build time via GitHub Actions secrets.

---

## Admin Capabilities

| Action | Where | Effect |
|--------|-------|--------|
| Create team | Teams tab | Creates auth user + team row; handles re-creation if auth user exists |
| Edit team | Teams tab | Updates team_name and/or cash_balance |
| Delete team | Teams tab | Cascades: transactions → team row → auth user |
| Reset team | Teams tab | Clears holdings, restores cash to ₹1,00,000 |
| Add / edit stock | Stocks tab | Upserts stock row; triggers portfolio recalc if price changes |
| Toggle stock active | Stocks tab | Hides stock from trading if inactive |
| Publish news | Publish News tab | Updates stock prices, inserts news, recalculates all portfolios |
| Edit / delete news | Publish News tab | Updates headline/body or removes from ticker |
| Schedule news | Game Control | Saves news items per round; auto-fires on Start Round |
| Set round durations | Game Control | Saves seconds-per-round to game_state |
| Start Round | Game Control | Sets status=active, opens trading, fires scheduled news, starts server timer |
| Pause Trading | Game Control | Sets status=paused, stores remaining seconds server-side |
| Resume Trading | Game Control | Restores timer from stored remaining seconds |
| End Game | Game Control | Sets status=ended, closes trading permanently |
| Restart Game | Game Control | Resets all teams to ₹1,00,000, clears holdings, round back to 0 |
| Clear transactions | Transactions tab | Deletes all transaction records (does not affect balances) |

---

## Team Capabilities

| Action | Effect |
|--------|--------|
| View portfolio | Shows cash, holdings with current prices, unrealised P&L, total value |
| Buy shares | Pays `price × quantity` from cash; receives shares; price moves up |
| Sell shares | Receives `price × quantity` to cash; loses shares; price moves down |
| View leaderboard | Live ranking of all teams by total portfolio value |
| View news | Latest published news with stock impact indicators |
| View trade history | Own buy/sell log with prices, totals, and round numbers |
| Watch ticker | Scrolling news feed at the bottom of every page |
| Watch timer | Round countdown in the top bar; pauses when admin pauses; hides when no round active |

---

## Environment Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### Step 1 — Clone and install

```bash
git clone https://github.com/Shreenandbhattad/stock_simulation.git
cd stock_simulation
npm install
```

### Step 2 — Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `schema.sql`
3. Go to **Authentication → Providers → Email** → turn off **Confirm email**
4. Go to **Settings → API** → copy the **Project URL**, **anon key**, and **service_role key**

### Step 3 — Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_SUPABASE_SERVICE_KEY=your_service_role_key_here
```

### Step 4 — Create an admin user

1. Run `npm run dev` and open `http://localhost:5173`
2. In the Supabase Dashboard → **Authentication → Users** → **Add user** → create your admin email/password
3. In **SQL Editor** run:
   ```sql
   INSERT INTO public.admins (id, email)
   SELECT id, email FROM auth.users WHERE email = 'your-admin@email.com';
   ```
4. Log in at `/login` — you will be routed to the admin panel

### Step 5 — Run SQL patches

If upgrading from an older version, run these in the SQL Editor:

```sql
-- Server-side timer functions
-- (copy from the timer section in schema.sql)

-- Leaderboard RLS fix
drop policy if exists "teams read own" on public.teams;
create policy "teams read authenticated" on public.teams
  for select using (auth.role() = 'authenticated');

-- Dynamic pricing column (if needed)
alter table public.game_state
  add column if not exists scheduled_news jsonb default '[]';
```

---

## Deployment

Deployed automatically to GitHub Pages via GitHub Actions on every push to `main`.

### GitHub Secrets required

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key |
| `VITE_SUPABASE_SERVICE_KEY` | Service role key |

### Custom domain

Point your domain's DNS to GitHub Pages and add the domain under **Settings → Pages → Custom domain**. Change `base` in `vite.config.js` from `/stock_simulation/` to `/` before your next push.

---

## Project Structure

```
stock_simulation/
├── .github/workflows/deploy.yml   # GitHub Actions deploy pipeline
├── public/
│   └── logo.png                   # AWIFS circular logo
├── src/
│   ├── main.jsx                   # Entry point (HashRouter, Toaster)
│   ├── App.jsx                    # Route definitions
│   ├── index.css                  # Global design system (navy theme)
│   ├── supabase/client.js         # Two Supabase clients (anon + service role)
│   ├── contexts/AuthContext.jsx   # Login, logout, role detection
│   ├── hooks/
│   │   ├── useGameState.js        # Live game_state subscription
│   │   ├── useStocks.js           # Live stocks subscription
│   │   ├── useLeaderboard.js      # Live team rankings
│   │   ├── useNews.js             # Live news subscription
│   │   ├── useTeamPortfolio.js    # Own team row subscription
│   │   ├── useTransactions.js     # Trade history subscription
│   │   └── useTimer.js            # Client-side countdown from server timestamp
│   ├── services/
│   │   ├── adminService.js        # All admin operations (15 exported functions)
│   │   ├── tradeService.js        # buyStock / sellStock via execute_trade RPC
│   │   └── portfolioService.js    # recalculate helpers
│   ├── pages/
│   │   ├── LoginPage.jsx          # Auth form with role redirect
│   │   ├── TeamDashboard.jsx      # Team page router
│   │   └── AdminDashboard.jsx     # Admin page router
│   └── components/
│       ├── common/
│       │   ├── NewsTicker.jsx     # Scrolling bottom ticker
│       │   ├── RoundTimer.jsx     # Countdown display (topbar + full variants)
│       │   ├── PriceTag.jsx       # Green/red price with arrow
│       │   └── LoadingSpinner.jsx # Branded loading state
│       ├── team/
│       │   ├── TeamLayout.jsx     # Nav sidebar + top bar
│       │   ├── Portfolio.jsx      # Holdings table + stat cards
│       │   ├── StockMarket.jsx    # Live stock list + buy/sell
│       │   ├── TradeModal.jsx     # Order confirmation modal
│       │   ├── Leaderboard.jsx    # Ranked team list with progress bars
│       │   ├── NewsPanel.jsx      # Latest news card list
│       │   └── TradeHistory.jsx   # Own transaction log
│       └── admin/
│           ├── AdminLayout.jsx    # Admin nav sidebar
│           ├── GameControl.jsx    # Round control + timer + schedule
│           ├── StockManager.jsx   # Add/edit/toggle stocks
│           ├── NewsPublisher.jsx  # Publish + manage news flashes
│           ├── TeamOverview.jsx   # Create/edit/delete/reset teams
│           └── AllTransactions.jsx # Full audit trail with clear button
├── schema.sql                     # Complete Supabase schema (paste once)
├── tailwind.config.js             # Custom navy/rose theme
├── vite.config.js                 # Build config (base path for GH Pages)
└── .env.example                   # Required environment variable template
```

---

## Licence

Built for AWIFS at Ashoka University. Internal use.
