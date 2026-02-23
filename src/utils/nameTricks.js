// İsim dönüştürme trikleri
export function applyNameTrick(name) {
    const lower = name.toLowerCase().trim()

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
