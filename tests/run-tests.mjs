/* Uji otomatis Portofolio — pola tim: hitung lulus/gagal, keluar non-nol bila gagal.
 * Jalankan: node tests/run-tests.mjs
 * Mencakup: kelengkapan konten bawaan (fallback uji c), sanitasi,
 * logika kepemilikan cermin firestore.rules (uji a & b di tingkat logika),
 * urutan/hapus kartu, entri riwayat, dan pemeriksaan statis rules/firebase.json.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = require(join(root, "public", "core.js"));

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.error("GAGAL:", name); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ---------- (c) konten bawaan lengkap & benar ---------- */
const D = C.DEFAULT_CONTENT;
t("fallback: ada nama situs", !!D.siteName);
t("fallback: ada nama pemilik", /Giwa/.test(D.ownerName));
t("fallback: ada tagline", D.tagline.length > 10);
t("fallback: tentang menyebut Psikologi UGM", /Psikologi/.test(D.about) && /Gadjah Mada|UGM/.test(D.about));
const byId = Object.fromEntries(D.projects.map((p) => [p.id, p]));
t("fallback: 4 proyek awal", D.projects.length === 4);
t("fallback: PsiKuis + tautan + jumlah soal", byId["psikuis"] && byId["psikuis"].url === "https://psikuis.my.id" && /25\.701 soal/.test(byId["psikuis"].desc));
t("fallback: Merdeka Belajar live", byId["merdeka-belajar"] && byId["merdeka-belajar"].url === "https://merek-5ba13.web.app" && byId["merdeka-belajar"].status === "live");
t("fallback: Cari Tempat live", byId["cari-tempat"] && /cari-tempat/.test(byId["cari-tempat"].url));
t("fallback: Render Jurnal dev tanpa tautan", byId["render-jurnal"] && byId["render-jurnal"].status === "dev" && byId["render-jurnal"].url === "");
const linkUrls = D.links.map((l) => l.url);
t("fallback: tautan Lynk", linkUrls.includes("https://lynk.id/ngerti"));
t("fallback: tautan Instagram", linkUrls.some((u) => u.includes("instagram.com/giwa.tulung.agung")));
t("fallback: tautan email UGM", linkUrls.includes("mailto:giwatulungagung@mail.ugm.ac.id"));
t("fallback: tautan WhatsApp format internasional", linkUrls.includes("https://wa.me/62895415862862"));
t("fallback: konten bawaan lulus sanitasi utuh", eq(C.sanitizeContent(D).projects.length, 4) && eq(C.sanitizeContent(D).links.length, 4));

/* ---------- sanitasi ---------- */
const evil = C.sanitizeContent({
  siteName: "  Situs  ", ownerName: "", tagline: "x".repeat(999), about: "ok",
  projects: [
    { id: "a", title: "Bagus", desc: "d", url: "javascript:alert(1)", status: "live" },
    { id: "a", title: "Duplikat id", desc: "d", url: "https://contoh.id", status: "live" },
    { id: "b", title: "", desc: "tanpa judul -> dibuang", url: "https://x.id", status: "live" },
    { id: "c", title: "Status aneh", desc: "d", url: "data:text/html,hi", status: "aneh" },
  ],
  links: [
    { id: "l1", label: "Jahat", url: "javascript:evil()" },
    { id: "l2", label: "Baik", url: "https://baik.id" },
    { id: "l3", label: "", url: "https://tanpa-label.id" },
  ],
  bidangAsing: "harus dibuang",
});
t("sanitasi: nama situs di-trim", evil.siteName === "Situs");
t("sanitasi: ownerName kosong -> bawaan", evil.ownerName === D.ownerName);
t("sanitasi: tagline dipotong ke batas", evil.tagline.length === C.MAX.tagline);
t("sanitasi: URL javascript: ditolak", evil.projects[0].url === "");
t("sanitasi: id duplikat dibuat unik", evil.projects[0].id !== evil.projects[1].id);
t("sanitasi: proyek tanpa judul dibuang", !evil.projects.some((p) => p.desc.includes("tanpa judul")));
t("sanitasi: status aneh -> live & URL data: ditolak", evil.projects[2].status === "live" && evil.projects[2].url === "");
t("sanitasi: tautan javascript dibuang, yang baik tinggal", evil.links.length === 1 && evil.links[0].url === "https://baik.id");
t("sanitasi: bidang asing tidak ikut", !("bidangAsing" in evil));
t("sanitasi: masukan bukan objek -> bawaan aman", C.sanitizeContent(null).projects.length === 4);

