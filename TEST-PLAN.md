# Test Prosedürü — Sensor FOV Layout

`HANDOFF.md`'deki manuel kontrol listesini, **hangisinin zaten otomatik test altında olduğu**
bilgisiyle önceliklendirir. Amaç: sistemin çalışıp çalışmadığını en kısa sürede anlamak.

Temel bulgu: **matematik ve store katmanı sağlam ve test altında. Test altında olmayan tek şey
React bağlantıları, fare hareketleri ve performans.** Manuel pass'i oraya odaklayın.

---

## Tier 0 — Otomatik kapı (makine doğruluyor)

Her değişiklikten sonra çalıştırın. Üçü de yeşil değilse manuel teste geçmeyin.

```bash
npm install
npm test        # beklenen: 11 dosya, 125 test, hepsi yeşil
npm run build   # beklenen: tsc temiz + dist/ üretilir
npm run dev     # http://localhost:5173
```

**2026-08-11 itibarıyla doğrulanan durum (Node 18.19.1):**

| Kontrol | Sonuç |
|---|---|
| `npm install` | 228 paket, hata yok (`three-mesh-bvh` deprecation uyarısı zararsız) |
| `npm test` | **125/125 yeşil** |
| `npm run build` | **Temiz.** Sadece uyarı: chunk > 900 kB ve `three -> mui -> three` döngüsel chunk. İşlevsel değil |
| `npm run dev` | 5173'te ayakta, HTTP 200 |
| Headless render | Uygulama **açılıyor ve çiziyor** — boş ekran yok |

Açılıştaki TOP pane'inde görünen **kırmızı gölge bir hata değil**: sensör yokken 5 m içindeki
tüm azimut sektörleri kör sayılır, blind-sector overlay de bunu boyar.

`npm audit` 5 açık bildiriyor (1 critical). Hepsi dev/build zinciri; çalışma zamanı SPA'ya
girmiyor. Bloke edici değil, ama Vite 5 / Vitest 2 pinini kaldırmadan önce bakılmalı.

---

## Tier 1 — 10 dakikalık duman testi

