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

// === YENİ SES VE MÜZİK SİSTEMİ === //

export const sfxPoop = new Audio('https://www.myinstants.com/media/sounds/fart-with-reverb.mp3')
export const sfxTada = new Audio('https://www.myinstants.com/media/sounds/tada.mp3')

// Sağa ve sola kaydırma seslerini garanti çalışması için (CORS/ORB yememesi için) tarayıcıda Web Audio API ile sentezliyoruz:
export function playSwoosh(direction) {
    try {
        const ctx = getCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)

        osc.type = 'sine'
        if (direction === 'left') {
            osc.frequency.setValueAtTime(800, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3)
        } else {
            osc.frequency.setValueAtTime(100, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3)
        }

        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
    } catch (e) { }
}

// BGM (Background Music) - Test için %100 çalışan ve CORS engeli olmayan SoundHelix MP3'ü
export const bgMusic = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3')
bgMusic.loop = true
bgMusic.volume = 0.3 // Varsayılan BGM sesi

export function playEmojiSfx(emoji) {
    try {
        if (emoji === '💩') { sfxPoop.currentTime = 0; sfxPoop.play() }
        if (emoji === '🎯') { sfxTada.currentTime = 0; sfxTada.play() }
        if (emoji === '👈') { playSwoosh('left') }
        if (emoji === '👉') { playSwoosh('right') }
    } catch (e) { console.error("SFX Error: ", e) }
}
