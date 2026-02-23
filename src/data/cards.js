// Wavelength oyun kartları - Her kart iki karşıt kutup içerir
// 100+ benzersiz kart
const CARDS = [
    // Temel kavramlar
    { left: "Sıcak", right: "Soğuk" },
    { left: "Kolay", right: "Zor" },
    { left: "Hızlı", right: "Yavaş" },
    { left: "Güçlü", right: "Zayıf" },
    { left: "Küçük", right: "Büyük" },
    { left: "Eski", right: "Yeni" },
    { left: "Güzel", right: "Çirkin" },
    { left: "Sessiz", right: "Gürültülü" },
    { left: "Basit", right: "Karmaşık" },
    { left: "Doğal", right: "Yapay" },

    // Duygusal / Sosyal
    { left: "Eğlenceli", right: "Sıkıcı" },
    { left: "Komik", right: "Ciddi" },
    { left: "Romantik", right: "Hiç Romantik Değil" },
    { left: "Rahatlatıcı", right: "Stresli" },
    { left: "İlham Verici", right: "Moral Bozucu" },
    { left: "Cesur", right: "Korkak" },
    { left: "Akıllıca", right: "Aptalca" },
    { left: "Havalı", right: "Utanç Verici" },
    { left: "Mutlu Eden", right: "Üzen" },
    { left: "Heyecan Verici", right: "Sakinleştirici" },

    // Yiyecek / İçecek
    { left: "Lezzetli", right: "İğrenç" },
    { left: "Sağlıklı", right: "Sağlıksız" },
    { left: "Tatlı", right: "Acı" },
    { left: "Ev Yemeği", right: "Dışarıda Yenir" },
    { left: "Kahvaltılık", right: "Akşam Yemeği" },
    { left: "Atıştırmalık", right: "Doyurucu" },
    { left: "Türk Mutfağı", right: "İtalyan Mutfağı" },
    { left: "Çay", right: "Kahve" },

    // Değerlendirme
    { left: "Overrated (Abartılmış)", right: "Underrated (Keşfedilmemiş)" },
    { left: "İyi Bir Film", right: "Kötü Bir Film" },
    { left: "Gerekli", right: "Gereksiz" },
    { left: "Önemli", right: "Önemsiz" },
    { left: "Gerçek", right: "Sahte" },
    { left: "Yararlı", right: "Zararlı" },
    { left: "Güvenli", right: "Tehlikeli" },
    { left: "Pahalı", right: "Ucuz" },
    { left: "Kaliteli", right: "Kalitesiz" },
    { left: "Profesyonel", right: "Amatör" },

    // Zaman / Aktivite
    { left: "Sabah Aktivitesi", right: "Gece Aktivitesi" },
    { left: "Yaz Aktivitesi", right: "Kış Aktivitesi" },
    { left: "Her Gün Yapılır", right: "Yılda Bir Yapılır" },
    { left: "Hafta Sonu İşi", right: "Hafta İçi İşi" },
    { left: "5 Dakikada Biter", right: "Saatler Sürer" },
    { left: "Yalnız Yapılır", right: "Grupla Yapılır" },
    { left: "İç Mekan", right: "Dış Mekan" },

    // Toplumsal
    { left: "Herkesin Sevdiği", right: "Kimsenin Sevmediği" },
    { left: "Herkesin Bildiği", right: "Gizli Hazine" },
    { left: "Çocuklar İçin", right: "Yetişkinler İçin" },
    { left: "Türkiye'ye Özgü", right: "Evrensel" },
    { left: "Sosyal Medyada Paylaşılır", right: "Gizli Tutulur" },
    { left: "İnstagramda Popüler", right: "TikTok'ta Popüler" },
    { left: "Boomerlara Ait", right: "Z Kuşağına Ait" },
    { left: "Kadınların Tercihi", right: "Erkeklerin Tercihi" },

    // Hayal Gücü
    { left: "İyi Bir Süper Güç", right: "Kötü Bir Süper Güç" },
    { left: "Düğünde Çalınır", right: "Cenazede Çalınır" },
    { left: "İlk Buluşmada Konuşulur", right: "İlk Buluşmada Konuşulmaz" },
    { left: "Survivor'da İşe Yarar", right: "Survivor'da İşe Yaramaz" },
    { left: "Zombi Kıyametinde Lazım", right: "Zombi Kıyametinde Gereksiz" },
    { left: "Issız Adaya Götürürsün", right: "Evde Bırakırsın" },
    { left: "Süper Kahraman", right: "Süper Kötü" },

    // Eğitim / İş
    { left: "Okulda Öğretilmeli", right: "Okulda Öğretilmemeli" },
    { left: "İş Hayatında Gerekli", right: "İş Hayatında Gereksiz" },
    { left: "Kolay Öğrenilir", right: "Zor Öğrenilir" },
    { left: "Pratikle Gelişir", right: "Doğuştan Yetenek" },
    { left: "Lider Özelliği", right: "Takipçi Özelliği" },
    { left: "Strateji Gerektirir", right: "Şans İşi" },

    // Karşılaştırmalar
    { left: "Kedi", right: "Köpek" },
    { left: "Dağ", right: "Deniz" },
    { left: "Kitap", right: "Film" },
    { left: "Pizza", right: "Hamburger" },
    { left: "Araba", right: "Motosiklet" },
    { left: "Android", right: "iPhone" },
    { left: "Netflix", right: "YouTube" },
    { left: "Spotify", right: "Radyo" },
    { left: "İstanbul", right: "Ankara" },
    { left: "Messi", right: "Ronaldo" },

    // Günlük Hayat
    { left: "Bağımlılık Yapan", right: "Bir Kez Deneyip Bırakan" },
    { left: "Ucuza Yapılır", right: "Çok Para İster" },
    { left: "İçsel Mutluluk", right: "Geçici Haz" },
    { left: "Modern", right: "Klasik" },
    { left: "Yaygın", right: "Nadir" },
    { left: "Lüks", right: "Sade" },
    { left: "Trendi Takip Eden", right: "Kendi Yolunda Giden" },
    { left: "İntrovert", right: "Extrovert" },

    // Yaratıcı / Eğlenceli
    { left: "Güldüren Tweet", right: "Ağlatan Tweet" },
    { left: "Viral Olur", right: "Kimse Görmez" },
    { left: "Sahne Performansı", right: "Stüdyo Kaydı" },
    { left: "Ana Karakter Enerjisi", right: "NPC Enerjisi" },
    { left: "İlk Bölümde Bırakılır", right: "Sabaha Kadar İzlenir" },
    { left: "Müzede Sergilenir", right: "Çöpe Atılır" },
    { left: "Güzel Kokar", right: "Kötü Kokar" },
    { left: "Yumuşak", right: "Sert" },
    { left: "Şeffaf", right: "Gizli" },
    { left: "Ön Koltuk", right: "Arka Koltuk" },

    // Fantastik
    { left: "Gryffindor", right: "Slytherin" },
    { left: "Jedi", right: "Sith" },
    { left: "Deniz Altı", right: "Uzay" },
    { left: "Zaman Yolculuğu", right: "Işınlanma" },
    { left: "Robot", right: "İnsan" },
    { left: "Elmas", right: "Altın" },
    { left: "Kahraman", right: "Anti-Kahraman" },

    // Yeni kavramlar
    { left: "Sabır Gerektirir", right: "Anında Sonuç Verir" },
    { left: "Risk Almak", right: "Güvende Kalmak" },
    { left: "Nostalji", right: "Gelecek" },
    { left: "Gizli Yetenek", right: "Herkese Gösteriş" },
    { left: "Doğu", right: "Batı" },
    { left: "Minimalist", right: "Maksimalist" },
    { left: "Fiziksel Güç", right: "Zihinsel Güç" },
    { left: "İlk İzlenim", right: "Son İzlenim" },
    { left: "Fotojenk", right: "Gerçek Hayatta Daha İyi" },
    { left: "Tek Başına Film", right: "Arkadaşlarla Film" },
    { left: "Erken Kalkmak", right: "Geç Yatmak" },
    { left: "Plan Yapmak", right: "Anlık Karar" },
    { left: "Hediye Almak", right: "Hediye Vermek" },
    { left: "Ünlü Olmak", right: "Anonim Kalmak" },
    { left: "Konuşmak", right: "Dinlemek" },
]

export default CARDS
