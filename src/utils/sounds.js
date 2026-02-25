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
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06)
    } catch (e) { }
}

// === YENİ SES VE MÜZİK SİSTEMİ (MP3 Placeholderlar) === //

export const sfxPoop = new Audio('https://www.myinstants.com/media/sounds/fart-with-reverb.mp3')
export const sfxTada = new Audio('https://www.myinstants.com/media/sounds/tada.mp3')
export const sfxSwoosh1 = new Audio('https://actions.google.com/sounds/v1/cartoon/whoosh.ogg')
export const sfxSwoosh2 = new Audio('https://actions.google.com/sounds/v1/cartoon/whoosh.ogg')

export const bgMusic = new Audio('https://actions.google.com/sounds/v1/water/rain_on_roof.ogg')
bgMusic.loop = true
bgMusic.volume = 0.3 // Varsayılan BGM sesi

export function playEmojiSfx(emoji) {
    try {
        if (emoji === '💩') { sfxPoop.currentTime = 0; sfxPoop.play() }
        if (emoji === '🎯') { sfxTada.currentTime = 0; sfxTada.play() }
        if (emoji === '👈') { sfxSwoosh1.currentTime = 0; sfxSwoosh1.play() }
        if (emoji === '👉') { sfxSwoosh2.currentTime = 0; sfxSwoosh2.play() }
    } catch (e) { console.error("SFX Error: ", e) }
}
