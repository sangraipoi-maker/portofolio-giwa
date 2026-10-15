/* Portofolio — logika murni (dipakai app.js di browser & tests/run-tests.mjs di Node).
 * Arsitektur: situs statis; konten hidup di Firestore doc `site/content`
 * (publik boleh baca, hanya pemilik boleh menulis — lihat firestore.rules).
 * Bila dokumen itu belum ada / Firebase belum terhubung, situs memakai
 * DEFAULT_CONTENT di berkas ini sebagai cadangan (fallback) — jadi situs
 * selalu tampil utuh walau backend belum aktif.
 */
"use strict";

/* ---------- konten bawaan (bekal awal; semua bisa diubah pemilik) ---------- */
const DEFAULT_CONTENT = {
  siteName: "Portofolio Giwa",
  ownerName: "Giwa — Arkasha Brainley Illyria",
  tagline: "Mahasiswa Psikologi UGM yang membangun alat belajar digital — dari bank soal psikologi sampai pembaca buku Inggris bergrammar.",
  about:
    "Halo, saya Giwa (Arkasha Brainley Illyria), mahasiswa Psikologi di Universitas Gadjah Mada. " +
    "Di luar kuliah saya merancang dan membangun situs-situs belajar: bank soal psikologi dengan ranking, " +
    "pembaca Bahasa Inggris dari berita dan buku, sampai pencari tempat nongkrong di Yogyakarta. " +
    "Semua proyek di halaman ini saya bangun sendiri dari nol — dan halaman ini pun bisa saya sunting langsung dari browser.",
  projects: [
    {
      id: "psikuis",
      title: "PsiKuis",
      desc: "Situs belajar psikologi: 25.701 soal latihan dari 23 mata kuliah, mode awan dengan akun, papan ranking harian, dan penjelasan kenapa jawaban salah.",
      url: "https://psikuis.my.id",
      status: "live",
      statusLabel: "Live",
      tag: "Belajar Psikologi",
    },
    {
      id: "merdeka-belajar",
      title: "Merdeka Belajar",
      desc: "Belajar Bahasa Inggris dari berita dan buku: ketuk kata untuk arti Indonesia, bedah grammar per kalimat, rak buku privat, dan latihan pronunciation.",
      url: "https://merek-5ba13.web.app",
      status: "live",
      statusLabel: "Live",
      tag: "Belajar Bahasa Inggris",
    },
    {
      id: "cari-tempat",
      title: "Cari Tempat",
      desc: "Pencari kafe dan tempat main alam khusus Yogyakarta, memakai data OpenStreetMap — tanpa kunci API, langsung dari peta terbuka.",
      url: "https://sangraipoi-maker.github.io/cari-tempat/",
      status: "live",
      statusLabel: "Live",
      tag: "Peta & Tempat",
    },
    {
      id: "render-jurnal",
      title: "Render Jurnal",
      desc: "Penerjemah dan perender artikel/jurnal PDF dari Inggris ke Indonesia — baca jurnal dalam tampilan bersih, ekspor rapi. Masih dalam pengembangan.",
      url: "",
      status: "dev",
      statusLabel: "Dalam Pengembangan",
      tag: "Alat Baca",
    },
  ],
  education: [
    {
      id: "ugm-psikologi",
      school: "Universitas Gadjah Mada",
      level: "Fakultas Psikologi",
      period: "",
      note: "",
    },
  ],
  skills: {
    bars: [
      { id: "web", label: "Pengembangan Web", pct: 85 },
      { id: "uiux", label: "Desain Antarmuka (UI/UX)", pct: 75 },
      { id: "riset", label: "Riset & Penulisan Akademik", pct: 80 },
      { id: "konten", label: "Pembuatan Konten Digital", pct: 70 },
    ],
    tools: ["HTML & CSS", "JavaScript", "Firebase", "Git & GitHub", "GitHub Pages", "OpenStreetMap"],
    languages: ["Bahasa Indonesia", "Bahasa Inggris"],
  },
  links: [
    { id: "lynk", label: "Toko Lynk — lynk.id/ngerti", url: "https://lynk.id/ngerti", kind: "toko" },
    { id: "instagram", label: "Instagram — @giwa.tulung.agung", url: "https://instagram.com/giwa.tulung.agung", kind: "instagram" },
    { id: "email", label: "Email — giwatulungagung@mail.ugm.ac.id", url: "mailto:giwatulungagung@mail.ugm.ac.id", kind: "email" },
    { id: "whatsapp", label: "WhatsApp — 0895415862862", url: "https://wa.me/62895415862862", kind: "whatsapp" },
  ],
};