/* ---------- (a)+(b) logika kepemilikan, cermin rules ---------- */
const noDoc = null;
const docA = { ...D, ownerUid: "uid-pemilik" };
t("klaim: belum ada dokumen -> boleh klaim", C.canClaim(noDoc) === true && C.canWrite(noDoc, "uid-pemilik") === true);
t("klaim: dokumen tanpa ownerUid -> boleh klaim", C.canClaim({ ...D }) === true);
t("klaim: sudah ada pemilik -> tidak boleh klaim", C.canClaim(docA) === false);
t("(a) pengunjung anonim tidak bisa menulis", C.canWrite(docA, null) === false && C.canWrite(noDoc, undefined) === false);
t("(a) pengguna lain tidak bisa menulis dokumen pemilik", C.canWrite(docA, "uid-orang-lain") === false);
t("(b) pemilik bisa menulis dokumennya", C.canWrite(docA, "uid-pemilik") === true && C.isOwner(docA, "uid-pemilik") === true);
t("isOwner: uid cocok persis", C.isOwner(docA, "uid-pemilik ") === false);

/* ---------- urutan & hapus ---------- */
const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
t("urut: b naik", eq(C.moveItem(list, "b", "up").map((x) => x.id), ["b", "a", "c"]));
t("urut: b turun", eq(C.moveItem(list, "b", "down").map((x) => x.id), ["a", "c", "b"]));
t("urut: ujung tidak bergerak", eq(C.moveItem(list, "a", "up").map((x) => x.id), ["a", "b", "c"]) && eq(C.moveItem(list, "c", "down").map((x) => x.id), ["a", "b", "c"]));
t("urut: daftar asal tidak diubah", eq(list.map((x) => x.id), ["a", "b", "c"]));
t("hapus: b hilang", eq(C.removeItem(list, "b").map((x) => x.id), ["a", "c"]));
t("id baru: tidak tabrakan", C.makeId("proyek", [{ id: "proyek-1" }, { id: "proyek-2" }]) === "proyek-3");

/* ---------- riwayat ---------- */
const hist = C.makeHistoryEntry(docA, "uid-pemilik", 12345);
t("riwayat: stempel waktu & pemilik tercatat", hist.savedAt === 12345 && hist.ownerUid === "uid-pemilik");
t("riwayat: isi tersanitasi & salinan dalam", hist.content.projects.length === 4 && hist.content !== docA);

/* ---------- pendidikan (bagian baru 2026-10-16) ---------- */
t("pendidikan: bawaan tepat 1 entri terverifikasi UGM Psikologi",
  D.education.length === 1 && D.education[0].school === "Universitas Gadjah Mada" && /Psikologi/.test(D.education[0].level));
t("pendidikan: periode bawaan kosong (tidak dikarang)", D.education[0].period === "");
t("pendidikan: sanitasi mempertahankan entri sah & memotong bidang",
  (() => { const e = C.sanitizeContent({ education: [{ id: "x", school: "  SMA Contoh  ", level: "SMA", period: "2019 — 2022", note: "n".repeat(999) }] }).education;
    return e.length === 1 && e[0].school === "SMA Contoh" && e[0].note.length === C.MAX.eduNote; })());
t("pendidikan: entri tanpa nama sekolah dibuang",
  C.sanitizeContent({ education: [{ school: "  " }, { school: "Ada" }] }).education.length === 1);
t("pendidikan: bukan array -> bawaan; array kosong dihormati",
  C.sanitizeContent({ education: "rusak" }).education.length === 1 && C.sanitizeContent({ education: [] }).education.length === 0);
t("pendidikan: urut & hapus bekerja pada daftar tersanitasi",
  (() => { const es = C.sanitizeContent({ education: [{ school: "A" }, { school: "B" }, { school: "C" }] }).education;
    return eq(C.moveItem(es, es[1].id, "up").map((x) => x.school), ["B", "A", "C"]) &&
           eq(C.removeItem(es, es[1].id).map((x) => x.school), ["A", "C"]); })());
t("pendidikan: id baru prefiks sekolah tidak tabrakan",
  C.makeId("sekolah", [{ id: "sekolah-1" }]) === "sekolah-2");
