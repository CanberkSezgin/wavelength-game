import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCw, Eye, Lightbulb, Trophy, ArrowRight, Sparkles, RefreshCw, CheckCircle2, PenLine } from 'lucide-react'
import WavelengthDial from './WavelengthDial'
import CARDS from '../data/cards'

// Oyun Fazları:
// 'setup'    -> Her oyuncu kendi 2 kartını görür, ipuçlarını yazar
// 'clue'     -> Sıradaki medyumun ipucu + kartı gösteriliyor
// 'guess'    -> Diğerleri ibreyi döndürür + hazır butonuna basar
// 'reveal'   -> Hedef gösterilir, puan hesaplanır
// 'finished' -> Tüm turlar bitti, oyun sonu ekranı

export default function GameRoom({ network, playerName, playerAvatar, onBackToLobby }) {
    const [phase, setPhase] = useState('setup')
    const [card, setCard] = useState(null)
    const [targetAngle, setTargetAngle] = useState(90)
    const [dialAngle, setDialAngle] = useState(90)
    const [clue, setClue] = useState('')
    const [isPsychic, setIsPsychic] = useState(false)
    const [score, setScore] = useState(0)
    const [roundScore, setRoundScore] = useState(0)
    const [showScoreAnim, setShowScoreAnim] = useState(false)

    // Yeni state'ler
    const [currentPsychic, setCurrentPsychic] = useState(null)
    const [turnIndex, setTurnIndex] = useState(0)
    const [totalTurns, setTotalTurns] = useState(0)
    const [readyPlayers, setReadyPlayers] = useState(new Set())
    const [isReady, setIsReady] = useState(false)
    const [moverInfo, setMoverInfo] = useState(null)
    const [allPlayers, setAllPlayers] = useState([])
    const [totalScore, setTotalScore] = useState(0)

    // Setup aşaması state'leri
    const [myCards, setMyCards] = useState([]) // [{card, targetAngle, clue, hasRefresh}]
    const [setupClues, setSetupClues] = useState(['', ''])
    const [setupSubmitted, setSetupSubmitted] = useState(false)
    const [playersReady, setPlayersReady] = useState(new Set()) // İpucunu gönderenler

    const usedCardsRef = useRef(new Set())
    const throttleRef = useRef(null)
    const moverTimeoutRef = useRef(null)
    const turnScheduleRef = useRef([])
    const autoStartedRef = useRef(false)

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

    // Host: Oyunu başlat (Hazırlık aşamasını başlat)
    const startGame = useCallback(() => {
        const players = network.players
        if (players.length < 2) return

        usedCardsRef.current.clear()

        // Her oyuncuya 2 benzersiz kart dağıt
        const assignments = {}
        players.forEach(p => {
            const c1 = pickUniqueCard()
            const c2 = pickUniqueCard()
            assignments[p.name] = [
                { card: c1.card, cardIdx: c1.cardIdx, targetAngle: Math.floor(Math.random() * 140) + 20 },
                { card: c2.card, cardIdx: c2.cardIdx, targetAngle: Math.floor(Math.random() * 140) + 20 },
            ]
        })

        setAllPlayers(players.map(p => ({ name: p.name, avatar: p.avatar })))
        setTotalTurns(players.length * 2)
        setScore(0)
        setTotalScore(0)
        setPlayersReady(new Set())
        setSetupSubmitted(false)
        setPhase('setup')

        // Kendi kartlarımı ayarla
        const mine = assignments[playerName]
        if (mine) {
            setMyCards(mine.map(c => ({ ...c, clue: '', hasRefresh: true })))
            setSetupClues(['', ''])
        }

        // Herkese kartları gönder
        network.broadcast({
            type: 'game-init',
            assignments,
            totalTurns: players.length * 2,
            players: players.map(p => ({ name: p.name, avatar: p.avatar })),
        })
    }, [network, playerName, pickUniqueCard])

    // Host mount olduğunda otomatik başlat
    useEffect(() => {
        if (network.isHost && !autoStartedRef.current && network.players.length >= 2) {
            autoStartedRef.current = true
            setTimeout(() => startGame(), 300)
        }
    })

    // Tur programını oluştur ve başlat
    const buildAndStartTurns = useCallback((allClues, players) => {
        // Tur sırası: herkesin 1. kartı, sonra herkesin 2. kartı
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

    // Belirli tura geç
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

    // Tüm clue verilerini saklayan ref
    const allCluesRef = useRef({})

    // Ağ mesajlarını dinle
    useEffect(() => {
        network.onMessage((data) => {
            switch (data.type) {
                case 'player-joined': {
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
                            network.broadcast({
                                type: 'player-list',
                                players: updated.map(p => ({ name: p.name, avatar: p.avatar, isHost: p.isHost })),
                            })
                        }
                    }
                    break
                }

                case 'player-list': {
                    if (!network.isHost) {
                        network.updatePlayers(data.players.map(p => ({
                            ...p, id: p.name, connId: null,
                        })))
                    }
                    break
                }

                case 'game-init': {
                    const mine = data.assignments[playerName]
                    setAllPlayers(data.players)
                    setTotalTurns(data.totalTurns)
                    setScore(0)
                    setTotalScore(0)
                    setPlayersReady(new Set())
                    setSetupSubmitted(false)
                    setPhase('setup')
                    if (mine) {
                        setMyCards(mine.map(c => ({ ...c, clue: '', hasRefresh: true })))
                        setSetupClues(['', ''])
                    }
                    break
                }

                case 'clues-submitted': {
                    // Bir oyuncu ipuçlarını gönderdi
                    setPlayersReady(prev => {
                        const next = new Set(prev)
                        next.add(data.playerName)
                        return next
                    })

                    // Host: clue verilerini topla
                    if (network.isHost) {
                        allCluesRef.current[data.playerName] = data.clueData
                    }
                    break
                }

                case 'all-clues-ready': {
                    // Tüm ipuçları toplandı, turları başlat
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
                    goToTurn(data.turnIndex)
                    break
                }

                case 'refresh-card': {
                    // Misafir: kartını güncelle
                    if (data.playerName === playerName) {
                        setMyCards(prev => {
                            const copy = [...prev]
                            copy[data.slotIndex] = {
                                ...copy[data.slotIndex],
                                card: data.newCard,
                                targetAngle: data.newTarget,
                                hasRefresh: false,
                            }
                            return copy
                        })
                    }
                    break
                }

                case 'restart-game': {
                    setPhase('setup')
                    setScore(0)
                    setTotalScore(0)
                    setTurnIndex(0)
                    setCard(null)
                    setClue('')
                    usedCardsRef.current.clear()
                    turnScheduleRef.current = []
                    allCluesRef.current = {}
                    autoStartedRef.current = false
                    break
                }

                default:
                    break
            }
        })
    }, [network, playerName, goToTurn, buildAndStartTurns])

    // Host: all-ready kontrol (guess aşaması)
    useEffect(() => {
        if (!network.isHost || phase !== 'guess') return

        const nonPsychicPlayers = allPlayers.filter(p => p.name !== currentPsychic?.name)
        const allReady = nonPsychicPlayers.length > 0 &&
            nonPsychicPlayers.every(p => readyPlayers.has(p.name))

        if (allReady) {
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

    // Host: tüm ipuçları gönderildi mi kontrol
    useEffect(() => {
        if (!network.isHost || phase !== 'setup') return

        const allSubmitted = allPlayers.length > 0 &&
            allPlayers.every(p => playersReady.has(p.name))

        if (allSubmitted) {
            const clues = allCluesRef.current
            buildAndStartTurns(clues, allPlayers)
            network.broadcast({
                type: 'all-clues-ready',
                allClues: clues,
                players: allPlayers,
            })
        }
    }, [playersReady, network, phase, allPlayers, buildAndStartTurns])

    // İbre hareket
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

    // Setup: İpuçlarını gönder
    const handleSubmitClues = () => {
        if (!setupClues[0].trim() || !setupClues[1].trim()) return
        setSetupSubmitted(true)

        const clueData = myCards.map((c, i) => ({
            card: c.card,
            targetAngle: c.targetAngle,
            clue: setupClues[i].trim(),
        }))

        setPlayersReady(prev => {
            const next = new Set(prev)
            next.add(playerName)
            return next
        })

        if (network.isHost) {
            allCluesRef.current[playerName] = clueData
        }

        network.broadcast({
            type: 'clues-submitted',
            playerName,
            clueData,
        })
    }

    // Setup: Kart yenile
    const handleRefreshCard = (slotIndex) => {
        const current = myCards[slotIndex]
        if (!current.hasRefresh) return

        const { card: newCard, cardIdx } = pickUniqueCard()
        const newTarget = Math.floor(Math.random() * 140) + 20

        setMyCards(prev => {
            const copy = [...prev]
            copy[slotIndex] = {
                card: newCard,
                cardIdx,
                targetAngle: newTarget,
                clue: '',
                hasRefresh: false,
            }
            return copy
        })
        setSetupClues(prev => {
            const copy = [...prev]
            copy[slotIndex] = ''
            return copy
        })

        network.broadcast({
            type: 'refresh-card',
            playerName,
            slotIndex,
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
        goToTurn(nextIdx)
        network.broadcast({ type: 'next-turn', turnIndex: nextIdx })
    }

    // Tekrar oyna
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

    // Puan değerlendirmesi
    const getScoreRating = (s) => {
        const max = totalTurns * 4
        if (s >= max * 0.75) return { text: '🏆 EFSANE!', color: 'text-yellow-400' }
        if (s >= max * 0.5) return { text: '🌟 Harika!', color: 'text-green-400' }
        if (s >= max * 0.3) return { text: '👍 İyi!', color: 'text-blue-400' }
        return { text: '💪 Geliştirilmeli', color: 'text-orange-400' }
    }

    // ═══════════════════ RENDER ═══════════════════

    // HAZIRLIK AŞAMASI
    if (phase === 'setup') {
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
                            Her kart için bir ipucu yaz. Hedef bölgeyi hatırla!
                        </p>
                    </div>

                    {myCards.map((c, idx) => (
                        <div key={idx} className="glass rounded-2xl p-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-text-muted">Kart {idx + 1}</span>
                                {c.hasRefresh && !setupSubmitted && (
                                    <button
                                        onClick={() => handleRefreshCard(idx)}
                                        className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Yenile
                                    </button>
                                )}
                                {!c.hasRefresh && (
                                    <span className="text-xs text-text-muted">Yenileme hakkı kullanıldı</span>
                                )}
                            </div>

                            <div className="flex justify-between mb-3">
                                <span className="text-sm font-bold text-blue-300 bg-blue-900/30 px-2.5 py-1 rounded-lg">
                                    {c.card.left}
                                </span>
                                <span className="text-sm font-bold text-amber-300 bg-amber-900/30 px-2.5 py-1 rounded-lg">
                                    {c.card.right}
                                </span>
                            </div>

                            {/* Mini kadran — hedefi göster */}
                            <div className="mb-3">
                                <WavelengthDial
                                    targetAngle={c.targetAngle}
                                    dialAngle={90}
                                    showTarget={true}
                                    disabled={true}
                                    leftLabel={c.card.left}
                                    rightLabel={c.card.right}
                                />
                            </div>

                            <input
                                type="text"
                                value={setupClues[idx]}
                                onChange={(e) => {
                                    setSetupClues(prev => {
                                        const copy = [...prev]
                                        copy[idx] = e.target.value
                                        return copy
                                    })
                                }}
                                disabled={setupSubmitted}
                                placeholder="İpucu yaz..."
                                className="input-field text-center"
                                maxLength={50}
                            />
                        </div>
                    ))}

                    {!setupSubmitted ? (
                        <button
                            onClick={handleSubmitClues}
                            disabled={!setupClues[0].trim() || !setupClues[1].trim()}
                            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            İpuçlarını Onayla
                        </button>
                    ) : (
                        <div className="text-center">
                            <div className="glass px-4 py-3 rounded-xl text-green-400 text-sm font-medium flex items-center justify-center gap-2 mb-3">
                                <CheckCircle2 className="w-4 h-4" />
                                İpuçların hazır! Diğerlerini bekliyoruz...
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {allPlayers.map((p, i) => (
                                    <div
                                        key={i}
                                        className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${playersReady.has(p.name)
                                                ? 'bg-green-600/30 text-green-300'
                                                : 'bg-bg-card text-text-muted'
                                            }`}
                                    >
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

    // OYUN SONU EKRANI
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
                        <motion.div key={i} className="w-3 h-3 bg-purple-400 rounded-full"
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
        <div className="min-h-screen flex flex-col items-center px-4 py-4 md:py-6 pb-20">
            {/* Üst Bilgi */}
            <div className="w-full max-w-lg flex items-center justify-between mb-3">
                <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-2">
                    <span className="text-xs text-text-muted">Tur</span>
                    <span className="text-sm font-bold text-purple-300">{turnIndex + 1}/{totalTurns}</span>
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
                        {isPsychic ? '(Sen) — Medyum 🔮' : '— Medyum 🔮'}
                    </span>
                </div>
            )}

            {/* İpucu Gösterim */}
            {clue && (
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
                    showTarget={phase === 'reveal' || isPsychic}
                    disabled={phase === 'reveal' || isPsychic}
                    leftLabel={card.left}
                    rightLabel={card.right}
                    moverInfo={moverInfo}
                />
            </div>

            {/* Guess: Hazır butonu */}
            {phase === 'guess' && !isPsychic && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3 w-full max-w-lg"
                >
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

                    <div className="flex flex-wrap gap-2 justify-center">
                        {nonPsychicPlayers.map((p, i) => (
                            <div key={i} className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${readyPlayers.has(p.name)
                                    ? 'bg-green-600/30 text-green-300'
                                    : 'bg-bg-card text-text-muted'
                                }`}>
                                <span>{p.avatar}</span>
                                <span>{p.name}</span>
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
                                    className={`text-6xl font-black mb-2 ${roundScore === 4 ? 'text-blue-400' :
                                            roundScore === 3 ? 'text-orange-400' :
                                                roundScore === 2 ? 'text-yellow-400' :
                                                    'text-red-400'
                                        }`}
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 0.5 }}
                                >
                                    {roundScore === 4 && <Sparkles className="w-12 h-12 mx-auto mb-1 text-blue-400" />}
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

                    <button
                        onClick={handleNextTurn}
                        className="btn-primary w-full max-w-xs flex items-center justify-center gap-2"
                    >
                        <RotateCw className="w-5 h-5" />
                        {turnIndex + 1 >= totalTurns ? 'Sonuçları Gör' : 'Sonraki Tur'}
                    </button>
                </motion.div>
            )}

            {/* Alt: Oyuncu Çubuğu */}
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
