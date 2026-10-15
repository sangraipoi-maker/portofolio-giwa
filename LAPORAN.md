# LAPORAN — Situs Portofolio Giwa (Damar🦫, 2026-10-16)

## Hasil akhir

- **Alamat live:** https://sangraipoi-maker.github.io/portofolio-giwa/
  (GitHub Pages dari folder `public/`, deploy otomatis GitHub Actions tiap push ke `main` — run pertama sukses.)
- **Repo:** https://github.com/sangraipoi-maker/portofolio-giwa (publik; lokal `~/workspace/portofolio-giwa/`)
- **Struktur:** satu halaman — hero (nama + tagline) → grid kartu proyek → Tentang → Kontak.
  Konten awal persis spek: PsiKuis (25.701 soal, psikuis.my.id), Merdeka Belajar
  (merek-5ba13.web.app), Cari Tempat, Render Jurnal (Dalam Pengembangan, tanpa tautan),
  tautan Lynk/Instagram/Email UGM/WhatsApp. Semua teks — termasuk nama situs —
  berada di wilayah yang bisa disunting pemilik dari mode edit.
- **Mode edit langsung (sudah terprogram penuh):** masuk via Firebase Auth →
  bar pemilik muncul → teks nama/tagline/tentang contenteditable di tempat;
  kartu proyek tambah/edit/hapus/naik/turun lewat formulir sebaris; tautan juga
  bisa ditambah/edit/hapus; simpan menulis ke Firestore `site/content`
  (publik-baca, pemilik-tulis per `firestore.rules`) + cadangan versi sebelumnya
  ke `site/content/history/`; halaman publik diperbarui langsung via onSnapshot.
  Pengunjung tanpa login tidak pernah melihat kontrol edit (kontrol hanya
  dirender JS sesudah status pemilik terverifikasi; tombol "Masuk Pemilik" pun
  baru muncul bila Firebase terhubung).

## Kenapa backend belum aktif (jujur)

