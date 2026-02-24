import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCw, Trophy, Sparkles, RefreshCw, CheckCircle2, PenLine, ChevronRight, Zap, Eye } from 'lucide-react'
import WavelengthDial from './WavelengthDial'
import CARDS from '../data/cards'
import { playBip, playCelebration, playFail, playTimerWarn } from '../utils/sounds'

// Konfeti bileşeni — hooks kuralına uygun
function Confetti({ active }) {
    const pieces = useRef(Array.from({ length: 60 }, (_, i) => ({
        id: i, x: Math.random() * 100,
        color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF69B4'][i % 8],
        delay: Math.random() * 0.5, size: Math.random() * 8 + 4,
        isCircle: Math.random() > 0.5, dir: Math.random() > 0.5 ? 1 : -1,
    }))).current
    if (!active) return null
    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
            {pieces.map(p => (
                <motion.div key={p.id}
                    initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
                    animate={{ y: '110vh', opacity: 0, rotate: 360 * p.dir, scale: 0 }}
                    transition={{ duration: 2 + Math.random() * 2, delay: p.delay, ease: 'easeIn' }}
                    style={{ position: 'absolute', width: p.size, height: p.size, backgroundColor: p.color, borderRadius: p.isCircle ? '50%' : '2px' }}
                />
            ))}
        </div>
    )
}

