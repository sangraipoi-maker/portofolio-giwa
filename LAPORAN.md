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
