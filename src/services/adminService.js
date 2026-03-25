import { supabase, supabaseAdmin } from '../supabase/client'
import { recalculateAllPortfolios } from './portfolioService'

// Creates a Supabase Auth user + teams row using the service role key.
// If the auth user already exists (e.g. team was deleted but auth user wasn't),
// reuses their UID and resets their password.
export async function createTeamAccount({ teamName, email, password, cashBalance = 100000 }) {
  if (!supabaseAdmin) throw new Error('Service role key missing — add VITE_SUPABASE_SERVICE_KEY to .env (Supabase → Settings → API → service_role)')

  let uid

  // 1. Try to create auth user
  const { data, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (signUpError) {
    const msg = signUpError.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('already exists')) {
      // Auth user exists but team row was deleted — find their UID and reset password
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      if (listError) throw new Error(listError.message)
      const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!existing) throw new Error('User exists in auth but could not be located — contact support')
      uid = existing.id
      // Reset their password to the new one
      await supabaseAdmin.auth.admin.updateUserById(uid, { password })
    } else {
      throw new Error(signUpError.message)
    }
  } else {
    uid = data.user?.id
    if (!uid) throw new Error('User created but UID not returned')
  }

  // 2. Upsert teams row (handles both new teams and re-created ones)
  const { error: teamError } = await supabaseAdmin.from('teams').upsert({
    id: uid,
    team_name: teamName.trim(),
    email,
    cash_balance: Number(cashBalance),
    holdings: {},
    total_portfolio_value: Number(cashBalance),
  })
  if (teamError) throw new Error(teamError.message)
}

export async function setGameState({ status, tradingEnabled, roundNumber, roundEndTime, timerPausedRemaining, priceAppliedRound }) {
  // Only include fields that were explicitly passed (undefined = don't touch)
  const row = { id: 'current', updated_at: new Date().toISOString() }
  if (status !== undefined) row.status = status
  if (tradingEnabled !== undefined) row.trading_enabled = tradingEnabled
  if (roundNumber !== undefined) row.round_number = roundNumber
  if (roundEndTime !== undefined) row.round_end_time = roundEndTime          // null explicitly clears
  if (timerPausedRemaining !== undefined) row.timer_paused_remaining = timerPausedRemaining
  if (priceAppliedRound !== undefined) row.price_applied_round = priceAppliedRound
  const { error } = await supabase.from('game_state').upsert(row)
  if (error) throw new Error(error.message)
}

export async function saveScheduledNews(items) {
  const { error } = await supabase.from('game_state')
    .update({ scheduled_news: items, updated_at: new Date().toISOString() })
    .eq('id', 'current')
  if (error) throw new Error(error.message)
}

export async function saveRoundDurations(durations) {
  // durations = { 1: 600, 2: 900, ... }  (round_number → seconds)
  const { error } = await supabase.from('game_state')
    .update({ round_durations: durations, updated_at: new Date().toISOString() })
    .eq('id', 'current')
  if (error) throw new Error(error.message)
}

