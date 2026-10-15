/* Konfigurasi web Firebase untuk situs portofolio.
 *
 * SAAT INI: null — situs berjalan dalam MODE MANDIRI: konten bawaan dari
 * core.js tampil penuh, tanpa login & tanpa tombol edit. Itu disengaja
 * sampai project Firebase portofolio dibuat (langkahnya ada di README.md).
 *
 * SESUDAH project dibuat, ganti null di bawah dengan objek konfigurasi web
 * dari Firebase Console (Project settings → Your apps → Web app), persis
 * pola Merdeka Belajar:
 *
 * window.PORTOFOLIO_FIREBASE_CONFIG = {
 *   apiKey: "...",
 *   authDomain: "<project-id>.firebaseapp.com",
 *   projectId: "<project-id>",
 *   storageBucket: "<project-id>.firebasestorage.app",
 *   messagingSenderId: "...",
 *   appId: "1:...:web:...",
 * };
 *
 * Nilai-nilai ini identitas publik aplikasi web (bukan rahasia) — keamanan
 * diatur oleh Firebase Auth + firestore.rules (publik baca, pemilik tulis).
 */
window.PORTOFOLIO_FIREBASE_CONFIG = null;
