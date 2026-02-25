import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, Users, ArrowRight, Copy, Check, Radio, Plus, X } from 'lucide-react'
import AVATARS from '../data/avatars'
import { applyNameTrick } from '../utils/nameTricks'
import { bgMusic } from '../utils/sounds'

const PLAYER_COLORS = [
    '#EF4444', '#3B82F6', '#10B981', '#8B5CF6',
    '#EC4899', '#F59E0B', '#06B6D4', '#F97316',
]

export default function Lobby({ network, onGameStart }) {
    const [joinCode, setJoinCode] = useState('')
    const [playerName, setPlayerName] = useState('')
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])
    const [selectedColor, setSelectedColor] = useState(PLAYER_COLORS[3])
    const [mode, setMode] = useState(null)
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    // Özel kartlar
    const [customCards, setCustomCards] = useState([])
    const [newCardLeft, setNewCardLeft] = useState('')
    const [newCardRight, setNewCardRight] = useState('')

    const getDisplayName = (name) => applyNameTrick(name.trim())

    useEffect(() => {
        network.onMessage((data) => {
            if (data.type === 'player-joined' && network.isHost) {
                const existing = network.playersRef.current
                if (!existing.some(p => p.name === data.name)) {
                    const updated = [...existing, { id: Date.now().toString(), name: data.name, avatar: data.avatar, color: data.color, isHost: false, connId: null }]
                    network.updatePlayers(updated)
                    network.broadcast({ type: 'player-list', players: updated.map(p => ({ name: p.name, avatar: p.avatar, color: p.color, isHost: p.isHost })) })
                }
            }
            if (data.type === 'custom-card-add') {
                setCustomCards(prev => [...prev, data.card])
            }
            if (data.type === 'custom-cards-sync') {
                setCustomCards(data.cards)
            }
            if (data.type === 'game-start') {
                onGameStart(getDisplayName(playerName), selectedAvatar, selectedColor, data.customCards || [])
            }
        })
    }, [network, playerName, selectedAvatar, selectedColor, onGameStart])

    const handleHost = async () => {
        if (!playerName.trim()) return
        bgMusic.play().catch(e => console.log('BGM Autoplay engeli:', e))
        setLoading(true)
        try {
            await network.hostGame(getDisplayName(playerName), selectedAvatar)
            setMode('host')
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const handleJoin = async () => {
        if (!playerName.trim() || !joinCode.trim()) return
        bgMusic.play().catch(e => console.log('BGM Autoplay engeli:', e))
        setLoading(true)
        try {
            const displayName = getDisplayName(playerName)
            await network.joinGame(joinCode.trim(), displayName, selectedAvatar)
            setTimeout(() => {
                network.broadcast({ type: 'player-joined', name: displayName, avatar: selectedAvatar, color: selectedColor })
            }, 500)
            setMode('joined')
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const handleCopyCode = () => {
        navigator.clipboard.writeText(network.roomCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleAddCustomCard = () => {
        if (!newCardLeft.trim() || !newCardRight.trim()) return
        if (customCards.length >= 1) return // Sadece 1 özel kart
        const card = { left: newCardLeft.trim(), right: newCardRight.trim() }
        setCustomCards(prev => [...prev, card])
        network.broadcast({ type: 'custom-card-add', card })
        setNewCardLeft('')
        setNewCardRight('')
    }

    const handleRemoveCustomCard = (idx) => {
        setCustomCards(prev => prev.filter((_, i) => i !== idx))
    }

    const handleStartGame = () => {
        const displayName = getDisplayName(playerName)
        network.broadcast({ type: 'game-start', customCards, players: network.players.map(p => ({ name: p.name, avatar: p.avatar, color: p.color, isHost: p.isHost })) })
        onGameStart(displayName, selectedAvatar, selectedColor, customCards)
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative">
            {/* Arkaplan deseni — sadece giriş ekranı */}
            <div className="bg-lobby-pattern" />

            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-8 relative z-10">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <Radio className="w-10 h-10 text-purple-400 animate-float" />
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight">
                        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">Wave</span>
                        <span className="text-white">length</span>
                    </h1>
                </div>
                <p className="text-text-secondary text-lg">Kimin dalga boyu daha büyük?</p>
            </motion.div>

            <AnimatePresence mode="wait">

                {!mode && (
                    <motion.div key="start" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-strong rounded-3xl p-8 max-w-md w-full">
                        <div className="mb-5">
                            <label className="text-text-secondary text-sm font-medium mb-2 block">İsmin</label>
                            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="İsmini gir..." className="input-field text-center text-lg" maxLength={20} />
                        </div>

                        <div className="mb-4">
                            <label className="text-text-secondary text-sm font-medium mb-2 block">Avatarını Seç</label>
                            <div className="grid grid-cols-8 gap-2">
                                {AVATARS.map((av) => (
                                    <button key={av} onClick={() => setSelectedAvatar(av)}
                                        className={`text-2xl p-1.5 rounded-xl transition-all duration-200 ${selectedAvatar === av ? 'bg-purple-600/50 ring-2 ring-purple-400 scale-110' : 'bg-bg-card hover:bg-bg-card-hover'}`}>
                                        {av}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Renk seçimi */}
                        <div className="mb-5">
                            <label className="text-text-secondary text-sm font-medium mb-2 block">Rengini Seç</label>
                            <div className="flex gap-2 justify-center">
                                {PLAYER_COLORS.map(c => (
                                    <button key={c} onClick={() => setSelectedColor(c)}
                                        className={`w-8 h-8 rounded-full transition-all duration-200 ${selectedColor === c ? 'ring-2 ring-white scale-125' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button onClick={handleHost} disabled={!playerName.trim() || loading} className="btn-primary w-full flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed">
                                <Wifi className="w-5 h-5" /> Oda Kur
                            </button>
                            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-border" /><span className="text-text-muted text-sm">veya</span><div className="flex-1 h-px bg-border" /></div>
                            <div className="flex gap-2">
                                <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ODA KODU" className="input-field text-center tracking-[0.3em] font-bold uppercase" maxLength={4} />
                                <button onClick={handleJoin} disabled={!playerName.trim() || joinCode.length < 4 || loading} className="btn-secondary flex items-center gap-2 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                                    <ArrowRight className="w-5 h-5" /> Katıl
                                </button>
                            </div>
                        </div>
                        {network.error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-danger text-sm text-center bg-red-500/10 p-3 rounded-xl">{network.error}</motion.p>}
                    </motion.div>
                )}

                {mode === 'host' && (
                    <motion.div key="host" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-strong rounded-3xl p-8 max-w-md w-full text-center">
                        <div className="mb-6">
                            <p className="text-text-secondary text-sm mb-3">Oda Kodun</p>
                            <div className="flex items-center justify-center gap-3">
                                <div className="text-5xl font-black tracking-[0.4em] text-purple-300 animate-pulse-glow bg-bg-card px-6 py-4 rounded-2xl">{network.roomCode}</div>
                                <button onClick={handleCopyCode} className="p-3 rounded-xl bg-bg-card hover:bg-bg-card-hover transition-colors">
                                    {copied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5 text-text-secondary" />}
                                </button>
                            </div>
                            <p className="text-text-muted text-sm mt-3">Bu kodu arkadaşlarınla paylaş</p>
                        </div>

                        {/* Oyuncu listesi */}
                        <div className="mb-4">
                            <div className="flex items-center justify-center gap-2 text-text-secondary mb-3">
                                <Users className="w-5 h-5" />
                                <span className="font-semibold text-lg">{network.playerCount}</span>
                                <span className="text-sm">oyuncu bağlı</span>
                            </div>
                            <div className="flex flex-wrap justify-center gap-3">
                                {network.players.map((p, i) => (
                                    <div key={i} className="glass px-3 py-2 rounded-xl flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || '#8B5CF6' }} />
                                        <span className="text-xl">{p.avatar}</span>
                                        <span className="text-sm font-medium">{p.name}</span>
                                        {p.isHost && <span className="text-xs bg-purple-600/40 px-1.5 py-0.5 rounded-md text-purple-300">Host</span>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Özel kart ekleme — max 1 */}
                        <div className="glass rounded-2xl p-4 mb-4 text-left">
                            <p className="text-text-secondary text-xs font-semibold mb-2">✏️ Özel Kart Ekle (1 Hak)</p>
                            {customCards.length === 0 ? (
                                <div className="flex gap-2">
                                    <input type="text" value={newCardLeft} onChange={e => setNewCardLeft(e.target.value)} placeholder="Sol etiket" className="input-field text-xs !py-2 !px-2" maxLength={30} />
                                    <input type="text" value={newCardRight} onChange={e => setNewCardRight(e.target.value)} placeholder="Sağ etiket" className="input-field text-xs !py-2 !px-2" maxLength={30} />
                                    <button onClick={handleAddCustomCard} disabled={!newCardLeft.trim() || !newCardRight.trim()} className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-3 disabled:opacity-30 transition-colors">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between bg-bg-card rounded-lg px-2 py-1 text-xs mb-1">
                                        <span className="text-blue-300">{customCards[0].left}</span>
                                        <span className="text-text-muted">↔</span>
                                        <span className="text-amber-300">{customCards[0].right}</span>
                                        <button onClick={() => handleRemoveCustomCard(0)} className="text-text-muted hover:text-red-400 ml-1"><X className="w-3 h-3" /></button>
                                    </div>
                                    <p className="text-text-muted text-[10px]">✅ Özel kart eklendi</p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-center gap-1 mb-4">
                            {[0, 1, 2].map(i => <motion.div key={i} className="w-2 h-2 bg-purple-400 rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }} />)}
                            <span className="text-text-muted text-sm ml-2">Oyuncular bekleniyor...</span>
                        </div>

                        <button onClick={handleStartGame} disabled={network.playerCount < 2} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
                            {network.playerCount < 2 ? 'En az 2 oyuncu gerekli' : `Oyunu Başlat (${network.playerCount} oyuncu)`}
                        </button>
                    </motion.div>
                )}

                {mode === 'joined' && (
                    <motion.div key="joined" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-strong rounded-3xl p-8 max-w-md w-full text-center">
                        <div className="text-4xl mb-4">{selectedAvatar}</div>
                        <h2 className="text-xl font-bold mb-2">{getDisplayName(playerName)}</h2>
                        <p className="text-text-secondary text-sm mb-6">Odaya katıldın! Host oyunu başlatmayı bekliyor...</p>
                        <div className="flex items-center justify-center gap-2">
                            {[0, 1, 2].map(i => <motion.div key={i} className="w-2 h-2 bg-purple-400 rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }} />)}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-text-muted text-xs mt-8 text-center relative z-10">
                Peer-to-Peer bağlantı ile sunucusuz oynayın
            </motion.p>
        </div>
    )
}
