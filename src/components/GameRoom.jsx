import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCw, Eye, Lightbulb, Trophy, Users, ArrowRight, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react'
import WavelengthDial from './WavelengthDial'
import CARDS from '../data/cards'

// Oyun Fazları:
// 'waiting'  -> Oyuncular bağlandı, host başlatmayı bekliyor
// 'clue'     -> Medyum ipucu yazar
// 'guess'    -> Diğerleri ibreyi döndürür + hazır butonuna basar
// 'reveal'   -> Hedef gösterilir, puan hesaplanır
// 'finished' -> Tüm turlar bitti, oyun sonu ekranı

export default function GameRoom({ network, playerName, playerAvatar, onBackToLobby }) {
    const [phase, setPhase] = useState('waiting')
    const [card, setCard] = useState(null)
    const [targetAngle, setTargetAngle] = useState(90)
    const [dialAngle, setDialAngle] = useState(90)
    const [clue, setClue] = useState('')
    const [clueInput, setClueInput] = useState('')
    const [isPsychic, setIsPsychic] = useState(false)
    const [score, setScore] = useState(0)
    const [roundScore, setRoundScore] = useState(0)
    const [showScoreAnim, setShowScoreAnim] = useState(false)

    // Yeni state'ler
    const [currentPsychic, setCurrentPsychic] = useState(null) // { name, avatar }
    const [turnIndex, setTurnIndex] = useState(0) // Toplam tur indeksi
    const [totalTurns, setTotalTurns] = useState(0) // Toplam tur sayısı
    const [readyPlayers, setReadyPlayers] = useState(new Set())
    const [isReady, setIsReady] = useState(false)
    const [moverInfo, setMoverInfo] = useState(null) // { name, avatar } - çubuğu hareket ettiren
    const [hasRefresh, setHasRefresh] = useState(true) // Yenileme hakkı
    const [allPlayers, setAllPlayers] = useState([]) // Tüm oyuncular { name, avatar }
    const [totalScore, setTotalScore] = useState(0)

    const usedCardsRef = useRef(new Set())
    const throttleRef = useRef(null)
    const moverTimeoutRef = useRef(null)
    const turnScheduleRef = useRef([]) // Her tur için: { psychicName, psychicAvatar, cardIdx, targetAngle }

    // Host mount olduğunda otomatik başlat
    const autoStartedRef = useRef(false)
    useEffect(() => {
        if (network.isHost && !autoStartedRef.current && network.players.length >= 2) {
            autoStartedRef.current = true
            // Küçük bir gecikme ile başlat (state'lerin oturmasını bekle)
            setTimeout(() => startGame(), 300)
        }
    }) // Her render'da kontrol et

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

    // Oyunu başlat (host tarafından çağrılır)
    const startGame = useCallback(() => {
        const players = network.players
        if (players.length < 2) return

        // Her oyuncuya 2 tur: toplam = oyuncu sayısı × 2
        const total = players.length * 2
        const schedule = []
        usedCardsRef.current.clear()

        // Her oyuncuya 2 tur dağıt
        for (let round = 0; round < 2; round++) {
            for (let i = 0; i < players.length; i++) {
                const { card: c, cardIdx } = pickUniqueCard()
                const target = Math.floor(Math.random() * 140) + 20 // 20-160 arası
                schedule.push({
                    psychicName: players[i].name,
                    psychicAvatar: players[i].avatar,
                    card: c,
                    cardIdx,
                    targetAngle: target,
                })
            }
        }

        turnScheduleRef.current = schedule

        // İlk turu başlat
        const firstTurn = schedule[0]
        setTotalTurns(total)
        setTurnIndex(0)
        setScore(0)
        setTotalScore(0)

        setCard(firstTurn.card)
        setTargetAngle(firstTurn.targetAngle)
        setDialAngle(90)
        setClue('')
        setClueInput('')
        setPhase('clue')
        setIsPsychic(firstTurn.psychicName === playerName)
        setCurrentPsychic({ name: firstTurn.psychicName, avatar: firstTurn.psychicAvatar })
        setRoundScore(0)
        setShowScoreAnim(false)
        setReadyPlayers(new Set())
        setIsReady(false)
        setHasRefresh(true)
        setAllPlayers(players.map(p => ({ name: p.name, avatar: p.avatar })))

        // Broadcast
        network.broadcast({
            type: 'game-init',
            schedule: schedule,
            totalTurns: total,
            players: players.map(p => ({ name: p.name, avatar: p.avatar })),
        })
    }, [network, playerName, pickUniqueCard])

    // Belirli bir tura geç
    const goToTurn = useCallback((index, schedule, players) => {
        if (index >= schedule.length) {
            // Oyun bitti
            setPhase('finished')
            return
        }

        const turn = schedule[index]
        setCard(turn.card)
        setTargetAngle(turn.targetAngle)
        setDialAngle(90)
        setClue('')
        setClueInput('')
        setPhase('clue')
        setIsPsychic(turn.psychicName === playerName)
        setCurrentPsychic({ name: turn.psychicName, avatar: turn.psychicAvatar })
        setRoundScore(0)
        setShowScoreAnim(false)
        setReadyPlayers(new Set())
        setIsReady(false)
        setHasRefresh(true)
        setMoverInfo(null)
        setTurnIndex(index)
    }, [playerName])

    // Ağdan gelen mesajları dinle
    useEffect(() => {
        network.onMessage((data) => {
            switch (data.type) {
                case 'player-joined': {
                    // Host, gelen oyuncuyu listeye ekle
                    if (network.isHost) {
                        const existing = network.playersRef.current
                        const alreadyExists = existing.some(p => p.name === data.name)
                        if (!alreadyExists) {
                            const updated = [...existing, {
                                id: Date.now().toString(),
                                name: data.name,
                                avatar: data.avatar,
                                isHost: false,
                                connId: null,
                            }]
                            network.updatePlayers(updated)
                            // Güncel listeyi herkese gönder
                            network.broadcast({
                                type: 'player-list',
                                players: updated.map(p => ({ name: p.name, avatar: p.avatar, isHost: p.isHost })),
                            })
                        }
                    }
                    break
                }

                case 'player-list': {
                    // Misafir oyuncu listesini günceller
                    if (!network.isHost) {
                        network.updatePlayers(data.players.map(p => ({
                            ...p,
                            id: p.name,
                            connId: null,
                        })))
                    }
                    break
                }

                case 'game-start':
                    // Host başlattığında misafirler de oyuna geçer (App.jsx'te handle ediliyor)
                    break

                case 'game-init': {
                    // Misafirler oyun başlangıç bilgilerini alır
                    turnScheduleRef.current = data.schedule
                    setTotalTurns(data.totalTurns)
                    setTurnIndex(0)
                    setScore(0)
                    setTotalScore(0)
                    setAllPlayers(data.players)

                    const firstTurn = data.schedule[0]
                    setCard(firstTurn.card)
                    setTargetAngle(firstTurn.targetAngle)
                    setDialAngle(90)
                    setClue('')
                    setClueInput('')
                    setPhase('clue')
                    setIsPsychic(firstTurn.psychicName === playerName)
                    setCurrentPsychic({ name: firstTurn.psychicName, avatar: firstTurn.psychicAvatar })
                    setRoundScore(0)
                    setShowScoreAnim(false)
                    setReadyPlayers(new Set())
                    setIsReady(false)
                    setHasRefresh(true)
                    break
                }

                case 'clue-submitted':
                    setClue(data.clue)
                    setPhase('guess')
                    break

                case 'dial-move':
                    setDialAngle(data.angle)
                    setMoverInfo({ name: data.moverName, avatar: data.moverAvatar })
                    // 2 saniye sonra mover bilgisini temizle
                    if (moverTimeoutRef.current) clearTimeout(moverTimeoutRef.current)
                    moverTimeoutRef.current = setTimeout(() => setMoverInfo(null), 2000)
                    break

                case 'player-ready': {
                    setReadyPlayers(prev => {
                        const next = new Set(prev)
                        next.add(data.playerName)
                        return next
                    })
                    break
                }

                case 'all-ready-reveal': {
                    setPhase('reveal')
                    setRoundScore(data.roundScore)
                    setScore(prev => prev + data.roundScore)
                    setTotalScore(prev => prev + data.roundScore)
                    setShowScoreAnim(true)
                    break
                }

                case 'next-turn': {
                    goToTurn(data.turnIndex, turnScheduleRef.current, allPlayers)
                    break
                }

                case 'refresh-card': {
                    // Kart yenilendi
                    const schedule = turnScheduleRef.current
                    schedule[data.turnIndex] = {
                        ...schedule[data.turnIndex],
                        card: data.newCard,
                        cardIdx: data.newCardIdx,
                        targetAngle: data.newTarget,
                    }
                    turnScheduleRef.current = schedule
                    setCard(data.newCard)
                    setTargetAngle(data.newTarget)
                    break
                }

                case 'restart-game': {
                    setPhase('waiting')
                    setScore(0)
                    setTotalScore(0)
                    setTurnIndex(0)
                    setCard(null)
                    setClue('')
                    usedCardsRef.current.clear()
                    turnScheduleRef.current = []
                    break
                }

                default:
                    break
            }
        })
    }, [network, playerName, goToTurn, allPlayers])

    // Host: Herkes hazır mı kontrol et
    useEffect(() => {
        if (!network.isHost || phase !== 'guess') return

        const nonPsychicPlayers = allPlayers.filter(p => p.name !== currentPsychic?.name)
        const allReady = nonPsychicPlayers.length > 0 &&
            nonPsychicPlayers.every(p => readyPlayers.has(p.name))

        if (allReady) {
            // Puan hesapla
            const diff = Math.abs(dialAngle - targetAngle)
            let pts = 0
            if (diff <= 8) pts = 4
            else if (diff <= 16) pts = 3
            else if (diff <= 24) pts = 2
            else pts = 0

            setPhase('reveal')
            setRoundScore(pts)
            setScore(prev => prev + pts)
            setTotalScore(prev => prev + pts)
            setShowScoreAnim(true)

            network.broadcast({ type: 'all-ready-reveal', roundScore: pts })
        }
    }, [readyPlayers, network, phase, allPlayers, currentPsychic, dialAngle, targetAngle])

    // İpucu gönder
    const submitClue = () => {
        if (!clueInput.trim()) return
        setClue(clueInput.trim())
        setPhase('guess')
        network.broadcast({ type: 'clue-submitted', clue: clueInput.trim() })
    }

    // İbre hareket -> broadcast
    const handleDialMove = useCallback((angle) => {
        setDialAngle(angle)
        if (throttleRef.current) return
        throttleRef.current = setTimeout(() => {
            network.broadcast({
                type: 'dial-move',
                angle,
                moverName: playerName,
                moverAvatar: playerAvatar,
            })
            throttleRef.current = null
        }, 30)
    }, [network, playerName, playerAvatar])

    // Hazır butonu
    const handleReady = () => {
        setIsReady(true)
        setReadyPlayers(prev => {
            const next = new Set(prev)
            next.add(playerName)
            return next
        })
        network.broadcast({ type: 'player-ready', playerName })
    }

    // Kart yenileme
    const handleRefresh = () => {
        if (!hasRefresh || !isPsychic) return
        setHasRefresh(false)

        const { card: newCard, cardIdx } = pickUniqueCard()
        const newTarget = Math.floor(Math.random() * 140) + 20

        const schedule = turnScheduleRef.current
        schedule[turnIndex] = {
            ...schedule[turnIndex],
            card: newCard,
            cardIdx,
            targetAngle: newTarget,
        }
        turnScheduleRef.current = schedule

        setCard(newCard)
        setTargetAngle(newTarget)

        network.broadcast({
            type: 'refresh-card',
            turnIndex,
            newCard,
            newCardIdx: cardIdx,
            newTarget,
        })
    }

    // Sonraki tur
    const handleNextTurn = () => {
        const nextIdx = turnIndex + 1
        if (nextIdx >= totalTurns) {
            setPhase('finished')
            network.broadcast({ type: 'next-turn', turnIndex: nextIdx })
            return
        }
        goToTurn(nextIdx, turnScheduleRef.current, allPlayers)
        network.broadcast({ type: 'next-turn', turnIndex: nextIdx })
    }

    // Tekrar oyna
    const handleRestart = () => {
        if (network.isHost) {
            setPhase('waiting')
            setScore(0)
            setTotalScore(0)
            setTurnIndex(0)
            setCard(null)
            setClue('')
            usedCardsRef.current.clear()
            turnScheduleRef.current = []
            network.broadcast({ type: 'restart-game' })
        }
    }

    // Host: oyunu başlat
    const handleHostStart = () => {
        startGame()
    }

    // Puan skalası
    const getScoreRating = (s) => {
        if (s >= totalTurns * 4 * 0.75) return { text: '🏆 EFSANE!', color: 'text-yellow-400' }
        if (s >= totalTurns * 4 * 0.5) return { text: '🌟 Harika!', color: 'text-green-400' }
        if (s >= totalTurns * 4 * 0.3) return { text: '👍 İyi!', color: 'text-blue-400' }
        return { text: '💪 Geliştirilmeli', color: 'text-orange-400' }
    }

    // --- RENDER ---

    // Bekleme ekranı (host oyunu başlatmadı)
    if (phase === 'waiting') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
                <div className="glass-strong rounded-3xl p-8 max-w-md w-full text-center">
                    <h2 className="text-2xl font-bold mb-4">Oyun Odası</h2>

                    {/* Oyuncu listesi */}
                    <div className="mb-6">
                        <p className="text-text-secondary text-sm mb-3">Oyuncular</p>
                        <div className="flex flex-wrap justify-center gap-3">
                            {network.players.map((p, i) => (
                                <div key={i} className="glass px-3 py-2 rounded-xl flex items-center gap-2">
                                    <span className="text-xl">{p.avatar}</span>
                                    <span className="text-sm font-medium">{p.name}</span>
                                    {p.isHost && (
                                        <span className="text-xs bg-purple-600/40 px-1.5 py-0.5 rounded-md text-purple-300">Host</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {network.isHost ? (
                        <button
                            onClick={handleHostStart}
                            disabled={network.playerCount < 2}
                            className="btn-primary w-full disabled:opacity-40"
                        >
                            {network.playerCount < 2 ? 'En az 2 oyuncu gerekli' : `Oyunu Başlat 🚀`}
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-2 text-text-secondary">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 bg-purple-400 rounded-full"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                                />
                            ))}
                            <span className="text-sm ml-2">Host oyunu başlatmayı bekliyor...</span>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Oyun sonu ekranı
    if (phase === 'finished') {
        const rating = getScoreRating(totalScore)
        const maxScore = totalTurns * 4
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-strong rounded-3xl p-8 max-w-md w-full text-center"
                >
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-6xl mb-4"
                    >
                        🎉
                    </motion.div>
                    <h2 className="text-3xl font-black mb-2">Oyun Bitti!</h2>

                    <div className="my-6">
                        <p className="text-text-muted text-sm mb-2">Toplam Puan</p>
                        <motion.div
                            className="text-7xl font-black text-amber-400"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10 }}
                        >
                            {totalScore}
                        </motion.div>
                        <p className="text-text-muted text-sm mt-1">/ {maxScore}</p>
                    </div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className={`text-2xl font-bold mb-6 ${rating.color}`}
                    >
                        {rating.text}
                    </motion.p>

                    {/* Oyuncu listesi */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                        {allPlayers.map((p, i) => (
                            <div key={i} className="glass px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                <span className="text-lg">{p.avatar}</span>
                                <span className="text-xs font-medium">{p.name}</span>
                            </div>
                        ))}
                    </div>

                    {network.isHost && (
                        <button
                            onClick={handleRestart}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
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
                        <motion.div
                            key={i}
                            className="w-3 h-3 bg-purple-400 rounded-full"
                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                    ))}
                    <span className="ml-2">Oyun hazırlanıyor...</span>
                </div>
            </div>
        )
    }

    // Hazır olan oyuncu sayısı
    const nonPsychicPlayers = allPlayers.filter(p => p.name !== currentPsychic?.name)
    const readyCount = nonPsychicPlayers.filter(p => readyPlayers.has(p.name)).length

    return (
        <div className="min-h-screen flex flex-col items-center px-4 py-4 md:py-6">
            {/* Üst Bilgi Çubuğu */}
            <div className="w-full max-w-lg flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <span className="text-xs text-text-muted">Tur</span>
                        <span className="text-sm font-bold text-purple-300">{turnIndex + 1}/{totalTurns}</span>
                    </div>
                </div>
                <div className="glass px-4 py-1.5 rounded-xl flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-amber-300">{score}</span>
                    <span className="text-xs text-text-muted">puan</span>
                </div>
            </div>

            {/* Medyum bilgisi */}
            {currentPsychic && (
                <div className="glass px-4 py-2 rounded-2xl flex items-center gap-2 mb-3">
                    <span className="text-xl">{currentPsychic.avatar}</span>
                    <span className="font-semibold text-sm">{currentPsychic.name}</span>
                    <span className="text-xs text-text-muted">
                        {isPsychic ? '(Sen) — Medyum' : '— Medyum'}
                    </span>
                </div>
            )}

            {/* Faz Göstergesi */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-3"
                >
                    {phase === 'clue' && (
                        <div className="glass px-5 py-2 rounded-2xl flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-amber-400" />
                            <span className="font-semibold text-sm">
                                {isPsychic ? 'İpucu Yaz!' : `${currentPsychic?.name} ipucu yazıyor...`}
                            </span>
                        </div>
                    )}
                    {phase === 'guess' && (
                        <div className="glass px-5 py-2 rounded-2xl flex items-center gap-2">
                            <RotateCw className="w-5 h-5 text-blue-400" />
                            <span className="font-semibold text-sm">İbreyi Döndür!</span>
                        </div>
                    )}
                    {phase === 'reveal' && (
                        <div className="glass px-5 py-2 rounded-2xl flex items-center gap-2">
                            <Eye className="w-5 h-5 text-green-400" />
                            <span className="font-semibold text-sm">Sonuç!</span>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* İpucu Alanı - Medyum */}
            {phase === 'clue' && isPsychic && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-strong rounded-2xl p-4 max-w-lg w-full mb-3"
                >
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={clueInput}
                            onChange={(e) => setClueInput(e.target.value)}
                            placeholder="İpucu yaz..."
                            className="input-field"
                            maxLength={50}
                            onKeyDown={(e) => e.key === 'Enter' && submitClue()}
                        />
                        <button
                            onClick={submitClue}
                            disabled={!clueInput.trim()}
                            className="btn-primary whitespace-nowrap disabled:opacity-40 px-4"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                    {hasRefresh && (
                        <button
                            onClick={handleRefresh}
                            className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Soruyu Yenile (1 Hak)
                        </button>
                    )}
                </motion.div>
            )}

            {phase === 'clue' && !isPsychic && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="glass rounded-2xl p-4 max-w-lg w-full mb-3 text-center"
                >
                    <div className="flex items-center justify-center gap-2">
                        {[0, 1, 2].map(i => (
                            <motion.div
                                key={i}
                                className="w-2 h-2 bg-amber-400 rounded-full"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                            />
                        ))}
                    </div>
                    <p className="text-text-secondary text-sm mt-2">
                        {currentPsychic?.avatar} {currentPsychic?.name} ipucu düşünüyor...
                    </p>
                </motion.div>
            )}

            {/* İpucu Gösterim */}
            {(phase === 'guess' || phase === 'reveal') && clue && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-strong rounded-2xl px-6 py-3 max-w-lg w-full mb-3 text-center"
                >
                    <p className="text-2xl md:text-3xl font-black text-purple-200">
                        &ldquo;{clue}&rdquo;
                    </p>
                </motion.div>
            )}

            {/* Kadran */}
            <div className="w-full max-w-lg mb-3">
                <WavelengthDial
                    targetAngle={targetAngle}
                    dialAngle={dialAngle}
                    onAngleChange={handleDialMove}
                    showTarget={phase === 'reveal' || (phase === 'clue' && isPsychic)}
                    disabled={phase === 'clue' || phase === 'reveal' || isPsychic}
                    leftLabel={card.left}
                    rightLabel={card.right}
                    phase={phase}
                    moverInfo={moverInfo}
                />
            </div>

            {/* Guess aşaması: Hazır butonu */}
            {phase === 'guess' && !isPsychic && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3 w-full max-w-lg"
                >
                    <p className="text-text-secondary text-xs text-center">
                        İbreyi sürükleyerek tahmininizi yapın, hazır olunca butona basın
                    </p>

                    {!isReady ? (
                        <button
                            onClick={handleReady}
                            className="btn-primary w-full max-w-xs flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            Hazırım!
                        </button>
                    ) : (
                        <div className="glass px-4 py-2 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Hazırsın! Diğerlerini bekliyoruz...
                        </div>
                    )}

                    {/* Hazır durumu */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {nonPsychicPlayers.map((p, i) => (
                            <div
                                key={i}
                                className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${readyPlayers.has(p.name)
                                    ? 'bg-green-600/30 text-green-300'
                                    : 'bg-bg-card text-text-muted'
                                    }`}
                            >
                                <span>{p.avatar}</span>
                                <span>{p.name}</span>
                                {readyPlayers.has(p.name) && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                        ))}
                    </div>
                    <p className="text-text-muted text-xs">
                        {readyCount}/{nonPsychicPlayers.length} hazır
                    </p>
                </motion.div>
            )}

            {/* Medyum guess aşamasında bekler */}
            {phase === 'guess' && isPsychic && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                >
                    <p className="text-text-secondary text-sm mb-2">
                        Takım arkadaşların ibreyi döndürüyor...
                    </p>
                    <p className="text-text-muted text-xs">
                        {readyCount}/{nonPsychicPlayers.length} hazır
                    </p>
                </motion.div>
            )}

            {/* Sonuç Ekranı */}
            {phase === 'reveal' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4 w-full max-w-lg"
                >
                    <AnimatePresence>
                        {showScoreAnim && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-center"
                            >
                                <motion.div
                                    className={`text-6xl font-black mb-2 ${roundScore === 4 ? 'text-green-400' :
                                        roundScore === 3 ? 'text-emerald-400' :
                                            roundScore === 2 ? 'text-amber-400' :
                                                'text-red-400'
                                        }`}
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 0.5 }}
                                >
                                    {roundScore === 4 && <Sparkles className="w-12 h-12 mx-auto mb-1 text-green-400" />}
                                    +{roundScore}
                                </motion.div>
                                <p className="text-text-secondary text-sm">
                                    {roundScore === 4 ? 'Mükemmel! Tam isabet!' :
                                        roundScore === 3 ? 'Çok yakın! Harika!' :
                                            roundScore === 2 ? 'Fena değil!' :
                                                'Maalesef kaçtı...'}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {(network.isHost || turnIndex + 1 >= totalTurns) && (
                        <button
                            onClick={handleNextTurn}
                            className="btn-primary w-full max-w-xs flex items-center justify-center gap-2"
                        >
                            <RotateCw className="w-5 h-5" />
                            {turnIndex + 1 >= totalTurns ? 'Sonuçları Gör' : 'Sonraki Tur'}
                        </button>
                    )}
                </motion.div>
            )}

            {/* Alt: Oyuncu Listesi */}
            <div className="fixed bottom-0 left-0 right-0 bg-bg-primary/80 backdrop-blur-md border-t border-border py-2 px-4">
                <div className="flex justify-center gap-3 max-w-lg mx-auto overflow-x-auto">
                    {allPlayers.map((p, i) => (
                        <div
                            key={i}
                            className={`flex flex-col items-center gap-0.5 min-w-fit ${currentPsychic?.name === p.name ? 'opacity-100' : 'opacity-60'
                                }`}
                        >
                            <span className="text-lg">{p.avatar}</span>
                            <span className="text-[10px] text-text-muted font-medium truncate max-w-[60px]">
                                {p.name}
                            </span>
                            {currentPsychic?.name === p.name && (
                                <span className="text-[8px] text-amber-400">🔮</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
