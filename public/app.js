/* Portofolio — aplikasi utama.
 * Pola sama seperti Merdeka Belajar: konten cadangan (fallback) dari core.js
 * tampil SEGERA; bila Firebase terhubung, dokumen Firestore `site/content`
 * (publik-baca, pemilik-tulis) menggantikannya dan diperbarui langsung
 * (onSnapshot). Kontrol edit HANYA dirender untuk pemilik yang masuk —
 * pengunjung tidak pernah melihatnya.
 */
"use strict";

const C = window.PortofolioCore;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- state ---------- */
let contentDoc = null;                       // data mentah site/content (atau null)
let content = C.sanitizeContent(C.DEFAULT_CONTENT); // yang sedang tampil
let user = null;                             // pengguna Firebase (atau null)
let editing = false;
let fb = { ready: false, auth: null, db: null };

const isOwner = () => !!user && C.isOwner(contentDoc, user.uid);
const claimable = () => !!user && !contentDoc && C.canClaim(contentDoc);

/* ---------- scroll-reveal ringan (pola AOS ala PIONIR) ----------
 * Elemen diberi kelas .rv (keadaan awal tersembunyi) HANYA bila
 * IntersectionObserver tersedia dan gerak tidak dikurangi — jadi tanpa
 * JS/IO atau dengan prefers-reduced-motion, konten selalu tampil penuh. */
let revealObserver = null;
function initReveal() {
  const els = $$(".hero-inner > *, main section .kicker, main section h2.sec, .about-grid > .panel, #eduList > .card, #projectGrid > .card, .skills-grid > .panel, #linkList > li");
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("rv-in"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("rv-in"); revealObserver.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -4% 0px" });
  }
  els.forEach((el, i) => {
    if (el.classList.contains("rv-in")) return;
    el.classList.add("rv");
    el.style.transitionDelay = (i % 4) * 50 + "ms";
    revealObserver.observe(el);
  });
}

/* ---------- glif pita kartu proyek (SVG generik, bergilir per posisi) ---------- */
const GLYPHS = [
  `<svg width="86" height="86" viewBox="0 0 100 100" aria-hidden="true"><rect x="14" y="22" width="72" height="52" rx="8" fill="#fffdf3" stroke="#4b2a18" stroke-width="4"/><path d="M14 34 H86" stroke="#4b2a18" stroke-width="4"/><circle cx="24" cy="28" r="3" fill="#f20f50"/><circle cx="34" cy="28" r="3" fill="#ffe029"/></svg>`,
  `<svg width="86" height="86" viewBox="0 0 100 100" aria-hidden="true"><rect x="30" y="12" width="40" height="76" rx="9" fill="#fffdf3" stroke="#4b2a18" stroke-width="4"/><path d="M42 26 H58 M42 38 H58 M42 50 H52" stroke="#4b2a18" stroke-width="4" stroke-linecap="round"/></svg>`,
  `<svg width="86" height="86" viewBox="0 0 100 100" aria-hidden="true"><path d="M16 78 V46 M38 78 V30 M60 78 V54 M82 78 V22" stroke="#4b2a18" stroke-width="7" stroke-linecap="round"/><path d="M12 84 H88" stroke="#4b2a18" stroke-width="4" stroke-linecap="round"/></svg>`,
  `<svg width="86" height="86" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="30" fill="#fffdf3" stroke="#4b2a18" stroke-width="4"/><path d="M50 32 V50 L64 60" stroke="#4b2a18" stroke-width="4" stroke-linecap="round"/></svg>`,
  `<svg width="86" height="86" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 82 C20 62 16 40 30 28 C42 18 50 30 50 38 C50 30 58 18 70 28 C84 40 80 62 50 82Z" fill="#fffdf3" stroke="#4b2a18" stroke-width="4" stroke-linejoin="round"/></svg>`,
  `<svg width="86" height="86" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 L61 39 L94 39 L67 58 L77 90 L50 71 L23 90 L33 58 L6 39 L39 39Z" fill="#fffdf3" stroke="#4b2a18" stroke-width="4" stroke-linejoin="round"/></svg>`,
];

/* ---------- fakta singkat di panel Tentang (dihitung dari konten) ---------- */
function renderFacts() {
  const el = $("#aboutFacts");
  if (!el) return;
  const live = content.projects.filter((p) => p.status === "live").length;
  el.innerHTML = `
    <div class="fact"><b>${content.projects.length}</b><span>Proyek Dibangun</span></div>
    <div class="fact"><b>${live}</b><span>Situs Live</span></div>
    <div class="fact"><b>UGM</b><span>Fakultas Psikologi</span></div>`;
}

