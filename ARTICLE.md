# Kamera Bir Yalandır: Canvas'ta Sıfırdan Side-Scroller ve Oyuncuya Söylenen Kibar Yalanlar

*Ekran hiç kaydırmadan bir dünyayı nasıl kaydırırız, bir platform oyununu "iyi" hissettiren şeyin fizik değil küçük yalanlar olduğunu — KAYIP ZEYTİN'i kahvaltı sofrasında yuvarlayarak öğreniyoruz.*

*Tahmini okuma süresi: 16 dakika*

---

Bir Western filminde tren asla hareket etmez.

Kamera vagonun içindedir, pencereden çöl akıp gider, kahraman purosunu yakar — ama o vagon bir stüdyoda durur, tekerlekleri sabit, hiçbir yere gitmez. Hareket eden tek şey, camın arkasında sağdan sola çekilen boyalı bir manzara silindiridir. Seyirci trenin yol aldığına yemin eder. Yol alan bir şey yoktur; sadece arka plan ters yöne kaydırılmıştır.

Her side-scroller (yandan kaydırmalı oyun) tam olarak böyle çalışır. Mario sağa gitmez; dünya sola kayar. "Kamera" dediğimiz şey, pencerenin arkasındaki o boyalı silindirdir — bir nesne değil, bir çizim hilesi. Tutorial'ların çoğu bu silindiri bir framework'ün `follow()` çağrısının içine saklar: tek satır yazarsınız, karakter takip edilir, ama silindirin nasıl döndüğünü asla görmezsiniz.

Bu yazıda silindiri kendi elimizle döndüreceğiz. Ve iş bununla da bitmeyecek, çünkü bir platform oyununu iyi hissettiren şey kamera bile değil: fiziğe söylenen bir avuç küçük, kibar yalan. Zıplamanın "adil" hissetmesi gerçekçi fizikten değil, oyuncunun lehine çevrilmiş hatalardan gelir. Bütün mesele şu: oyun geliştirme, oyuncunun lehine söylenen yalanlar sanatıdır. Kamera bir yalan, kontroller birer yalan, finalde bir yalan daha.

Yol haritası dört durak: motoru raftan indirip ona daire-dikdörtgen çarpışması öğretmek, kamerayı ve parallax'ı elle kurmak, zıplamaya kişilik veren üç kontrol yalanı ve son perdede zeytini evine döndüren bir kaldırma kuvveti.

Oyunun ilhamı, Dr Abstract'ın ZIM ve Box2D ile yazdığı "Lost Olive" tutorial'ı: bir zeytin daldan düşüyor, silindir şapkaların üstünde zıplaya zıplaya bir votka kadehine ulaşıyor. Kurgu şirin ama motoru satır satır okuyunca aynı tanıdık dert çıkıyor karşıma — fizik, kamera ve kontrol, hepsi kapalı bir kutunun içinde. `follow()` tek satır ama nasıl çalıştığı yok. Parallax hiç yok; fon oyunla birebir kayıyor; derinlik duygusu sıfır. Şapkaların zıplama animasyonu fizik motorunu kandıran bir hile. Ve kaybedince oyun `location.reload()` çağırıyor — koca sayfayı baştan yükleyerek.

Bizim zeytinimiz votka yerine bir kahvaltı sofrasında yuvarlanacak ve sonunda ait olduğu yere, bir zeytinyağı kasesine ulaşacak. Serinin önceki oyunları hep geceydi — yıldızlı gökyüzü, karanlık bahçe. Bu sefer bilerek sabaha çıkıyoruz: sıcak pastel bir sabah ışığı, simit, çay bardağı, peynir dilimi. Aynı damar, farklı saat.

Bu, canvas serisinin dördüncü yazısı. İlk yazıda bir fizik motoru yazmıştık (vektörler, Euler entegrasyonu, impulse, `invMass` numarası); onu birazdan raftan indireceğiz. İkinci yazıda "çizim çizer, mantık bilir" ilkesini koymuştuk; üçüncüde juice'u ve `dt` disiplinini. Üçüne de yeri geldikçe selam çakacağım, ama seriyi baştan takip etmeseniz de bu yazı kendi ayakları üzerinde durur.

### Motoru Raftan İndirmek — ve Ona Yeni Bir Yetenek Öğretmek

İlk yazının motoru bir klasörde bizi bekliyor: `vec.ts` (vektör alfabesi), `body.ts` (daire cisim), `world.ts` (yerçekimi, çarpışma, adım döngüsü). Bunları olduğu gibi kopyalıyoruz. Yerçekimi hâlâ iki satır, `invMass` hâlâ statik cisimleri formülden bedavaya çıkaran o küçük numara. Değişen bir şey yok.

Ama motorumuzun bir eksiği vardı: her şey daireydi. Daire-daire çarpışmasını biliyordu, dikdörtgeni bilmiyordu. Bir platform oyununun bütün zemini ise dikdörtgen — simit dilimi, tabak kenarı, çay tepsisi. Motora yeni bir yetenek öğretmemiz gerekiyor: daireyi dikdörtgenden ayırmak.

