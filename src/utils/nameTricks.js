// İsim dönüştürme trikleri
export function applyNameTrick(name) {
    const lower = name.toLowerCase().trim()
    const noSpace = lower.replace(/\s+/g, '')

    // GAY Easter Egg
    const easterEggNames = ['fakirveteriner', 'samet']
    if (easterEggNames.includes(noSpace)) {
        return 'GAY'
    }

    // Elif varyasyonları
    if (lower === 'elif') {
        return 'Kısa Saçlı Lavuk'
    }

    // Sina varyasyonları
    const sinaVariants = ['sinana', 'sina', 'sinono']
    if (sinaVariants.includes(lower)) {
        return '❤️'
    }

    return name
}