/* ---------- render tampilan publik ---------- */
function renderView() {
  document.title = content.siteName;
  $("#brandName").textContent = content.siteName;
  $("#footName").textContent = content.siteName;
  $("#footTagline").textContent = content.tagline;
  $("#ownerName").textContent = content.ownerName;
  $("#tagline").textContent = content.tagline;
  $("#aboutText").textContent = content.about;
  renderFacts();

  $("#eduList").innerHTML = content.education.length ? content.education.map((e) => `
    <article class="card">
      <div class="meta">
        ${e.level ? `<span class="badge">${esc(e.level)}</span>` : ""}
        ${e.period ? `<span class="badge period">${esc(e.period)}</span>` : ""}
      </div>
      <h3>${esc(e.school)}</h3>
      ${e.note ? `<p>${esc(e.note)}</p>` : ""}
    </article>`).join("") : `<p class="loading">Belum ada riwayat pendidikan.</p>`;

  $("#projectGrid").innerHTML = content.projects.length ? content.projects.map((p, i) => `
    <article class="card">
      <div class="thumb">${GLYPHS[i % GLYPHS.length]}</div>
      <div class="meta">
        <span class="badge ${p.status === "dev" ? "dev" : "live"}">${esc(p.statusLabel)}</span>
      </div>
      <h3>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)}</h3>
      <p>${esc(p.desc)}</p>
      ${p.tag ? `<div class="tags"><span class="tag">${esc(p.tag)}</span></div>` : ""}
      ${p.url ? `<a class="visit" href="${esc(p.url)}" target="_blank" rel="noopener">Kunjungi →</a>` : `<span class="save-note">Belum tayang</span>`}
    </article>`).join("") : `<p class="loading">Belum ada proyek.</p>`;

  $("#skillBars").innerHTML = content.skills.bars.length ? content.skills.bars.map((b) => `
    <div class="skill-row">
      <div class="lbl"><span>${esc(b.label)}</span><span>${b.pct}%</span></div>
      <div class="bar"><i style="width:${b.pct}%"></i></div>
    </div>`).join("") : `<p class="loading">Belum ada data keahlian.</p>`;
  $("#skillTools").innerHTML = content.skills.tools.map((s) => `<span class="chip">${esc(s)}</span>`).join("");
  $("#skillLangs").innerHTML = content.skills.languages.map((s) => `<span class="chip">${esc(s)}</span>`).join("");

  $("#linkList").innerHTML = content.links.map((l) => `
    <li><a href="${esc(l.url)}" ${/^https?:/.test(l.url) ? `target="_blank" rel="noopener"` : ""}>${esc(l.label)}</a></li>`).join("");
  $("#footLinks").innerHTML = content.links.slice(0, 4).map((l) => `
    <a href="${esc(l.url)}" ${/^https?:/.test(l.url) ? `target="_blank" rel="noopener"` : ""}>${esc(l.label)}</a>`).join("");

  renderOwnerBar();
  initReveal();
}

/* ---------- bar pemilik (hanya untuk pengguna masuk) ---------- */
function renderOwnerBar() {
  const bar = $("#ownerBar");
  if (!user) { bar.classList.add("hidden"); bar.innerHTML = ""; return; }
  bar.classList.remove("hidden");
  if (editing) {
    bar.innerHTML = `
      <span class="grow">✏️ Mode edit aktif — ubah teks langsung di halaman, atur pendidikan, kartu proyek, keahlian & tautan di bawah, lalu simpan.</span>
      <button class="btn small" id="saveBtn" type="button">💾 Simpan Perubahan</button>
      <button class="btn small ghost" id="cancelBtn" type="button">Batalkan</button>
      <span class="save-note" id="saveNote"></span>`;
    $("#saveBtn").addEventListener("click", saveEdits);
    $("#cancelBtn").addEventListener("click", () => { editing = false; renderView(); });
  } else if (isOwner()) {
    bar.innerHTML = `
      <span class="grow">Kamu masuk sebagai pemilik (${esc(user.email || "")}).</span>
      <button class="btn small" id="editBtn" type="button">✏️ Edit Situs Ini</button>
      <button class="btn small ghost" id="outBtn" type="button">Keluar</button>`;
    $("#editBtn").addEventListener("click", () => { editing = true; renderEdit(); });
    $("#outBtn").addEventListener("click", () => fb.auth.signOut());
  } else if (claimable()) {
    bar.innerHTML = `
      <span class="grow">Dokumen konten belum ada pemilik. Kamu masuk sebagai ${esc(user.email || "")} — klaim situs ini untuk menjadi pemiliknya.</span>
      <button class="btn small" id="claimBtn" type="button">Klaim Situs Ini</button>
      <button class="btn small ghost" id="outBtn2" type="button">Keluar</button>`;
    $("#claimBtn").addEventListener("click", claimSite);
    $("#outBtn2").addEventListener("click", () => fb.auth.signOut());
  } else {
    bar.innerHTML = `
      <span class="grow">Kamu masuk sebagai ${esc(user.email || "")}, bukan pemilik situs — mode hanya-baca.</span>
      <button class="btn small ghost" id="outBtn3" type="button">Keluar</button>`;
    $("#outBtn3").addEventListener("click", () => fb.auth.signOut());
  }
}

