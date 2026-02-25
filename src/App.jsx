import { useState, useEffect } from 'react'
import { useNetwork } from './hooks/useNetwork'
import { Volume2, VolumeX } from 'lucide-react'
import { bgMusic } from './utils/sounds'
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
        setPlayerName(name)
        setPlayerAvatar(avatar)
        if (color) setPlayerColor(color)
        if (cards) setCustomCards(cards)
        setGameStarted(true)
    }

    const handleBackToLobby = () => {
        setGameStarted(false)
        network.cleanupPeer()
    }

    // BGM Ses Kontrolü
    const [bgmVolume, setBgmVolume] = useState(0.3)
    const [isMuted, setIsMuted] = useState(false)
    const [showVolumeSlider, setShowVolumeSlider] = useState(false)

    useEffect(() => {
        // Kullanıcı sayfayla etkileşime girdiğinde müziği başlat
        const startAudio = () => {
            if (bgMusic.paused) {
                bgMusic.play().catch(e => console.log('Audio autoplay blocked', e))
            }
        }
        document.addEventListener('click', startAudio, { once: true })
        return () => document.removeEventListener('click', startAudio)
    }, [])

    useEffect(() => {
        bgMusic.volume = isMuted ? 0 : bgmVolume
    }, [bgmVolume, isMuted])

    return (
        <>
            <div className="bg-blobs" />
            <div className="min-h-screen relative z-10">

                {/* Bağımsız BGM Ses Kontrolü */}
                <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
                    {showVolumeSlider && (
                        <input
                            type="range"
                            min="0" max="1" step="0.05"
                            value={isMuted ? 0 : bgmVolume}
                            onChange={(e) => {
                                setBgmVolume(parseFloat(e.target.value))
                                if (parseFloat(e.target.value) > 0) setIsMuted(false)
                            }}
                            className="w-24 accent-purple-500 rounded-full bg-bg-card h-2"
                        />
                    )}
                    <button
                        onClick={() => {
                            if (showVolumeSlider) {
                                // Slider açıksa kapat veya duruma göre mute yap/kaldır
                                if (bgmVolume > 0) setIsMuted(!isMuted)
                            } else {
                                setShowVolumeSlider(true)
                            }
                        }}
                        onDoubleClick={() => setShowVolumeSlider(!showVolumeSlider)}
                        className="w-10 h-10 rounded-full bg-bg-card/80 backdrop-blur-md flex items-center justify-center text-purple-300 hover:text-white hover:bg-bg-card transition-all border border-white/5"
                    >
                        {isMuted || bgmVolume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    {showVolumeSlider && (
                        <button onClick={() => setShowVolumeSlider(false)} className="text-xs text-text-muted hover:text-white">&times;</button>
                    )}
                </div>

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
