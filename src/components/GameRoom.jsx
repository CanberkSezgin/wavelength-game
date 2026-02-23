import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCw, Eye, Lightbulb, Trophy, Users, ArrowRight, Sparkles } from 'lucide-react'
import WavelengthDial from './WavelengthDial'
import CARDS from '../data/cards'

// Oyun aşamaları:
// 'clue'    -> İpucu veren (medyum) hedefi görür, ipucu yazar
// 'guess'   -> Diğerleri ipucuya bakıp ibreyi döndürür
// 'reveal'  -> Hedef gösterilir, puan hesaplanır

export default function GameRoom({ network, playerName }) {
    const [phase, setPhase] = useState('clue')        // clue | guess | reveal
    const [card, setCard] = useState(null)              // { left, right }
    const [targetAngle, setTargetAngle] = useState(90)  // Hedefin açısı 0-180
    const [dialAngle, setDialAngle] = useState(90)      // İbrenin açısı
    const [clue, setClue] = useState('')                 // Medyumun ipucu metni
    const [clueInput, setClueInput] = useState('')       // İpucu input alanı
    const [isPsychic, setIsPsychic] = useState(false)   // Bu oyuncu medyum mu?
    const [score, setScore] = useState(0)                // Toplam puan
    const [roundScore, setRoundScore] = useState(0)      // Bu turun puanı
    const [roundNumber, setRoundNumber] = useState(1)
    const [showScoreAnim, setShowScoreAnim] = useState(false)

    const usedCardsRef = useRef(new Set())
    const throttleRef = useRef(null)
    // Medyum sırası: tek turlar host, çift turlar misafir
    const psychicTurnRef = useRef(0)

    // Yeni raunt başlat
    const startNewRound = useCallback((roundNum) => {
        // Rastgele kart seç (daha önce kullanılmamış)
        let availableCards = CARDS.filter((_, i) => !usedCardsRef.current.has(i))
        if (availableCards.length === 0) {
            usedCardsRef.current.clear()
            availableCards = CARDS
        }
        const randomIdx = Math.floor(Math.random() * availableCards.length)
        const cardIdx = CARDS.indexOf(availableCards[randomIdx])
        usedCardsRef.current.add(cardIdx)

        const newCard = CARDS[cardIdx]
        const newTarget = Math.floor(Math.random() * 160) + 10 // 10-170 arası

        // Çift/tek tur mantığı: Host tek turda medyum, çift turda misafir medyum
        const hostIsPsychic = (psychicTurnRef.current % 2 === 0)
        psychicTurnRef.current += 1

        setCard(newCard)
        setTargetAngle(newTarget)
        setDialAngle(90)
        setClue('')
        setClueInput('')
        setPhase('clue')
        setIsPsychic(hostIsPsychic) // Host kendi durumunu ayarlar
        setRoundScore(0)
        setRoundNumber(roundNum)
        setShowScoreAnim(false)

        // Host ise diğerlerine yeni round bilgisi gönder
        if (network.isHost) {
            network.broadcast({
                type: 'new-round',
                card: newCard,
                targetAngle: newTarget,
                roundNumber: roundNum,
                hostIsPsychic: hostIsPsychic,
            })
        }
    }, [network])

    // İlk açıldığında host ise round başlat
    useEffect(() => {
        if (network.isHost) {
            startNewRound(1)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Ağdan gelen mesajları dinle
    useEffect(() => {
        network.onMessage((data) => {
            switch (data.type) {
                case 'new-round':
                    setCard(data.card)
                    setTargetAngle(data.targetAngle)
                    setDialAngle(90)
                    setClue('')
                    setClueInput('')
                    setPhase('clue')
                    // Host medyumsa, misafir medyum DEĞİLDİR (ve tam tersi)
                    setIsPsychic(!data.hostIsPsychic)
                    setRoundScore(0)
                    setRoundNumber(data.roundNumber)
                    setShowScoreAnim(false)
                    break

                case 'clue-submitted':
                    setClue(data.clue)
                    setPhase('guess')
                    break

                case 'dial-move':
                    setDialAngle(data.angle)
                    break

                case 'reveal':
                    setPhase('reveal')
                    setRoundScore(data.roundScore)
                    setScore(prev => prev + data.roundScore)
                    setShowScoreAnim(true)
                    break

                case 'game-start':
                    break

                case 'player-joined':
                    break

                case 'next-round-request':
                    // Host yeni round başlatır
                    if (network.isHost) {
                        setRoundNumber(prev => {
                            const nextRound = prev + 1
                            startNewRound(nextRound)
                            return nextRound
                        })
                    }
                    break

                default:
                    break
            }
        })
    }, [network, startNewRound])

    // İpucu gönder
    const submitClue = () => {
        if (!clueInput.trim()) return
        setClue(clueInput.trim())
        setPhase('guess')
        network.broadcast({ type: 'clue-submitted', clue: clueInput.trim() })
    }

    // İbre hareket -> broadcast (throttle ile)
    const handleDialMove = useCallback((angle) => {
        setDialAngle(angle)
        // Throttle: her 30ms'de bir gönder
        if (throttleRef.current) return
        throttleRef.current = setTimeout(() => {
            network.broadcast({ type: 'dial-move', angle })
            throttleRef.current = null
        }, 30)
    }, [network])

    // Sonucu göster (reveal)
    const handleReveal = () => {
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
        setShowScoreAnim(true)

        network.broadcast({ type: 'reveal', roundScore: pts })
    }

    // Sonraki round
    const handleNextRound = () => {
        if (network.isHost) {
            setRoundNumber(prev => {
                const nextRound = prev + 1
                startNewRound(nextRound)
                return nextRound
            })
        } else {
            network.broadcast({ type: 'next-round-request' })
        }
    }

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

    return (
        <div className="min-h-screen flex flex-col items-center px-4 py-4 md:py-6">
            {/* Üst Bilgi Çubuğu */}
            <div className="w-full max-w-lg flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-semibold">{network.playerCount}</span>
                    </div>
                    <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <span className="text-xs text-text-muted">Tur</span>
                        <span className="text-sm font-bold text-purple-300">{roundNumber}</span>
                    </div>
                </div>
                <div className="glass px-4 py-1.5 rounded-xl flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-amber-300">{score}</span>
                    <span className="text-xs text-text-muted">puan</span>
                </div>
            </div>

            {/* Faz Göstergesi */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-4"
                >
                    {phase === 'clue' && (
                        <div className="glass px-5 py-2.5 rounded-2xl flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-amber-400" />
                            <span className="font-semibold text-sm">
                                {isPsychic ? 'Sen Medyumsun! İpucu Yaz' : 'Medyum ipucu yazıyor...'}
                            </span>
                        </div>
                    )}
                    {phase === 'guess' && (
                        <div className="glass px-5 py-2.5 rounded-2xl flex items-center gap-2">
                            <RotateCw className="w-5 h-5 text-blue-400" />
                            <span className="font-semibold text-sm">İbreyi Döndür!</span>
                        </div>
                    )}
                    {phase === 'reveal' && (
                        <div className="glass px-5 py-2.5 rounded-2xl flex items-center gap-2">
                            <Eye className="w-5 h-5 text-green-400" />
                            <span className="font-semibold text-sm">Sonuç!</span>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* İpucu Alanı - Medyum yazıyor */}
            {phase === 'clue' && isPsychic && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-strong rounded-2xl p-5 max-w-lg w-full mb-4"
                >
                    <p className="text-sm text-text-secondary mb-2 text-center">
                        Hedef bölge aşağıda gösteriliyor. Takımına bir ipucu yaz:
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={clueInput}
                            onChange={(e) => setClueInput(e.target.value)}
                            placeholder="İpucu yaz... (Örn: Pizza)"
                            className="input-field"
                            maxLength={50}
                            onKeyDown={(e) => e.key === 'Enter' && submitClue()}
                        />
                        <button
                            onClick={submitClue}
                            disabled={!clueInput.trim()}
                            className="btn-primary whitespace-nowrap disabled:opacity-40"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>
            )}

            {phase === 'clue' && !isPsychic && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="glass rounded-2xl p-5 max-w-lg w-full mb-4 text-center"
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
                    <p className="text-text-secondary text-sm mt-2">Medyum ipucu düşünüyor...</p>
                </motion.div>
            )}

            {/* İpucu Gösterim (guess & reveal) */}
            {(phase === 'guess' || phase === 'reveal') && clue && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-strong rounded-2xl px-6 py-4 max-w-lg w-full mb-4 text-center"
                >
                    <p className="text-xs text-text-muted mb-1">İpucu</p>
                    <p className="text-2xl md:text-3xl font-black text-purple-200">
                        &ldquo;{clue}&rdquo;
                    </p>
                </motion.div>
            )}

            {/* Kadran */}
            <div className="w-full max-w-lg mb-4">
                <WavelengthDial
                    targetAngle={targetAngle}
                    dialAngle={dialAngle}
                    onAngleChange={handleDialMove}
                    showTarget={phase === 'reveal' || (phase === 'clue' && isPsychic)}
                    disabled={phase === 'clue' || phase === 'reveal'}
                    leftLabel={card.left}
                    rightLabel={card.right}
                    phase={phase}
                />
            </div>

            {/* Reveal Butonları */}
            {phase === 'guess' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3 w-full max-w-lg"
                >
                    {isPsychic ? (
                        <p className="text-text-secondary text-sm text-center">
                            Takım arkadaşların ibreyi döndürüyor...
                        </p>
                    ) : (
                        <p className="text-text-secondary text-xs text-center">
                            İbreyi sürükleyerek tahmininizi yapın
                        </p>
                    )}
                    <button
                        onClick={handleReveal}
                        className="btn-primary w-full max-w-xs flex items-center justify-center gap-2"
                    >
                        <Eye className="w-5 h-5" />
                        Sonucu Göster
                    </button>
                </motion.div>
            )}

            {/* Sonuç Ekranı */}
            {phase === 'reveal' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4 w-full max-w-lg"
                >
                    {/* Puan Animasyonu */}
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

                    <button
                        onClick={handleNextRound}
                        className="btn-primary w-full max-w-xs flex items-center justify-center gap-2"
                    >
                        <RotateCw className="w-5 h-5" />
                        Sonraki Tur
                    </button>
                </motion.div>
            )}
        </div>
    )
}