t("pendidikan: ikut tersimpan di entri riwayat",
  C.makeHistoryEntry({ ...D, ownerUid: "u" }, "u", 1).content.education.length === 1);

/* ---------- keahlian (bagian baru 2026-10-16) ---------- */
t("keahlian: bawaan punya bar, alat (termasuk Firebase) & bahasa",
  D.skills.bars.length >= 3 && D.skills.tools.includes("Firebase") && D.skills.languages.length >= 1);
t("keahlian: persen dijepit 0..100 & dibulatkan",
  (() => { const bs = C.sanitizeContent({ skills: { bars: [{ label: "X", pct: 250 }, { label: "Y", pct: -5 }, { label: "Z", pct: "62.6" }] } }).skills.bars;
    return bs[0].pct === 100 && bs[1].pct === 0 && bs[2].pct === 63; })());
t("keahlian: bar tanpa label dibuang; chip didedup & bukan array -> bawaan",
  (() => { const s = C.sanitizeContent({ skills: { bars: [{ label: " " }], tools: ["A", "A", " B "], languages: "rusak" } }).skills;
    return s.bars.length === 0 && eq(s.tools, ["A", "B"]) && s.languages.length === D.skills.languages.length; })());

/* ---------- pemeriksaan statis rules & konfigurasi ---------- */
const rules = readFileSync(join(root, "firestore.rules"), "utf8");
t("rules: konten publik boleh baca", /match \/site\/content \{[\s\S]*?allow read: if true;/.test(rules));
t("rules: klaim mengikat ownerUid ke uid penulis", rules.includes("request.resource.data.ownerUid == request.auth.uid"));
t("rules: update hanya pemilik & ownerUid tak berpindah", rules.includes("resource.data.ownerUid == request.auth.uid") && rules.includes("request.resource.data.ownerUid == resource.data.ownerUid"));
t("rules: hapus konten dilarang", /match \/site\/content \{[\s\S]*?allow delete: if false;/.test(rules));
t("rules: riwayat tidak publik", /match \/history\/\{entryId\}/.test(rules) && !/match \/history\/\{entryId\} \{[\s\S]*?allow read: if true/.test(rules));
t("rules: jalur lain ditolak bawaan", rules.includes("match /{document=**}") && rules.includes("allow read, write: if false;"));
t("rules: tidak ada allow write publik", !/allow write: if true/.test(rules) && !/allow create: if true/.test(rules));
const fbJson = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
t("firebase.json: hosting public=public & rules terhubung", fbJson.hosting.public === "public" && fbJson.firestore.rules === "firestore.rules");
const indexHtml = readFileSync(join(root, "public", "index.html"), "utf8");
t("index: wadah proyek & tautan ada", indexHtml.includes('id="projectGrid"') && indexHtml.includes('id="linkList"'));
t("index: tidak ada kontrol edit statis (edit dirender JS untuk pemilik saja)", !indexHtml.includes("contenteditable") && !indexHtml.includes("Edit Situs"));
const appJs = readFileSync(join(root, "public", "app.js"), "utf8");
t("app: fallback dirender sebelum Firebase", appJs.indexOf("renderView();") > -1 && appJs.indexOf("fbInit();") > appJs.indexOf("renderView();"));
t("app: mode edit digerbang isOwner/klaim", appJs.includes("C.isOwner(contentDoc, user.uid)") && appJs.includes("renderEdit"));
t("app: simpan menulis site/content + riwayat", appJs.includes('doc("site/content")') && appJs.includes('collection("history")'));

/* ---------- bahasa desain PIONIR (perapian visual 2026-10-16) ---------- */
const css = readFileSync(join(root, "public", "styles.css"), "utf8");
t("pionir: latar krem kertas #fffdf3", css.includes("--paper: #fffdf3"));
t("pionir: teks tergelap #232323 & cokelat komponen", css.includes("--ink: #232323") && css.includes("--brown: #4b2a18") && css.includes("--brown-deep: #461a0c"));
t("pionir: oranye jangkar #f58124 & kuning #ffe029", css.includes("--brand: #f58124") && css.includes("--yellow: #ffe029"));
t("pionir: keluarga aksen per kartu lengkap", ["#3dc7f2", "#45e1b1", "#902ef5", "#f76f96"].every((h) => css.includes(h)));
t("pionir: token sudut terpotong --container-cut + clip-path polygon", css.includes("--container-cut:") && css.includes("clip-path: var(--poly)") && /--poly: polygon\(/.test(css));
t("pionir: bingkai dua lapis (lapis dalam --poly-in via ::before)", css.includes("--poly-in: polygon(") && /\.card::before/.test(css) && /\.hero::before/.test(css));
t("pionir: aksen kartu berganti via nth-child + variabel --card-accent", css.includes("--card-accent") && /nth-child\(5n\+/.test(css));
t("pionir: tombol 3D bayangan offset keras tanpa blur", css.includes("--button-shadow:") && /\.btn \{[^}]*box-shadow: var\(--button-shadow\)/.test(css) && /\.card \.visit \{[^}]*box-shadow: var\(--button-shadow\)/.test(css));
t("pionir: font tunggal DM Sans", css.includes('"DM Sans"') && indexHtml.includes("family=DM+Sans"));
t("pionir: header pil melayang fixed", /\.topbar \{[^}]*position: fixed/.test(css) && /\.topbar \{[^}]*border-radius: 999px/.test(css));
t("pionir: scroll-reveal .rv/.rv-in + reduced-motion dihormati", css.includes(".rv.rv-in") && css.includes("prefers-reduced-motion: reduce"));
t("pionir: aset berversi anti-cache basi di index", indexHtml.includes("styles.css?v=pionir2") && indexHtml.includes("app.js?v=pionir2"));
t("pionir: reveal memakai IntersectionObserver vanilla di app.js", appJs.includes("IntersectionObserver") && appJs.includes("initReveal") && appJs.includes('matchMedia("(prefers-reduced-motion: reduce)")'));

/* ---------- komposisi mockup Kirana + bagian Pendidikan (2026-10-16) ---------- */
const pos = (s) => indexHtml.indexOf(s);
t("komposisi: urutan bagian tentang < pendidikan < proyek < keahlian < kontak",
  pos('id="tentang"') > -1 && pos('id="tentang"') < pos('id="pendidikan"') && pos('id="pendidikan"') < pos('id="proyek"') &&
  pos('id="proyek"') < pos('id="keahlian"') && pos('id="keahlian"') < pos('id="kontak"'));
t("komposisi: nav memuat tautan pendidikan & keahlian",
  indexHtml.includes('href="#pendidikan"') && indexHtml.includes('href="#keahlian"'));
t("komposisi: wadah pendidikan & keahlian ada di HTML",
  indexHtml.includes('id="eduList"') && indexHtml.includes('id="skillBars"') && indexHtml.includes('id="skillTools"') && indexHtml.includes('id="skillLangs"'));
t("komposisi: hero adegan mockup (lencana, burung, bintang, tikar)",
  indexHtml.includes("hero-badge") && indexHtml.includes('class="bird left"') && indexHtml.includes('class="star s1"') && indexHtml.includes('class="mat"'));
t("komposisi: tentang dua panel + footer wordmark raksasa & grid",
  indexHtml.includes('class="about-grid"') && indexHtml.includes('id="aboutFacts"') &&
  indexHtml.includes('class="foot-word"') && indexHtml.includes('class="foot-grid"') && indexHtml.includes('id="footLinks"'));
t("app: pendidikan dirender publik & formulir editnya ada",
  appJs.includes("content.education") && appJs.includes('data-edu') && appJs.includes('data-ef="school"') && appJs.includes('id="addEduBtn"') || appJs.includes("addEduBtn"));
t("app: keahlian dirender publik & formulir editnya ada",
  appJs.includes("content.skills.bars") && appJs.includes('data-bar') && appJs.includes('id="toolsInput"') && appJs.includes('id="langsInput"'));
t("app: draf edit mengumpulkan pendidikan & keahlian",
  appJs.includes("draft.education") && appJs.includes("draft.skills"));
t("css: pola mockup — chip kicker, bar keahlian, panel, footer gelap, grid tentang",
  css.includes(".kicker") && css.includes(".bar") && css.includes(".panel") && css.includes(".foot-word") && css.includes(".about-grid") && css.includes(".skills-grid"));
t("css: hero langit gradasi + animasi bangau/bintang ala mockup",
  css.includes("radial-gradient") && css.includes("@keyframes sway") && css.includes("@keyframes spin") && css.includes(".mat"));

console.log(`\nHasil uji portofolio: ${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
