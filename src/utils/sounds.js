// Web Audio API ile ses efektleri — dosya gerektirmez, tarayıcıda sentezlenir
let audioCtx = null

function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
}

// İbre çevirme — kısa tık sesi
export function playTick() {
    try {
        const ctx = getCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = 1200
        gain.gain.setValueAtTime(0.06, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.03)
    } catch (e) { }
}

// Hazırım butonu — tatlı bip
export function playBip() {
    try {
        const ctx = getCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = 660
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12)
    } catch (e) { }
}

// 4 puan — zafer melodisi (C-E-G-C yükselen)
export function playCelebration() {
    try {
        const ctx = getCtx()
            ;[523, 659, 784, 1047].forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain); gain.connect(ctx.destination)
                osc.type = 'sine'; osc.frequency.value = freq
                const t = ctx.currentTime + i * 0.1
                gain.gain.setValueAtTime(0.12, t)
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
                osc.start(t); osc.stop(t + 0.25)
            })
    } catch (e) { }
}

// 0 puan — üzgün ses
export function playFail() {
    try {
        const ctx = getCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(300, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.4)
        gain.gain.setValueAtTime(0.06, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
    } catch (e) { }
}

// Timer — son 10 saniye uyarı tik
export function playTimerWarn() {
    try {
        const ctx = getCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'square'; osc.frequency.value = 880
        gain.gain.setValueAtTime(0.04, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06)
    } catch (e) { }
}
