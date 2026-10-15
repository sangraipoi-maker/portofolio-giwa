# Portofolio Giwa

Situs portofolio satu halaman milik Giwa (Arkasha Brainley Illyria) — menampilkan
PsiKuis, Merdeka Belajar, Cari Tempat, dan Render Jurnal. Pemilik bisa
**mengedit seluruh isinya langsung dari situs** (teks, kartu proyek, tautan)
sesudah masuk dengan akunnya; pengunjung hanya membaca.

**Alamat live saat ini (GitHub Pages):** https://sangraipoi-maker.github.io/portofolio-giwa/

## Cara kerja

- Situs statis (`public/`) — pola yang sama dengan situs-situs Giwa lainnya.
- Konten tampil dari **dokumen Firestore `site/content`** (publik boleh baca,
  hanya pemilik boleh menulis — lihat `firestore.rules`). Setiap penyimpanan
  juga menuliskan cadangan versi sebelumnya ke `site/content/history/`.
- Bila dokumen itu belum ada (atau Firebase belum terhubung), situs memakai
  **konten bawaan di `public/core.js`** — jadi halaman selalu tampil utuh.
- Kepemilikan: pengguna masuk **pertama** yang menekan "Klaim Situs Ini"
  menjadi pemilik (`ownerUid` tercatat di dokumen). Hanya akun itu yang
  melihat tombol edit.

## Status backend

Saat repo ini dibuat, `public/firebase-config.js` masih `null` (mode mandiri:
konten bawaan tampil, tanpa login/edit) karena project Firebase baru hanya
bisa dibuat dari akun Google Arkasha sendiri (Firebase CLI di mesin tim tidak
bisa login — OAuth terblokir). Langkah aktivasi di bawah menyelesaikannya.

## Langkah aktivasi Firebase (sekali saja, oleh Arkasha)

1. Buka https://console.firebase.google.com → **Add project** → beri nama
   (mis. `portofolio-giwa`) → buat project (Analytics boleh dilewati).
2. Di project itu: **Build → Firestore Database → Create database** (mode
   produksi, lokasi Singapore/`asia-southeast2` bila ditanya).
3. **Build → Authentication → Get started** → aktifkan **Email/Password**.
   Lalu tab **Users → Add user**: buat akun dengan email + kata sandi
   Arkasha sendiri (kata sandi jangan dikirim ke siapa pun, termasuk chat).
4. **Build → Firestore Database → Rules** → ganti seluruh isinya dengan isi
   berkas `firestore.rules` di repo ini → **Publish**.
5. **Project settings (⚙️) → Your apps → </> (Web)** → daftarkan aplikasi
   (nama bebas, mis. "Portofolio Web") → salin objek `firebaseConfig`-nya.
6. Tempel objek itu ke `public/firebase-config.js` menggantikan `null`
   (format persis seperti contoh di komentar berkas itu), lalu commit & push —
   GitHub Pages akan menayangkan ulang otomatis. (Atau minta Kav/Damar yang
   menempelkan — nilai config web ini publik, bukan rahasia.)
7. Buka situs → **Masuk Pemilik** (pojok kanan atas) dengan akun langkah 3 →
   muncul bar kuning **"Klaim Situs Ini"** → klik → selesai: akun itu resmi
   pemilik, tombol **✏️ Edit Situs Ini** muncul tiap kali masuk.

Opsional sesudahnya: hubungkan domain sendiri (mis. portofolio.my.id) lewat
Firebase Hosting (**Hosting → Add custom domain**) — perlu project di-hosting
di Firebase: jalankan workflow manual "Deploy Hosting — Portofolio (Firebase)"
sesudah mengisi secret repo `FIREBASE_SERVICE_ACCOUNT_PORTOFOLIO`.

## Mengedit (sesudah aktif)

Masuk → **✏️ Edit Situs Ini** → nama/tagline/tentang bisa diketik langsung di
teksnya; kartu proyek punya formulir (judul, deskripsi, tautan, status,
kategori) + tombol naik/turun/hapus; ada tombol tambah proyek & tambah tautan;
akhiri dengan **💾 Simpan Perubahan**. Perubahan langsung tampil ke semua
pengunjung; versi sebelumnya tersimpan di riwayat Firestore.

## Uji

```
node tests/run-tests.mjs
```

52 pemeriksaan: kelengkapan konten bawaan, sanitasi (URL `javascript:`/`data:`
ditolak), logika kepemilikan cermin rules (anonim & pengguna lain ditolak,
pemilik diterima), urut/hapus kartu, riwayat, dan pemeriksaan statis
`firestore.rules` + `firebase.json` + gerbang mode edit di `app.js`.