#### Daireyi Dikdörtgenden Ayırmak: "Nasıl" Sorusu

Falling game yazısında daire-dikdörtgen testini yazmıştık, ama o test yalnızca bir soruya cevap veriyordu: değiyorlar mı? İki clamp ile dikdörtgendeki en yakın noktayı buluyor, mesafeye bakıyor, `true`/`false` dönüyordu. Bir platform oyunu için bu yetmez. Zeytin tabağa değdiğinde "evet, değiyor" demek çözüm değil; onu tabağın *üstüne* oturtmak, içine gömülmesini engellemek, dikey hızını kesmek lazım. Yeni soru şu: değiyorlarsa, nasıl ayrılır?

Cevap yine en yakın noktada saklı. En yakın nokta ile daire merkezi arasındaki yön, çarpışmanın normalidir (yüzeye dik yön); aradaki eksik mesafe ise iç içe geçme miktarı. Bu ikisini döndüren saf bir fonksiyon yazıyoruz:

```ts
// src/engine/collide.ts
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hit {
  nx: number; // birim normal: daireyi dışarı iten yön
  ny: number;
  depth: number; // iç içe geçme (px)
}

// Falling game'de bu fonksiyon sadece "değiyor mu?" diyordu.
// Şimdi "nasıl ayrılır?" sorusuna da cevap veriyor: normal + derinlik.
export function resolveCircleRect(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
): Hit | null {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w)); // en yakın x
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h)); // en yakın y
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;

  if (d2 > r * r) return null; // temas yok

  // Merkez dikdörtgenin dışında: en yakın nokta bize yönü verir
  if (d2 > 0) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }

  // Merkez dikdörtgenin İÇİNDE (d = 0): en kısa kaçış eksenini seç
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  if (m === bottom) return { nx: 0, ny: 1, depth: bottom + r };
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  return { nx: 1, ny: 0, depth: right + r };
}
```

İlk yarısı falling game'in testiyle birebir aynı: iki clamp, kare mesafe, `d2 > r*r` ise temas yok. Sonrası yeni. Merkez dikdörtgenin dışındaysa (`d2 > 0`), en yakın noktadan merkeze giden vektörü normalize ediyoruz — çarpışmanın yönü bu. `depth` de dairenin yarıçapından o mesafeyi çıkarınca kalan içeri gömülme.

Bir de sinsi bir durum var: merkez dikdörtgenin tam içine düşerse (`d2 === 0`), en yakın nokta merkezin kendisi olur ve yön hesaplanamaz — sıfıra bölme. Bu, zeytin hızlı düşüp bir kareyi atlayarak platformun içine gömüldüğünde olur. O zaman en kısa kaçışı seçiyoruz: dört kenara olan mesafeye bakıp en yakınından dışarı itiyoruz. Üstten geldiyse normal `(0, -1)` — "yukarı it" — platform oyununun en çok ihtiyaç duyduğu normal budur.

Fonksiyonun sadece hesap yaptığına dikkat edin; hiçbir cismi kımıldatmıyor. İlk yazının ilkesi hâlâ geçerli: motor fiziği bilir, oyunu bilmez. Kımıldatma işini `World`'e bırakıyoruz; orada eski dostumuz altın kural sahneye çıkıyor:

```ts
// src/engine/world.ts — step()'in 3. bölümü: platform çarpışmaları
for (const b of this.bodies) {
  if (b.invMass === 0) continue;
  for (const rect of this.rects) {
    const hit = resolveCircleRect(b.pos.x, b.pos.y, b.radius, rect);
    if (!hit) continue;

    // 1. ÖNCE GEOMETRİ: iç içe geçmeyi it
    b.pos.x += hit.nx * hit.depth;
    b.pos.y += hit.ny * hit.depth;

    // 2. SONRA HIZ: yalnızca yüzeye giren bileşeni sil (platform yutar, sekmez)
    const vn = b.vel.x * hit.nx + b.vel.y * hit.ny;
    if (vn < 0) {
      b.vel.x -= vn * hit.nx;
      b.vel.y -= vn * hit.ny;
    }

    // 3. Normal yukarı bakıyorsa: zemindeyiz
    if (hit.ny < -0.5) b.grounded = true;
  }
}
```

Fizik yazısındaki duvar çarpışmasının aynısı: önce cismi geometrik olarak düzelt, sonra hızını değiştir. Sırayı ters çevirirseniz zeytin platformun içinde titreyip kalır — her karede "içerideyim, hızımı keseyim" der ama çıkamadığı için bir sonraki karede yine keser. Sonsuz kararsızlık.

