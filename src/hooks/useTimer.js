import { useState, useEffect } from 'react'

// Accepts round_end_time string directly — no internal gameState subscription.
// Parent should pass gameState.round_end_time down so there's one subscription total.
export function useTimer(roundEndTime) {
  const [secondsLeft, setSecondsLeft] = useState(null)

  useEffect(() => {
    if (!roundEndTime) { setSecondsLeft(null); return }

    function tick() {
      const diff = Math.max(0, Math.floor((new Date(roundEndTime).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [roundEndTime])

  return secondsLeft  // null = no timer, 0 = expired, N = seconds remaining
}