export async function initGameState() {
  const { error } = await supabase.from('game_state').upsert({
    id: 'current',
    status: 'waiting',
    trading_enabled: false,
    round_number: 0,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function addStock({ symbol, name, currentPrice, brokerInventory }) {
  const { error } = await supabase.from('stocks').upsert({
    symbol: symbol.toUpperCase().trim(),
    name: name.trim(),
    current_price: Number(currentPrice),
    previous_price: Number(currentPrice),
    price_change_percent: 0,
    broker_inventory: Number(brokerInventory),
    is_active: true,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function updateStockDirect({ symbol, currentPrice, brokerInventory }) {
  const updates = { updated_at: new Date().toISOString() }

  if (currentPrice !== undefined) {
    const { data: existing } = await supabase
      .from('stocks').select('current_price').eq('symbol', symbol).single()
    const prev = existing?.current_price ?? Number(currentPrice)
    const pct = prev > 0 ? ((Number(currentPrice) - prev) / prev) * 100 : 0
    updates.previous_price = prev
    updates.current_price = Number(currentPrice)
    updates.price_change_percent = pct
  }
  if (brokerInventory !== undefined) {
    updates.broker_inventory = Number(brokerInventory)
  }

  const { error } = await supabase.from('stocks').update(updates).eq('symbol', symbol)
  if (error) throw new Error(error.message)

  if (currentPrice !== undefined) {
    await recalculateAllPortfolios()
  }
}

export async function toggleStockActive(symbol, isActive) {
  const { error } = await supabase.from('stocks').update({ is_active: isActive }).eq('symbol', symbol)
  if (error) throw new Error(error.message)
}

export async function deleteStock(symbol) {
  const { error } = await supabase.from('stocks').delete().eq('symbol', symbol)
  if (error) throw new Error(error.message)
}

// Publishes a news flash visible to all teams.
// Price changes are NOT applied here — they are deferred to round end (applyRoundNewsEffects).
export async function publishNews({ headline, body, round, affectedStocks }) {
  const { error } = await supabase.from('news').insert({
    headline: headline.trim(),
    body: body?.trim() || '',
    round,
    affected_stocks: affectedStocks,
    published_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

// Applies the deferred price effects from all news items published in a given round.
// Call this when a round ends (timer hits 0, game ends, or next round starts).
// Idempotent: tracks the last applied round in game_state.price_applied_round.
// Applies scheduled price changes for a completed round.
// Reads directly from savedSchedule (game_state.scheduled_news) — no SQL function needed.
// Returns the number of stocks whose price was updated.
export async function applyRoundNewsEffects(roundNumber, savedSchedule = []) {
  const client = supabaseAdmin || supabase
  const items = savedSchedule.filter(n => Number(n.round) === roundNumber)
  let count = 0

  for (const item of items) {
    for (const s of (item.stocks || [])) {
      const sym = (s.symbol || '').trim().toUpperCase()
      const pct = Number(s.changePercent)
      if (!sym || isNaN(pct) || pct === 0) continue

      const { data: stock, error: fetchErr } = await client
        .from('stocks').select('current_price').eq('symbol', sym).single()
      if (fetchErr || !stock) continue

      const prev     = stock.current_price
      const newPrice = Math.max(1, Math.round(prev * (1 + pct / 100) * 100) / 100)

      const { error: updErr } = await client.from('stocks').update({
        previous_price:       prev,
        current_price:        newPrice,
        price_change_percent: pct,
        updated_at:           new Date().toISOString(),
      }).eq('symbol', sym)

      if (updErr) throw new Error(`Could not update ${sym}: ${updErr.message}`)
      count++
    }
  }

  if (count > 0) await recalculateAllPortfolios()
  return count
}

export async function createTeam({ email, uid, teamName, cashBalance = 100000 }) {
  const { error } = await supabase.from('teams').insert({
    id: uid,
    team_name: teamName.trim(),
    email,
    cash_balance: Number(cashBalance),
    holdings: {},
    total_portfolio_value: Number(cashBalance),
  })
  if (error) throw new Error(error.message)
}

export async function resetTeam(uid, cashBalance = 100000) {
  const { error } = await supabase.from('teams').update({
    cash_balance: Number(cashBalance),
    holdings: {},
    total_portfolio_value: Number(cashBalance),
  }).eq('id', uid)
  if (error) throw new Error(error.message)
}

export async function updateTeam(uid, { teamName, cashBalance }) {
  const updates = {}
  if (teamName !== undefined) updates.team_name = teamName.trim()
  if (cashBalance !== undefined) updates.cash_balance = Number(cashBalance)
  const { error } = await supabase.from('teams').update(updates).eq('id', uid)
  if (error) throw new Error(error.message)
}

export async function deleteTeam(uid) {
  // 1. Delete this team's transactions first (FK: transactions.team_id → teams.id)
  const client = supabaseAdmin || supabase
  const { error: txError } = await client.from('transactions').delete().eq('team_id', uid)
  if (txError) throw new Error(txError.message)

  // 2. Delete the teams row
  const { error: teamError } = await client.from('teams').delete().eq('id', uid)
  if (teamError) throw new Error(teamError.message)

  // 3. Delete the auth user (requires service role key)
  if (supabaseAdmin) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (authError) throw new Error(authError.message)
  }
}

// Timer operations use DATABASE server clock via RPC to avoid client clock skew.
// All browsers compute remaining time from the same server-set end timestamp.
export async function startRoundTimer(durationSeconds) {
  const { error } = await supabase.rpc('set_game_timer', { p_seconds: durationSeconds })
  if (error) throw new Error(error.message)
}

export async function pauseRoundTimer() {
  // DB computes remaining seconds from round_end_time - now(), stores it, clears end time
  const { error } = await supabase.rpc('pause_round_timer')
  if (error) throw new Error(error.message)
}

export async function resumeRoundTimer() {
  // DB sets round_end_time = now() + timer_paused_remaining
  const { error } = await supabase.rpc('resume_round_timer')
  if (error) throw new Error(error.message)
}

export async function clearRoundTimer() {
  const { error } = await supabase.rpc('set_game_timer', { p_seconds: 0 })
  if (error) throw new Error(error.message)
}

export async function clearAllTransactions() {
  const { error } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(error.message)
}

export async function deleteNews(id) {
  const { error } = await supabase.from('news').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function clearAllNews() {
  const { error } = await supabase.from('news').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(error.message)
}

export async function updateNews(id, { headline, body }) {
  const updates = { updated_at: new Date().toISOString() }
  if (headline !== undefined) updates.headline = headline.trim()
  if (body !== undefined) updates.body = body.trim()
  const { error } = await supabase.from('news').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function restartGame(cashBalance = 100000) {
  // 1. Reset game state to round 0, clear all timer state
  const { error: gsError } = await supabase.from('game_state').update({
    status: 'waiting',
    trading_enabled: false,
    round_number: 0,
    round_end_time: null,
    timer_paused_remaining: null,
    price_applied_round: 0,
    updated_at: new Date().toISOString(),
  }).eq('id', 'current')
  if (gsError) throw new Error(gsError.message)

  // 2. Reset all teams: clear holdings, restore cash
  const { error: teamError } = await supabase.from('teams').update({
    cash_balance: Number(cashBalance),
    holdings: {},
    total_portfolio_value: Number(cashBalance),
  }).neq('id', '00000000-0000-0000-0000-000000000000') // matches all rows
  if (teamError) throw new Error(teamError.message)
}