| # | Adım | Beklenen | Handoff maddesi |
|---|---|---|---|
| S1 | `Add sensor`'a bas | Ön tamponda sensör belirir, seçili gelir, editör açılır | 12 |
| S2 | Pozisyonu `z = 2`, pitch `-90`, FOV `90 × 90` yap | **TOP'ta yer karesi 1 m grid'e karşı tam 4 m × 4 m** (`Grid > Cell size` 1 m'de kalsın) | 7 |
| S3 | Yaw'ı `+45` yap | FOV aracın **soluna** döner | 9 |
| S4 | TOP'ta boş alanı sürükle, sonra scroll et | Dünya imlece yapışık kalır, imleç altındaki nokta sabit durur | 1, 2 |
| S5 | `Drag` = `Off` iken işaretçiyi sürükle | Sensör **kıpırdamaz**, pane kayar | 14 |
| S6 | `Drag` = `Move` yap, işaretçiyi sürükle | X ve Y alanları canlı takip eder | 14 |
| S7 | ISO'da gizmo okunu sürükle | Pozisyon alanları yazılır, kamera aynı anda dönmez | 16 |
| S8 | Dört surround kamera yerleştir | `Coverage` paneli yüzde verir, boşluklar TOP'ta kırmızı | 18 |
| S9 | `Export`, sonra yeni sekmede `Import` | Layout birebir geri gelir | 21 |

**S2 başarısızsa durun.** Ama not: bu acceptance test 7 olarak zaten yeşil, yani buradaki bir
sapma matematikte değil **render/ölçek katmanında** demektir.

---

## Tier 2 — Gerçek bilinmeyenler

Handoff'un "hiç tıklanmamış" dediği jestler. Aşağıdaki ikisi 2026-08-11'de tarayıcıda ölçülerek
doğrulandı, kalanı hâlâ elle denenmeli.

**Ölçülerek doğrulananlar:**

- **Sürükleme kilidi (madde 14).** `Drag = Off` → sensör kıpırdamıyor, pane kayıyor.
  `Drag = Move` → sensör hareket ediyor, pane kaymıyor.
- **Gizmo yakalanabilirliği (madde 16).** Gizmo ISO pane'inde ~**72 × 66 px**'lik bir alanda
  yanıt veriyor; oklardan uzakta orbit çalışmaya devam ediyor (azimut 35.0° → 17.5°).
  Dar gelirse `Gizmo.tsx` içindeki `size` (0.8) büyütülür.
  *Eski `GIZMO_REACH` / pointer-gate tavsiyesi geçersiz — gerekçe `HANDOFF.md` kararı #4'te.*
- **Orta tuşla pan (madde 1).** ISO'da orta tuş yörünge yapmıyor, pan yapıyor; sol tuş hâlâ
  yörünge yapıyor. TOP'ta `Move` açıkken işaretçinin üzerinden başlasa bile sensörü kapmıyor,
  pan yapıyor. Orta tuş `mousedown`'ı `defaultPrevented` — Chrome'un autoscroll aracı çıkmıyor.

**Hâlâ elle denenmeli:**

1. **Madde 15 — gövdeye snap.** Gövdenin 15 cm'ine sürükleyin: yüzeye yapışmalı, optik ekseni
   dışa dönmeli. `Alt` basılıyken snap olmamalı. *Matematiği 13 testle kapalı; kapalı olmayan,
   sürükleme sırasında doğru çağrılıp çağrılmadığı.*
2. **Madde 17 — rotate modu.** Halkaları sürükleyip yaw/pitch/roll'un makul kaldığını, özellikle
   dik aşağı bakarken (gimbal tekilliği) doğrulayın.
3. **Madde 19 — debounce.** Sürükleme sırasında rapor hesaplanmamalı; bırakınca 150 ms sonra
   oturmalı, bu sırada spinner dönmeli.
4. **Madde 25 — performans. Hiç ölçülmedi.** 20 sensör ekleyip birini sürükleyin; dört pane
   açıkken 60 fps hedefleniyor. DevTools → Performance ile ölçün, göz kararı yetmez.

---

## Tier 3 — Otomatik testin zaten kapattığı maddeler

Bunları elle tekrar etmek **düşük getirili**. Manuel kontrol burada sadece "React bağlantısı
doğru mu" sorusunu cevaplar.

| Handoff maddesi | Kapatan test |
|---|---|
| 3 — link zoom | `store/views.test.ts` (linked/unlinked/clamp) |
| 4 — orbit ±83° clamp | `store/views.test.ts` `setIsoView` |
| 5 — fit all, kırpma yok | `scene/views.test.ts` — *"includes the ground footprint, which can reach past the frustum corners"* |
| 6 — pane yönelimleri | `scene/views.test.ts` — TOP/FRONT/LEFT bazları ve el yönü |
| 7 — 4 m kare | acceptance test 7 |
| 9 — dönme işaretleri | acceptance test 1–6 (**etiket metinleri test edilemez, gözle bakın**) |
| 10, 11 — inherit/override, 190° clamp | `core/catalog.test.ts` (16 test) |
| 12 — add/duplicate/delete | `store/roundtrip.test.ts` |
| 13 — readout, gövde uyarısı | `core/ground.test.ts` |
| 16 — orbit/gizmo hakemliği | `scene/__tests__/gizmoHandle.test.ts` (5 test) |
| 18, 20 — kapsama raporu | `core/coverage.test.ts` + `store/blindReport.test.ts` |
| 21 — bozuk JSON | `store/persist.test.ts` |
| 22 — kalıcılık | `store/persist.test.ts` |

Kalan saf-manuel maddeler: **8, 23, 24** (alan bağlantıları, klavye kısayolları, metin alanı
odaktayken tuşların yutulması). Üçü de hızlı.

---

## Tarayıcı uyumluluğu

2026-08-11'de bir tarama yapıldı. Kod tabanında `randomUUID`, `structuredClone` (test dışı) veya
File System Access gibi Chrome'a bağlayan bir API **yok**. Bulunan ve düzeltilen üç fark:

1. **Tekerlek `deltaMode`.** Chrome/Safari piksel bildirir (~100/tık), Firefox **satır** bildirir
   (3/tık). Eski kod `deltaY`'yi ham kullanıyordu, yani Firefox'ta bir tık zoom'u ~32'de bir
   oynatıyordu — zoom bozuk sanılırdı. `scene/wheel.ts` normalize ediyor; ölçüm: 50 zoom'dan bir
   tık, Chrome tarzı 43.04, Firefox tarzı 43.10 (**%0.9 fark**).
2. **Odaklı `type="number"` tekerleği yutuyordu.** Her tarayıcıda geçerli: kenar çubuğunu
   kaydırırken alanın üzerinden geçmek değeri sessizce değiştiriyordu. Artık önce odak
   bırakılıyor; ölçüm: değer `4.8 → 4.8`, kaydırma geçiyor.
3. **Metin seçimi.** Firefox ve Safari, pane üzerinde başlayan sürüklemede metin seçmeye
   başlıyordu. Pane'lere `user-select: none` eklendi — Safari 17'den önce yalnızca `-webkit-`
   ön ekli sürümü tanıdığı için iki yazım da duruyor.

**Doğrulanamayan:** bu makinede headless Firefox hiç açılmıyor (boş bir `data:` URL'de bile
takılıyor, snap kısıtlaması). Yukarıdaki üç düzeltme Chrome'da gerçek olay akışıyla ve birim
testleriyle doğrulandı, ama **Firefox ve Safari'de elle bir tur atılmadı**. Sıradaki manuel
pass'te öncelik: her iki tarayıcıda Tier 1 duman testi, özellikle zoom hissi ve sürükleme.

Safari için alt sınır Safari 15 (WebGL2 + `file.text()` gerektiriyor).

---

## Render doğrulaması

```bash
google-chrome --headless=old --disable-gpu --use-angle=swiftshader \
  --enable-unsafe-swiftshader --hide-scrollbars --window-size=1600,900 \
  --virtual-time-budget=15000 --screenshot=out.png \
  --user-data-dir=/tmp/chrome-fov http://localhost:5173/
```

**Bilinen artefakt:** WebGL içeriği CSS yerleşiminin ~87 px altına düşer. Harness'ın kusuru.
Hizalı görüntü için `index.html`'e geçici olarak
`<style>html, body, #root { height: 813px !important; }</style>` ekleyip sonra kaldırın.

**Jest simülasyonu yaparsanız:** sentetik `PointerEvent`'lerde `pointerType: 'mouse'` **şart**.
three'nin `onPointerHover`'ı `pointerType`'a göre switch'liyor; boş bırakırsanız gizmo hiç yanıt
vermez ve bunu uygulama hatası sanırsınız. Ayrıca `dispatchEvent` tarayıcı hit-test'ini atlar —
"hangi eleman işaretçiyi alıyor" sorusu yalnızca `document.elementFromPoint` ile ölçülür.

---

## Kapsam dışı

Overlap analizi, gövde okluzyonu, odak uzaklığından FOV türetme, hesap/sunucu depolama, mobil
yerleşim, undo/redo. **"Hata gibi görünen ama doğru olan" kararlar** `HANDOFF.md`'de listeli;
tuhaf gelen bir şeye dokunmadan önce oraya bakın.

---

## Tek gerçek eksik: Faz 5 verisi

Mekanizma bitmiş, eksik olan **veri**. `src/data/sensors.json` içindeki üç
`sensing-world-isx031-*` kaydında **yalnızca HFOV gerçek** (60 / 120 / 190). VFOV `60` ve range
`50` üç varyantta da bilerek aynı bırakılmış ki lens-başına veri sanılmasınlar. Üçü de
`verified: false`, `datasheetUrl` boş.

Test ederken bu kayıtların **`Unverified` uyarı chip'i ile geldiğini doğrulayın** (madde 11) —
kasıtlı bir işaret, düzeltilecek bir hata değil.