Bir fark var duvar çarpışmasından: orada hızı ters çevirip `bounciness` ile çarpıyorduk (sekme). Burada ters çevirmiyoruz, siliyoruz. Zeytin bir platforma çarpınca zıplamaz, durur. `vn < 0` kontrolü de önemli — yalnızca yüzeye *giren* hızı siliyoruz; yüzeyden ayrılan hıza (mesela zeytin platformun üstünde sağa yuvarlanırken) dokunmuyoruz. Yoksa zeytin hareket edemezdi.

Son satır platformcunun kalbi: `hit.ny < -0.5` ise normal yukarıyı gösteriyor demektir, yani zeytin bir şeyin üstünde duruyor. Bu `grounded` bayrağı birazdan üç kontrol yalanının hepsinin dayanağı olacak. Zeytin sağ yandan bir tabağa çarparsa normal `(-1, 0)` olur, `grounded` tetiklenmez — çünkü duvara yaslanmak yere basmak değildir.

Motorumuza yeni cisim tipini de tanıttık. `RectBody`, dikdörtgen bir platform; opsiyonel `vx` ile kinematik (kendiliğinden hareket eden) olabiliyor:

```ts
// src/engine/body.ts
export interface RectBody {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number; // kinematik yatay hız (px/s); sabit platformda 0
}
```

Ve bu arada motorun iki eski parçasını çıkardık: ekran duvarlarını ve cisim-cisim impulse'unu. Duvarlar `this.width`/`this.height`'ı sahne sınırı sayıyordu, ama artık dünya ekrandan geniş — sınırları platformlar çiziyor. Cisim-cisim çarpışması da gereksiz; sahnede tek bir dinamik cisim var, o da zeytin. Bir motoru raftan indirmek onu olduğu gibi kullanmak zorunda kalmak demek değil; kendi yazdığınız için neyi çıkarabileceğinizi de biliyorsunuz.

#### Zeytin Yuvarlanıyor: Görünürdeki Yalan

Zeytin fiziksel olarak bir daire ve yatayda kayıyor. Ama ekranda düz bir daire kaydırırsanız hiçbir şey dönmüyormuş gibi görünür — göz dönüşü ancak bir referans noktasıyla okur. Orijinal oyundaki zeytinin bir çekirdeği vardı; işte o çekirdek dönüşü görünür kılan şey. Biz de zeytine bir çekirdek lekesi koyup onu döndüreceğiz.

Kaymadan yuvarlanan bir tekerin açısı, aldığı yol bölü yarıçaptır. Karede aldığı yol `vx * dt` olduğuna göre:

```ts
// src/main.ts — update() içinde
oliveAngle += (olive.vel.x * dt) / olive.radius; // yol / yarıçap = açı
```

Çizimde `ctx.rotate(oliveAngle)` ile zeytini döndürüp çekirdeği ofsetli çiziyoruz. Fizik zaten doğru kayıyordu; bu tek satır sadece gözün onu okuyabilmesi için bir yalan — dönmeyen bir şeye dönüyormuş görüntüsü veriyor. Ama bu yalan olmadan zeytin buz üstünde kayan bir bilye gibi görünürdü, yuvarlanan bir zeytin gibi değil.

### Birinci Yalan: Kamera

Motor hazır, zeytin yuvarlanıyor. Şimdi büyük yalana geliyoruz.

Dünyamız ekrandan geniş — diyelim üç dört ekran boyu. Zeytin sağa yuvarlandıkça onu takip etmemiz, ekranı "kaydırmamız" lazım. Ama ekran kaydırılmaz. Ekran sabittir, hep aynı piksellerden ibarettir. Kaydırdığımız şey dünyadır.

#### Dünyayı Ters Yönde Kaydırmak

Bir `cam` nesnesi tutuyoruz — ama içinde "kamera" diye bir şey yok, sadece dünyayı ne kadar sola ittiğimizi söyleyen bir sayı:

```ts
// src/main.ts
const cam = { x: 0 }; // dünya bu kadar sola itilecek
```

Çizimden hemen önce canvas'ı bu kadar kaydırıyoruz, sahnenin geri kalanını hiç değiştirmeden:

```ts
// KAVRAMSAL örnek — projede bu iş layer(1.0, ...) içinde yapılır (aşağıda)
ctx.save();
ctx.translate(-cam.x, 0); // dünyayı sola it: ekran = dünya - cam.x
drawWorld(); // zeytin, platformlar, kase — hepsi dünya koordinatında
ctx.restore();
```

Hepsi bu. Dünyadaki her şey kendi gerçek koordinatında çiziliyor; zeytin dünyada 2000 pikselde olabilir. `translate(-cam.x, 0)` o 2000'i ekranın ortasına düşürüyor. Zeytin sağa gittikçe `cam.x` büyüyor, dünya sola kayıyor, zeytin ekranın ortasında kalıyor. Western'in boyalı silindiri tam olarak bu tek satır. `follow()` içinde saklı olan sır, bir `translate`'ten ibaret.

Batı yakasının bir de sınırı var: kameranın dünyanın dışını göstermesini istemiyoruz. Zeytin en soldayken sol tarafta boşluk, en sağdayken sağ tarafta boşluk görünmesin. Bir clamp yetiyor:

