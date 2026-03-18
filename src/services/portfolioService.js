import { supabase } from '../supabase/client'

export async function recalculatePortfolioValue(teamId) {
  const { error } = await supabase.rpc('recalculate_portfolio', { p_team_id: teamId })
  if (error) console.error('Portfolio recalc error:', error.message)
}

export async function recalculateAllPortfolios() {
  const { error } = await supabase.rpc('recalculate_all_portfolios')
  if (error) console.error('All portfolio recalc error:', error.message)
}