Project Firebase baru **tidak bisa dibuat dari VM tim**: `firebase-tools`
gagal diunduh (konektivitas npm registry: "FatalError" saat npx) dan tidak ada
login Google tersimpan di mesin (OAuth pernah terblokir proxy egress — pola
yang sama seperti catatan Merdeka Belajar). Maka `firebase-config.js` sengaja
`null`: situs berjalan **mode mandiri** — konten bawaan tampil utuh & live,
login/edit menunggu aktivasi. Ini persis jalan yang diminta spek ("situs LIVE
yang bisa dibuka + laporkan langkah sisanya"), bukan berhenti di tengah.

## Langkah sisa untuk Arkasha (sekali saja, ±10 menit — detail di README repo)

1. Firebase Console → buat project baru (mis. `portofolio-giwa`).
2. Firestore Database → Create database; Authentication → aktifkan Email/Password + buat user untuk dirinya.
3. Firestore → Rules → tempel isi `firestore.rules` repo ini → Publish.
4. Project settings → daftarkan Web app → salin `firebaseConfig`.
5. Tempel ke `public/firebase-config.js` (gantikan `null`) → commit & push (atau minta Damar menempelkan — config web itu publik).
6. Buka situs → Masuk Pemilik → **Klaim Situs Ini** → mulai mengedit.

Domain kustom (portogiwa.my.id dsb.) TIDAK dibeli/didaftarkan — belum diputuskan Arkasha.

## Hasil uji

- **Otomatis: 52 lulus, 0 gagal** (`node tests/run-tests.mjs`) — kelengkapan
  konten bawaan; sanitasi (URL `javascript:`/`data:` ditolak, id unik, batas
  panjang); logika kepemilikan cermin rules; urut/hapus; riwayat; pemeriksaan
  statis rules/firebase.json/gerbang edit.
- **(c) Konten awal tampil utuh sebelum ada dokumen Firestore:** TERBUKTI —
  itulah keadaan live sekarang (config null, tanpa dokumen apa pun): shell
  halaman + `core.js` terverifikasi tersaji dari alamat live, dan render
  fallback terjadi dari DEFAULT_CONTENT di perangkat pengunjung.
- **(a) Pengunjung tidak bisa menulis:** di tingkat rules, update/create
  digerbang `ownerUid == request.auth.uid`, hapus dilarang, jalur lain ditolak
  bawaan; di tingkat logika teruji otomatis (anonim & uid lain → canWrite
  false). Uji tembak langsung ke Firestore baru bisa dilakukan sesudah
  project Arkasha aktif (langkah sisa di atas) — pola rules ini meniru pola
  owner-only Merdeka Belajar yang sudah terverifikasi dua akun di sana.
- **(b) Pemilik edit → tampil publik:** alur terprogram & teruji di tingkat
  logika (canWrite pemilik true; simpan menulis dokumen + riwayat; onSnapshot
  menyegarkan tampilan publik tanpa refresh). Verifikasi ujung-ke-ujung di
  Firestore nyata menunggu aktivasi project (butir di atas).
- Repo/situs lain (PsiKuis, Merdeka Belajar) TIDAK disentuh sama sekali.

## Perapian visual — bahasa desain PIONIR (Damar🦫, 2026-10-16)

Atas teguran Arkasha (desain awal tidak memakai referensi PIONIR), lapisan visual
dirombak mengikuti bedah Kirana (`Research/Bedah-Website-Pionir-UGM-2026.md`).
Yang ditiru bahasa desainnya — bukan aset/teks PIONIR/UGM:

- Palet: latar krem kertas `#fffdf3`, teks `#232323`, cokelat `#4b2a18`/`#461a0c`,
  oranye jangkar `#f58124`, kuning `#ffe029`; aksen per kartu berganti keluarga
  (biru `#3dc7f2`, hijau `#45e1b1`, ungu `#902ef5`, pink `#f76f96`) via `--card-accent`.
- Kartu proyek & hero: sudut terpotong 45° (`clip-path: polygon`, token
  `--container-cut`) + bingkai dua lapis (lapis luar aksen, lapis dalam lebih kecil).
- Tombol "3D" chunky: bayangan offset keras tanpa blur (`--button-shadow`),
  tertekan saat `:active` — berlaku untuk CTA kartu, tombol simpan, Masuk Pemilik.
- Tipografi tunggal DM Sans (Google Fonts), hierarki dari bobot + ukuran.
- Header pil melayang `fixed`; scroll-reveal ringan IntersectionObserver vanilla
  (fade-up), menghormati `prefers-reduced-motion`; hover kartu terangkat.
- Isi, mode edit, rules, alamat live, dan fallback TIDAK berubah.
  Uji: 65 lulus, 0 gagal (52 lama + 13 statis baru untuk token/gaya PIONIR).
  Aset di `index.html` diberi query versi `?v=pionir1` agar pengunjung lama
  tidak terjebak cache gaya lama di GitHub Pages.

## Penyelarasan komposisi mockup Kirana + bagian Pendidikan (Damar🦫, 2026-10-16)

Atas perintah Arkasha ("terapin kayak gitu" sambil membuka lagi mockup asli
Kirana `pratinjau-portofolio-pionir.html`, 11 Okt) + tambahan kolom sekolah:

- **Komposisi disamakan ke mockup** (mockup menang soal susunan; data live
  menang soal isi — tidak ada lorem ipsum yang kembali):
  urutan bagian kini nav → hero → **Tentang → Pendidikan → Proyek → Keahlian
  → Kontak → footer**. Elemen khas mockup yang sebelumnya belum ada kini
  diterapkan: hero adegan langit (lencana pil, judul raksasa berbayangan
  berlapis kuning/oranye, dua tombol pil, burung bangau & bintang SVG generik
  beranimasi, pola anyaman, tikar anyaman miring di dasar hero); label bagian
  pola chip kicker + judul besar; Tentang jadi dua panel berbingkai (potret
  SVG generik + cerita) dengan deret fakta yang **dihitung dari konten**
  (jumlah proyek, situs live, UGM); kartu proyek dapat pita gambar glif SVG
  bergilir + chip kategori di kaki kartu, grid melebar 3 kolom pada layar
  besar (kontainer 72rem seperti bungkus mockup); Kontak jadi panel tengah;
  footer jadi gelap cokelat dengan wordmark raksasa + grid 3 kolom
  (Tentang/Eksplorasi/Kontak dari data tautan).
- **Keahlian kini bagian sungguhan** (di mockup ada, di live sebelumnya
  belum): bar berlabel + persen dan dua kelompok chip (Alat & Teknologi,
  Bahasa), tersimpan di dokumen konten yang sama dan bisa disunting pemilik
  (bar: tambah/edit/hapus/urut; chip: satu per baris). Bekal awalnya
  konservatif dari proyek yang benar-benar tayang (HTML & CSS, JavaScript,
  Firebase, Git & GitHub, GitHub Pages, OpenStreetMap) — pemilik bebas
  mengubah angka & isinya.
- **Bagian baru "Pendidikan"** (sesudah Tentang): daftar entri sekolah
  (nama, jenjang/keterangan, periode, catatan) dirender sebagai kartu
  sekeluarga kartu proyek. Tersimpan di dokumen Firestore `site/content`
  yang sama (bidang `education`), jadi ikut fallback bawaan, ikut gerbang
  pemilik/rules yang sama, dan ikut tercadangkan ke `history/` tiap simpan.
  Mode edit: tambah/edit/hapus/naik/turun persis pola kartu proyek.
  **Bekal awal hanya yang terverifikasi:** satu entri "Universitas Gadjah
  Mada — Fakultas Psikologi" dengan periode SENGAJA dikosongkan; tidak ada
  tahun atau nama sekolah lain yang dikarang — Arkasha tinggal mengisi
  riwayat sebenarnya lewat mode edit.
- Yang TIDAK berubah: alamat live, `firestore.rules` & mekanisme
  klaim/pemilik, konten proyek/kontak, bahasa desain PIONIR yang sudah
  diterapkan. Versi aset dinaikkan `?v=pionir1` → `?v=pionir2`.
- Uji: **86 lulus, 0 gagal** (65 lama tetap hijau + 21 baru: sanitasi &
  logika Pendidikan, jepit persen & dedup Keahlian, urutan bagian &
  kehadiran wadah secara statis). Pemeriksaan silang otomatis: seluruh 36
  id yang dirujuk `app.js` teratasi di HTML / dibuat dinamis oleh app.js.
  Verifikasi live: isi berkas tersaji di alamat live diperiksa sesudah
  deploy (lihat catatan rilis di bawah).

---

## Putaran 3 — PORTING SETIA mockup Kirana (perintah Arkasha 2026-10-16 02:56, commit `e6e6744`)

Keputusan Arkasha: mockup aslinya (`~/workspace/pratinjau-portofolio-pionir.html`)
LEBIH BAGUS dari terapan putaran 2 — maka putaran ini **porting, bukan
interpretasi**: struktur HTML per bagian dan nilai CSS mockup diangkat
apa adanya ke situs live.

### Yang sekarang mengikuti mockup secara NILAI (terverifikasi uji statis + render)

- **Sistem bingkai mockup**: `.frame` (padding 3px, sudut terpotong
  `--cut:1.1rem`) > `.inner` (padding 1.4rem 1.5rem, potongan `cut − 3px`);
  warna bingkai bergilir per kartu persis urutan mockup
  (oranye, biru, hijau, ungu, pink, kuning); `.lift:hover` naik −8px.
- **Token persis**: `--paper:#fffdf3`, `--brown-deep:#3f2415` (putaran 2
  sempat memakai #461a0c — dikoreksi), `--line:#e5e1d9`, palet pastel
  thumbnail kartu persis daftar mockup.
- **Tombol pil mockup**: radius 999px, garis 2px cokelat, bayangan keras
  `0 6px rgba(70,26,12,.35)`, kuning bawaan / oranye / ghost.
- **Header**: `header` tetap full-width > `.nav` pil (max 72rem, bayangan
  `0 6px rgba(35,35,35,.22)`) dengan bintang brand + tautan kapital.
- **Hero**: padding 8.5rem/5.5rem, gradasi radial langit persis string
  mockup, lapisan anyaman `.weave`, lencana ✦, judul clamp s.d. 5.2rem
  dengan bayangan lapis kuning/oranye persis, bangau SVG mockup, bintang
  SVG mockup, tikar `.mat` di kaki hero.
- **Animasi mockup HIDUP di live** (keluhan "kok ga ada animasi" dijawab
  dengan bukti terukur, bukan klaim): di Chromium, gaya terhitung
  `.bird` = `sway 7.6s` dan transform bangau maupun bintang BERUBAH antar
  dua waktu sampling; reveal memakai pola mockup (`.rv` → `.on`,
  IntersectionObserver threshold 0.12) — 22/22 elemen ter-reveal sesudah
  gulir; `prefers-reduced-motion` tetap dihormati persis blok mockup.
- **Tentang**: grid 5fr/7fr mockup — frame biru berisi potret SVG mockup
  persis + frame oranye "Cerita Singkat" + kotak fakta mockup.
- **Proyek**: kartu `.frame > .inner.proj` mockup — thumbnail pastel
  150px + glif mockup, judul/desc tipografi mockup, chip `.tag`
  (kapital via CSS seperti tampilan mockup).
- **Keahlian**: dua frame mockup (bar berwarna bergilir hijau/biru/ungu/
  pink persis urutan bar mockup; chip alat & bahasa gaya `.chip` mockup).
- **Kontak**: panel tengah mockup — email dipromosikan menjadi tombol
  CTA oranye besar (pola mockup: email tampil sebagai tombol), tautan
  lain menjadi kotak ikon `.socials` 46px berglif mockup.
- **Footer**: margin 5rem, wordmark raksasa clamp s.d. 8.5rem, grid
  Tentang/Eksplorasi/Kontak, catatan kaki.

### Selisih yang disengaja (beserta alasan)

1. **Judul hero = nama pemilik**, bukan slogan mockup + baris peran:
   model data tidak punya bidang slogan/peran; tagline pemilik mengisi
   baris deskripsi `p.desc`. (Menambah bidang slogan = perubahan model
   data; menunggu perintah Arkasha.)
2. **Kartu proyek punya tombol "Kunjungi →"** (`.btn small` mockup) dan
   chip kedua berisi status (Live/Dalam Pengembangan): kebutuhan data
   nyata; mockup contoh tidak punya tautan keluar per kartu.
3. **Fakta Tentang dihitung dari konten** (4 proyek · 3 live · UGM),
   bukan placeholder "00+" mockup; teks Tentang satu paragraf mengikuti
   data (mockup contoh dua paragraf lorem).
4. **PENDIDIKAN tidak ada di mockup** — dibangun MURNI dari komponen
   mockup (`.frame`, `.inner`, `.tag`) di antara Tentang dan Proyek,
   sesuai perintah tetap Arkasha; nav menambah tautan PENDIDIKAN.
5. **Slot tombol kanan header = "Masuk Pemilik"** (sistem edit), tampil
   hanya sesudah Firebase aktif; mockup memakai slot itu untuk tombol
   "Hubungi Saya".
6. **UI pemilik** (bar pemilik, modal masuk, formulir edit) tidak ada di
   mockup — dibangun hanya dari token & komponen mockup.
7. Aset dinaikkan ke `?v=pionir3` (anti-cache).

### ⚠️ Bug fatal yang ditemukan & diperbaiki di putaran ini

Sejak commit PERTAMA, `public/app.js` mendeklarasikan `const isOwner`
padahal `public/core.js` juga mengekspor `function isOwner` global —
skrip klasik berbagi ruang global, jadi app.js mati total oleh
SyntaxError: **situs tidak pernah benar-benar ter-render** (pengunjung
hanya melihat teks "Memuat…" bawaan HTML). Verifikasi putaran-putaran
sebelumnya hanya memeriksa berkas tersaji, bukan tereksekusi — lolos.
Perbaikan: helper lokal diganti nama `meIsOwner`, ditambah **uji regresi**
yang melarang app.js mendeklarasikan ulang nama global core.js mana pun.
Verifikasi sekarang mencakup render sungguhan di Chromium (jumlah kartu,
bar, CTA) — bukan hanya isi berkas.

### Uji & verifikasi putaran 3

- **113 uji lulus, 0 gagal** (termasuk ±33 assertion kesetiaan nilai
  mockup + uji regresi di atas).
- **Banding visual Playwright** (mockup vs build baru, viewport sama
  360px & 1280px, per bagian): hero/tentang/proyek/keahlian/kontak/
  footer sekomposisi dan senilai; bahkan artefak render border+clip-path
  pada `.chip` identik antara mockup dan hasil porting.
- **Live**: sesudah push, keempat berkas (index/styles/app/core) diunduh
  dari alamat live dan terbukti **identik byte-per-byte** dengan build
  lokal yang sudah dirender-verifikasi.
