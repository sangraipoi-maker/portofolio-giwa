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
  const els = $$(".hero > *, main section > h2, #projectGrid > .card, #linkList > li");
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

/* ---------- render tampilan publik ---------- */
function renderView() {
  document.title = content.siteName;
  $("#brandName").textContent = content.siteName;
  $("#footName").textContent = content.siteName;
  $("#ownerName").textContent = content.ownerName;
  $("#tagline").textContent = content.tagline;
  $("#aboutText").textContent = content.about;

  $("#projectGrid").innerHTML = content.projects.length ? content.projects.map((p) => `
    <article class="card">
      <div class="meta">
        <span class="badge ${p.status === "dev" ? "dev" : "live"}">${esc(p.statusLabel)}</span>
        ${p.tag ? `<span class="badge">${esc(p.tag)}</span>` : ""}
      </div>
      <h3>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)}</h3>
      <p>${esc(p.desc)}</p>
      ${p.url ? `<a class="visit" href="${esc(p.url)}" target="_blank" rel="noopener">Kunjungi →</a>` : `<span class="save-note">Belum tayang</span>`}
    </article>`).join("") : `<p class="loading">Belum ada proyek.</p>`;

  $("#linkList").innerHTML = content.links.map((l) => `
    <li><a href="${esc(l.url)}" ${/^https?:/.test(l.url) ? `target="_blank" rel="noopener"` : ""}>${esc(l.label)}</a></li>`).join("");

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
      <span class="grow">✏️ Mode edit aktif — ubah teks langsung di halaman, atur kartu proyek & tautan di bawah, lalu simpan.</span>
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