```ts
// src/main.ts — update() içinde
cam.x = Math.max(0, Math.min(cam.x, WORLD_W - W)); // dünyanın dışını gösterme
```

#### Yumuşak Takip: lerp ve Bakış-Önü

Kamerayı doğrudan zeytine kilitlerseniz (`cam.x = olive.pos.x - W/2`) oyun tuhaf hisseder: zeytin her titrediğinde ekran da titrer, göz yorulur. İyi kamera zeytini bir lastikle takip eder — hedefe doğru yumuşakça yaklaşır. Bu tekniğin adı lerp (linear interpolation, doğrusal aradeğerleme): her karede aradaki mesafenin bir kısmını kapat.

Ama saf lerp'in `dt` tuzağı var. "Her karede mesafenin %10'unu kapat" derseniz, 120 FPS'te 60 FPS'in iki katı hızlı yakınsarsınız — kamera hızı ekrana göre değişir. Fizik yazısının dersi burada da geçerli: hız her zaman saniyede olmalı. Kareden bağımsız lerp'in numarası üstel bir formül:

```ts
// src/logic.ts
export interface Camera {
  x: number;
}

// Kamerayı hedefe yumuşat: lerp + bakış yönüne bakış-önü (lookahead)
export function followCamera(
  camX: number,
  targetX: number, // takip edilen dünya x'i (zeytin)
  facing: number, // -1 sol, +1 sağ
  viewW: number,
  dt: number,
): number {
  const lookahead = facing * viewW * 0.18; // gidilen yöne biraz açıl
  const desired = targetX - viewW * 0.5 + lookahead; // hedefi ortaya al
  const t = 1 - Math.pow(0.001, dt); // dt'den bağımsız yumuşatma
  return camX + (desired - camX) * t;
}
```

`1 - Math.pow(0.001, dt)` satırı incelikli. Buradaki `0.001`, "bir saniye sonra aradaki mesafenin ne kadarı kalsın" demek — saniyede boşluğun %99.9'unu kapat. `dt` küçük olduğunda formül bunu o kareye düşen doğru orana çevirir. 30 FPS'te de 144 FPS'te de kamera aynı hızda yakınsar. Aynı `Math.pow(sabit, dt)` deseni sönümlerde, ışık geçişlerinde, her yerde işinize yarar; kareden bağımsız yumuşatmanın İsviçre çakısı.

`lookahead` ise küçük bir sinema numarası. Kamerayı zeytinin tam üstüne değil, gittiği yönde biraz ileriye kilitliyoruz. Zeytin sağa yuvarlanıyorsa ekranın biraz solunda durur, çünkü oyuncunun asıl görmek istediği yer önü — nereye gittiği, nereden geldiği değil. Bu kadarcık bir kaydırma, oyuna "bilinçli çekilmiş" hissi verir. `follow()` bunu size hiç sormaz.

Çağrı tarafı iki satır — takip et, sonra dünyaya sığdır:

```ts
// src/main.ts — update() içinde
cam.x = followCamera(cam.x, olive.pos.x, facing, W, dt);
cam.x = Math.max(0, Math.min(cam.x, WORLD_W - W)); // dünyanın dışını gösterme
```

#### Yalanın Katmanları: Parallax

Şimdiye kadarki yalan tek düzlemli: dünya bir bütün olarak kayıyor. Orijinal oyunun durduğu yer de burası — fon oyunla birebir kayıyordu, sanki bütün sahne aynı cama boyanmış gibi. Gerçek derinlik hissi bir katmanla değil, farklı hızlarda kayan katmanlarla gelir. Trenden bakarken yakındaki çitler hızla geçer, uzaktaki dağlar neredeyse durur. Buna parallax (paralaks, kat kat kayma) denir ve tam olarak bunu taklit ediyoruz: uzak olan az kaysın, yakın olan çok.

Her katmanı kendi kayma çarpanıyla çiziyoruz. Çarpan, o katmanın kameraya ne kadar uyduğu:

```ts
// src/main.ts — çizim katmanları
function layer(factor: number, body: () => void) {
  ctx.save();
  ctx.translate(-cam.x * factor, 0); // uzak katman az kayar
  body();
  ctx.restore();
}

function draw() {
  drawSky(); // gökyüzü: hiç kaymaz (sonsuz uzak), sabit gradient

  layer(0.2, drawFarHills); // uzak tepeler: kameranın %20'si
  layer(0.5, drawMidProps); // orta plan: %50
  layer(1.0, () => {
    // oyun düzlemi: %100 — gerçek dünya
    drawPlatforms();
    drawBowl();
    drawOlive();
  });

  drawHud(); // arayüz: dünyadan bağımsız, hiç kaydırılmaz
}
```

