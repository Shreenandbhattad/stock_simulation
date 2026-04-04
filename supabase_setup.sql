-- =============================================
-- AWIFS Stock Simulation — Full Database Setup
-- Run this ONCE in Supabase SQL Editor
-- =============================================

-- 1. TABLES
-- ---------

-- Game state (singleton row)
CREATE TABLE IF NOT EXISTS game_state (
  id                    TEXT PRIMARY KEY DEFAULT 'current',
  status                TEXT NOT NULL DEFAULT 'waiting',
  trading_enabled       BOOLEAN NOT NULL DEFAULT false,
  round_number          INTEGER NOT NULL DEFAULT 0,
  round_end_time        TIMESTAMPTZ,
  timer_paused_remaining INTEGER,
  round_durations       JSONB DEFAULT '{}',
  scheduled_news        JSONB DEFAULT '[]',
  price_applied_round   INTEGER DEFAULT 0,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Stocks
CREATE TABLE IF NOT EXISTS stocks (
  symbol                TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  current_price         NUMERIC(12,2) NOT NULL DEFAULT 100,
  previous_price        NUMERIC(12,2) NOT NULL DEFAULT 100,
  price_change_percent  NUMERIC(8,2) NOT NULL DEFAULT 0,
  broker_inventory      INTEGER NOT NULL DEFAULT 500,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Teams (linked to auth.users)
CREATE TABLE IF NOT EXISTS teams (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  cash_balance          NUMERIC(14,2) NOT NULL DEFAULT 100000,
  holdings              JSONB NOT NULL DEFAULT '{}',
  total_portfolio_value NUMERIC(14,2) NOT NULL DEFAULT 100000
);

-- Admins (linked to auth.users)
CREATE TABLE IF NOT EXISTS admins (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               UUID NOT NULL REFERENCES teams(id),
  team_name             TEXT NOT NULL DEFAULT '',
  symbol                TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity              INTEGER NOT NULL,
  price_per_share       NUMERIC(12,2) NOT NULL,
  total_value           NUMERIC(14,2) NOT NULL,
  round                 INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- News
CREATE TABLE IF NOT EXISTS news (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline              TEXT NOT NULL,
  body                  TEXT DEFAULT '',
  round                 INTEGER DEFAULT 0,
  affected_stocks       JSONB DEFAULT '[]',
  published_at          TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);


-- 2. INDEXES
-- ----------
CREATE INDEX IF NOT EXISTS idx_transactions_team ON transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_active ON stocks(is_active);


-- 3. DATABASE FUNCTIONS
-- ---------------------

-- Execute a trade (buy or sell) atomically
CREATE OR REPLACE FUNCTION execute_trade(
  p_team_id UUID,
  p_symbol  TEXT,
  p_quantity INTEGER,
  p_type    TEXT
) RETURNS VOID AS $$
DECLARE
  v_price       NUMERIC(12,2);
  v_inventory   INTEGER;
  v_cash        NUMERIC(14,2);
  v_holdings    JSONB;
  v_held        INTEGER;
  v_total       NUMERIC(14,2);
  v_team_name   TEXT;
  v_trading     BOOLEAN;
  v_round       INTEGER;
BEGIN
  -- Check trading is enabled
  SELECT trading_enabled, round_number INTO v_trading, v_round
    FROM game_state WHERE id = 'current';
  IF NOT v_trading THEN
    RAISE EXCEPTION 'Trading is currently disabled';
  END IF;

  -- Lock the stock row
  SELECT current_price, broker_inventory INTO v_price, v_inventory
    FROM stocks WHERE symbol = p_symbol FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock % not found', p_symbol;
  END IF;

  -- Lock the team row
  SELECT cash_balance, holdings, team_name INTO v_cash, v_holdings, v_team_name
    FROM teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  v_held := COALESCE((v_holdings ->> p_symbol)::INTEGER, 0);
  v_total := v_price * p_quantity;

  IF p_type = 'buy' THEN
    IF v_cash < v_total THEN
      RAISE EXCEPTION 'Insufficient cash. Need %, have %', v_total, v_cash;
    END IF;
    IF v_inventory < p_quantity THEN
      RAISE EXCEPTION 'Insufficient broker inventory. Available: %', v_inventory;
    END IF;

    -- Deduct cash, add holdings, reduce inventory
    UPDATE teams SET
      cash_balance = cash_balance - v_total,
      holdings = jsonb_set(COALESCE(holdings, '{}'), ARRAY[p_symbol], to_jsonb(v_held + p_quantity))
    WHERE id = p_team_id;

    UPDATE stocks SET broker_inventory = broker_inventory - p_quantity WHERE symbol = p_symbol;

  ELSIF p_type = 'sell' THEN
    IF v_held < p_quantity THEN
      RAISE EXCEPTION 'Insufficient holdings. You hold: %', v_held;
    END IF;

    -- Add cash, reduce holdings, increase inventory
    UPDATE teams SET
      cash_balance = cash_balance + v_total,
      holdings = CASE
        WHEN v_held - p_quantity = 0 THEN holdings - p_symbol
        ELSE jsonb_set(holdings, ARRAY[p_symbol], to_jsonb(v_held - p_quantity))
      END
    WHERE id = p_team_id;

    UPDATE stocks SET broker_inventory = broker_inventory + p_quantity WHERE symbol = p_symbol;

  ELSE
    RAISE EXCEPTION 'Invalid trade type: %', p_type;
  END IF;

  -- Record transaction
  INSERT INTO transactions (team_id, team_name, symbol, type, quantity, price_per_share, total_value, round)
    VALUES (p_team_id, v_team_name, p_symbol, p_type, p_quantity, v_price, v_total, v_round);

  -- Recalculate portfolio value
  PERFORM recalculate_portfolio(p_team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Recalculate a single team's portfolio value
CREATE OR REPLACE FUNCTION recalculate_portfolio(p_team_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cash     NUMERIC(14,2);
  v_holdings JSONB;
  v_total    NUMERIC(14,2) := 0;
  v_symbol   TEXT;
  v_qty      INTEGER;
  v_price    NUMERIC(12,2);
BEGIN
  SELECT cash_balance, holdings INTO v_cash, v_holdings FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_total := v_cash;

  FOR v_symbol, v_qty IN SELECT key, (value)::INTEGER FROM jsonb_each_text(COALESCE(v_holdings, '{}'))
  LOOP
    SELECT current_price INTO v_price FROM stocks WHERE symbol = v_symbol;
    IF FOUND THEN
      v_total := v_total + (v_price * v_qty);
    END IF;
  END LOOP;

  UPDATE teams SET total_portfolio_value = v_total WHERE id = p_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Recalculate ALL teams' portfolio values
CREATE OR REPLACE FUNCTION recalculate_all_portfolios()
RETURNS VOID AS $$
DECLARE
  v_team RECORD;
BEGIN
  FOR v_team IN SELECT id FROM teams LOOP
    PERFORM recalculate_portfolio(v_team.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Set game timer using server clock (avoids client clock skew)
CREATE OR REPLACE FUNCTION set_game_timer(p_seconds INTEGER)
RETURNS VOID AS $$
BEGIN
  IF p_seconds > 0 THEN
    UPDATE game_state SET
      round_end_time = now() + (p_seconds || ' seconds')::INTERVAL,
      timer_paused_remaining = NULL,
      updated_at = now()
    WHERE id = 'current';
  ELSE
    UPDATE game_state SET
      round_end_time = NULL,
      timer_paused_remaining = NULL,
      updated_at = now()
    WHERE id = 'current';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Pause round timer — store remaining seconds, clear end time
CREATE OR REPLACE FUNCTION pause_round_timer()
RETURNS VOID AS $$
DECLARE
  v_end TIMESTAMPTZ;
  v_remaining INTEGER;
BEGIN
  SELECT round_end_time INTO v_end FROM game_state WHERE id = 'current';
  IF v_end IS NULL THEN RETURN; END IF;

  v_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_end - now()))::INTEGER);

  UPDATE game_state SET
    round_end_time = NULL,
    timer_paused_remaining = v_remaining,
    updated_at = now()
  WHERE id = 'current';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Resume round timer — set new end time from paused remaining
CREATE OR REPLACE FUNCTION resume_round_timer()
RETURNS VOID AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT timer_paused_remaining INTO v_remaining FROM game_state WHERE id = 'current';
  IF v_remaining IS NULL OR v_remaining <= 0 THEN RETURN; END IF;

  UPDATE game_state SET
    round_end_time = now() + (v_remaining || ' seconds')::INTERVAL,
    timer_paused_remaining = NULL,
    updated_at = now()
  WHERE id = 'current';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. ROW LEVEL SECURITY
-- ---------------------

ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Game state: everyone can read, admins can write
CREATE POLICY "game_state_read" ON game_state FOR SELECT USING (true);
CREATE POLICY "game_state_write" ON game_state FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
);

-- Stocks: everyone can read, admins can write
CREATE POLICY "stocks_read" ON stocks FOR SELECT USING (true);
CREATE POLICY "stocks_write" ON stocks FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
);

-- Teams: everyone can read (for leaderboard), own row can be updated by trade functions
CREATE POLICY "teams_read" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_write" ON teams FOR ALL USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
);

-- Admins: only admins can read
CREATE POLICY "admins_read" ON admins FOR SELECT USING (true);

-- Transactions: teams see own, admins see all
CREATE POLICY "transactions_read" ON transactions FOR SELECT USING (
  auth.uid() = team_id OR EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
);
CREATE POLICY "transactions_write" ON transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
);

-- News: everyone can read, admins can write
CREATE POLICY "news_read" ON news FOR SELECT USING (true);
CREATE POLICY "news_write" ON news FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
);


-- 5. ENABLE REALTIME
-- ------------------

ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE stocks;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE news;


-- 6. INITIALIZE GAME STATE
-- ------------------------

INSERT INTO game_state (id, status, trading_enabled, round_number)
VALUES ('current', 'waiting', false, 0)
ON CONFLICT (id) DO NOTHING;


-- =============================================
-- DONE! Now:
-- 1. Create admin user in Supabase Auth
-- 2. Insert admin's UUID into admins table
-- 3. Update .env with new project URL + keys
-- =============================================