/* ---------- render mode edit ---------- */
function renderEdit() {
  document.title = content.siteName;
  $("#brandName").textContent = content.siteName;
  $("#footName").textContent = content.siteName;
  const setEditable = (el, text) => { el.textContent = text; el.setAttribute("contenteditable", "true"); el.spellcheck = false; };
  setEditable($("#brandName"), content.siteName);
  setEditable($("#ownerName"), content.ownerName);
  setEditable($("#tagline"), content.tagline);
  setEditable($("#aboutText"), content.about);

  $("#projectGrid").innerHTML = content.projects.map((p, i) => `
    <article class="card editing" data-proj="${esc(p.id)}">
      <label class="fld">Judul proyek
        <input data-f="title" type="text" value="${esc(p.title)}" maxlength="120">
      </label>
      <label class="fld">Deskripsi
        <textarea data-f="desc" rows="3" maxlength="600">${esc(p.desc)}</textarea>
      </label>
      <label class="fld">Tautan (kosongkan bila belum tayang)
        <input data-f="url" type="url" value="${esc(p.url)}" placeholder="https://…">
      </label>
      <div class="meta">
        <label class="fld" style="flex:1">Status
          <select data-f="status">
            <option value="live" ${p.status === "live" ? "selected" : ""}>Live</option>
            <option value="dev" ${p.status === "dev" ? "selected" : ""}>Dalam Pengembangan</option>
          </select>
        </label>
        <label class="fld" style="flex:1">Label status
          <input data-f="statusLabel" type="text" value="${esc(p.statusLabel)}" maxlength="60">
        </label>
        <label class="fld" style="flex:1">Kategori
          <input data-f="tag" type="text" value="${esc(p.tag)}" maxlength="60">
        </label>
      </div>
      <div class="edit-actions">
        <button class="icon-btn" type="button" data-act="up" ${i === 0 ? "disabled" : ""}>↑ Naik</button>
        <button class="icon-btn" type="button" data-act="down" ${i === content.projects.length - 1 ? "disabled" : ""}>↓ Turun</button>
        <button class="icon-btn red" type="button" data-act="del">🗑 Hapus proyek</button>
      </div>
    </article>`).join("") + `
    <article class="card" style="align-items:flex-start;justify-content:center">
      <button class="btn" type="button" id="addProjBtn">＋ Tambah Proyek</button>
      <p class="save-note">Kartu baru muncul di urutan terakhir; naikkan dengan tombol ↑ sesudah menyimpan.</p>
    </article>`;

  $$("#projectGrid [data-proj]").forEach((card) => {
    $$("[data-act]", card).forEach((b) => b.addEventListener("click", () => {
      const draft = collectDraft();
      const id = card.dataset.proj;
      if (b.dataset.act === "del") {
        if (!confirm("Hapus proyek ini dari daftar? (berlaku sesudah disimpan)")) return;
        draft.projects = C.removeItem(draft.projects, id);
      } else {
        draft.projects = C.moveItem(draft.projects, id, b.dataset.act);
      }
      content = C.sanitizeContent(draft);
      renderEdit();
    }));
  });
  $("#addProjBtn").addEventListener("click", () => {
    const draft = collectDraft();
    draft.projects.push({ id: C.makeId("proyek", draft.projects), title: "Proyek Baru", desc: "", url: "", status: "dev", statusLabel: "Dalam Pengembangan", tag: "" });
    content = C.sanitizeContent(draft);
    renderEdit();
  });

  renderFacts();

  /* --- formulir pendidikan: tambah/edit/hapus/urut, pola sama seperti proyek --- */
  $("#eduList").innerHTML = content.education.map((e, i) => `
    <article class="card editing" data-edu="${esc(e.id)}">
      <label class="fld">Nama sekolah / kampus
        <input data-ef="school" type="text" value="${esc(e.school)}" maxlength="120">
      </label>
      <label class="fld">Jenjang / keterangan
        <input data-ef="level" type="text" value="${esc(e.level)}" maxlength="120" placeholder="mis. Fakultas Psikologi">
      </label>
      <label class="fld">Periode (boleh kosong)
        <input data-ef="period" type="text" value="${esc(e.period)}" maxlength="60" placeholder="mis. 2023 — sekarang">
      </label>
      <label class="fld">Catatan singkat
        <textarea data-ef="note" rows="2" maxlength="400">${esc(e.note)}</textarea>
      </label>
      <div class="edit-actions">
        <button class="icon-btn" type="button" data-eact="up" ${i === 0 ? "disabled" : ""}>↑ Naik</button>
        <button class="icon-btn" type="button" data-eact="down" ${i === content.education.length - 1 ? "disabled" : ""}>↓ Turun</button>
        <button class="icon-btn red" type="button" data-eact="del">🗑 Hapus entri</button>
      </div>
    </article>`).join("") + `
    <article class="card" style="align-items:flex-start;justify-content:center">
      <button class="btn" type="button" id="addEduBtn">＋ Tambah Pendidikan</button>
      <p class="save-note">Entri baru muncul di urutan terakhir; naikkan dengan tombol ↑ sesudah menyimpan.</p>
    </article>`;
  $$("#eduList [data-edu]").forEach((card) => {
    $$("[data-eact]", card).forEach((b) => b.addEventListener("click", () => {
      const draft = collectDraft();
      const id = card.dataset.edu;
      if (b.dataset.eact === "del") {
        if (!confirm("Hapus entri pendidikan ini dari daftar? (berlaku sesudah disimpan)")) return;
        draft.education = C.removeItem(draft.education, id);
      } else {
        draft.education = C.moveItem(draft.education, id, b.dataset.eact);
      }
      content = C.sanitizeContent(draft);
      renderEdit();
    }));
  });
  $("#addEduBtn").addEventListener("click", () => {
    const draft = collectDraft();
    draft.education.push({ id: C.makeId("sekolah", draft.education), school: "Sekolah Baru", level: "", period: "", note: "" });
    content = C.sanitizeContent(draft);
    renderEdit();
  });

  /* --- formulir keahlian: bar (label + persen) & dua daftar chip --- */
  $("#skillBars").innerHTML = content.skills.bars.map((b, i) => `
    <div class="skill-edit" data-bar="${esc(b.id)}" style="display:grid;gap:.4rem;margin-bottom:.8rem">
      <label class="fld" style="margin:0">Nama keahlian
        <input data-sf="label" type="text" value="${esc(b.label)}" maxlength="80">
      </label>
      <label class="fld" style="margin:0">Tingkat (0–100)
        <input data-sf="pct" type="number" min="0" max="100" step="1" value="${b.pct}">
      </label>
      <div class="edit-actions">
        <button class="icon-btn" type="button" data-sact="up" ${i === 0 ? "disabled" : ""}>↑ Naik</button>
        <button class="icon-btn" type="button" data-sact="down" ${i === content.skills.bars.length - 1 ? "disabled" : ""}>↓ Turun</button>
        <button class="icon-btn red" type="button" data-sact="del">🗑 Hapus</button>
      </div>
    </div>`).join("") + `
    <div><button class="btn small ghost" type="button" id="addBarBtn">＋ Tambah Keahlian</button></div>`;
  $$("#skillBars [data-bar]").forEach((row) => {
    $$("[data-sact]", row).forEach((b) => b.addEventListener("click", () => {
      const draft = collectDraft();
      const id = row.dataset.bar;
      if (b.dataset.sact === "del") {
        if (!confirm("Hapus keahlian ini? (berlaku sesudah disimpan)")) return;
        draft.skills.bars = C.removeItem(draft.skills.bars, id);
      } else {
        draft.skills.bars = C.moveItem(draft.skills.bars, id, b.dataset.sact);
      }
      content = C.sanitizeContent(draft);
      renderEdit();
    }));
  });
  $("#addBarBtn").addEventListener("click", () => {
    const draft = collectDraft();
    draft.skills.bars.push({ id: C.makeId("keahlian", draft.skills.bars), label: "Keahlian Baru", pct: 50 });
    content = C.sanitizeContent(draft);
    renderEdit();
  });
  $("#skillTools").innerHTML = `
    <label class="fld" style="flex:1 1 100%;margin:0">Satu alat per baris
      <textarea id="toolsInput" rows="4">${esc(content.skills.tools.join("\n"))}</textarea>
    </label>`;
  $("#skillLangs").innerHTML = `
    <label class="fld" style="flex:1 1 100%;margin:0">Satu bahasa per baris
      <textarea id="langsInput" rows="2">${esc(content.skills.languages.join("\n"))}</textarea>
    </label>`;

  $("#linkList").innerHTML = content.links.map((l) => `
    <li data-link="${esc(l.id)}" style="display:grid;gap:.4rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.7rem .9rem">
      <label class="fld" style="margin:0">Label tautan
        <input data-lf="label" type="text" value="${esc(l.label)}" maxlength="120">
      </label>
      <label class="fld" style="margin:0">Alamat (https://… atau mailto:…)
        <input data-lf="url" type="text" value="${esc(l.url)}">
      </label>
      <div><button class="icon-btn red" type="button" data-lact="del">🗑 Hapus tautan</button></div>
    </li>`).join("") + `
    <li style="margin-top:.6rem"><button class="btn small ghost" type="button" id="addLinkBtn">＋ Tambah Tautan</button></li>`;
  $$("#linkList [data-link]").forEach((row) => {
    $("[data-lact]", row).addEventListener("click", () => {
      const draft = collectDraft();
      draft.links = C.removeItem(draft.links, row.dataset.link);
      content = C.sanitizeContent(draft);
      renderEdit();
    });
  });
  $("#addLinkBtn").addEventListener("click", () => {
    const draft = collectDraft();
    draft.links.push({ id: C.makeId("tautan", draft.links), label: "Tautan Baru", url: "https://", kind: "tautan" });
    content = C.sanitizeContent(draft);
    renderEdit();
  });

  renderOwnerBar();
  initReveal();
}