Çarpanların anlamı güzel: `1.0` gerçek dünya — zeytin ve platformlar burada, çünkü çarpışma orada oluyor. `0.5` ve `0.2` ise saf hile; o tepelerin fizikte bir karşılığı yok, sadece göz için çizilmiş resimler. Gökyüzü ise `0.0` — hiç kaymaz, sonsuz uzaktaki her şey gibi. Arayüz de dünyanın dışında; onu `layer`'ın hiç dokunmadığı yerde çiziyoruz.

Yalanı katman katman söylüyoruz. `1.0` düzleminde oyuncuya "işte gerçek dünya" diyoruz — ama ekranın dörtte üçü, farklı hızlarda kayan uydurma resimlerden ibaret. Ve o uydurma resimler olmadan oyun düz, kartondan bir dünya gibi görünürdü. Bir çarpan sayısı, koca bir derinlik yanılsaması.

### İkinci Yalan: Fiziğe Söylenen Kibar Yalanlar

Kamera hazır, zeytin yuvarlanıp zıplayabiliyor. Teknik olarak oyun çalışıyor. Ama bir platformcuda "çalışıyor" ile "iyi hissettiriyor" arasındaki uçurum, tam da burada başlıyor.

Size dürüst bir itiraf: coyote time'ı ilk duyduğumda saçma bulmuştum. Karakter uçurumdan çıktıktan *sonra* hâlâ zıplayabiliyorsa, bu bir bug değil mi? İyi oyuncu zamanında basar, hile istemez. Sonra kendi oyunumu bu yalanlar olmadan yaptım ve zıplamalar sürekli "geç" hissetti. Kod kusursuzdu — tuşa tam kenarda bastığımda karakter çoktan boşluktaydı, matematik haklıydı. Ama parmağım haklı olduğuma yemin ediyordu. Sorun oyuncunun refleksinde değil, fiziğin acımasız dürüstlüğündeydi. İyi platformcular o dürüstlükten vazgeçer.

Üç yalan var ve üçü de saf, test edilebilir küçük mantık.

#### Coyote Time: Uçurumdan Çıkan Çakal

İsim, Looney Tunes'un çakalı Wile E. Coyote'den geliyor — uçurumdan koşarak çıkan çakal, aşağı bakana kadar düşmez. Bir an havada asılı kalır, sonra fark eder ve çakılır. Coyote time (çakal süresi) tam bu affı oyuncuya verir: zeytin platformdan ayrıldıktan sonra da kısa bir süre (~0.1 saniye) hâlâ zıplayabilir.

Neden işe yarar? Çünkü insan gözü ile parmağı arasında gecikme var. Oyuncu platformun kenarını görür, "şimdi zıpla" der, parmağı basana kadar zeytin çoktan boşluğa adım atmıştır. O 100 milisaniyelik af, gözün gördüğü ile parmağın yaptığı arasındaki farkı kapatır.

#### Jump Buffering: Erken Basılan Tuşu Affetmek

İkinci yalan birincinin aynadaki yansıması. Coyote time geç basmayı affeder; jump buffering (zıplama tamponu) erken basmayı. Oyuncu zeytin daha havadayken, yere inmeden bir tık önce zıpla tuşuna basar. Katı bir fizik "yerde değilsin, zıplayamazsın" der ve o basışı çöpe atar; oyuncu da yere inince zeytinin neden zıplamadığını anlamaz. Tampon o basışı kısa bir süre (~0.12 saniye) hatırlar: zeytin yere değdiği an, bekleyen zıplama tetiklenir.

İki yalanı da tek bir yerde topluyoruz. İki sayaç tutuyoruz: en son ne zaman yerdeydik, en son ne zaman zıpla'ya bastık. İkisi de yeterince küçükse, zıpla:

```ts
// src/logic.ts
export const COYOTE = 0.1; // sn — zeminden ayrıldıktan sonraki af
export const BUFFER = 0.12; // sn — inmeden önce basılan zıplama hatırlanır

export interface JumpInput {
  timeSinceGround: number; // en son ne zaman zemindeydik
  timeSincePress: number; // en son ne zaman zıpla'ya bastık
}

// Şu an zıplamalı mı? İki kibar yalan tek koşulda.
export function shouldJump(j: JumpInput): boolean {
  return j.timeSinceGround <= COYOTE && j.timeSincePress <= BUFFER;
}
```

Bütün mantık bu üç satırda. Oyun döngüsünde iki sayacı besliyoruz ve zıplama gerçekleşince ikisini de "tüketiyoruz" — aynı basış iki kez zıplamaya, aynı yere değme iki kez havalanmaya dönüşmesin:

```ts
// src/main.ts — update() içinde
if (olive.grounded) timeSinceGround = 0;
else timeSinceGround += dt;
timeSincePress += dt; // her kare artar; tuşa basınca 0'a döner (event)

if (shouldJump({ timeSinceGround, timeSincePress })) {
  olive.vel.y = -JUMP_SPEED;
  timeSincePress = BUFFER + 1; // tüket: aynı basış tek zıplama
  timeSinceGround = COYOTE + 1; // tüket: havada ikinci zıplama yok
}
```

