import { useRef, useCallback, useEffect, useState } from 'react'

// Yarım daire "Wavelength" kadranı bileşeni
// targetAngle: Gizli hedefin merkez açısı (0-180)
// dialAngle: İbrenin mevcut açısı (0-180)
// onAngleChange: İbre hareket ettiğinde çağrılır
// showTarget: Hedef gösterilsin mi
// disabled: İbre sürüklenebilir mi
// phase: Oyun fazı (clue, guess, reveal)

export default function WavelengthDial({
    targetAngle = 90,
    dialAngle = 90,
    onAngleChange,
    showTarget = false,
    disabled = false,
    leftLabel = "Sol",
    rightLabel = "Sağ",
    phase = "guess",
}) {
    const svgRef = useRef(null)
    const isDragging = useRef(false)
    const [localAngle, setLocalAngle] = useState(dialAngle)

    useEffect(() => {
        setLocalAngle(dialAngle)
    }, [dialAngle])

    const angleToPosition = (angle) => {
        const rad = (angle * Math.PI) / 180
        const cx = 250, cy = 250, r = 200
        return {
            x: cx - r * Math.cos(rad),
            y: cy - r * Math.sin(rad),
        }
    }

    const getAngleFromEvent = useCallback((e) => {
        const svg = svgRef.current
        if (!svg) return localAngle
        const rect = svg.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height

        let clientX, clientY
        if (e.touches) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = e.clientX
            clientY = e.clientY
        }

        const dx = clientX - cx
        const dy = cy - clientY
        let angle = Math.atan2(dy, dx) * (180 / Math.PI)
        if (angle < 0) angle = 0
        if (angle > 180) angle = 180
        // En az 5, en çok 175 olsun
        angle = Math.max(5, Math.min(175, angle))
        return angle
    }, [localAngle])

    const handlePointerDown = useCallback((e) => {
        if (disabled) return
        e.preventDefault()
        isDragging.current = true
        const angle = getAngleFromEvent(e)
        setLocalAngle(angle)
        if (onAngleChange) onAngleChange(angle)
    }, [disabled, getAngleFromEvent, onAngleChange])

    const handlePointerMove = useCallback((e) => {
        if (!isDragging.current || disabled) return
        e.preventDefault()
        const angle = getAngleFromEvent(e)
        setLocalAngle(angle)
        if (onAngleChange) onAngleChange(angle)
    }, [disabled, getAngleFromEvent, onAngleChange])

    const handlePointerUp = useCallback(() => {
        isDragging.current = false
    }, [])

    useEffect(() => {
        window.addEventListener('mousemove', handlePointerMove)
        window.addEventListener('mouseup', handlePointerUp)
        window.addEventListener('touchmove', handlePointerMove, { passive: false })
        window.addEventListener('touchend', handlePointerUp)
        return () => {
            window.removeEventListener('mousemove', handlePointerMove)
            window.removeEventListener('mouseup', handlePointerUp)
            window.removeEventListener('touchmove', handlePointerMove)
            window.removeEventListener('touchend', handlePointerUp)
        }
    }, [handlePointerMove, handlePointerUp])

    // Hedef bölgesi arc path'leri
    const createArcPath = (startAngle, endAngle, innerR, outerR) => {
        const cx = 250, cy = 250
        const toRad = (a) => (a * Math.PI) / 180
        const x1o = cx - outerR * Math.cos(toRad(startAngle))
        const y1o = cy - outerR * Math.sin(toRad(startAngle))
        const x2o = cx - outerR * Math.cos(toRad(endAngle))
        const y2o = cy - outerR * Math.sin(toRad(endAngle))
        const x1i = cx - innerR * Math.cos(toRad(endAngle))
        const y1i = cy - innerR * Math.sin(toRad(endAngle))
        const x2i = cx - innerR * Math.cos(toRad(startAngle))
        const y2i = cy - innerR * Math.sin(toRad(startAngle))
        const largeArc = endAngle - startAngle > 180 ? 1 : 0
        return `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 0 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 1 ${x2i} ${y2i} Z`
    }

    // Spektrum renkleri – yarım daire boyunca soldan sağa gökkuşağı
    const spectrumSegments = 36
    const segmentAngle = 180 / spectrumSegments

    // İbre ucu konumu
    const needleEnd = angleToPosition(localAngle)

    // Hedef bölgesi: 4 puan = ±8°, 3 puan = ±16°, 2 puan = ±24°
    const targetZones = [
        { delta: 24, color: 'rgba(34,197,94,0.25)', points: 2 },
        { delta: 16, color: 'rgba(34,197,94,0.4)', points: 3 },
        { delta: 8, color: 'rgba(34,197,94,0.7)', points: 4 },
    ]

    return (
        <div className="flex flex-col items-center w-full select-none">
            {/* Etiketler */}
            <div className="flex justify-between w-full max-w-lg mb-2 px-2">
                <span className="text-sm md:text-base font-bold text-purple-300 bg-purple-900/40 px-3 py-1.5 rounded-xl">
                    {leftLabel}
                </span>
                <span className="text-sm md:text-base font-bold text-amber-300 bg-amber-900/40 px-3 py-1.5 rounded-xl">
                    {rightLabel}
                </span>
            </div>

            {/* SVG Kadran */}
            <svg
                ref={svgRef}
                viewBox="0 0 500 280"
                className="w-full max-w-lg cursor-pointer"
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                style={{ touchAction: 'none' }}
            >
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="shadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
                    </filter>
                    <linearGradient id="spectrumGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="25%" stopColor="#3b82f6" />
                        <stop offset="50%" stopColor="#22c55e" />
                        <stop offset="75%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                </defs>

                {/* Arka Plan Yay – Spektrum Renkleri */}
                {Array.from({ length: spectrumSegments }).map((_, i) => {
                    const startA = i * segmentAngle
                    const endA = (i + 1) * segmentAngle
                    const hue = (i / spectrumSegments) * 300
                    return (
                        <path
                            key={`seg-${i}`}
                            d={createArcPath(startA, endA, 80, 200)}
                            fill={`hsl(${hue}, 70%, 45%)`}
                            opacity={0.6}
                            stroke="rgba(10,10,26,0.4)"
                            strokeWidth="0.5"
                        />
                    )
                })}

                {/* Hedef Bölgesi - Sadece reveal aşamasında veya showTarget */}
                {showTarget && targetZones.map((zone, idx) => {
                    const startA = Math.max(0, targetAngle - zone.delta)
                    const endA = Math.min(180, targetAngle + zone.delta)
                    return (
                        <path
                            key={`zone-${idx}`}
                            d={createArcPath(startA, endA, 80, 200)}
                            fill={zone.color}
                            stroke="rgba(34,197,94,0.3)"
                            strokeWidth="1"
                        />
                    )
                })}

                {/* Hedef merkez çizgisi - sadece reveal'da */}
                {showTarget && (() => {
                    const tp = angleToPosition(targetAngle)
                    return (
                        <line
                            x1="250"
                            y1="250"
                            x2={tp.x}
                            y2={tp.y}
                            stroke="#22c55e"
                            strokeWidth="3"
                            strokeDasharray="6 4"
                            opacity="0.8"
                            filter="url(#glow)"
                        />
                    )
                })()}

                {/* Dış çerçeve */}
                <path
                    d={createArcPath(0, 180, 198, 202)}
                    fill="none"
                    stroke="rgba(124,58,237,0.4)"
                    strokeWidth="2"
                />
                <path
                    d={createArcPath(0, 180, 78, 82)}
                    fill="none"
                    stroke="rgba(124,58,237,0.2)"
                    strokeWidth="1"
                />

                {/* Merkez nokta */}
                <circle cx="250" cy="250" r="12" fill="#1a1a3e" stroke="#7c3aed" strokeWidth="3" />
                <circle cx="250" cy="250" r="6" fill="#7c3aed" />

                {/* İbre */}
                <line
                    x1="250"
                    y1="250"
                    x2={needleEnd.x}
                    y2={needleEnd.y}
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#shadow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }}
                />
                {/* İbre ucu */}
                <circle
                    cx={needleEnd.x}
                    cy={needleEnd.y}
                    r="10"
                    fill="white"
                    stroke="#7c3aed"
                    strokeWidth="3"
                    filter="url(#glow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }}
                />

                {/* Alt düz çizgi */}
                <line x1="40" y1="252" x2="460" y2="252" stroke="rgba(124,58,237,0.3)" strokeWidth="2" />
            </svg>
        </div>
    )
}