/* Kumpulkan seluruh isian formulir edit menjadi satu objek konten. */
function collectDraft() {
  const draft = {
    siteName: $("#brandName").innerText,
    ownerName: $("#ownerName").innerText,
    tagline: $("#tagline").innerText,
    about: $("#aboutText").innerText,
    projects: [],
    education: [],
    skills: { bars: [], tools: [], languages: [] },
    links: [],
  };
  $$("#projectGrid [data-proj]").forEach((card) => {
    const get = (f) => { const el = card.querySelector(`[data-f="${f}"]`); return el ? el.value : ""; };
    draft.projects.push({
      id: card.dataset.proj,
      title: get("title"), desc: get("desc"), url: get("url"),
      status: get("status"), statusLabel: get("statusLabel"), tag: get("tag"),
    });
  });
  $$("#eduList [data-edu]").forEach((card) => {
    const get = (f) => { const el = card.querySelector(`[data-ef="${f}"]`); return el ? el.value : ""; };
    draft.education.push({
      id: card.dataset.edu,
      school: get("school"), level: get("level"), period: get("period"), note: get("note"),
    });
  });
  $$("#skillBars [data-bar]").forEach((row) => {
    const get = (f) => { const el = row.querySelector(`[data-sf="${f}"]`); return el ? el.value : ""; };
    draft.skills.bars.push({ id: row.dataset.bar, label: get("label"), pct: get("pct") });
  });
  const splitLines = (el) => (el ? el.value : "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  draft.skills.tools = splitLines($("#toolsInput"));
  draft.skills.languages = splitLines($("#langsInput"));
  $$("#linkList [data-link]").forEach((row) => {
    const get = (f) => { const el = row.querySelector(`[data-lf="${f}"]`); return el ? el.value : ""; };
    draft.links.push({ id: row.dataset.link, label: get("label"), url: get("url"), kind: "tautan" });
  });
  return draft;
}

/* ---------- simpan & klaim ---------- */
async function writeContent(nextContent, noteEl) {
  const clean = C.sanitizeContent(nextContent);
  const payload = { ...clean, ownerUid: user.uid, updatedAt: Date.now() };
  // Cadangkan versi sebelumnya dulu (bila dokumen sudah ada).
  if (contentDoc) {
    const entry = C.makeHistoryEntry(contentDoc, C.ownerUidOf(contentDoc), Date.now());
    await fb.db.doc("site/content").collection("history").add(entry);
  }
  await fb.db.doc("site/content").set(payload);
  contentDoc = payload;
  content = clean;
  if (noteEl) noteEl.textContent = "Tersimpan ✓ — perubahan sudah tampil untuk semua pengunjung.";
  return payload;
}

async function saveEdits() {
  const btn = $("#saveBtn");
  const note = $("#saveNote");
  btn.disabled = true;
  note.textContent = "Menyimpan…";
  try {
    await writeContent(collectDraft(), note);
    editing = false;
    ["#brandName", "#ownerName", "#tagline", "#aboutText"].forEach((s) => { const el = $(s); el.removeAttribute("contenteditable"); });
    renderView();
  } catch (e) {
    note.textContent = "Gagal menyimpan: " + (e.message || e);
    btn.disabled = false;
  }
}

async function claimSite() {
  const btn = $("#claimBtn");
  btn.disabled = true;
  btn.textContent = "Mengklaim…";
  try {
    const payload = { ...C.sanitizeContent(C.DEFAULT_CONTENT), ownerUid: user.uid, updatedAt: Date.now() };
    await fb.db.doc("site/content").set(payload);
    contentDoc = payload;
    content = C.sanitizeContent(payload);
    renderView();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Klaim Situs Ini";
    alert("Gagal mengklaim: " + (e.message || e) + "\nPastikan Firestore rules portofolio sudah terpasang (lihat README repo).");
  }
}

/* ---------- Firebase ---------- */
function fbInit() {
  if (!window.firebase || !window.PORTOFOLIO_FIREBASE_CONFIG) return; // mode mandiri
  try {
    firebase.initializeApp(window.PORTOFOLIO_FIREBASE_CONFIG);
    fb.auth = firebase.auth();
    fb.db = firebase.firestore();
    fb.ready = true;
    $("#accountBtn").classList.remove("hidden");
    fb.auth.onAuthStateChanged((u) => {
      user = u;
      $("#accountBtn").textContent = u ? `👤 ${u.email}` : "Masuk Pemilik";
      if (!editing) renderView(); else renderOwnerBar();
    });
    fb.db.doc("site/content").onSnapshot(
      (snap) => {
        if (snap.exists) {
          contentDoc = snap.data();
          if (!editing) { content = C.sanitizeContent(contentDoc); renderView(); }
        } else {
          contentDoc = null;
          if (!editing) renderView();
        }
      },
      () => { /* rules/DB belum siap: tetap pakai fallback */ }
    );
  } catch (e) { /* tetap mode mandiri */ }
}

/* ---------- UI akun ---------- */
function wireAuthUI() {
  const btn = $("#accountBtn");
  btn.addEventListener("click", () => {
    if (!fb.ready) return;
    if (user) { if (confirm(`Masuk sebagai ${user.email}.\nKeluar dari akun?`)) fb.auth.signOut(); return; }
    $("#authModal").classList.remove("hidden");
    $("#authErr").textContent = "";
  });
  $("#authClose").addEventListener("click", () => $("#authModal").classList.add("hidden"));
  $("#authModal").addEventListener("click", (ev) => { if (ev.target === $("#authModal")) $("#authModal").classList.add("hidden"); });
  $("#authForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("#authErr").textContent = "";
    try {
      await fb.auth.signInWithEmailAndPassword($("#authEmail").value.trim(), $("#authPass").value);
      $("#authModal").classList.add("hidden");
    } catch (e) {
      const msgs = {
        "auth/invalid-email": "Format email tidak valid.",
        "auth/user-not-found": "Akun tidak ditemukan.",
        "auth/wrong-password": "Kata sandi salah.",
        "auth/invalid-credential": "Email atau kata sandi salah.",
        "auth/network-request-failed": "Jaringan bermasalah — coba lagi.",
        "auth/operation-not-allowed": "Metode masuk email/sandi belum diaktifkan di server.",
      };
      $("#authErr").textContent = msgs[e.code] || `Gagal: ${e.message}`;
    }
  });
}

renderView();
wireAuthUI();
fbInit();