`timeSincePress = 0` ataması bir event'te oluyor — tuşa basıldığı anda. Zıplama ise sürekli döngüde kontrol ediliyor. Böylece oyuncu havadayken bassa bile, basış tampona yazılıyor ve zeytin yere değer değmez `shouldJump` `true` dönüyor. İki yalan, tek koşul, sıfır karmaşa.

#### Değişken Zıplama: Tuşu Ne Kadar Tutarsan

Üçüncü yalan zıplamanın *yüksekliğiyle* ilgili. Katı fizikte zıplama tek bir kuvvettir: basarsın, karakter hep aynı yüksekliğe çıkar. Ama iyi platformcularda tuşa kısa basınca alçak, uzun basınca yüksek zıplarsınız. Değişken zıplama (variable jump height) bunu şöyle yapıyor: oyuncu tuşu erkenden bırakırsa ve zeytin hâlâ yükseliyorsa, dikey hızı kısıyoruz.

```ts
// src/logic.ts
// Tuş erken bırakıldı ve hâlâ yükseliyoruz: zıplamayı kıs
export function cutJump(vy: number): number {
  return vy < 0 ? vy * 0.45 : vy;
}
```

`vy < 0` yükseliyor demek (ekranda yukarı negatif). Tuş bırakılınca yükseliş hızının yarıdan biraz azını bırakıyoruz; zeytin frenleyip erkenden tepe yapıyor. Tuşu basılı tutarsanız hiç kesilmez, tam yükseğe çıkar. Tek bir çarpım, ama zıplamaya bir tuş kadar ince bir kontrol katıyor. Bunu bir event'e bağlıyoruz — tuş `keyup` olduğunda:

```ts
// src/main.ts
function releaseJump() {
  olive.vel.y = cutJump(olive.vel.y);
}
```

Üç yalanın ortak dokusuna dikkat edin: hiçbiri fiziği "düzeltmiyor". Fizik zaten doğru — zeytin kenardan ayrıldı, tuş geç basıldı, kuvvet sabit. Biz sadece doğru olanın oyuncuya haksız hissettirdiği yerlerde araya girip daha nazik bir versiyonunu anlatıyoruz. Ve oyuncu bunun için bize teşekkür ediyor, farkında bile olmadan.

### Hareketli Platformlar: Taşımak, Kandırmak Değil

Orijinal oyunda şapkalar zıplama animasyonu yapıyordu ve bunu fizik motorunu kandırarak beceriyordu — bir "act of god" kuvveti, bir de uyku modunu kapatan bir bayrak. Motorun kurallarının dışına çıkan bir hile. Kendi motorumuzda buna gerek yok, çünkü hareketli platform bir hile değil, temiz bir kavram: platform kayıyorsa, üstündeki zeytini de yanında götürür.

Kahvaltı sofrasında bunu bir çay tepsisi yapıyor — sağa sola kayan kinematik bir platform. `RectBody`'nin `vx`'i sıfırdan farklıysa hareketli demektir. Motorun adım döngüsüne taşımayı ekliyoruz. İnce nokta sıra: platformu oynatmadan *önce* üstünde kim var diye bak, sonra ikisini birlikte kaydır. Böylece platform zeytinin altından kayıp gitmez.

```ts
// src/engine/world.ts — step()'in 1. bölümü: kinematik platformlar + taşıma
for (const rect of this.rects) {
  const dx = rect.vx * dt;
  if (dx !== 0) {
    for (const b of this.bodies) {
      // Zeytin bu platformun üstünde mi? Öyleyse onu da götür.
      if (b.invMass > 0 && restsOn(b.pos.x, b.pos.y, b.radius, rect)) {
        b.pos.x += dx;
      }
    }
  }
  rect.x += dx;
}
```

"Üstünde mi duruyor" testi de saf bir geometri sorusu — çarpışmadan sonra zeytinin tabanı (`cy + r`) platformun üstüne (`rect.y`) oturmuş olur:

```ts
// src/engine/collide.ts
// Daire bu dikdörtgenin üstünde mi duruyor? (taşıma testi)
export function restsOn(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
): boolean {
  const withinX = cx > rect.x && cx < rect.x + rect.w;
  const onTop = Math.abs(cy + r - rect.y) < r * 0.6; // taban ~ platform üstü
  return withinX && onTop;
}
```

Sonuç şu: zeytin tepsiye biner, tepsi sağa kayar, zeytin de sağa kayar — parmağınızı hiç kımıldatmadan. Tepsi yön değiştirir, zeytin de değiştirir, çünkü taşıma her karede o anki `vx`'i okuyor. Zeytin tepsiden zıplayıp inerse `restsOn` artık `false` döner, taşıma durur. Fizik motorunu kandıran bir hile yerine, motorun bildiği bir kural. Platform hareketini `vx`'e emanet edip yön değiştirmeyi oyun katmanına bırakıyoruz — tepsi sınıra gelince yönünü çeviriyor, o kadar.

