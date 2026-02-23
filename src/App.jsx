import { useState } from 'react'
import { useNetwork } from './hooks/useNetwork'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'

export default function App() {
    const network = useNetwork()
    const [gameStarted, setGameStarted] = useState(false)
    const [playerName, setPlayerName] = useState('')
    const [playerAvatar, setPlayerAvatar] = useState('🐱')

    const handleGameStart = (name, avatar) => {
        setPlayerName(name)
        setPlayerAvatar(avatar)
        setGameStarted(true)
    }

    const handleBackToLobby = () => {
        setGameStarted(false)
        network.cleanupPeer()
    }

    return (
        <div className="min-h-screen">
            {!gameStarted ? (
                <Lobby network={network} onGameStart={handleGameStart} />
            ) : (
                <GameRoom
                    network={network}
                    playerName={playerName}
                    playerAvatar={playerAvatar}
                    onBackToLobby={handleBackToLobby}
                />
            )}
        </div>
    )
}
