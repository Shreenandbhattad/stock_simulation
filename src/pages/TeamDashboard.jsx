import { GameProvider } from '../contexts/GameContext'
import TeamLayout from '../components/team/TeamLayout'

export default function TeamDashboard() {
  return (
    <GameProvider>
      <TeamLayout />
    </GameProvider>
  )
}