/* ---------- util ---------- */
const MAX = {
  siteName: 80, ownerName: 120, tagline: 300, about: 3000,
  projTitle: 120, projDesc: 600, projTag: 60, statusLabel: 60,
  eduSchool: 120, eduLevel: 120, eduPeriod: 60, eduNote: 400, maxEducation: 20,
  skillLabel: 80, skillItem: 40, maxSkillBars: 12, maxSkillItems: 24,
  linkLabel: 120, maxProjects: 60, maxLinks: 30,
};
const ALLOWED_URL = /^(https?:\/\/|mailto:)/i;

function cleanStr(v, max) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.trim().slice(0, max);
}
function cleanUrl(v) {
  const s = cleanStr(v, 500);
  if (!s) return "";
  return ALLOWED_URL.test(s) ? s : "";
}
function slugId(v, fallback) {
  const s = String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s || fallback;
}

/* Sanitasi konten apa pun (dari Firestore / formulir edit) ke bentuk aman.
 * Bidang tak dikenal dibuang; URL skema berbahaya (javascript:, data:) ditolak. */
function sanitizeContent(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {
    siteName: cleanStr(src.siteName, MAX.siteName) || DEFAULT_CONTENT.siteName,
    ownerName: cleanStr(src.ownerName, MAX.ownerName) || DEFAULT_CONTENT.ownerName,
    tagline: cleanStr(src.tagline, MAX.tagline),
    about: cleanStr(src.about, MAX.about),
    projects: [],
    education: [],
    skills: { bars: [], tools: [], languages: [] },
    links: [],
  };
  const seenP = new Set();
  // Bukan array (dokumen rusak/absen) -> daftar bawaan; array (walau kosong) dihormati.
  const projs = Array.isArray(src.projects) ? src.projects : DEFAULT_CONTENT.projects;
  for (const p of projs.slice(0, MAX.maxProjects)) {
    if (!p || typeof p !== "object") continue;
    const title = cleanStr(p.title, MAX.projTitle);
    if (!title) continue;
    let id = slugId(p.id, "");
    if (!id || seenP.has(id)) id = "proyek-" + (seenP.size + 1) + "-" + slugId(title, "x");
    seenP.add(id);
    const status = p.status === "dev" ? "dev" : "live";
    out.projects.push({
      id,
      title,
      desc: cleanStr(p.desc, MAX.projDesc),
      url: cleanUrl(p.url),
      status,
      statusLabel: cleanStr(p.statusLabel, MAX.statusLabel) || (status === "dev" ? "Dalam Pengembangan" : "Live"),
      tag: cleanStr(p.tag, MAX.projTag),
    });
  }
  const seenE = new Set();
  // Sama seperti proyek: bukan array -> bawaan; array (walau kosong) dihormati.
  const edus = Array.isArray(src.education) ? src.education : DEFAULT_CONTENT.education;
  for (const e of edus.slice(0, MAX.maxEducation)) {
    if (!e || typeof e !== "object") continue;
    const school = cleanStr(e.school, MAX.eduSchool);
    if (!school) continue;
    let id = slugId(e.id, "");
    if (!id || seenE.has(id)) id = "sekolah-" + (seenE.size + 1) + "-" + slugId(school, "x");
    seenE.add(id);
    out.education.push({
      id,
      school,
      level: cleanStr(e.level, MAX.eduLevel),
      period: cleanStr(e.period, MAX.eduPeriod),
      note: cleanStr(e.note, MAX.eduNote),
    });
  }
  // Keahlian: bar berlabel+persen, plus dua daftar chip (alat & bahasa).
  const sk = src.skills && typeof src.skills === "object" ? src.skills : DEFAULT_CONTENT.skills;
  const seenB = new Set();
  const bars = Array.isArray(sk.bars) ? sk.bars : DEFAULT_CONTENT.skills.bars;
  for (const b of bars.slice(0, MAX.maxSkillBars)) {
    if (!b || typeof b !== "object") continue;
    const label = cleanStr(b.label, MAX.skillLabel);
    if (!label) continue;
    let id = slugId(b.id, "");
    if (!id || seenB.has(id)) id = "keahlian-" + (seenB.size + 1) + "-" + slugId(label, "x");
    seenB.add(id);
    const pct = Math.max(0, Math.min(100, Math.round(Number(b.pct) || 0)));
    out.skills.bars.push({ id, label, pct });
  }
  const cleanItems = (arr, fallback) => {
    const list = Array.isArray(arr) ? arr : fallback;
    const outItems = [];
    for (const it of list.slice(0, MAX.maxSkillItems)) {
      const s = cleanStr(it, MAX.skillItem);
      if (s && !outItems.includes(s)) outItems.push(s);
    }
    return outItems;
  };
  out.skills.tools = cleanItems(sk.tools, DEFAULT_CONTENT.skills.tools);
  out.skills.languages = cleanItems(sk.languages, DEFAULT_CONTENT.skills.languages);
  const seenL = new Set();
  const links = Array.isArray(src.links) ? src.links : DEFAULT_CONTENT.links;
  for (const l of links.slice(0, MAX.maxLinks)) {
    if (!l || typeof l !== "object") continue;
    const label = cleanStr(l.label, MAX.linkLabel);
    const url = cleanUrl(l.url);
    if (!label || !url) continue;
    let id = slugId(l.id, "");
    if (!id || seenL.has(id)) id = "tautan-" + (seenL.size + 1) + "-" + slugId(label, "x");
    seenL.add(id);
    out.links.push({ id, label, url, kind: cleanStr(l.kind, 30) || "tautan" });
  }
  return out;
}

