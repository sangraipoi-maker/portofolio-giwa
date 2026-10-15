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

/* ---------- KESETIAAN MOCKUP Kirana (porting 2026-10-16) ----------
 * Acuan tunggal: ~/workspace/pratinjau-portofolio-pionir.html.
 * Blok ini menggantikan assertion "bahasa desain PIONIR" versi tafsir
 * (yang sempat mengkodekan nilai salah tafsir, mis. --brown-deep #461a0c);
 * sekarang semua nilai yang diuji = nilai mockup persis. */
const css = readFileSync(join(root, "public", "styles.css"), "utf8");
t("mockup: token warna inti persis", ["--paper:#fffdf3", "--paper-2:#fff8dc", "--ink:#232323", "--ink-soft:#4f4c4c", "--brown:#4b2a18", "--brown-deep:#3f2415", "--line:#e5e1d9"].every((s) => css.includes(s)));
t("mockup: token warna aksen persis", ["--orange:#f58124", "--orange-deep:#f56e00", "--orange-soft:#ffcda3", "--yellow:#ffe029", "--yellow-soft:#fff3a9", "--blue:#3dc7f2", "--green:#45e1b1", "--purple:#902ef5", "--pink:#f76f96", "--red:#f20f50"].every((s) => css.includes(s)));
t("mockup: token potongan --cut:1.1rem & --cut-sm:.7rem", css.includes("--cut:1.1rem") && css.includes("--cut-sm:.7rem"));
t("mockup: pola .frame (padding 3px, clip-path var(--cut))", /\.frame\{[^}]*padding:3px/.test(css) && /\.frame\{[^}]*clip-path:polygon\(var\(--cut\)/.test(css));
t("mockup: .frame > .inner (padding 1.4rem 1.5rem, potongan -3px)", css.includes(".frame > .inner") && /\.frame > \.inner\{[^}]*padding:1\.4rem 1\.5rem/.test(css) && css.includes("calc(var(--cut) - 3px)"));
t("mockup: .lift hover naik -8px", /\.lift:hover\{transform:translateY\(-8px\)\}/.test(css));
t("mockup: tombol pil kuning berbatas cokelat + bayangan keras rgba", /\.btn\{[^}]*background:var\(--yellow\)[^}]*border:2px solid var\(--brown\)[^}]*border-radius:999px[^}]*box-shadow:0 6px rgba\(70,26,12,\.35\)/.test(css));
t("mockup: .btn.orange oranye & .btn.small bayangan 0 4px", /\.btn\.orange\{background:var\(--orange\)/.test(css) && /\.btn\.small\{[^}]*box-shadow:0 4px rgba\(70,26,12,\.35\)/.test(css));
t("mockup: header wrapper fixed + .nav pil (batas cokelat, bayangan 0 6px rgba(35,35,35,.22))", /header\{[^}]*position:fixed/.test(css) && /\.nav\{[^}]*border:2px solid var\(--brown\)[^}]*border-radius:999px[^}]*box-shadow:0 6px rgba\(35,35,35,\.22\)/.test(css));
t("mockup: nav max-width 72rem & tautan .86rem/700", /\.nav\{[^}]*max-width:72rem/.test(css) && /\.nav nav a\{[^}]*font-weight:700; font-size:\.86rem/.test(css));
t("mockup: section padding 4.5rem 0 1rem & .wrap 72rem", /section\{padding:4\.5rem 0 1rem\}/.test(css) && /\.wrap\{max-width:72rem/.test(css));
t("mockup: kicker kuning-soft BERBATAS cokelat + potongan cut-sm", /\.kicker\{[^}]*background:var\(--yellow-soft\)[^}]*border:2px solid var\(--brown\)/.test(css));
t("mockup: h2.sec clamp(1.7rem,4vw,2.5rem) cokelat tua", /h2\.sec\{font-size:clamp\(1\.7rem,4vw,2\.5rem\); font-weight:800; color:var\(--brown-deep\)/.test(css));
t("mockup: hero padding 8.5rem 0 5.5rem + gradasi langit persis", /\.hero\{[^}]*padding:8\.5rem 0 5\.5rem/.test(css) && css.includes("radial-gradient(circle at 50% 32%, rgba(255,254,238,.95) 0%, rgba(196,242,250,.55) 42%, rgba(129,219,247,.75) 78%, rgba(144,221,246,.9) 100%)"));
t("mockup: anyaman 26px rgba(87,48,25,.045)", css.includes("background-size:26px 26px") && css.includes("rgba(87,48,25,.045)"));
t("mockup: h1 hero clamp(2.6rem,8.5vw,5.2rem) lh 1.02 + bayangan lapis kuning/oranye", /\.hero h1\{[^}]*font-size:clamp\(2\.6rem,8\.5vw,5\.2rem\)[^}]*line-height:1\.02/.test(css) && css.includes("text-shadow:.045em .045em 0 var(--yellow), .09em .09em 0 rgba(245,129,36,.55)"));
t("mockup: lencana hero pil berbayang 0 4px rgba(70,26,12,.3)", /\.hero \.badge\{[^}]*box-shadow:0 4px rgba\(70,26,12,\.3\)/.test(css));
t("mockup: animasi bangau sway 7.6s + swayR & bintang spin 24s (keyframes ada)", css.includes("animation:sway 7.6s cubic-bezier(.45,0,.55,1) infinite") && css.includes("@keyframes swayR") && css.includes("animation:spin 24s linear infinite") && css.includes("@keyframes spin"));
t("mockup: posisi bintang s1/s2 persis (bottom 14%/22%)", /\.star\.s1\{left:12%; bottom:14%; width:44px\}/.test(css) && /\.star\.s2\{right:14%; bottom:22%; width:30px/.test(css));
t("mockup: tikar .mat 54px gradasi 45deg + potongan miring", /\.mat\{[^}]*height:54px[^}]*repeating-linear-gradient\(45deg, var\(--orange-soft\) 0 14px, var\(--yellow-soft\) 14px 28px\)/.test(css) && css.includes("clip-path:polygon(0 38%, 100% 0, 100% 100%, 0 100%)"));
t("mockup: grid proyek 1/2/3 kolom di 640/1024", /\.grid\{[^}]*grid-template-columns:1fr/.test(css) && css.includes("min-width:640px") && css.includes("min-width:1024px"));
t("mockup: thumb kartu 150px & margin -.4rem -.5rem 1rem", /\.proj \.thumb\{height:150px[^}]*margin:-\.4rem -\.5rem 1rem/.test(css));
t("mockup: .proj h3 1.12rem & .proj p .9rem ink-soft", /\.proj h3\{font-size:1\.12rem/.test(css) && /\.proj p\{font-size:\.9rem; color:var\(--ink-soft\)\}/.test(css));
t("mockup: chip .tag berbatas 1.5px + terpotong cut-sm", /\.tag\{[^}]*border:1\.5px solid var\(--brown\)/.test(css));
t("mockup: bar keahlian tinggi 16px berbatas cokelat pil", /\.bar\{height:16px; border:2px solid var\(--brown\)[^}]*border-radius:999px/.test(css));
t("mockup: chip keahlian bayangan 0 4px rgba(70,26,12,.28)", /\.chip\{[^}]*box-shadow:0 4px rgba\(70,26,12,\.28\)/.test(css));
t("mockup: panel kontak padding 3rem 1.5rem & h2 clamp(1.8rem,4.5vw,2.7rem)", /\.contact-panel\{text-align:center; padding:3rem 1\.5rem\}/.test(css) && /\.contact-panel h2\{font-size:clamp\(1\.8rem,4\.5vw,2\.7rem\)/.test(css));
t("mockup: socials kotak 46px terpotong berbayang", /\.socials a\{[^}]*width:46px; height:46px[^}]*box-shadow:0 4px rgba\(70,26,12,\.3\)/.test(css));
t("mockup: footer margin-top 5rem bg brown-deep & wordmark clamp(3rem,11.5vw,8.5rem)", /footer\{margin-top:5rem; background:var\(--brown-deep\)/.test(css) && /\.foot-word\{[^}]*font-size:clamp\(3rem,11\.5vw,8\.5rem\)/.test(css));
t("mockup: reveal .rv translateY(26px) .7s + .rv.zoom scale(.92) + .rv.on", /\.rv\{opacity:0; transform:translateY\(26px\); transition:opacity \.7s ease, transform \.7s cubic-bezier\(0,0,\.25,1\)\}/.test(css) && /\.rv\.zoom\{transform:scale\(\.92\)\}/.test(css) && css.includes(".rv.on"));
t("mockup: reduced-motion mematikan rv & animasi bangau/bintang (bukan semua)", /prefers-reduced-motion: reduce\)\{\s*\.rv\{opacity:1; transform:none; transition:none\}\s*\.bird,\.star\{animation:none\}/.test(css));
t("mockup: font DM Sans di tumpukan font", css.includes('--font:"DM Sans"') && indexHtml.includes("family=DM+Sans"));
t("mockup: aset berversi pionir3 anti-cache basi di index", indexHtml.includes("styles.css?v=pionir3") && indexHtml.includes("app.js?v=pionir3") && indexHtml.includes("core.js?v=pionir3"));
t("mockup: reveal memakai IntersectionObserver vanilla di app.js (ambang 0.12 ala mockup)", appJs.includes("IntersectionObserver") && appJs.includes("initReveal") && appJs.includes("threshold: 0.12") && appJs.includes('matchMedia("(prefers-reduced-motion: reduce)")'));

/* ---------- komposisi mockup Kirana + bagian Pendidikan (2026-10-16) ---------- */
const pos = (s) => indexHtml.indexOf(s);
t("komposisi: urutan bagian tentang < pendidikan < proyek < keahlian < kontak",
  pos('id="tentang"') > -1 && pos('id="tentang"') < pos('id="pendidikan"') && pos('id="pendidikan"') < pos('id="proyek"') &&
  pos('id="proyek"') < pos('id="keahlian"') && pos('id="keahlian"') < pos('id="kontak"'));
t("komposisi: nav memuat tautan pendidikan & keahlian",
  indexHtml.includes('href="#pendidikan"') && indexHtml.includes('href="#keahlian"'));
t("komposisi: wadah pendidikan & keahlian ada di HTML",
  indexHtml.includes('id="eduList"') && indexHtml.includes('id="skillBars"') && indexHtml.includes('id="skillTools"') && indexHtml.includes('id="skillLangs"'));
t("komposisi: hero adegan mockup (lencana, anyaman, burung, bintang, tikar)",
  indexHtml.includes('class="badge"') && indexHtml.includes('class="weave"') && indexHtml.includes('class="bird left"') && indexHtml.includes('class="star s1"') && indexHtml.includes('class="mat"'));
t("komposisi: tentang dua frame mockup + footer wordmark raksasa & grid",
  indexHtml.includes('class="about-grid"') && indexHtml.includes('id="aboutFacts"') &&
  indexHtml.includes('class="foot-word"') && indexHtml.includes('class="foot-grid"') && indexHtml.includes('id="footLinks"'));
t("komposisi: struktur header mockup (header > .nav > .brand .dot)",
  indexHtml.includes('class="nav"') && indexHtml.includes('class="dot"') && indexHtml.includes('id="accountBtn"'));
t("komposisi: kontak pola mockup (CTA email + .socials#linkList)",
  indexHtml.includes('id="emailCta"') && indexHtml.includes('class="socials" id="linkList"') && indexHtml.includes("contact-panel"));
t("app: pendidikan dirender publik & formulir editnya ada",
  appJs.includes("content.education") && appJs.includes('data-edu') && appJs.includes('data-ef="school"') && appJs.includes('id="addEduBtn"') || appJs.includes("addEduBtn"));
t("app: keahlian dirender publik & formulir editnya ada",
  appJs.includes("content.skills.bars") && appJs.includes('data-bar') && appJs.includes('id="toolsInput"') && appJs.includes('id="langsInput"'));
t("app: draf edit mengumpulkan pendidikan & keahlian",
  appJs.includes("draft.education") && appJs.includes("draft.skills"));
t("css: pola mockup — chip kicker, bar keahlian, frame, footer gelap, grid tentang & keahlian",
  css.includes(".kicker") && css.includes(".bar") && css.includes(".frame") && css.includes(".foot-word") && css.includes(".about-grid") && css.includes(".skills"));
t("css: hero langit gradasi + animasi bangau/bintang ala mockup",
  css.includes("radial-gradient") && css.includes("@keyframes sway") && css.includes("@keyframes spin") && css.includes(".mat"));
t("app: kartu dirender sebagai .frame mockup (siklus warna & pastel persis mockup)",
  appJs.includes("FRAME_VARS") && appJs.includes('"--orange", "--blue", "--green", "--purple", "--pink", "--yellow"') &&
  appJs.includes("THUMB_BGS") && appJs.includes('"#ffcda3", "#c4f2fa", "#d3f9ec", "#ecd9fe", "#fcdce6", "#fff3a9"') &&
  appJs.includes('class="frame lift rv') && appJs.includes('class="inner proj"') && appJs.includes('class="inner edu"'));
t("app: kontak dirender pola mockup (email -> CTA, lain -> socials berglif)",
  appJs.includes('$("#emailCta")') && appJs.includes("SOCIAL_GLYPHS") && appJs.includes('linkList.className = "socials"'));
t("app: bar keahlian berwarna bergilir ala mockup (hijau/biru/ungu/pink)",
  appJs.includes("BAR_COLORS") && appJs.includes('"var(--green)", "var(--blue)", "var(--purple)", "var(--pink)"'));
/* Regresi bug fatal yang ditemukan saat porting: core.js & app.js berbagi
 * ruang global skrip klasik — nama fungsi top-level core.js TIDAK boleh
 * dideklarasikan ulang di app.js (pernah terjadi pada `isOwner`:
 * SyntaxError membuat seluruh app.js mati dan situs tak pernah ter-render). */
const coreSrc = readFileSync(join(root, "public", "core.js"), "utf8");
const coreNames = [...coreSrc.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]);
t("regresi: app.js tidak mendeklarasikan ulang nama global core.js",
  coreNames.length >= 8 && coreNames.every((n) => !new RegExp(`(^|\\n)\\s*(const|let|var|function)\\s+${n}\\b`).test(appJs)));

console.log(`\nHasil uji portofolio: ${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