### Üçüncü Yalan: Zeytin Evine Dönüyor

Zeytin bütün sofrayı geçti, son platformdan atladı ve karşısında bir zeytinyağı kasesi var. Kazanma anı bir zıplama ve düşüşle değil, yumuşak bir batış-çıkışla gelsin istiyorum — zeytin yağa değsin, biraz batsın, sonra usulca yüzeye çıkıp sallanarak dursun. Bunun fizik karşılığı kaldırma kuvveti (buoyancy): bir cisim sıvıya ne kadar batarsa, onu yukarı iten kuvvet o kadar büyür.

Üçüncü yalan da diğerleri gibi küçük bir formül. Zeytin yağın yüzeyinin altındaysa, derinlikle orantılı bir yukarı itiş uyguluyoruz — tıpkı bastıkça sertleşen bir yay gibi. Üstüne yüksek bir sönüm koyuyoruz ki sonsuza kadar zıplamasın, birkaç salınımda dursun:

```ts
// src/logic.ts
// Yüzdürme: derinlikle orantılı itiş + yüksek sönüm → yumuşak sallanma
export function buoyancy(
  cy: number, // zeytin merkezi y
  vy: number, // dikey hız
  surface: number, // yağ yüzeyi y
  dt: number,
): number {
  const depth = cy - surface;
  if (depth <= 0) return vy; // yağın üstünde: dokunma

  const k = 26; // yay sertliği: batış arttıkça yukarı itiş artar
  const lifted = vy - depth * k * dt; // yerçekimine karşı yukarı kuvvet
  return lifted * Math.pow(0.05, dt); // viskoz sönüm: bata çıka durulur
}
```

Zeytin yüzeyin üstündeyken `depth` negatif, fonksiyon hıza dokunmuyor — yağın dışında normal yerçekimi geçerli. Yüzeyin altına inince `depth` pozitif oluyor ve `depth * k` kadar yukarı itiliyor. Ne kadar çok batarsa o kadar sert itilir — yayın sertliği bu. `Math.pow(0.05, dt)` ise kameradaki numaranın kardeşi — bu sefer hızı söndürmek için. Yağ ağır, viskoz bir sıvı; zeytin içinde savrulmaz, birkaç kez bata çıka durulur.

Denge noktası kendiliğinden oluşuyor: zeytin yeterince batınca yukarı itiş, yerçekimini tam dengeler ve zeytin yüzeyin biraz altında asılı kalır — sallana sallana. Kuvvetleri elle eşitlemiyoruz; `k` ve sönüm sayılarını "iyi hissedene kadar" ayarlıyoruz, damakla tuz gibi. Oyun döngüsünde tek bir çağrı yetiyor:

```ts
// src/main.ts — update() içinde
// Üçüncü yalan: yağa değince eve döndü
if (
  inBowl(olive.pos.x, bowl) &&
  olive.pos.y + olive.radius > bowl.surface
) {
  olive.vel.y = buoyancy(olive.pos.y, olive.vel.y, bowl.surface, dt);
  if (state === "playing") state = "won"; // yağa değdi: eve döndü
}
```

Zeytin yağa değdiği an oyun kazanılıyor, ama simülasyon durmuyor — kazanma ekranı açılırken zeytin arkada hâlâ nazikçe sallanıyor. Kazanma bir donmuş kare değil, yaşayan bir an.

### Düşmek: Nazik Bir Kayıp

Peki zeytin bir platformu ıskalar da boşluğa düşerse? Orijinalin cevabı `location.reload()` — koca sayfayı baştan yükle, oyuncuya beyaz bir ekran göster. Falling game yazısında bu satırla zaten hesaplaşmıştık: kaybetmek de kazanmak da bir sayfa yenilemesi değil, bir durum değişikliğidir.

Zeytin dünyanın dibinden aşağı düşerse durumu değiştiriyoruz:

```ts
// src/main.ts — update() içinde
if (olive.pos.y - olive.radius > WORLD_BOTTOM) {
  state = "lost";
}
```

Durum makinemiz üç kelime: `"playing" | "won" | "lost"`. Kaybetme ekranı suçlayıcı değil, nazik: "Zeytin sofradan düştü. Tekrar denemek için dokun." Bir dokunuş ya da Enter, sayfayı yenilemeden her şeyi baştan kuruyor:

```ts
// src/main.ts
function resetGame() {
  olive.pos = vec(START_X, START_Y);
  olive.vel = vec();
  oliveAngle = 0;
  cam.x = 0;
  timeSinceGround = COYOTE + 1;
  timeSincePress = BUFFER + 1;
  state = "playing";
}
```

Oyunun bütün durumu bir avuç değişken. Onları sıfırlamak bir fonksiyon; canvas aynı canvas, döngü aynı döngü kalıyor. Serinin her oyununda tekrar eden ders: oyununuzun yaşam döngüsünü tarayıcıya değil, kendi durumunuza emanet edin.