/* ---------- logika kepemilikan (cermin firestore.rules) ----------
 * contentDoc = data site/content (atau null bila belum ada).
 * Klaim: pengguna masuk pertama yang membuat dokumen menjadi pemilik
 * (ownerUid tertulis di dokumen). Sesudah itu hanya uid itu yang boleh edit. */
function ownerUidOf(contentDoc) {
  return contentDoc && typeof contentDoc.ownerUid === "string" && contentDoc.ownerUid ? contentDoc.ownerUid : null;
}
function canClaim(contentDoc) {
  return ownerUidOf(contentDoc) === null;
}
function isOwner(contentDoc, uid) {
  return !!uid && ownerUidOf(contentDoc) === uid;
}
function canWrite(contentDoc, uid) {
  // selaras rules: create bila belum ada pemilik & penulis menandai dirinya;
  // update bila penulis adalah pemilik tercatat.
  return !!uid && (canClaim(contentDoc) || isOwner(contentDoc, uid));
}

/* ---------- urutan daftar ---------- */
function moveItem(list, id, dir) {
  const a = Array.isArray(list) ? [...list] : [];
  const i = a.findIndex((x) => x && x.id === id);
  if (i < 0) return a;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}
function removeItem(list, id) {
  return (Array.isArray(list) ? list : []).filter((x) => x && x.id !== id);
}
function makeId(prefix, existing) {
  const taken = new Set((existing || []).map((x) => x && x.id));
  let n = 1;
  let id = prefix + "-" + n;
  while (taken.has(id)) { n++; id = prefix + "-" + n; }
  return id;
}

/* ---------- riwayat/cadangan ---------- */
function makeHistoryEntry(prevContent, prevOwnerUid, savedAt) {
  return {
    savedAt: typeof savedAt === "number" ? savedAt : Date.now(),
    ownerUid: prevOwnerUid || null,
    content: sanitizeContent(prevContent),
  };
}

const Core = {
  DEFAULT_CONTENT, MAX, ALLOWED_URL,
  cleanStr, cleanUrl, slugId, sanitizeContent,
  ownerUidOf, canClaim, isOwner, canWrite,
  moveItem, removeItem, makeId, makeHistoryEntry,
};

if (typeof window !== "undefined") window.PortofolioCore = Core;
if (typeof module !== "undefined" && module.exports) module.exports = Core;
