import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCw, Eye, Lightbulb, Trophy, ArrowRight, Sparkles, RefreshCw, CheckCircle2, PenLine, ChevronRight } from 'lucide-react'
import WavelengthDial from './WavelengthDial'
import CARDS from '../data/cards'

// Oyun Fazları:
// 'setup'    -> Her oyuncu kartlarını teker teker görür, ipuçlarını yazar
// 'guess'    -> Diğerleri ibreyi döndürür + hazır butonuna basar
// 'reveal'   -> Hedef gösterilir, puan hesaplanır
// 'finished' -> Tüm turlar bitti, skor tablosu

export default function GameRoom({ network, playerName, playerAvatar, onBackToLobby }) {
    const [phase, setPhase] = useState('setup')
    const [card, setCard] = useState(null)
    const [targetAngle, setTargetAngle] = useState(90)
    const [dialAngle, setDialAngle] = useState(90)
    const [clue, setClue] = useState('')
    const [isPsychic, setIsPsychic] = useState(false)
    const [roundScore, setRoundScore] = useState(0)
    const [showScoreAnim, setShowScoreAnim] = useState(false)

    const [currentPsychic, setCurrentPsychic] = useState(null)
    const [turnIndex, setTurnIndex] = useState(0)
    const [totalTurns, setTotalTurns] = useState(0)
    const [readyPlayers, setReadyPlayers] = useState(new Set())
    const [isReady, setIsReady] = useState(false)
    const [moverInfo, setMoverInfo] = useState(null)
    const [allPlayers, setAllPlayers] = useState([])

    // Kişisel puanlama: { playerName: totalPoints }
    const [playerScores, setPlayerScores] = useState({})

    // Setup state'leri
    const [myCards, setMyCards] = useState([])
    const [setupClues, setSetupClues] = useState(['', ''])
    const [setupStep, setSetupStep] = useState(0) // 0 = Kart 1, 1 = Kart 2
    const [setupSubmitted, setSetupSubmitted] = useState(false)
    const [playersReady, setPlayersReady] = useState(new Set())

    const usedCardsRef = useRef(new Set())
    const throttleRef = useRef(null)
    const moverTimeoutRef = useRef(null)
    const turnScheduleRef = useRef([])
    const autoStartedRef = useRef(false)
    const allCluesRef = useRef({})

    // Hedef açısı üretimi: Tam skala (5-175 arası, neredeyse tüm alan)
    const randomTarget = () => Math.floor(Math.random() * 171) + 5

    // Benzersiz kart seç
    const pickUniqueCard = useCallback(() => {
        let availableCards = CARDS.filter((_, i) => !usedCardsRef.current.has(i))
        if (availableCards.length === 0) {
            usedCardsRef.current.clear()
            availableCards = CARDS
        }
        const randomIdx = Math.floor(Math.random() * availableCards.length)
        const cardIdx = CARDS.indexOf(availableCards[randomIdx])
        usedCardsRef.current.add(cardIdx)
        return { card: CARDS[cardIdx], cardIdx }
    }, [])

    // Oyunu başlat
    const startGame = useCallback(() => {
        const players = network.players
        if (players.length < 2) return

        usedCardsRef.current.clear()
        allCluesRef.current = {}

        const assignments = {}
        players.forEach(p => {
            const c1 = pickUniqueCard()
            const c2 = pickUniqueCard()
            assignments[p.name] = [
                { card: c1.card, cardIdx: c1.cardIdx, targetAngle: randomTarget() },
                { card: c2.card, cardIdx: c2.cardIdx, targetAngle: randomTarget() },
            ]
        })

        const pList = players.map(p => ({ name: p.name, avatar: p.avatar }))
        setAllPlayers(pList)
        setTotalTurns(players.length * 2)
        setPlayerScores(Object.fromEntries(pList.map(p => [p.name, 0])))
        setPlayersReady(new Set())
        setSetupSubmitted(false)
        setSetupStep(0)
        setPhase('setup')

        const mine = assignments[playerName]
        if (mine) {
            setMyCards(mine.map(c => ({ ...c, clue: '', hasRefresh: true })))
            setSetupClues(['', ''])
        }

        network.broadcast({
            type: 'game-init',
            assignments,
            totalTurns: players.length * 2,
            players: pList,
        })
    }, [network, playerName, pickUniqueCard])

    // Otomatik başlat (host)
    useEffect(() => {
        if (network.isHost && !autoStartedRef.current && network.players.length >= 2) {
            autoStartedRef.current = true
            setTimeout(() => startGame(), 300)
        }
    })

    // Tur programı oluştur ve başlat
    const buildAndStartTurns = useCallback((allClues, players) => {
        const schedule = []
        for (let cardIdx = 0; cardIdx < 2; cardIdx++) {
            for (let p = 0; p < players.length; p++) {
                const pName = players[p].name
                const pAvatar = players[p].avatar
                const clueData = allClues[pName]?.[cardIdx]
                if (clueData) {
                    schedule.push({
                        psychicName: pName,
                        psychicAvatar: pAvatar,
                        card: clueData.card,
                        targetAngle: clueData.targetAngle,
                        clue: clueData.clue,
                    })
                }
            }
        }

        turnScheduleRef.current = schedule
        setTurnIndex(0)

        if (schedule.length > 0) {
            const first = schedule[0]
            setCard(first.card)
            setTargetAngle(first.targetAngle)
            setClue(first.clue)
            setDialAngle(90)
            setPhase('guess')
            setIsPsychic(first.psychicName === playerName)
            setCurrentPsychic({ name: first.psychicName, avatar: first.psychicAvatar })
            setRoundScore(0)
            setShowScoreAnim(false)
            setReadyPlayers(new Set())
            setIsReady(false)
            setMoverInfo(null)
        }
    }, [playerName])

    // Tura geç
    const goToTurn = useCallback((index) => {
        const schedule = turnScheduleRef.current
        if (index >= schedule.length) {
            setPhase('finished')
            return
        }
        const turn = schedule[index]
        setCard(turn.card)
        setTargetAngle(turn.targetAngle)
        setClue(turn.clue)
        setDialAngle(90)
        setPhase('guess')
        setIsPsychic(turn.psychicName === playerName)
        setCurrentPsychic({ name: turn.psychicName, avatar: turn.psychicAvatar })
        setRoundScore(0)
        setShowScoreAnim(false)
        setReadyPlayers(new Set())
        setIsReady(false)
        setMoverInfo(null)
        setTurnIndex(index)
    }, [playerName])

    // Ağ mesajları
    useEffect(() => {
        network.onMessage((data) => {
            switch (data.type) {
                case 'player-joined': {
                    if (network.isHost) {
                        const existing = network.playersRef.current
                        if (!existing.some(p => p.name === data.name)) {
                            const updated = [...existing, { id: Date.now().toString(), name: data.name, avatar: data.avatar, isHost: false, connId: null }]
                            network.updatePlayers(updated)
                            network.broadcast({ type: 'player-list', players: updated.map(p => ({ name: p.name, avatar: p.avatar, isHost: p.isHost })) })
                        }
                    }
                    break
                }
                case 'player-list': {
                    if (!network.isHost) {
                        network.updatePlayers(data.players.map(p => ({ ...p, id: p.name, connId: null })))
                    }
                    break
                }
                case 'game-init': {
                    const mine = data.assignments[playerName]
                    setAllPlayers(data.players)
                    setTotalTurns(data.totalTurns)
                    setPlayerScores(Object.fromEntries(data.players.map(p => [p.name, 0])))
                    setPlayersReady(new Set())
                    setSetupSubmitted(false)
                    setSetupStep(0)
                    setPhase('setup')
                    if (mine) {
                        setMyCards(mine.map(c => ({ ...c, clue: '', hasRefresh: true })))
                        setSetupClues(['', ''])
                    }
                    break
                }
                case 'clues-submitted': {
                    setPlayersReady(prev => { const n = new Set(prev); n.add(data.playerName); return n })
                    if (network.isHost) allCluesRef.current[data.playerName] = data.clueData
                    break
                }
                case 'all-clues-ready': {
                    buildAndStartTurns(data.allClues, data.players)
                    break
                }
                case 'dial-move':
                    setDialAngle(data.angle)
                    setMoverInfo({ name: data.moverName, avatar: data.moverAvatar })
                    if (moverTimeoutRef.current) clearTimeout(moverTimeoutRef.current)
                    moverTimeoutRef.current = setTimeout(() => setMoverInfo(null), 2000)
                    break
                case 'player-ready': {
                    setReadyPlayers(prev => { const n = new Set(prev); n.add(data.playerName); return n })
                    break
                }
                case 'all-ready-reveal': {
                    setPhase('reveal')
                    setRoundScore(data.roundScore)
                    // Puanı medyuma yaz
                    setPlayerScores(prev => ({
                        ...prev,
                        [data.psychicName]: (prev[data.psychicName] || 0) + data.roundScore,
                    }))
                    setShowScoreAnim(true)
                    break
                }
                case 'next-turn': {
                    goToTurn(data.turnIndex)
                    break
                }
                case 'refresh-card': {
                    if (data.playerName === playerName) {
                        setMyCards(prev => {
                            const copy = [...prev]
                            copy[data.slotIndex] = { ...copy[data.slotIndex], card: data.newCard, targetAngle: data.newTarget, hasRefresh: false }
                            return copy
                        })
                    }
                    break
                }
                case 'restart-game': {
                    setPhase('setup')
                    setPlayerScores({})
                    setTurnIndex(0)
                    setCard(null)
                    setClue('')
                    usedCardsRef.current.clear()
                    turnScheduleRef.current = []
                    allCluesRef.current = {}
                    autoStartedRef.current = false
                    break
                }
                default: break
            }
        })
    }, [network, playerName, goToTurn, buildAndStartTurns])

    // Host: herkes hazır mı
    useEffect(() => {
        if (!network.isHost || phase !== 'guess') return
        const nonPsychic = allPlayers.filter(p => p.name !== currentPsychic?.name)
        const allReady = nonPsychic.length > 0 && nonPsychic.every(p => readyPlayers.has(p.name))
        if (allReady) {
            const diff = Math.abs(dialAngle - targetAngle)
            let pts = 0
            if (diff <= 8) pts = 4
            else if (diff <= 16) pts = 3
            else if (diff <= 24) pts = 2

            setPhase('reveal')
            setRoundScore(pts)
            // Puanı medyuma yaz
            setPlayerScores(prev => ({
                ...prev,
                [currentPsychic.name]: (prev[currentPsychic.name] || 0) + pts,
            }))
            setShowScoreAnim(true)
            network.broadcast({ type: 'all-ready-reveal', roundScore: pts, psychicName: currentPsychic.name })
        }
    }, [readyPlayers, network, phase, allPlayers, currentPsychic, dialAngle, targetAngle])

    // Host: tüm ipuçları gönderildi mi
    useEffect(() => {
        if (!network.isHost || phase !== 'setup') return
        if (allPlayers.length > 0 && allPlayers.every(p => playersReady.has(p.name))) {
            buildAndStartTurns(allCluesRef.current, allPlayers)
            network.broadcast({ type: 'all-clues-ready', allClues: allCluesRef.current, players: allPlayers })
        }
    }, [playersReady, network, phase, allPlayers, buildAndStartTurns])

    // Handlers
    const handleDialMove = useCallback((angle) => {
        setDialAngle(angle)
        if (throttleRef.current) return
        throttleRef.current = setTimeout(() => {
            network.broadcast({ type: 'dial-move', angle, moverName: playerName, moverAvatar: playerAvatar })
            throttleRef.current = null
        }, 30)
    }, [network, playerName, playerAvatar])

    const handleReady = () => {
        setIsReady(true)
        setReadyPlayers(prev => { const n = new Set(prev); n.add(playerName); return n })
        network.broadcast({ type: 'player-ready', playerName })
    }

    const handleSubmitClues = () => {
        if (!setupClues[0].trim() || !setupClues[1].trim()) return
        setSetupSubmitted(true)
        const clueData = myCards.map((c, i) => ({ card: c.card, targetAngle: c.targetAngle, clue: setupClues[i].trim() }))
        setPlayersReady(prev => { const n = new Set(prev); n.add(playerName); return n })
        if (network.isHost) allCluesRef.current[playerName] = clueData
        network.broadcast({ type: 'clues-submitted', playerName, clueData })
    }

    const handleRefreshCard = (slotIndex) => {
        if (!myCards[slotIndex].hasRefresh) return
        const { card: newCard, cardIdx } = pickUniqueCard()
        const newTarget = randomTarget()
        setMyCards(prev => {
            const copy = [...prev]
            copy[slotIndex] = { card: newCard, cardIdx, targetAngle: newTarget, clue: '', hasRefresh: false }
            return copy
        })
        setSetupClues(prev => { const c = [...prev]; c[slotIndex] = ''; return c })
        network.broadcast({ type: 'refresh-card', playerName, slotIndex, newCard, newCardIdx: cardIdx, newTarget })
    }

    const handleNextTurn = () => {
        const nextIdx = turnIndex + 1
        if (nextIdx >= totalTurns) {
            setPhase('finished')
            network.broadcast({ type: 'next-turn', turnIndex: nextIdx })
            return
        }
        goToTurn(nextIdx)
        network.broadcast({ type: 'next-turn', turnIndex: nextIdx })
    }

    const handleRestart = () => {
        if (network.isHost) {
            autoStartedRef.current = false
            allCluesRef.current = {}
            usedCardsRef.current.clear()
            turnScheduleRef.current = []
            network.broadcast({ type: 'restart-game' })
            setTimeout(() => startGame(), 500)
        }
    }

    // ═══════════════════ RENDER ═══════════════════

    // HAZIRLIK AŞAMASI — Adım adım kart gösterimi
    if (phase === 'setup') {
        const currentCard = myCards[setupStep]
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-strong rounded-3xl p-6 max-w-lg w-full"
                >
                    <div className="text-center mb-5">
                        <PenLine className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                        <h2 className="text-xl font-bold">İpuçlarını Hazırla</h2>
                        <p className="text-text-secondary text-sm mt-1">
                            Kart {setupStep + 1} / 2
                        </p>
                    </div>

                    {/* Adım göstergesi */}
                    <div className="flex justify-center gap-2 mb-4">
                        {[0, 1].map(i => (
                            <div
                                key={i}
                                className={`w-3 h-3 rounded-full transition-all ${i === setupStep ? 'bg-purple-400 scale-125' :
                                        i < setupStep ? 'bg-green-400' : 'bg-bg-card'
                                    }`}
                            />
                        ))}
                    </div>

                    {!setupSubmitted && currentCard && (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={setupStep}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.3 }}
                                className="glass rounded-2xl p-4 mb-4"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-text-muted">Kart {setupStep + 1}</span>
                                    {currentCard.hasRefresh && (
                                        <button
                                            onClick={() => handleRefreshCard(setupStep)}
                                            className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Yenile
                                        </button>
                                    )}
                                    {!currentCard.hasRefresh && (
                                        <span className="text-xs text-text-muted">Yenileme kullanıldı</span>
                                    )}
                                </div>

                                {/* Kadran — hedefi göster */}
                                <div className="mb-3">
                                    <WavelengthDial
                                        targetAngle={currentCard.targetAngle}
                                        dialAngle={90}
                                        showTarget={true}
                                        disabled={true}
                                        leftLabel={currentCard.card.left}
                                        rightLabel={currentCard.card.right}
                                    />
                                </div>

                                <input
                                    type="text"
                                    value={setupClues[setupStep]}
                                    onChange={(e) => {
                                        setSetupClues(prev => {
                                            const copy = [...prev]
                                            copy[setupStep] = e.target.value
                                            return copy
                                        })
                                    }}
                                    placeholder="İpucu yaz..."
                                    className="input-field text-center"
                                    maxLength={50}
                                />
                            </motion.div>
                        </AnimatePresence>
                    )}

                    {/* Butonlar */}
                    {!setupSubmitted && (
                        <>
                            {setupStep === 0 ? (
                                <button
                                    onClick={() => {
                                        if (!setupClues[0].trim()) return
                                        setSetupStep(1)
                                    }}
                                    disabled={!setupClues[0].trim()}
                                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
                                >
                                    Sonraki Karta Geç
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmitClues}
                                    disabled={!setupClues[1].trim()}
                                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                    İpuçlarını Onayla
                                </button>
                            )}
                        </>
                    )}

                    {setupSubmitted && (
                        <div className="text-center">
                            <div className="glass px-4 py-3 rounded-xl text-green-400 text-sm font-medium flex items-center justify-center gap-2 mb-3">
                                <CheckCircle2 className="w-4 h-4" />
                                İpuçların hazır! Diğerlerini bekliyoruz...
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {allPlayers.map((p, i) => (
                                    <div key={i} className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${playersReady.has(p.name) ? 'bg-green-600/30 text-green-300' : 'bg-bg-card text-text-muted'
                                        }`}>
                                        <span>{p.avatar}</span>
                                        <span>{p.name}</span>
                                        {playersReady.has(p.name) && <CheckCircle2 className="w-3 h-3" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        )
    }

    // OYUN SONU — Skor tablosu + Patlıcan
    if (phase === 'finished') {
        const sorted = [...allPlayers]
            .map(p => ({ ...p, score: playerScores[p.name] || 0 }))
            .sort((a, b) => b.score - a.score)

        const maxScore = sorted[0]?.score || 1
        const winner = sorted[0]

        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-strong rounded-3xl p-8 max-w-md w-full text-center"
                >
                    {/* Kazanan açıklaması */}
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="mb-4"
                    >
                        <p className="text-text-muted text-sm mb-1">🏆 Dalga boyu en büyük olan kişi:</p>
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-4xl">{winner?.avatar}</span>
                            <h2 className="text-3xl font-black bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                                {winner?.name}
                            </h2>
                        </div>
                    </motion.div>

                    {/* Skor tablosu */}
                    <div className="space-y-3 my-6">
                        {sorted.map((p, i) => {
                            const scale = p.score > 0 ? (p.score / maxScore) : 0.2
                            const eggplantSize = Math.max(1.5, scale * 5) // 1.5rem - 5rem arası
                            return (
                                <motion.div
                                    key={p.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.15 }}
                                    className="glass rounded-2xl p-3 flex items-center gap-3"
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-amber-500 text-black' :
                                            i === 1 ? 'bg-slate-400 text-black' :
                                                i === 2 ? 'bg-orange-700 text-white' :
                                                    'bg-bg-card text-text-muted'
                                        }`}>
                                        {i + 1}
                                    </div>
                                    <span className="text-xl">{p.avatar}</span>
                                    <span className="font-semibold text-sm flex-1 text-left">{p.name}</span>
                                    <span
                                        style={{ fontSize: `${eggplantSize}rem`, lineHeight: 1 }}
                                        className="transition-all"
                                    >
                                        🍆
                                    </span>
                                    <span className="font-black text-lg text-amber-300 min-w-[40px] text-right">
                                        {p.score}
                                    </span>
                                </motion.div>
                            )
                        })}
                    </div>

                    {network.isHost && (
                        <button onClick={handleRestart} className="btn-primary w-full flex items-center justify-center gap-2">
                            <RotateCw className="w-5 h-5" />
                            Tekrar Oyna
                        </button>
                    )}
                    {!network.isHost && (
                        <p className="text-text-secondary text-sm">Host tekrar oynamayı başlatabilir</p>
                    )}
                </motion.div>
            </div>
        )
    }

    // Kart yüklenmediyse
    if (!card) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center gap-3 text-text-secondary">
                    {[0, 1, 2].map(i => (
                        <motion.div key={i} className="w-3 h-3 bg-purple-400 rounded-full"
                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                    <span className="ml-2">Oyun hazırlanıyor...</span>
                </div>
            </div>
        )
    }

    const nonPsychicPlayers = allPlayers.filter(p => p.name !== currentPsychic?.name)
    const readyCount = nonPsychicPlayers.filter(p => readyPlayers.has(p.name)).length

    return (
        <div className="min-h-screen flex flex-col items-center px-4 py-4 md:py-6 pb-20">
            {/* Üst bilgi */}
            <div className="w-full max-w-lg flex items-center justify-between mb-3">
                <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-2">
                    <span className="text-xs text-text-muted">Tur</span>
                    <span className="text-sm font-bold text-purple-300">{turnIndex + 1}/{totalTurns}</span>
                </div>
                <div className="glass px-4 py-1.5 rounded-xl flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-amber-300">{playerScores[playerName] || 0}</span>
                    <span className="text-xs text-text-muted">senin puanın</span>
                </div>
            </div>

            {/* Medyum */}
            {currentPsychic && (
                <div className="glass px-4 py-2 rounded-2xl flex items-center gap-2 mb-3">
                    <span className="text-xl">{currentPsychic.avatar}</span>
                    <span className="font-semibold text-sm">{currentPsychic.name}</span>
                    <span className="text-xs text-text-muted">
                        {isPsychic ? '(Sen) — Medyum 🔮' : '— Medyum 🔮'}
                    </span>
                </div>
            )}

            {/* İpucu */}
            {clue && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="glass-strong rounded-2xl px-6 py-3 max-w-lg w-full mb-3 text-center">
                    <p className="text-2xl md:text-3xl font-black text-purple-200">&ldquo;{clue}&rdquo;</p>
                </motion.div>
            )}

            {/* Kadran */}
            <div className="w-full max-w-lg mb-3">
                <WavelengthDial
                    targetAngle={targetAngle}
                    dialAngle={dialAngle}
                    onAngleChange={handleDialMove}
                    showTarget={phase === 'reveal' || isPsychic}
                    disabled={phase === 'reveal' || isPsychic}
                    leftLabel={card.left}
                    rightLabel={card.right}
                    moverInfo={moverInfo}
                />
            </div>

            {/* Guess: Hazır butonu */}
            {phase === 'guess' && !isPsychic && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3 w-full max-w-lg">
                    {!isReady ? (
                        <button onClick={handleReady} className="btn-primary w-full max-w-xs flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-5 h-5" /> Hazırım!
                        </button>
                    ) : (
                        <div className="glass px-4 py-2 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Hazırsın! Diğerlerini bekliyoruz...
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {nonPsychicPlayers.map((p, i) => (
                            <div key={i} className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${readyPlayers.has(p.name) ? 'bg-green-600/30 text-green-300' : 'bg-bg-card text-text-muted'
                                }`}>
                                <span>{p.avatar}</span><span>{p.name}</span>
                                {readyPlayers.has(p.name) && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                        ))}
                    </div>
                    <p className="text-text-muted text-xs">{readyCount}/{nonPsychicPlayers.length} hazır</p>
                </motion.div>
            )}

            {/* Medyum bekliyor */}
            {phase === 'guess' && isPsychic && (
                <div className="text-center">
                    <p className="text-text-secondary text-sm mb-2">Takım ibreyi döndürüyor...</p>
                    <p className="text-text-muted text-xs">{readyCount}/{nonPsychicPlayers.length} hazır</p>
                </div>
            )}

            {/* Sonuç */}
            {phase === 'reveal' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4 w-full max-w-lg">
                    <AnimatePresence>
                        {showScoreAnim && (
                            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }} className="text-center">
                                <motion.div
                                    className={`text-6xl font-black mb-2 ${roundScore === 4 ? 'text-blue-400' :
                                            roundScore === 3 ? 'text-orange-400' :
                                                roundScore === 2 ? 'text-yellow-400' : 'text-red-400'
                                        }`}
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 0.5 }}>
                                    {roundScore === 4 && <Sparkles className="w-12 h-12 mx-auto mb-1 text-blue-400" />}
                                    +{roundScore}
                                </motion.div>
                                <p className="text-text-secondary text-sm">
                                    {roundScore === 4 ? 'Mükemmel! Tam isabet!' :
                                        roundScore === 3 ? 'Çok yakın!' :
                                            roundScore === 2 ? 'Fena değil!' : 'Kaçtı...'}
                                </p>
                                <p className="text-text-muted text-xs mt-1">
                                    Puan: {currentPsychic?.avatar} {currentPsychic?.name} → +{roundScore}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button onClick={handleNextTurn} className="btn-primary w-full max-w-xs flex items-center justify-center gap-2">
                        <RotateCw className="w-5 h-5" />
                        {turnIndex + 1 >= totalTurns ? 'Sonuçları Gör' : 'Sonraki Tur'}
                    </button>
                </motion.div>
            )}

            {/* Alt: Oyuncu çubuğu */}
            <div className="fixed bottom-0 left-0 right-0 bg-bg-primary/80 backdrop-blur-md border-t border-border py-2 px-4">
                <div className="flex justify-center gap-3 max-w-lg mx-auto overflow-x-auto">
                    {allPlayers.map((p, i) => (
                        <div key={i} className={`flex flex-col items-center gap-0.5 min-w-fit ${currentPsychic?.name === p.name ? 'opacity-100' : 'opacity-60'
                            }`}>
                            <span className="text-lg">{p.avatar}</span>
                            <span className="text-[10px] text-text-muted font-medium truncate max-w-[60px]">{p.name}</span>
                            {currentPsychic?.name === p.name && <span className="text-[8px] text-amber-400">🔮</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
