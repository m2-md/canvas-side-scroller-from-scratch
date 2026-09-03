# KAYIP ZEYTİN — Canvas'ta Sıfırdan Side-Scroller

"Kamera Bir Yalandır: Canvas'ta Sıfırdan Side-Scroller ve Oyuncuya Söylenen Kibar
Yalanlar" makalesinin çalışan kodu. Bir zeytin daldan düşer, sıcak pastel bir
kahvaltı sofrasında yuvarlanır ve ait olduğu yere — bir zeytinyağı kasesine —
ulaşır. Yazının taşıyıcı fikri: **oyun geliştirme, oyuncunun lehine söylenen
yalanlar sanatıdır.**

Üç katman:

- **Raftan indirilen motor** (`src/engine/`): fizik yazısının `vec` + `body` +
  `world`'ü olduğu gibi kopyalandı, sonra platformcuya göre genişletildi. Yeni
  `collide.ts` daireyi dikdörtgenden ayırır (`resolveCircleRect`: normal +
  derinlik); `world.step` platform taşıma + yerçekimi entegrasyonu + çarpışmayı
  tek döngüde yürütür. Ekran duvarları ve cisim-cisim impulse ÇIKARILDI.
- **Saf mantık** (`src/logic.ts`): kamera (`followCamera` — lerp + lookahead,
  `dt`'den bağımsız), üç zıplama yalanı (`shouldJump` coyote+buffer, `cutJump`
  değişken yükseklik) ve yüzdürme (`buoyancy`). Hepsi DOM'suz, canvas'sız.
- **Oyun** (`src/main.ts`): elle kurulmuş kamera (`ctx.translate(-cam.x, 0)`),
  parallax katmanları (`layer(0.2)` / `layer(0.5)` / `layer(1.0)`), kinematik çay
  tepsisi, klavye **ve** dokunmatik girdi, durum makinesi (`playing`/`won`/`lost`)
  ve `resetGame()` — kaybedince/kazanınca sayfa **yenilenmez**.

Sıfır asset, ses yok, network isteği yok. Üretim build'i: **JS 9.91 KB
(gzip 4.15 KB)** (`npm run build` ile doğrula).

## Kurulum ve çalıştırma

```bash
npm install
npm run dev     # http://localhost:5173 (veya Vite'ın verdiği port)
```

**Nasıl oynanır:** `←` `→` ya da `A` `D` zeytini yuvarlar; `↑` / `W` / `Space`
zıplatır. Zeytin kenardan yeni ayrılmışken hâlâ zıplayabilir (coyote), yere
inmeden bir tık önce basılan zıplama yere değince tetiklenir (buffer), tuşu erken
bırakınca alçak zıplar (değişken zıplama). Kinematik **çay tepsisi** üstündeki
zeytini yanında taşır. Boşluğa düşerse nazik bir kayıp; yağ kasesine ulaşınca
`won` — zeytin yağda bata çıka dengelenir. Kazanma/kaybetme ekranı bir dokunuş ya
da `Enter` ile `resetGame()`'e döner, sayfa yenilenmez.

**Mobil:** ekranın sol/sağ yarısını basılı tutmak yatay hareket, yukarı kaydırma
zıplamadır (orijinal tutorial'da yoktu — bu sürümde tam oynanabilir).

## Test

```bash
npm test        # 18 birim testi
```

Testler saf mantığı tarayıcısız doğrular:

- `tests/collide.test.ts` — `resolveCircleRect` üstten iniş (`ny === -1`,
  `depth ≈ 8`, makaledeki test birebir), yandan temas, merkez-içi kaçış,
  uzak null; `restsOn` kenar toleransı.
- `tests/logic.test.ts` — `shouldJump` üç durum (makaledeki test birebir) +
  tüketilmiş sayaç; `cutJump` (yükselirken keser, düşerken dokunmaz);
  `followCamera` (hedefe yaklaşır, aşmaz, `dt`'den bağımsız); `buoyancy`
  (yüzey üstünde `vy` değişmez, altında yukarı iter, derinlikle güçlenir).

## Dosya yapısı

```
index.html
src/
  engine/
    vec.ts       # fizik yazısından aynen kopya
    body.ts      # Body'ye grounded? + RectBody eklendi
    collide.ts   # YENİ: Rect, Hit, resolveCircleRect, restsOn
    world.ts     # step platformcuya göre yeniden yazıldı (taşıma + entegrasyon + çarpışma)
  logic.ts       # followCamera, shouldJump, cutJump, buoyancy (saf)
  main.ts        # kamera, parallax, girdi, durum, çizim, tam ekran canvas
tests/
  collide.test.ts
  logic.test.ts
```

## Alınan dersler (makalede de anlatılır)

- Side-scroller'da kamera diye bir nesne yoktur: ekran sabittir, siz dünyayı ters
  yönde kaydırırsınız (`ctx.translate(-cam.x, 0)`). Framework'ün `follow()`'u bu
  tek satırı saklar.
- Yumuşatma `dt`'den bağımsız olmalı: `1 - Math.pow(0.001, dt)` her karede aynı
  hisseder. Aynı `Math.pow(sabit, dt)` deseni yüzdürme sönümünde de kullanılır.
- Parallax yalanın katmanlarıdır: uzak %20, orta %50, oyun düzlemi %100 kayar.
- Daire-dikdörtgen çözümleme, falling game'deki boolean testin devamı: en yakın
  nokta + normal + derinlik. Önce geometri, sonra hız — hep aynı altın kural.
- İyi zıplama fizik değil, kibar yalanlardır: coyote (~0.1s), buffer (~0.12s),
  değişken zıplama.
- Hareketli platform kandırmaz, taşır: önce üstünde kim var diye bak, sonra ikisini
  birlikte kaydır.
- Kaybetmek de kazanmak da `location.reload()` değil, bir durum + `resetGame()`.
- Bu oyunun ilk sürümünde bir yerleşim hatası vardı: büyük "sofra" platformu kase
  bölgesiyle çakışıyordu ve zeytin yağa batmak yerine masaya oturuyordu. Hatayı
  gözle değil, motoru başsız (headless) süren 5 senaryoluk bir simülasyon testi
  yakaladı (dala düşüş, tepsiyle taşınma, zıplama, yüzeyde dengelenme, boşluğa
  düşüş). Ders: kazanma koşulunuz test edilmemişse, oyununuz kazanılamaz olabilir.

## Lisans

MIT
