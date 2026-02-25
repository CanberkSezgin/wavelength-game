import { useRef, useCallback, useEffect, useState } from 'react'
import { playTick } from '../utils/sounds'

export default function WavelengthDial({
    targetAngle = 90,
    dialAngle = 90,
    onAngleChange,
    showTarget = false,
    disabled = false,
    leftLabel = "Sol",
    rightLabel = "Sağ",
    moverInfo = null,
    showNarrowHint = false,
}) {
    const svgRef = useRef(null)
    const isDragging = useRef(false)
    const [localAngle, setLocalAngle] = useState(dialAngle)
    const lastTickAngle = useRef(dialAngle)

    useEffect(() => { setLocalAngle(dialAngle) }, [dialAngle])

    const angleToPosition = (angle, r = 190) => {
        const rad = (angle * Math.PI) / 180
        return { x: 250 - r * Math.cos(rad), y: 250 - r * Math.sin(rad) }
    }

    const getAngleFromEvent = useCallback((e) => {
        const svg = svgRef.current
        if (!svg) return localAngle
        const rect = svg.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height
        const [clientX, clientY] = e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY]
        let angle = Math.atan2(cy - clientY, cx - clientX) * (180 / Math.PI)
        return Math.max(5, Math.min(175, angle < 0 ? 0 : angle > 180 ? 180 : angle))
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
        // Tick sesi — her 5 derecede bir
        if (Math.abs(angle - lastTickAngle.current) > 5) {
            playTick()
            lastTickAngle.current = angle
        }
        setLocalAngle(angle)
        if (onAngleChange) onAngleChange(angle)
    }, [disabled, getAngleFromEvent, onAngleChange])

    const handlePointerUp = useCallback(() => { isDragging.current = false }, [])

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

    // Üçgen dilim path (Yay düzeltmesi yapıldı)
    const createTrianglePath = (centerAngle, halfSpread, radius) => {
        const cx = 250, cy = 250
        const toRad = a => (a * Math.PI) / 180
        const sA = centerAngle - halfSpread, eA = centerAngle + halfSpread
        const x1 = cx - radius * Math.cos(toRad(sA)), y1 = cy - radius * Math.sin(toRad(sA))
        const x2 = cx - radius * Math.cos(toRad(eA)), y2 = cy - radius * Math.sin(toRad(eA))
        // Sweep flag (sonuncu 0 veya 1 parametresi) 1 yapıldı ki dışa doğru bombeli pikselsiz pürüzsüz bir yay çizsin
        return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`
    }

    // Arc path (yarım daire)
    const createArcPath = (startAngle, endAngle, innerR, outerR) => {
        const cx = 250, cy = 250, toRad = a => (a * Math.PI) / 180
        const x1o = cx - outerR * Math.cos(toRad(startAngle)), y1o = cy - outerR * Math.sin(toRad(startAngle))
        const x2o = cx - outerR * Math.cos(toRad(endAngle)), y2o = cy - outerR * Math.sin(toRad(endAngle))
        const x1i = cx - innerR * Math.cos(toRad(endAngle)), y1i = cy - innerR * Math.sin(toRad(endAngle))
        const x2i = cx - innerR * Math.cos(toRad(startAngle)), y2i = cy - innerR * Math.sin(toRad(startAngle))
        const la = endAngle - startAngle > 180 ? 1 : 0
        // sweep flag 1 for outer curve (upwards), 0 for inner curve
        return `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${la} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${la} 0 ${x2i} ${y2i} Z`
    }

    const needleEnd = angleToPosition(localAngle, 200)

    const zones = [
        { delta: 24, color: '#F5C842', label: '2' },
        { delta: 16, color: '#E8882D', label: '3' },
        { delta: 8, color: '#3B82F6', label: '4' },
    ]

    // Daraltma jokeri — hedefin hangi yarıda olduğunu göster
    const narrowHalf = targetAngle < 90 ? 'left' : 'right'

    return (
        <div className="flex flex-col items-center w-full select-none">
            <div className="flex justify-between w-full max-w-lg mb-2 px-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg opacity-50">←</span>
                    <span className="text-sm md:text-base font-bold text-slate-200">{leftLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm md:text-base font-bold text-slate-200">{rightLabel}</span>
                    <span className="text-lg opacity-50">→</span>
                </div>
            </div>

            <svg ref={svgRef} viewBox="0 0 500 290" className="w-full max-w-lg cursor-pointer"
                onMouseDown={handlePointerDown} onTouchStart={handlePointerDown} style={{ touchAction: 'none' }}>
                <defs>
                    <filter id="needle-shadow"><feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.5" /></filter>
                </defs>

                {/* Açık Renkli, Göz Yormayan, Hafif Saydam Yarım Ay Arka Planı (0-180) */}
                <path d={createArcPath(0, 180, 0, 200)} fill="rgba(226, 232, 240, 0.35)" stroke="rgba(203, 213, 225, 0.5)" strokeWidth="2" />

                {/* Daraltma jokeri göstergesi */}
                {showNarrowHint && (
                    <g>
                        <rect x="150" y="80" width="200" height="40" rx="10" fill="rgba(139, 92, 246, 0.9)" />
                        <text x="250" y="105" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
                            Hedef {narrowHalf === 'left' ? 'SOL' : 'SAĞ'} Yarıda
                        </text>
                    </g>
                )}

                {/* Hedef dilimleri */}
                {showTarget && zones.map((zone, idx) => (
                    <path key={idx} d={createTrianglePath(targetAngle, zone.delta, 195)} fill={zone.color} stroke="#1a1a2e" strokeWidth="1.5" />
                ))}

                {/* Puan etiketleri */}
                {showTarget && (() => {
                    const labels = []
                    const p2L = angleToPosition(targetAngle - 20, 120), p2R = angleToPosition(targetAngle + 20, 120)
                    labels.push(
                        <text key="2l" x={p2L.x} y={p2L.y} textAnchor="middle" dominantBaseline="middle" fill="#1a1a2e" fontSize="16" fontWeight="800">2</text>,
                        <text key="2r" x={p2R.x} y={p2R.y} textAnchor="middle" dominantBaseline="middle" fill="#1a1a2e" fontSize="16" fontWeight="800">2</text>,
                    )
                    const p3L = angleToPosition(targetAngle - 12, 100), p3R = angleToPosition(targetAngle + 12, 100)
                    labels.push(
                        <text key="3l" x={p3L.x} y={p3L.y} textAnchor="middle" dominantBaseline="middle" fill="#1a1a2e" fontSize="16" fontWeight="800">3</text>,
                        <text key="3r" x={p3R.x} y={p3R.y} textAnchor="middle" dominantBaseline="middle" fill="#1a1a2e" fontSize="16" fontWeight="800">3</text>,
                    )
                    const p4 = angleToPosition(targetAngle, 75)
                    labels.push(<text key="4" x={p4.x} y={p4.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="18" fontWeight="900">4</text>)
                    return labels
                })()}

                {showTarget && (() => {
                    const tp = angleToPosition(targetAngle, 195)
                    return <line x1="250" y1="250" x2={tp.x} y2={tp.y} stroke="#1a1a2e" strokeWidth="2" opacity="0.6" />
                })()}

                {/* Tick çizgileri */}
                {Array.from({ length: 37 }).map((_, i) => {
                    const angle = i * 5, isMain = i % 4 === 0
                    const inner = angleToPosition(angle, isMain ? 190 : 194), outer = angleToPosition(angle, 200)
                    return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#1a1a2e" strokeWidth={isMain ? "1.5" : "0.7"} opacity="0.3" />
                })}

                {/* Merkez */}
                <circle cx="250" cy="250" r="12" fill="#1a1a2e" stroke="#333" strokeWidth="2" />
                <circle cx="250" cy="250" r="5" fill="#555" />

                {/* İbre */}
                <line x1="250" y1="250" x2={needleEnd.x} y2={needleEnd.y}
                    stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" filter="url(#needle-shadow)"
                    style={{ transition: isDragging.current ? 'none' : 'all 0.15s ease-out' }} />
                {/* İbre ucu */}
                <circle cx={needleEnd.x} cy={needleEnd.y} r="10"
                    fill="white" stroke="#1a1a2e" strokeWidth="3"
                    filter="url(#needle-shadow)"
                    style={{
                        transition: isDragging.current ? 'none' : 'all 0.15s ease-out',
                    }} />

                {/* Hareket ettiren */}
                {moverInfo && (
                    <g>
                        <text x={needleEnd.x} y={needleEnd.y - 22} textAnchor="middle" fontSize="16">{moverInfo.avatar}</text>
                        <text x={needleEnd.x} y={needleEnd.y - 38} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">{moverInfo.name}</text>
                    </g>
                )}

                <line x1="45" y1="252" x2="455" y2="252" stroke="#1a1a2e" strokeWidth="3" />
            </svg>
        </div>
    )
}
