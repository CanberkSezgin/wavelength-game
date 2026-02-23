import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, Users, ArrowRight, Copy, Check, Radio } from 'lucide-react'
import AVATARS from '../data/avatars'
import { applyNameTrick } from '../utils/nameTricks'

export default function Lobby({ network, onGameStart }) {
    const [joinCode, setJoinCode] = useState('')
    const [playerName, setPlayerName] = useState('')
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])
    const [mode, setMode] = useState(null) // null, 'host', 'join'
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    const getDisplayName = (name) => applyNameTrick(name.trim())

    const handleHost = async () => {
        if (!playerName.trim()) return
        setLoading(true)
        try {
            const displayName = getDisplayName(playerName)
            await network.hostGame(displayName, selectedAvatar)
            setMode('host')
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const handleJoin = async () => {
        if (!playerName.trim() || !joinCode.trim()) return
        setLoading(true)
        try {
            const displayName = getDisplayName(playerName)
            await network.joinGame(joinCode.trim(), displayName, selectedAvatar)
            // Katıldığımızı host'a bildir
            setTimeout(() => {
                network.broadcast({
                    type: 'player-joined',
                    name: displayName,
                    avatar: selectedAvatar,
                })
                onGameStart(displayName, selectedAvatar)
            }, 500)
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const handleCopyCode = () => {
        navigator.clipboard.writeText(network.roomCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleStartGame = () => {
        const displayName = getDisplayName(playerName)
        network.broadcast({ type: 'game-start' })
        onGameStart(displayName, selectedAvatar)
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
            {/* Logo & Başlık */}
            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="text-center mb-8"
            >
                <div className="flex items-center justify-center gap-3 mb-4">
                    <Radio className="w-10 h-10 text-purple-400 animate-float" />
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight">
                        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                            Wave
                        </span>
                        <span className="text-white">length</span>
                    </h1>
                </div>
                <p className="text-text-secondary text-lg">
                    Arkadaşlarınla aynı dalga boyunda mısın?
                </p>
            </motion.div>

            <AnimatePresence mode="wait">
                {/* İsim + Avatar Girişi ve Mod Seçimi */}
                {!mode && (
                    <motion.div
                        key="start"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                        className="glass-strong rounded-3xl p-8 max-w-md w-full"
                    >
                        {/* İsim */}
                        <div className="mb-5">
                            <label className="text-text-secondary text-sm font-medium mb-2 block">
                                İsmin
                            </label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="İsmini gir..."
                                className="input-field text-center text-lg"
                                maxLength={20}
                            />
                        </div>

                        {/* Avatar Seçimi */}
                        <div className="mb-5">
                            <label className="text-text-secondary text-sm font-medium mb-2 block">
                                Avatarını Seç
                            </label>
                            <div className="grid grid-cols-8 gap-2">
                                {AVATARS.map((av) => (
                                    <button
                                        key={av}
                                        onClick={() => setSelectedAvatar(av)}
                                        className={`text-2xl p-1.5 rounded-xl transition-all duration-200 ${selectedAvatar === av
                                                ? 'bg-purple-600/50 ring-2 ring-purple-400 scale-110'
                                                : 'bg-bg-card hover:bg-bg-card-hover'
                                            }`}
                                    >
                                        {av}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handleHost}
                                disabled={!playerName.trim() || loading}
                                className="btn-primary w-full flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Wifi className="w-5 h-5" />
                                Oda Kur
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-text-muted text-sm">veya</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    placeholder="ODA KODU"
                                    className="input-field text-center tracking-[0.3em] font-bold uppercase"
                                    maxLength={4}
                                />
                                <button
                                    onClick={handleJoin}
                                    disabled={!playerName.trim() || joinCode.length < 4 || loading}
                                    className="btn-secondary flex items-center gap-2 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ArrowRight className="w-5 h-5" />
                                    Katıl
                                </button>
                            </div>
                        </div>

                        {network.error && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-4 text-danger text-sm text-center bg-red-500/10 p-3 rounded-xl"
                            >
                                {network.error}
                            </motion.p>
                        )}
                    </motion.div>
                )}

                {/* Host Bekleme Ekranı */}
                {mode === 'host' && (
                    <motion.div
                        key="host-waiting"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                        className="glass-strong rounded-3xl p-8 max-w-md w-full text-center"
                    >
                        <div className="mb-6">
                            <p className="text-text-secondary text-sm mb-3">Oda Kodun</p>
                            <div className="flex items-center justify-center gap-3">
                                <div className="text-5xl font-black tracking-[0.4em] text-purple-300 animate-pulse-glow bg-bg-card px-6 py-4 rounded-2xl">
                                    {network.roomCode}
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="p-3 rounded-xl bg-bg-card hover:bg-bg-card-hover transition-colors"
                                    title="Kodu kopyala"
                                >
                                    {copied ? (
                                        <Check className="w-5 h-5 text-success" />
                                    ) : (
                                        <Copy className="w-5 h-5 text-text-secondary" />
                                    )}
                                </button>
                            </div>
                            <p className="text-text-muted text-sm mt-3">
                                Bu kodu arkadaşlarınla paylaş
                            </p>
                        </div>

                        {/* Oyuncu Listesi */}
                        <div className="mb-6">
                            <div className="flex items-center justify-center gap-2 text-text-secondary mb-3">
                                <Users className="w-5 h-5" />
                                <span className="font-semibold text-lg">{network.playerCount}</span>
                                <span className="text-sm">oyuncu bağlı</span>
                            </div>

                            <div className="flex flex-wrap justify-center gap-3">
                                {network.players.map((p, i) => (
                                    <div
                                        key={i}
                                        className="glass px-3 py-2 rounded-xl flex items-center gap-2"
                                    >
                                        <span className="text-xl">{p.avatar}</span>
                                        <span className="text-sm font-medium">{p.name}</span>
                                        {p.isHost && (
                                            <span className="text-xs bg-purple-600/40 px-1.5 py-0.5 rounded-md text-purple-300">
                                                Host
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bağlanan oyuncular beklenirken animasyonlu nokta */}
                        <div className="flex items-center justify-center gap-1 mb-6">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 bg-purple-400 rounded-full"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                                />
                            ))}
                            <span className="text-text-muted text-sm ml-2">Oyuncular bekleniyor...</span>
                        </div>

                        <button
                            onClick={handleStartGame}
                            disabled={network.playerCount < 2}
                            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {network.playerCount < 2
                                ? 'En az 2 oyuncu gerekli'
                                : `Oyunu Başlat (${network.playerCount} oyuncu)`
                            }
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Alt Bilgi */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-text-muted text-xs mt-8 text-center"
            >
                Peer-to-Peer bağlantı ile sunucusuz oynayın
            </motion.p>
        </div>
    )
}
