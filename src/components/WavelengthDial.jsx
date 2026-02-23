import { useRef, useCallback, useEffect, useState } from 'react'

// Yarım daire "Wavelength" kadranı bileşeni
// Referans görseldeki gibi sade, krem/beyaz arka plan, puanlı bölgeler

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

    const angleToPosition = (angle, r = 190) => {
        const rad = (angle * Math.PI) / 180
        const cx = 250, cy = 250
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

    // Arc path oluştur
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

    // İbre ucu konumu
    const needleEnd = angleToPosition(localAngle, 195)

    // Hedef bölgesi: 4 puan = ±8°, 3 puan = ±16°, 2 puan = ±24°
    const targetZones = [
        { delta: 24, color: '#c2956a', label: '2' },
        { delta: 16, color: '#d4a76a', label: '3' },
        { delta: 8, color: '#e8c547', label: '4' },
    ]

    // Puan etiketlerini yerleştir
    const getZoneLabelPos = (targetAng, delta, r = 155) => {
        const leftAngle = targetAng - delta + (delta > 8 ? (delta === 24 ? 4 : 4) : 0)
        const rightAngle = targetAng + delta - (delta > 8 ? (delta === 24 ? 4 : 4) : 0)
        return {
            left: angleToPosition(leftAngle, r),
            right: angleToPosition(rightAngle, r),
        }
    }

    return (
        <div className="flex flex-col items-center w-full select-none">
            {/* Etiketler */}
            <div className="flex justify-between w-full max-w-lg mb-3 px-2">
                <span className="text-sm md:text-base font-bold text-slate-200 bg-slate-700/60 px-4 py-2 rounded-xl">
                    {leftLabel}
                </span>
                <span className="text-sm md:text-base font-bold text-slate-200 bg-slate-700/60 px-4 py-2 rounded-xl">
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
                    <filter id="needle-shadow">
                        <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
                    </filter>
                </defs>

                {/* Ana yarım daire – sade krem/beyaz arka plan */}
                <path
                    d={createArcPath(0, 180, 0, 200)}
                    fill="#f5f0e8"
                    stroke="#2a2a4a"
                    strokeWidth="2"
                />

                {/* İç daire (koyu alan) */}
                <path
                    d={createArcPath(0, 180, 0, 60)}
                    fill="#1a1a2e"
                    stroke="none"
                />

                {/* Dilim çizgileri (derecelendirme) */}
                {Array.from({ length: 19 }).map((_, i) => {
                    const angle = i * 10
                    const inner = angleToPosition(angle, 60)
                    const outer = angleToPosition(angle, 200)
                    return (
                        <line
                            key={`tick-${i}`}
                            x1={inner.x}
                            y1={inner.y}
                            x2={outer.x}
                            y2={outer.y}
                            stroke="#c4b99a"
                            strokeWidth="0.8"
                            opacity="0.5"
                        />
                    )
                })}

                {/* Hedef Bölgesi - Sadece reveal aşamasında veya medyum gösterimi */}
                {showTarget && targetZones.map((zone, idx) => {
                    const startA = Math.max(0, targetAngle - zone.delta)
                    const endA = Math.min(180, targetAngle + zone.delta)
                    return (
                        <path
                            key={`zone-${idx}`}
                            d={createArcPath(startA, endA, 60, 200)}
                            fill={zone.color}
                            stroke="#8a7b5a"
                            strokeWidth="0.5"
                            opacity="0.85"
                        />
                    )
                })}

                {/* Hedef bölge puan etiketleri */}
                {showTarget && targetZones.map((zone, idx) => {
                    const pos = getZoneLabelPos(targetAngle, zone.delta, idx === 0 ? 140 : idx === 1 ? 140 : 140)
                    return (
                        <g key={`label-${idx}`}>
                            {/* Sol taraf puan */}
                            <text
                                x={pos.left.x}
                                y={pos.left.y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#1a1a2e"
                                fontSize="16"
                                fontWeight="bold"
                            >
                                {zone.label}
                            </text>
                            {/* Sağ taraf puan */}
                            <text
                                x={pos.right.x}
                                y={pos.right.y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#1a1a2e"
                                fontSize="16"
                                fontWeight="bold"
                            >
                                {zone.label}
                            </text>
                        </g>
                    )
                })}

                {/* Hedef merkez çizgisi */}
                {showTarget && (() => {
                    const tp = angleToPosition(targetAngle, 200)
                    const ti = angleToPosition(targetAngle, 60)
                    return (
                        <line
                            x1={ti.x}
                            y1={ti.y}
                            x2={tp.x}
                            y2={tp.y}
                            stroke="#1a1a2e"
                            strokeWidth="2.5"
                            opacity="0.7"
                        />
                    )
                })()}

                {/* Merkez nokta */}
                <circle cx="250" cy="250" r="10" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="2" />

                {/* İbre çizgisi */}
                <line
                    x1="250"
                    y1="250"
                    x2={needleEnd.x}
                    y2={needleEnd.y}
                    stroke="#1a1a2e"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#needle-shadow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }}
                />
                {/* İbre ucu dairesi */}
                <circle
                    cx={needleEnd.x}
                    cy={needleEnd.y}
                    r="9"
                    fill="white"
                    stroke="#1a1a2e"
                    strokeWidth="3"
                    filter="url(#needle-shadow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }}
                />

                {/* Alt düz çizgi */}
                <line x1="45" y1="252" x2="455" y2="252" stroke="#3a3a5e" strokeWidth="2" />
            </svg>
        </div>
    )
}
