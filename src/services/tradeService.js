import { supabase } from '../supabase/client'

export async function buyStock({ teamId, symbol, quantity }) {
  const qty = Number(quantity)
  if (!qty || qty <= 0 || !Number.isInteger(qty)) {
    throw new Error('Quantity must be a positive whole number')
  }

  const { error } = await supabase.rpc('execute_trade', {
    p_team_id:  teamId,
    p_symbol:   symbol,
    p_quantity: qty,
    p_type:     'buy',
  })

  if (error) throw new Error(error.message)
  // execute_trade calls recalculate_all_portfolios internally after every trade
}

export async function sellStock({ teamId, symbol, quantity }) {
  const qty = Number(quantity)
  if (!qty || qty <= 0 || !Number.isInteger(qty)) {
    throw new Error('Quantity must be a positive whole number')
  }

  const { error } = await supabase.rpc('execute_trade', {
    p_team_id:  teamId,
    p_symbol:   symbol,
    p_quantity: qty,
    p_type:     'sell',
  })

  if (error) throw new Error(error.message)
}
