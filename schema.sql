-- =============================================================
-- AWIFS Stock Simulation — Supabase Schema
-- Paste this entire file into Supabase SQL Editor and click Run
-- =============================================================

-- ── Tables ──────────────────────────────────────────────────

create table if not exists public.admins (
  id uuid references auth.users primary key,
  email text not null,
  created_at timestamptz default now()
);

create table if not exists public.teams (
  id uuid references auth.users primary key,
  team_name text not null,
  email text not null,
  cash_balance numeric not null default 100000,
  holdings jsonb not null default '{}',
  total_portfolio_value numeric not null default 100000,
  created_at timestamptz default now()
);

create table if not exists public.game_state (
  id text primary key default 'current',
  round_number integer not null default 0,
  status text not null default 'waiting',
  trading_enabled boolean not null default false,
  updated_at timestamptz default now()
);

create table if not exists public.stocks (
  symbol text primary key,
  name text not null,
  current_price numeric not null default 100,
  previous_price numeric not null default 100,
  price_change_percent numeric not null default 0,
  broker_inventory integer not null default 500,
  is_active boolean not null default true,
  updated_at timestamptz default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  body text,
  round integer not null default 0,
  affected_stocks jsonb not null default '[]',
  published_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('buy', 'sell')),
  team_id uuid references public.teams(id),
  team_name text not null,
  symbol text not null,
  quantity integer not null,
  price_per_share numeric not null,
  total_value numeric not null,
  round integer not null default 0,
  created_at timestamptz default now()
);

-- ── Seed initial game state ──────────────────────────────────

insert into public.game_state (id, round_number, status, trading_enabled)
values ('current', 0, 'waiting', false)
on conflict (id) do nothing;

-- ── Enable real-time for all tables ─────────────────────────

alter publication supabase_realtime add table public.game_state;
alter publication supabase_realtime add table public.stocks;
alter publication supabase_realtime add table public.news;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.transactions;

-- ── Row Level Security ───────────────────────────────────────

alter table public.admins enable row level security;
alter table public.teams enable row level security;
alter table public.game_state enable row level security;
alter table public.stocks enable row level security;
alter table public.news enable row level security;
alter table public.transactions enable row level security;

-- admins: can only read own row
create policy "admins read own" on public.admins
  for select using (auth.uid() = id);

-- game_state: all authenticated users read; admins write
create policy "game_state read" on public.game_state
  for select using (auth.role() = 'authenticated');

create policy "game_state write admin" on public.game_state
  for all using (exists (select 1 from public.admins where id = auth.uid()));

-- stocks: all read; admins write
create policy "stocks read" on public.stocks
  for select using (auth.role() = 'authenticated');

create policy "stocks write admin" on public.stocks
  for all using (exists (select 1 from public.admins where id = auth.uid()));

-- news: all read; admins write
create policy "news read" on public.news
  for select using (auth.role() = 'authenticated');

create policy "news write admin" on public.news
  for all using (exists (select 1 from public.admins where id = auth.uid()));

-- teams: each team reads own row; admins read all; trades update via function
create policy "teams read own" on public.teams
  for select using (auth.uid() = id or exists (select 1 from public.admins where id = auth.uid()));

create policy "teams update own" on public.teams
  for update using (auth.uid() = id or exists (select 1 from public.admins where id = auth.uid()));

create policy "teams insert admin" on public.teams
  for insert with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "teams delete admin" on public.teams
  for delete using (exists (select 1 from public.admins where id = auth.uid()));

-- transactions: team reads own; admins read all; anyone authenticated inserts own
create policy "transactions read" on public.transactions
  for select using (
    team_id = auth.uid() or
    exists (select 1 from public.admins where id = auth.uid())
  );

create policy "transactions insert" on public.transactions
  for insert with check (team_id = auth.uid());

-- ── Atomic trade function ────────────────────────────────────

