import { useRef, useCallback, useEffect, useState } from 'react'

// Wavelength kadranı: Referans görsele uygun sade tasarım
// Koyu arka plan, beyaz/krem yarım daire, renkli dilimler (4-3-2 puan bölgeleri)

export default function WavelengthDial({
    targetAngle = 90,
    dialAngle = 90,
    onAngleChange,
    showTarget = false,
    disabled = false,
    leftLabel = "Sol",
    rightLabel = "Sağ",
    phase = "guess",
    moverInfo = null,
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

        // FIX: dx yönü düzeltildi (sağa = sağa, sola = sola)
        const dx = cx - clientX
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

    // Arc path oluşturucu
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

    // Hedef bölge dilimleri — referans görseldeki gibi ayrı renkli dilimler
    // Merkez: 4 puan (turuncu/altın), Orta: 3 puan (koyu turuncu), Dış: 2 puan (kahverengi)
    const zones = [
        { delta: 24, innerDelta: 16, color: '#8B6914', label: '2' }, // Dış halka
        { delta: 16, innerDelta: 8, color: '#C4841D', label: '3' },  // Orta halka
        { delta: 8, innerDelta: 0, color: '#E8A020', label: '4' },   // İç (merkez)
    ]

    return (
        <div className="flex flex-col items-center w-full select-none">
            {/* Etiketler */}
            <div className="flex justify-between w-full max-w-lg mb-2 px-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg">←</span>
                    <span className="text-sm md:text-base font-bold text-slate-200">
                        {leftLabel}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm md:text-base font-bold text-slate-200">
                        {rightLabel}
                    </span>
                    <span className="text-lg">→</span>
                </div>
            </div>

            {/* SVG Kadran */}
            <svg
                ref={svgRef}
                viewBox="0 0 500 290"
                className="w-full max-w-lg cursor-pointer"
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                style={{ touchAction: 'none' }}
            >
                <defs>
                    <filter id="needle-shadow">
                        <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
                    </filter>
                </defs>

                {/* Ana yarım daire – krem/beyaz arka plan */}
                <path
                    d={createArcPath(0, 180, 0, 200)}
                    fill="#E8DCC8"
                    stroke="#1a1a2e"
                    strokeWidth="3"
                />

                {/* Hedef Bölgesi - Sadece reveal veya medyum */}
                {showTarget && zones.map((zone, idx) => {
                    // Dış sınır dilimleri (sol ve sağ ayrı ayrı)
                    const startLeft = Math.max(0, targetAngle - zone.delta)
                    const endLeft = Math.max(0, targetAngle - zone.innerDelta)
                    const startRight = Math.min(180, targetAngle + zone.innerDelta)
                    const endRight = Math.min(180, targetAngle + zone.delta)

                    // Merkez dilim (innerDelta===0 ise tam ortada tek dilim)
                    if (zone.innerDelta === 0) {
                        const s = Math.max(0, targetAngle - zone.delta)
                        const e = Math.min(180, targetAngle + zone.delta)
                        return (
                            <g key={`zone-${idx}`}>
                                <path
                                    d={createArcPath(s, e, 0, 200)}
                                    fill={zone.color}
                                    stroke="#1a1a2e"
                                    strokeWidth="1.5"
                                />
                                {/* Puan etiketi merkez */}
                                {(() => {
                                    const pos = angleToPosition(targetAngle, 110)
                                    return (
                                        <text
                                            x={pos.x} y={pos.y}
                                            textAnchor="middle" dominantBaseline="middle"
                                            fill="#1a1a2e" fontSize="22" fontWeight="900"
                                        >
                                            {zone.label}
                                        </text>
                                    )
                                })()}
                            </g>
                        )
                    }

                    return (
                        <g key={`zone-${idx}`}>
                            {/* Sol dilim */}
                            {endLeft > startLeft && (
                                <path
                                    d={createArcPath(startLeft, endLeft, 0, 200)}
                                    fill={zone.color}
                                    stroke="#1a1a2e"
                                    strokeWidth="1.5"
                                />
                            )}
                            {/* Sağ dilim */}
                            {endRight > startRight && (
                                <path
                                    d={createArcPath(startRight, endRight, 0, 200)}
                                    fill={zone.color}
                                    stroke="#1a1a2e"
                                    strokeWidth="1.5"
                                />
                            )}
                            {/* Puan etiketleri */}
                            {(() => {
                                const leftMid = (startLeft + endLeft) / 2
                                const rightMid = (startRight + endRight) / 2
                                const posL = angleToPosition(leftMid, 110)
                                const posR = angleToPosition(rightMid, 110)
                                return (
                                    <>
                                        {endLeft > startLeft && (
                                            <text
                                                x={posL.x} y={posL.y}
                                                textAnchor="middle" dominantBaseline="middle"
                                                fill="#1a1a2e" fontSize="18" fontWeight="800"
                                            >
                                                {zone.label}
                                            </text>
                                        )}
                                        {endRight > startRight && (
                                            <text
                                                x={posR.x} y={posR.y}
                                                textAnchor="middle" dominantBaseline="middle"
                                                fill="#1a1a2e" fontSize="18" fontWeight="800"
                                            >
                                                {zone.label}
                                            </text>
                                        )}
                                    </>
                                )
                            })()}
                        </g>
                    )
                })}

                {/* Derece çizgileri */}
                {Array.from({ length: 37 }).map((_, i) => {
                    const angle = i * 5
                    const isMain = i % 2 === 0
                    const inner = angleToPosition(angle, isMain ? 188 : 192)
                    const outer = angleToPosition(angle, 200)
                    return (
                        <line
                            key={`tick-${i}`}
                            x1={inner.x} y1={inner.y}
                            x2={outer.x} y2={outer.y}
                            stroke="#1a1a2e"
                            strokeWidth={isMain ? "1.5" : "0.8"}
                            opacity="0.4"
                        />
                    )
                })}

                {/* Hedef merkez çizgisi */}
                {showTarget && (() => {
                    const tp = angleToPosition(targetAngle, 200)
                    return (
                        <line
                            x1="250" y1="250"
                            x2={tp.x} y2={tp.y}
                            stroke="#1a1a2e"
                            strokeWidth="3"
                            opacity="0.8"
                        />
                    )
                })()}

                {/* Merkez daire */}
                <circle cx="250" cy="250" r="12" fill="#1a1a2e" stroke="#333" strokeWidth="2" />
                <circle cx="250" cy="250" r="5" fill="#555" />

                {/* İbre */}
                <line
                    x1="250" y1="250"
                    x2={needleEnd.x} y2={needleEnd.y}
                    stroke="#1a1a2e"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#needle-shadow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }}
                />
                {/* İbre ucu dairesi */}
                <circle
                    cx={needleEnd.x} cy={needleEnd.y}
                    r="10"
                    fill="white"
                    stroke="#1a1a2e"
                    strokeWidth="3"
                    filter="url(#needle-shadow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }}
                />

                {/* Hareket ettiren kişi bilgisi */}
                {moverInfo && (
                    <g>
                        <text
                            x={needleEnd.x}
                            y={needleEnd.y - 22}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="16"
                        >
                            {moverInfo.avatar}
                        </text>
                        <text
                            x={needleEnd.x}
                            y={needleEnd.y - 38}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontSize="10"
                            fontWeight="600"
                        >
                            {moverInfo.name}
                        </text>
                    </g>
                )}

                {/* Alt düz çizgi */}
                <line x1="45" y1="252" x2="455" y2="252" stroke="#1a1a2e" strokeWidth="3" />
            </svg>
        </div>
    )
}
