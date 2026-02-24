import { useState } from 'react'
import { useNetwork } from './hooks/useNetwork'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'

export default function App() {
    const network = useNetwork()
    const [gameStarted, setGameStarted] = useState(false)
    const [playerName, setPlayerName] = useState('')
    const [playerAvatar, setPlayerAvatar] = useState('🐱')
    const [playerColor, setPlayerColor] = useState('#8B5CF6')
    const [customCards, setCustomCards] = useState([])

    const handleGameStart = (name, avatar, color, cards) => {
        // Easter Egg: Spesifik isim kontrolü (case-insensitive ve boşluksuz kontrol ediliyor)
        const checkName = name.toLowerCase().replace(/\s+/g, '')
        const easterEggNames = ['fakirveteriner', 'samet']
        const finalName = easterEggNames.includes(checkName) ? 'GAY' : name

        setPlayerName(finalName)
        setPlayerAvatar(avatar)
        if (color) setPlayerColor(color)
        if (cards) setCustomCards(cards)
        setGameStarted(true)
    }

    const handleBackToLobby = () => {
        setGameStarted(false)
        network.cleanupPeer()
    }

    return (
        <>
            <div className="bg-blobs" />
            <div className="min-h-screen relative z-10">
                {!gameStarted ? (
                    <Lobby network={network} onGameStart={handleGameStart} />
                ) : (
                    <GameRoom
                        network={network}
                        playerName={playerName}
                        playerAvatar={playerAvatar}
                        playerColor={playerColor}
                        customCards={customCards}
                        onBackToLobby={handleBackToLobby}
                    />
                )}
            </div>
        </>
    )
}