### Saf Mantığın Karşılığı: Testler

Bu yazının bütün "yalanları" — daire-dikdörtgen çözümleme, coyote/tampon kararı, değişken zıplama, kamera takibi, taşıma testi, yüzdürme — DOM'suz, canvas'sız, saf fonksiyonlar olarak yaşıyor. Serinin ortak ilkesi bir kez daha meyvesini veriyor: çizim çizer, mantık bilir. Mantık saf olduğu için tarayıcı açmadan test edilir.

En sevdiğim test, üstten inişin doğru normali verdiğini doğrulayan — çünkü platform oyununun tamamı o `(0, -1)` normaline yaslanıyor:

```ts
// tests/collide.test.ts + tests/logic.test.ts — iki testin özeti
it("üstten inen daireyi yukarı iter (normal 0,-1)", () => {
  // Zeytin platformun tam üstünde, biraz gömülü
  const hit = resolveCircleRect(50, 98, 10, { x: 0, y: 100, w: 200, h: 20 });
  expect(hit).not.toBeNull();
  expect(hit!.nx).toBe(0);
  expect(hit!.ny).toBe(-1); // yukarı: zemin normali
  expect(hit!.depth).toBeCloseTo(8); // 10 - (100 - 98)
});

it("coyote ve tampon: kenardan yeni ayrılmışken zıplayabilir", () => {
  expect(shouldJump({ timeSinceGround: 0.08, timeSincePress: 0.05 })).toBe(true);
  expect(shouldJump({ timeSinceGround: 0.2, timeSincePress: 0.05 })).toBe(false);
  expect(shouldJump({ timeSinceGround: 0.05, timeSincePress: 0.3 })).toBe(false);
});
```

Aynı disiplinle `cutJump`'ın yalnızca yükselirken kestiği, `followCamera`'nın hedefe yaklaşıp asla aşmadığı, `restsOn`'ın kenar toleransı, `buoyancy`'nin yüzeyin üstünde hıza dokunmadığı — hepsi tarayıcı açılmadan doğrulanıyor. Kamerayı bile test edebiliyoruz, çünkü kamera bir nesne değil, bir sayıyı hedefe yaklaştıran bir fonksiyon.

### Özetle:

1. Side-scroller'da kamera diye bir nesne yoktur: ekran sabittir, siz dünyayı ters yönde kaydırırsınız (`ctx.translate(-cam.x, 0)`). Framework'ün `follow()`'u bu tek satırı saklar.
2. Takip yumuşak olsun: lerp + gidiş yönüne lookahead. Yumuşatma `dt`'den bağımsız olmalı — `1 - Math.pow(0.001, dt)` deseni her karede aynı hisseder.
3. Parallax yalanın katmanlarıdır: uzak %20, orta %50, oyun düzlemi %100 kayar. Derinlik bir çarpım sayısı kadar ucuz.
4. Daire-dikdörtgen çözümleme, falling game'deki boolean testin devamı: en yakın nokta + normal + derinlik. Önce geometri, sonra hız — hep aynı altın kural.
5. İyi zıplama fizik değil, kibar yalanlardır: coyote time (~0.1s) geç basmayı, jump buffering (~0.12s) erken basmayı affeder; değişken zıplama tuşu erken bırakınca hızı keser.
6. Hareketli platform kandırmaz, taşır: platformun delta'sı üstündeki cisme eklenir — önce kim var diye bak, sonra ikisini birlikte kaydır.
7. Yüzdürme = derinlikle orantılı itiş + yüksek sönüm → kendiliğinden denge, kendiliğinden bobbing.
8. Kaybetmek de kazanmak da `location.reload()` değil, bir durum + `resetGame()`. Yaşam döngüsünü tarayıcıya değil kendi durumunuza emanet edin.
9. Kamera, çarpışma, zıplama kararı — hepsi saf fonksiyon olursa tarayıcısız test edilir. Bir sayıyı hedefe yaklaştıran kamerayı bile.

Kodun tamamı — genişletilmiş motor, saf mantık, testler ve oyunun kendisi — repoda; `npm install && npm run dev` ile sofra bir dakikada kuruluyor, zeytin daldan düşüyor.

Saydığımız yalanların hepsi tek bir şekle sahip. Oyun gerçeği biliyor — zeytin platformdan üç kare önce ayrıldı, ekran hiç kaymadı, o zeytin düpedüz bir daire, uzaktaki tepeler kartondan. Ve her seferinde gerçeği söylemek yerine oyuncuya daha nazik bir versiyonunu anlatmayı seçiyor. Dürüstlük daha kötü bir oyun olurdu. Bu işin asıl becerisi galiba isabet değil: hangi gerçeği saklarsak oyuncunun kendini becerikli hissedeceğini seçmek. En iyi hissettiren oyunlar, size en zarif yalan söyleyenler — ve siz bunun için onlara teşekkür ediyorsunuz. 🎬⚙️