export default function GameRoom({ network, playerName, playerAvatar, playerColor, customCards = [], onBackToLobby }) {
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
    const [playerScores, setPlayerScores] = useState({})

    // Setup
    const [myCards, setMyCards] = useState([])
    const [setupClues, setSetupClues] = useState(['', ''])
    const [setupStep, setSetupStep] = useState(0)
    const [setupSubmitted, setSetupSubmitted] = useState(false)
    const [playersReady, setPlayersReady] = useState(new Set())

    // Timer (4 dakika = 240 saniye)
    const [timeLeft, setTimeLeft] = useState(240)

    // Jokerler
    const [myJokers, setMyJokers] = useState({ narrow: true, doublePts: true, extraWord: true })
    const [doublePtsActive, setDoublePtsActive] = useState(false)
    const [showNarrowHint, setShowNarrowHint] = useState(false)
    const [extraWordRequested, setExtraWordRequested] = useState(false)
    const [extraWord, setExtraWord] = useState('')
    const [extraWordInput, setExtraWordInput] = useState('')

    // Canlı Reaksiyon Emojileri
    const [reactions, setReactions] = useState([])

    // Konfeti
    const [showConfetti, setShowConfetti] = useState(false)

    const usedCardsRef = useRef(new Set())
    const throttleRef = useRef(null)
    const moverTimeoutRef = useRef(null)
    const turnScheduleRef = useRef([])
    const autoStartedRef = useRef(false)
    const allCluesRef = useRef({})
    const timerRef = useRef(null)

    const randomTarget = () => Math.floor(Math.random() * 171) + 5
    const allCardsPool = useRef([...CARDS, ...customCards])

    useEffect(() => {
        allCardsPool.current = [...CARDS, ...customCards]
    }, [customCards])

    const pickUniqueCard = useCallback(() => {
        const pool = allCardsPool.current
        const customCount = pool.length - CARDS.length

        // Önce kullanılmamış özel kart var mı kontrol et
        let availableCustom = []
        if (customCount > 0) {
            for (let i = CARDS.length; i < pool.length; i++) {
                if (!usedCardsRef.current.has(i)) availableCustom.push(i)
            }
        }

        let cardIdx;
        if (availableCustom.length > 0) {
            // Varsa kesinlikle bir özel kart seç (önceliklendir)
            cardIdx = availableCustom[Math.floor(Math.random() * availableCustom.length)]
        } else {
            // Yoksa normal havuzdan kullanılmamış olanları bul
            let available = pool.map((_, i) => i).filter(i => !usedCardsRef.current.has(i))
            if (available.length === 0) {
                usedCardsRef.current.clear()
                available = pool.map((_, i) => i)
            }
            cardIdx = available[Math.floor(Math.random() * available.length)]
        }

        usedCardsRef.current.add(cardIdx)
        return { card: pool[cardIdx], cardIdx }
    }, [])

    // Timer mantığı
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        if ((phase === 'guess') || (phase === 'setup' && !setupSubmitted)) {
            setTimeLeft(240)
            timerRef.current = setInterval(() => setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timerRef.current); return 0 }
                if (prev <= 31) playTimerWarn()
                return prev - 1
            }), 1000)
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [phase, setupStep, setupSubmitted])

    // Timer sıfırlanınca oto-aksiyon
    useEffect(() => {
        if (timeLeft !== 0) return
        if (phase === 'guess' && !isReady && !isPsychic) handleReady()
        if (phase === 'setup' && !setupSubmitted) {
            if (setupStep === 0) {
                if (!setupClues[0].trim()) setSetupClues(p => { const c = [...p]; c[0] = '...'; return c })
                setSetupStep(1)
            } else {
                if (!setupClues[1].trim()) setSetupClues(p => { const c = [...p]; c[1] = '...'; return c })
                setTimeout(() => handleSubmitClues(), 100)
            }
        }
    }, [timeLeft])

    const startGame = useCallback(() => {
        const players = network.players
        if (players.length < 2) return
        usedCardsRef.current.clear(); allCluesRef.current = {}
        const assignments = {}
        players.forEach(p => {
            const c1 = pickUniqueCard(), c2 = pickUniqueCard()
            assignments[p.name] = [
                { card: c1.card, cardIdx: c1.cardIdx, targetAngle: randomTarget() },
                { card: c2.card, cardIdx: c2.cardIdx, targetAngle: randomTarget() },
            ]
        })
        const pList = players.map(p => ({ name: p.name, avatar: p.avatar, color: p.color }))
        setAllPlayers(pList); setTotalTurns(players.length * 2)
        setPlayerScores(Object.fromEntries(pList.map(p => [p.name, 0])))
        setPlayersReady(new Set()); setSetupSubmitted(false); setSetupStep(0); setPhase('setup')
        setMyJokers({ narrow: true, doublePts: true, extraWord: true })
        const mine = assignments[playerName]
        if (mine) { setMyCards(mine.map(c => ({ ...c, clue: '', hasRefresh: true }))); setSetupClues(['', '']) }
        network.broadcast({ type: 'game-init', assignments, totalTurns: players.length * 2, players: pList })
    }, [network, playerName, pickUniqueCard])

    useEffect(() => {
        if (network.isHost && !autoStartedRef.current && network.players.length >= 2) {
            autoStartedRef.current = true; setTimeout(() => startGame(), 300)
        }
    })

    const buildAndStartTurns = useCallback((allClues, players) => {
        const schedule = []
        for (let ci = 0; ci < 2; ci++) {
            for (let p = 0; p < players.length; p++) {
                const cd = allClues[players[p].name]?.[ci]
                if (cd) schedule.push({ psychicName: players[p].name, psychicAvatar: players[p].avatar, card: cd.card, targetAngle: cd.targetAngle, clue: cd.clue })
            }
        }
        turnScheduleRef.current = schedule; setTurnIndex(0)
        if (schedule.length > 0) {
            const f = schedule[0]
            setCard(f.card); setTargetAngle(f.targetAngle); setClue(f.clue); setDialAngle(90)
            setPhase('guess'); setIsPsychic(f.psychicName === playerName)
            setCurrentPsychic({ name: f.psychicName, avatar: f.psychicAvatar })
            setRoundScore(0); setShowScoreAnim(false); setReadyPlayers(new Set()); setIsReady(false); setMoverInfo(null)
            setDoublePtsActive(false); setShowNarrowHint(false); setExtraWordRequested(false); setExtraWord(''); setExtraWordInput('')
            setShowConfetti(false)
        }
    }, [playerName])

    const goToTurn = useCallback((index) => {
        const s = turnScheduleRef.current
        if (index >= s.length) { setPhase('finished'); return }
        const t = s[index]
        setCard(t.card); setTargetAngle(t.targetAngle); setClue(t.clue); setDialAngle(90)
        setPhase('guess'); setIsPsychic(t.psychicName === playerName)
        setCurrentPsychic({ name: t.psychicName, avatar: t.psychicAvatar })
        setRoundScore(0); setShowScoreAnim(false); setReadyPlayers(new Set()); setIsReady(false); setMoverInfo(null); setTurnIndex(index)
        setDoublePtsActive(false); setShowNarrowHint(false); setExtraWordRequested(false); setExtraWord(''); setExtraWordInput('')
        setShowConfetti(false)
    }, [playerName])

    // Ağ mesajları
    useEffect(() => {
        network.onMessage((data) => {
            switch (data.type) {
                case 'player-joined': {
                    if (network.isHost) {
                        const ex = network.playersRef.current
                        if (!ex.some(p => p.name === data.name)) {
                            const up = [...ex, { id: Date.now().toString(), name: data.name, avatar: data.avatar, color: data.color, isHost: false, connId: null }]
                            network.updatePlayers(up)
                            network.broadcast({ type: 'player-list', players: up.map(p => ({ name: p.name, avatar: p.avatar, color: p.color, isHost: p.isHost })) })
                        }
                    }
                    break
                }
                case 'player-list': if (!network.isHost) network.updatePlayers(data.players.map(p => ({ ...p, id: p.name, connId: null }))); break
                case 'game-init': {
                    const mine = data.assignments[playerName]
                    setAllPlayers(data.players); setTotalTurns(data.totalTurns)
                    setPlayerScores(Object.fromEntries(data.players.map(p => [p.name, 0])))
                    setPlayersReady(new Set()); setSetupSubmitted(false); setSetupStep(0); setPhase('setup')
                    setMyJokers({ narrow: true, doublePts: true, extraWord: true })
                    if (mine) { setMyCards(mine.map(c => ({ ...c, clue: '', hasRefresh: true }))); setSetupClues(['', '']) }
                    break
                }
                case 'clues-submitted': {
                    setPlayersReady(p => { const n = new Set(p); n.add(data.playerName); return n })
                    if (network.isHost) allCluesRef.current[data.playerName] = data.clueData
                    break
                }
                case 'all-clues-ready': buildAndStartTurns(data.allClues, data.players); break
                case 'dial-move':
                    setDialAngle(data.angle); setMoverInfo({ name: data.moverName, avatar: data.moverAvatar })
                    if (moverTimeoutRef.current) clearTimeout(moverTimeoutRef.current)
                    moverTimeoutRef.current = setTimeout(() => setMoverInfo(null), 2000)
                    break
                case 'player-ready': setReadyPlayers(p => { const n = new Set(p); n.add(data.playerName); return n }); break
                case 'all-ready-reveal': {
                    setPhase('reveal'); setRoundScore(data.roundScore)
                    setPlayerScores(p => ({ ...p, [data.psychicName]: (p[data.psychicName] || 0) + data.roundScore }))
                    setShowScoreAnim(true)
                    if (data.roundScore === 4) { playCelebration(); setShowConfetti(true) }
                    else if (data.roundScore === 0) playFail()
                    else playBip()
                    break
                }
                case 'next-turn': goToTurn(data.turnIndex); break
                case 'refresh-card': {
                    if (data.playerName === playerName) {
                        setMyCards(p => { const c = [...p]; c[data.slotIndex] = { ...c[data.slotIndex], card: data.newCard, targetAngle: data.newTarget, hasRefresh: false }; return c })
                    }
                    break
                }
                case 'joker-narrow': setShowNarrowHint(true); setTimeout(() => setShowNarrowHint(false), 2500); break
                case 'joker-double': setDoublePtsActive(true); break
                case 'joker-extra-word-req': setExtraWordRequested(true); break
                case 'joker-extra-word-res': setExtraWord(data.word); break
                case 'reaction-sync': {
                    setReactions(prev => [...prev.slice(-15), data.reaction])
                    setTimeout(() => setReactions(prev => prev.filter(x => x.id !== data.reaction.id)), 1500)
                    break
                }
                case 'restart-game': {
                    setPhase('setup'); setPlayerScores({}); setTurnIndex(0); setCard(null); setClue('')
                    usedCardsRef.current.clear(); turnScheduleRef.current = []; allCluesRef.current = {}; autoStartedRef.current = false
                    break
                }
                default: break
            }
        })
    }, [network, playerName, goToTurn, buildAndStartTurns])

    // Host: herkes hazır mı
    useEffect(() => {
        if (!network.isHost || phase !== 'guess') return
        const np = allPlayers.filter(p => p.name !== currentPsychic?.name)
        if (np.length > 0 && np.every(p => readyPlayers.has(p.name))) {
            const diff = Math.abs(dialAngle - targetAngle)
            let pts = diff <= 8 ? 4 : diff <= 16 ? 3 : diff <= 24 ? 2 : 0
            if (doublePtsActive) pts *= 2
            setPhase('reveal'); setRoundScore(pts)
            setPlayerScores(p => ({ ...p, [currentPsychic.name]: (p[currentPsychic.name] || 0) + pts }))
            setShowScoreAnim(true)
            if (pts >= 4) { playCelebration(); setShowConfetti(true); } else if (pts === 0) { playFail(); } else { playBip(); }
            network.broadcast({ type: 'all-ready-reveal', roundScore: pts, psychicName: currentPsychic.name })
        }
    }, [readyPlayers, network, phase, allPlayers, currentPsychic, dialAngle, targetAngle, doublePtsActive])

    useEffect(() => {
        if (!network.isHost || phase !== 'setup') return
        if (allPlayers.length > 0 && allPlayers.every(p => playersReady.has(p.name))) {
            buildAndStartTurns(allCluesRef.current, allPlayers)
            network.broadcast({ type: 'all-clues-ready', allClues: allCluesRef.current, players: allPlayers })
        }
    }, [playersReady, network, phase, allPlayers, buildAndStartTurns])

    const handleDialMove = useCallback((angle) => {
        setDialAngle(angle)
        if (throttleRef.current) return
        throttleRef.current = setTimeout(() => {
            network.broadcast({ type: 'dial-move', angle, moverName: playerName, moverAvatar: playerAvatar })
            throttleRef.current = null
        }, 30)
    }, [network, playerName, playerAvatar])

    const handleReady = () => {
        playBip(); setIsReady(true)
        setReadyPlayers(p => { const n = new Set(p); n.add(playerName); return n })
        network.broadcast({ type: 'player-ready', playerName })
    }

    const handleSubmitClues = () => {
        const c0 = setupClues[0].trim() || '...', c1 = setupClues[1].trim() || '...'
        setSetupSubmitted(true); playBip()
        const clueData = myCards.map((c, i) => ({ card: c.card, targetAngle: c.targetAngle, clue: i === 0 ? c0 : c1 }))
        setPlayersReady(p => { const n = new Set(p); n.add(playerName); return n })
        if (network.isHost) allCluesRef.current[playerName] = clueData
        network.broadcast({ type: 'clues-submitted', playerName, clueData })
    }

    const handleRefreshCard = (slotIndex) => {
        if (!myCards[slotIndex].hasRefresh) return
        const { card: newCard, cardIdx } = pickUniqueCard()
        const newTarget = randomTarget()
        setMyCards(p => { const c = [...p]; c[slotIndex] = { card: newCard, cardIdx, targetAngle: newTarget, clue: '', hasRefresh: false }; return c })
        setSetupClues(p => { const c = [...p]; c[slotIndex] = ''; return c })
        network.broadcast({ type: 'refresh-card', playerName, slotIndex, newCard, newCardIdx: cardIdx, newTarget })
    }

    const handleNextTurn = () => {
        const ni = turnIndex + 1
        if (ni >= totalTurns) { setPhase('finished'); network.broadcast({ type: 'next-turn', turnIndex: ni }); return }
        goToTurn(ni); network.broadcast({ type: 'next-turn', turnIndex: ni })
    }

    const handleRestart = () => {
        if (!network.isHost) return
        autoStartedRef.current = false; allCluesRef.current = {}; usedCardsRef.current.clear(); turnScheduleRef.current = []
        network.broadcast({ type: 'restart-game' }); setTimeout(() => startGame(), 500)
    }

    // Joker handlers
    const useNarrowJoker = () => {
        setMyJokers(p => ({ ...p, narrow: false }))
        setShowNarrowHint(true); setTimeout(() => setShowNarrowHint(false), 2500)
        network.broadcast({ type: 'joker-narrow' })
    }
    const useDoubleJoker = () => {
        setMyJokers(p => ({ ...p, doublePts: false })); setDoublePtsActive(true)
        network.broadcast({ type: 'joker-double' })
    }
    const useExtraWordJoker = () => {
        setMyJokers(p => ({ ...p, extraWord: false })); setExtraWordRequested(true)
        network.broadcast({ type: 'joker-extra-word-req' })
    }
    const submitExtraWord = () => {
        if (!extraWordInput.trim()) return
        setExtraWord(extraWordInput.trim()); setExtraWordRequested(false)
        network.broadcast({ type: 'joker-extra-word-res', word: extraWordInput.trim() })
        setExtraWordInput('')
    }

    // Emoji Reaksiyon Handlers
    const handleReaction = (emoji) => {
        const id = Date.now() + Math.random().toString()
        const reaction = { id, emoji, x: 20 + Math.random() * 60 }
        setReactions(prev => [...prev.slice(-15), reaction])
        network.broadcast({ type: 'reaction-sync', reaction })
        setTimeout(() => setReactions(prev => prev.filter(x => x.id !== id)), 1500)
    }

    // Timer bar bileşeni — belirgin ve görünür
    const TimerBar = () => (
        (phase === 'guess' || (phase === 'setup' && !setupSubmitted)) ? (
            <div className="w-full max-w-lg mb-3">
                <div className="flex items-center gap-3">
                    <div className={`glass px-4 py-2 rounded-xl flex items-center gap-2 ${timeLeft <= 30 ? 'border-red-500/50' : ''}`}>
                        <span className="text-lg">⏱️</span>
                        <motion.span
                            className={`text-xl font-black tabular-nums tracking-wider ${timeLeft <= 30 ? 'text-red-400' : timeLeft <= 60 ? 'text-amber-400' : 'text-purple-300'}`}
                            animate={timeLeft <= 30 ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.5, repeat: Infinity }}
                        >
                            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                        </motion.span>
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-bg-card overflow-hidden">
                        <motion.div
                            className={`h-full rounded-full ${timeLeft <= 30 ? 'bg-red-500 timer-urgent' : timeLeft <= 60 ? 'bg-amber-500' : 'bg-purple-500'}`}
                            style={{ width: `${(timeLeft / 240) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>
            </div>
        ) : null
    )

    // ═══ RENDER ═══

    if (phase === 'setup') {
        const cc = myCards[setupStep]
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
                <Confetti active={false} />
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-6 max-w-lg w-full">
                    <div className="text-center mb-4">
                        <PenLine className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                        <h2 className="text-xl font-bold">İpuçlarını Hazırla</h2>
                        <p className="text-text-secondary text-sm mt-1">Kart {setupStep + 1} / 2</p>
                    </div>
                    <div className="flex justify-center gap-2 mb-3">
                        {[0, 1].map(i => <div key={i} className={`w-3 h-3 rounded-full transition-all ${i === setupStep ? 'bg-purple-400 scale-125' : i < setupStep ? 'bg-green-400' : 'bg-bg-card'}`} />)}
                    </div>
                    <TimerBar />
                    {!setupSubmitted && cc && (
                        <AnimatePresence mode="wait">
                            <motion.div key={setupStep} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }} className="glass rounded-2xl p-4 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-text-muted">Kart {setupStep + 1}</span>
                                    {cc.hasRefresh && <button onClick={() => handleRefreshCard(setupStep)} className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"><RefreshCw className="w-3 h-3" /> Yenile</button>}
                                    {!cc.hasRefresh && <span className="text-xs text-text-muted">Yenileme kullanıldı</span>}
                                </div>
                                <div className="mb-3"><WavelengthDial targetAngle={cc.targetAngle} dialAngle={90} showTarget={true} disabled={true} leftLabel={cc.card.left} rightLabel={cc.card.right} /></div>
                                <input type="text" value={setupClues[setupStep]} onChange={e => setSetupClues(p => { const c = [...p]; c[setupStep] = e.target.value; return c })} placeholder="İpucu yaz..." className="input-field text-center" maxLength={50} />
                            </motion.div>
                        </AnimatePresence>
                    )}
                    {!setupSubmitted && (setupStep === 0
                        ? <button onClick={() => { if (setupClues[0].trim()) setSetupStep(1) }} disabled={!setupClues[0].trim()} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">Sonraki Karta Geç <ChevronRight className="w-5 h-5" /></button>
                        : <button onClick={handleSubmitClues} disabled={!setupClues[1].trim()} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"><CheckCircle2 className="w-5 h-5" /> İpuçlarını Onayla</button>
                    )}
                    {setupSubmitted && (
                        <div className="text-center">
                            <div className="glass px-4 py-3 rounded-xl text-green-400 text-sm font-medium flex items-center justify-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4" /> İpuçların hazır!</div>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {allPlayers.map((p, i) => <div key={i} className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${playersReady.has(p.name) ? 'bg-green-600/30 text-green-300' : 'bg-bg-card text-text-muted'}`}><span>{p.avatar}</span><span>{p.name}</span>{playersReady.has(p.name) && <CheckCircle2 className="w-3 h-3" />}</div>)}
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        )
    }

    if (phase === 'finished') {
        const sorted = [...allPlayers].map(p => ({ ...p, score: playerScores[p.name] || 0 })).sort((a, b) => b.score - a.score)
        const maxS = sorted[0]?.score || 1, winner = sorted[0]
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
                <Confetti active={true} />
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong rounded-3xl p-8 max-w-md w-full text-center">
                    <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }} className="mb-4">
                        <p className="text-text-muted text-sm mb-1">🏆 Dalga boyu en büyük olan kişi:</p>
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-4xl">{winner?.avatar}</span>
                            <h2 className="text-3xl font-black bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">{winner?.name}</h2>
                        </div>
                    </motion.div>
                    <div className="space-y-3 my-6">
                        {sorted.map((p, i) => {
                            const scale = p.score > 0 ? p.score / maxS : 0.2
                            const eSize = Math.max(1.5, scale * 5)
                            return (
                                <motion.div key={p.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }} className="glass rounded-2xl p-3 flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-amber-500 text-black' : i === 1 ? 'bg-slate-400 text-black' : i === 2 ? 'bg-orange-700 text-white' : 'bg-bg-card text-text-muted'}`}>{i + 1}</div>
                                    <span className="text-xl">{p.avatar}</span>
                                    <span className="font-semibold text-sm flex-1 text-left">{p.name}</span>
                                    <span style={{ fontSize: `${eSize}rem`, lineHeight: 1 }}>🍆</span>
                                    <span className="font-black text-lg text-amber-300 min-w-[40px] text-right">{p.score}</span>
                                </motion.div>
                            )
                        })}
                    </div>
                    {network.isHost ? <button onClick={handleRestart} className="btn-primary w-full flex items-center justify-center gap-2"><RotateCw className="w-5 h-5" /> Tekrar Oyna</button> : <p className="text-text-secondary text-sm">Host tekrar oynamayı başlatabilir</p>}
                </motion.div>
            </div>
        )
    }

    if (!card) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex items-center gap-3 text-text-secondary">
                {[0, 1, 2].map(i => <motion.div key={i} className="w-3 h-3 bg-purple-400 rounded-full" animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />)}
                <span className="ml-2">Oyun hazırlanıyor...</span>
            </div>
        </div>
    )

    const nonPsychic = allPlayers.filter(p => p.name !== currentPsychic?.name)
    const readyCount = nonPsychic.filter(p => readyPlayers.has(p.name)).length

    return (
        <div className="min-h-screen flex flex-col items-center px-4 py-4 md:py-6 pb-20">
            <Confetti active={showConfetti} />

            <div className="w-full max-w-lg flex items-center justify-between mb-2">
                <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-2">
                    <span className="text-xs text-text-muted">Tur</span>
                    <span className="text-sm font-bold text-purple-300">{turnIndex + 1}/{totalTurns}</span>
                </div>
                {doublePtsActive && <div className="glass px-3 py-1 rounded-xl text-xs text-amber-300 font-bold flex items-center gap-1"><span className="font-black">×</span> 2x PUAN</div>}
                <div className="glass px-4 py-1.5 rounded-xl flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-amber-300">{playerScores[playerName] || 0}</span>
                </div>
            </div>

            <TimerBar />

            {currentPsychic && (
                <div className="glass px-4 py-2 rounded-2xl flex items-center gap-2 mb-3">
                    <span className="text-xl">{currentPsychic.avatar}</span>
                    <span className="font-semibold text-sm">{currentPsychic.name}</span>
                    <span className="text-xs text-text-muted">{isPsychic ? '(Sen) — Medyum 🔮' : '— Medyum 🔮'}</span>
                </div>
            )}

            {clue && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong rounded-2xl px-6 py-3 max-w-lg w-full mb-2 text-center">
                    <p className="text-2xl md:text-3xl font-black text-purple-200">&ldquo;{clue}&rdquo;</p>
                    {extraWord && <p className="text-lg font-bold text-amber-300 mt-1">+ &ldquo;{extraWord}&rdquo;</p>}
                </motion.div>
            )}

            {/* Medyum: ekstra kelime isteği */}
            {isPsychic && extraWordRequested && !extraWord && phase === 'guess' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-3 max-w-lg w-full mb-2">
                    <p className="text-xs text-amber-300 mb-2">⚡ Ekstra kelime istendi!</p>
                    <div className="flex gap-2">
                        <input type="text" value={extraWordInput} onChange={e => setExtraWordInput(e.target.value)} placeholder="Ekstra ipucu..." className="input-field !py-1.5 text-sm" maxLength={20} />
                        <button onClick={submitExtraWord} className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-3 text-sm font-bold">Gönder</button>
                    </div>
                </motion.div>
            )}

            <div className="w-full max-w-lg mb-2 relative">
                {/* Floating Canlı Emojiler */}
                <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
                    <AnimatePresence>
                        {reactions.map(r => (
                            <motion.div key={r.id}
                                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                                animate={{ opacity: 0, y: -160, scale: 2 }}
                                transition={{ duration: 1.5, ease: 'easeOut' }}
                                className="absolute bottom-10 text-4xl drop-shadow-xl"
                                style={{ left: `${r.x}%` }}
                            >
                                {r.emoji}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <WavelengthDial targetAngle={targetAngle} dialAngle={dialAngle} onAngleChange={handleDialMove}
                    showTarget={phase === 'reveal' || isPsychic} disabled={phase === 'reveal' || isPsychic}
                    leftLabel={card.left} rightLabel={card.right} moverInfo={moverInfo} showNarrowHint={showNarrowHint} />
            </div>

            {/* Guess: Jokerler + Hazır */}
            {phase === 'guess' && !isPsychic && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 w-full max-w-lg">
                    {/* Emoji Reaksiyon Barı */}
                    <div className="flex bg-bg-card/60 p-2 md:p-3 rounded-2xl gap-4 md:gap-6 backdrop-blur-md border border-white/5 shadow-inner mb-2">
                        {['💩', '👈', '👉', '🎯'].map(emj => (
                            <button key={emj} onClick={() => handleReaction(emj)} className="text-3xl md:text-4xl hover:scale-125 transition-transform hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] active:scale-90">
                                {emj}
                            </button>
                        ))}
                    </div>

                    {/* Joker butonları */}
                    <div className="flex gap-2 justify-center">
                        {myJokers.narrow && !showNarrowHint && <button onClick={useNarrowJoker} className="glass px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 text-cyan-300 hover:bg-cyan-900/30 transition-colors"><Eye className="w-3.5 h-3.5" /> Daraltma</button>}
                        {myJokers.doublePts && !doublePtsActive && <button onClick={useDoubleJoker} className="glass px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 text-amber-300 hover:bg-amber-900/30 transition-colors"><span className="font-black">×</span> 2x Puan</button>}
                        {myJokers.extraWord && !extraWordRequested && !extraWord && <button onClick={useExtraWordJoker} className="glass px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 text-pink-300 hover:bg-pink-900/30 transition-colors"><Zap className="w-3.5 h-3.5" /> Ekstra Kelime</button>}
                    </div>

                    {!isReady ? (
                        <button onClick={handleReady} className="btn-primary w-full max-w-xs flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Hazırım!</button>
                    ) : (
                        <div className="glass px-4 py-2 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Hazırsın!</div>
                    )}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {nonPsychic.map((p, i) => <div key={i} className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${readyPlayers.has(p.name) ? 'bg-green-600/30 text-green-300' : 'bg-bg-card text-text-muted'}`}><span>{p.avatar}</span><span>{p.name}</span>{readyPlayers.has(p.name) && <CheckCircle2 className="w-3 h-3" />}</div>)}
                    </div>
                    <p className="text-text-muted text-xs">{readyCount}/{nonPsychic.length} hazır</p>
                </motion.div>
            )}

            {phase === 'guess' && isPsychic && (
                <div className="text-center"><p className="text-text-secondary text-sm mb-2">Takım ibreyi döndürüyor...</p><p className="text-text-muted text-xs">{readyCount}/{nonPsychic.length} hazır</p></div>
            )}

            {phase === 'reveal' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 w-full max-w-lg">
                    <AnimatePresence>
                        {showScoreAnim && (
                            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
                                <motion.div className={`text-6xl font-black mb-2 ${roundScore >= 4 ? 'text-blue-400' : roundScore >= 3 ? 'text-orange-400' : roundScore >= 2 ? 'text-yellow-400' : 'text-red-400'}`} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}>
                                    {roundScore >= 4 && <Sparkles className="w-12 h-12 mx-auto mb-1 text-blue-400" />}
                                    +{roundScore}
                                </motion.div>
                                <p className="text-text-secondary text-sm">{roundScore >= 4 ? 'Mükemmel!' : roundScore >= 3 ? 'Çok yakın!' : roundScore >= 2 ? 'Fena değil!' : 'Kaçtı...'}</p>
                                <p className="text-text-muted text-xs mt-1">{currentPsychic?.avatar} {currentPsychic?.name} → +{roundScore}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <button onClick={handleNextTurn} className="btn-primary w-full max-w-xs flex items-center justify-center gap-2"><RotateCw className="w-5 h-5" /> {turnIndex + 1 >= totalTurns ? 'Sonuçları Gör' : 'Sonraki Tur'}</button>
                </motion.div>
            )}

            <div className="fixed bottom-0 left-0 right-0 bg-bg-primary/80 backdrop-blur-md border-t border-border py-2 px-4">
                <div className="flex justify-center gap-3 max-w-lg mx-auto overflow-x-auto">
                    {allPlayers.map((p, i) => (
                        <div key={i} className={`flex flex-col items-center gap-0.5 min-w-fit ${currentPsychic?.name === p.name ? 'opacity-100' : 'opacity-60'}`}>
                            <div className="w-1.5 h-1.5 rounded-full mb-0.5" style={{ backgroundColor: p.color || '#8B5CF6' }} />
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
