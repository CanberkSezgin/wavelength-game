import { useRef, useCallback, useEffect, useState } from 'react'

// Wavelength kadranı — Referans görsele uygun:
// Krem arka planlı yarım daire, üçgen dilimler (4=mavi, 3=turuncu, 2=sarı)

export default function WavelengthDial({
    targetAngle = 90,
    dialAngle = 90,
    onAngleChange,
    showTarget = false,
    disabled = false,
    leftLabel = "Sol",
    rightLabel = "Sağ",
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

        // Yön düzeltmesi: sağa = sağa, sola = sola
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

    // Üçgen dilim oluşturucu (merkezden dışa doğru üçgen)
    const createTrianglePath = (centerAngle, halfSpread, radius) => {
        const cx = 250, cy = 250
        const toRad = (a) => (a * Math.PI) / 180
        const startA = centerAngle - halfSpread
        const endA = centerAngle + halfSpread

        const x1 = cx - radius * Math.cos(toRad(startA))
        const y1 = cy - radius * Math.sin(toRad(startA))
        const x2 = cx - radius * Math.cos(toRad(endA))
        const y2 = cy - radius * Math.sin(toRad(endA))

        // Üçgen: merkez noktası → dış kenar yayı → geri merkez
        const largeArc = (endA - startA) > 180 ? 1 : 0
        return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2} Z`
    }

    // Arc path oluşturucu (yarım daire arka plan için)
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
    const needleEnd = angleToPosition(localAngle, 200)

    // Hedef üçgen dilimleri — referansa uygun: 4=mavi, 3=turuncu, 2=sarı
    // Dıştan içe sıralı render (2 en dış, 4 en iç)
    const zones = [
        { delta: 24, color: '#F5C842', label: '2' },  // Sarı (dış)
        { delta: 16, color: '#E8882D', label: '3' },  // Turuncu (orta)
        { delta: 8, color: '#3B82F6', label: '4' },  // Mavi (iç)
    ]

    return (
        <div className="flex flex-col items-center w-full select-none">
            {/* Etiketler */}
            <div className="flex justify-between w-full max-w-lg mb-2 px-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg opacity-50">←</span>
                    <span className="text-sm md:text-base font-bold text-slate-200">
                        {leftLabel}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm md:text-base font-bold text-slate-200">
                        {rightLabel}
                    </span>
                    <span className="text-lg opacity-50">→</span>
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

                {/* Ana yarım daire — krem arka plan */}
                <path
                    d={createArcPath(0, 180, 0, 200)}
                    fill="#E8DCC8"
                    stroke="#1a1a2e"
                    strokeWidth="3"
                />

                {/* Hedef bölgesi üçgen dilimleri — dıştan içe render */}
                {showTarget && zones.map((zone, idx) => (
                    <path
                        key={`zone-${idx}`}
                        d={createTrianglePath(targetAngle, zone.delta, 195)}
                        fill={zone.color}
                        stroke="#1a1a2e"
                        strokeWidth="1.5"
                    />
                ))}

                {/* Puan etiketleri — her dilimde sol ve sağ taraf */}
                {showTarget && (() => {
                    const labels = []
                    // 2 puan etiketleri (sol ve sağ dış bant)
                    const pos2L = angleToPosition(targetAngle - 20, 120)
                    const pos2R = angleToPosition(targetAngle + 20, 120)
                    labels.push(
                        <text key="l2l" x={pos2L.x} y={pos2L.y} textAnchor="middle" dominantBaseline="middle" fill="#1a1a2e" fontSize="16" fontWeight="800">2</text>,
                        <text key="l2r" x={pos2R.x} y={pos2R.y} textAnchor="middle" dominantBaseline="middle" fill="#1a1a2e" fontSize="16" fontWeight="800">2</text>,
                    )
                    // 3 puan etiketleri
                    const pos3L = angleToPosition(targetAngle - 12, 100)
                    const pos3R = angleToPosition(targetAngle + 12, 100)
                    labels.push(
                        <text key="l3l" x={pos3L.x} y={pos3L.y} textAnchor="middle" dominantBaseline="middle" fill="#1a1a2e" fontSize="16" fontWeight="800">3</text>,
                        <text key="l3r" x={pos3R.x} y={pos3R.y} textAnchor="middle" dominantBaseline="middle" fill="#1a1a2e" fontSize="16" fontWeight="800">3</text>,
                    )
                    // 4 puan etiketi (merkez)
                    const pos4 = angleToPosition(targetAngle, 75)
                    labels.push(
                        <text key="l4" x={pos4.x} y={pos4.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="18" fontWeight="900">4</text>,
                    )
                    return labels
                })()}

                {/* Hedef merkez çizgisi */}
                {showTarget && (() => {
                    const tp = angleToPosition(targetAngle, 195)
                    return (
                        <line
                            x1="250" y1="250"
                            x2={tp.x} y2={tp.y}
                            stroke="#1a1a2e"
                            strokeWidth="2"
                            opacity="0.6"
                        />
                    )
                })()}

                {/* Derece çizgileri (ince tick'ler) */}
                {Array.from({ length: 37 }).map((_, i) => {
                    const angle = i * 5
                    const isMain = i % 4 === 0
                    const inner = angleToPosition(angle, isMain ? 190 : 194)
                    const outer = angleToPosition(angle, 200)
                    return (
                        <line
                            key={`tick-${i}`}
                            x1={inner.x} y1={inner.y}
                            x2={outer.x} y2={outer.y}
                            stroke="#1a1a2e"
                            strokeWidth={isMain ? "1.5" : "0.7"}
                            opacity="0.3"
                        />
                    )
                })}

                {/* Merkez noktası */}
                <circle cx="250" cy="250" r="12" fill="#1a1a2e" stroke="#333" strokeWidth="2" />
                <circle cx="250" cy="250" r="5" fill="#555" />

                {/* İbre çizgisi */}
                <line
                    x1="250" y1="250"
                    x2={needleEnd.x} y2={needleEnd.y}
                    stroke="#1a1a2e"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#needle-shadow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }}
                />
                {/* İbre ucu */}
                <circle
                    cx={needleEnd.x} cy={needleEnd.y}
                    r="10"
                    fill="white"
                    stroke="#1a1a2e"
                    strokeWidth="3"
                    filter="url(#needle-shadow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }}
                />

                {/* Hareket ettiren bilgisi */}
                {moverInfo && (
                    <g>
                        <text
                            x={needleEnd.x} y={needleEnd.y - 22}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize="16"
                        >
                            {moverInfo.avatar}
                        </text>
                        <text
                            x={needleEnd.x} y={needleEnd.y - 38}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="white" fontSize="10" fontWeight="600"
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