create or replace function execute_trade(
  p_team_id   uuid,
  p_symbol    text,
  p_quantity  integer,
  p_type      text
) returns json
language plpgsql
security definer
as $$
declare
  v_team   public.teams%rowtype;
  v_stock  public.stocks%rowtype;
  v_game   public.game_state%rowtype;
  v_total          numeric;
  v_current_qty    integer;
  v_new_holdings   jsonb;
begin
  -- Read & lock rows
  select * into v_game  from public.game_state where id = 'current' for share;
  select * into v_stock from public.stocks where symbol = p_symbol for update;
  select * into v_team  from public.teams  where id = p_team_id   for update;

  if not v_game.trading_enabled then
    raise exception 'Trading is currently disabled';
  end if;
  if not found then
    raise exception 'Team not found';
  end if;

  v_total       := v_stock.current_price * p_quantity;
  v_current_qty := coalesce((v_team.holdings ->> p_symbol)::integer, 0);

  if p_type = 'buy' then
    if v_stock.broker_inventory < p_quantity then
      raise exception 'Only % shares available from the broker', v_stock.broker_inventory;
    end if;
    if v_team.cash_balance < v_total then
      raise exception 'Insufficient funds. Need ₹%, you have ₹%',
        round(v_total, 2), round(v_team.cash_balance, 2);
    end if;

    v_new_holdings := v_team.holdings ||
      jsonb_build_object(p_symbol, v_current_qty + p_quantity);

    update public.teams set
      cash_balance = cash_balance - v_total,
      holdings     = v_new_holdings
    where id = p_team_id;

    update public.stocks set
      broker_inventory = broker_inventory - p_quantity
    where symbol = p_symbol;

  elsif p_type = 'sell' then
    if v_current_qty < p_quantity then
      raise exception 'You only hold % shares of %', v_current_qty, p_symbol;
    end if;

    if v_current_qty - p_quantity = 0 then
      v_new_holdings := v_team.holdings - p_symbol;
    else
      v_new_holdings := v_team.holdings ||
        jsonb_build_object(p_symbol, v_current_qty - p_quantity);
    end if;

    update public.teams set
      cash_balance = cash_balance + v_total,
      holdings     = v_new_holdings
    where id = p_team_id;

    update public.stocks set
      broker_inventory = broker_inventory + p_quantity
    where symbol = p_symbol;

  else
    raise exception 'Invalid trade type: %', p_type;
  end if;

  -- Log transaction
  insert into public.transactions
    (type, team_id, team_name, symbol, quantity, price_per_share, total_value, round)
  values
    (p_type, p_team_id, v_team.team_name, p_symbol,
     p_quantity, v_stock.current_price, v_total, v_game.round_number);

  return json_build_object('price', v_stock.current_price, 'total', v_total);
end;
$$;

-- ── Portfolio recalculation functions ────────────────────────

create or replace function recalculate_portfolio(p_team_id uuid)
returns numeric
language plpgsql
security definer
as $$
declare
  v_team        public.teams%rowtype;
  v_sym         text;
  v_qty         integer;
  v_price       numeric;
  v_holdings_val numeric := 0;
begin
  select * into v_team from public.teams where id = p_team_id;

  for v_sym, v_qty in
    select key, value::integer from jsonb_each_text(v_team.holdings)
  loop
    select current_price into v_price from public.stocks where symbol = v_sym;
    if found then
      v_holdings_val := v_holdings_val + (v_price * v_qty);
    end if;
  end loop;

  update public.teams
  set total_portfolio_value = v_team.cash_balance + v_holdings_val
  where id = p_team_id;

  return v_team.cash_balance + v_holdings_val;
end;
$$;

create or replace function recalculate_all_portfolios()
returns void
language plpgsql
security definer
as $$
declare v_team public.teams%rowtype;
begin
  for v_team in select * from public.teams loop
    perform recalculate_portfolio(v_team.id);
  end loop;
end;
$$;
