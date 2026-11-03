/* Crypto White Paper Library (web PWA + Android APK share this file).
   - PDFs render in-app with Mozilla PDF.js (Apache-2.0, vendored in pdfjs/).
   - Community: shared public uploads stored in Supabase (config.js holds only the public URL + anon key).
   - Private uploads: PDFs kept on this device only (IndexedDB).
   - In the APK (user agent contains "CryptoWhitePapersApp"), there is no service worker; everything is bundled. */
(function () {
  "use strict";
  var ua = navigator.userAgent || "";
  var IS_APK = /CryptoWhitePapersApp/.test(ua) || !!window.AndroidBridge;
  var CFG = window.WP_CONFIG || {};
  var SB = (CFG.supabaseUrl && CFG.supabaseAnonKey) ? { url: String(CFG.supabaseUrl).replace(/\/+$/, ""), key: CFG.supabaseAnonKey } : null;
  var MAX_UP = 25 * 1024 * 1024;
  var BOOKS = (window.LIBRARY || []).slice();
  var CATS = [
    { key: "L1", label: "Layer 1s", from: "#2F5BFF", to: "#7B3CFF" },
    { key: "L2", label: "Layer 2s & Scaling", from: "#FF6A3D", to: "#E0245E" },
    { key: "DF", label: "DeFi", from: "#E5267A", to: "#7A2BD9" },
    { key: "SC", label: "Stablecoins", from: "#10915A", to: "#2C6E49" },
    { key: "OR", label: "Oracles & Infra", from: "#0088D1", to: "#00A896" },
    { key: "ST", label: "Storage", from: "#1E8C6E", to: "#0B4F6C" },
    { key: "PR", label: "Privacy", from: "#3A3550", to: "#6A2C91" },
    { key: "SOL", label: "Solana Ecosystem", from: "#8A3FFC", to: "#0FAF7F" },
    { key: "AI", label: "AI & DePIN", from: "#E08A00", to: "#D6453D" },
    { key: "CR", label: "Cryptography & Consensus", from: "#17263A", to: "#2E5E7E" },
    { key: "CM", label: "Community", from: "#0A84FF", to: "#13A89E" },
    { key: "UP", label: "My Uploads", from: "#5856D6", to: "#C2389B" }
  ];
  var TOPICS = CATS.filter(function (c) { return c.key !== "CM" && c.key !== "UP"; });
  var CAT = {}; CATS.forEach(function (c) { CAT[c.key] = c; });
  var BY = {}; BOOKS.forEach(function (b) { BY[b.id] = b; });
  var KEY = "crypto-wp-library-v1";
  var dynId = function (i) { return /^[uc]-/.test(i); };

  var st = { q: "", shelf: "all", sort: "year", wantOnly: false, localOnly: false, recent: [], want: [] };
  try { var s = JSON.parse(localStorage.getItem(KEY) || "{}"); st.recent = (s.recent || []).filter(function (i) { return BY[i] || dynId(i); }); st.want = (s.want || []).filter(function (i) { return BY[i] || dynId(i); }); if (s.sort) st.sort = s.sort; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ recent: st.recent, want: st.want, sort: st.sort })); } catch (e) {} }
  if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function tkey(t) { return t.replace(/^(the|a|an)\s+/i, "").toLowerCase(); }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } }
  function onShelf(b, k) { return b.cat === k || b.tags.indexOf(k) >= 0; }
  function kindLabel(b) { return b.kind === "docs" ? "Docs" : b.kind === "web" ? "Web" : "Paper"; }
  function mb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function ago(t) { var d = (Date.now() - new Date(t).getTime()) / 1000; if (!(d >= 0)) return ""; if (d < 90) return "just now"; if (d < 5400) return Math.round(d / 60) + " min ago"; if (d < 129600) return Math.round(d / 3600) + " h ago"; return new Date(t).toLocaleDateString(); }

  function openExternal(url) {
    if (!/^(https?:|mailto:)/i.test(url)) return;
    if (window.AndroidBridge && window.AndroidBridge.openExternal) window.AndroidBridge.openExternal(url);
    else window.open(url, "_blank", "noopener");
  }
  function deviceId() {
    var k = "wp-device-id", v = null;
    try { v = localStorage.getItem(k); } catch (e) {}
    if (!v || !/^[A-Za-z0-9_-]{16,64}$/.test(v)) {
      var a = new Uint8Array(18); crypto.getRandomValues(a);
      v = btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      try { localStorage.setItem(k, v); } catch (e) {}
    }
    return v;
  }
  function uuid4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var a = new Uint8Array(16); crypto.getRandomValues(a); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
    var h = Array.prototype.map.call(a, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  /* ---------- IndexedDB: private uploads, saved community PDFs, community list cache ---------- */
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error("IndexedDB unavailable")); return; }
      var r = indexedDB.open("crypto-wp-uploads", 2);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "id" });
        if (!d.objectStoreNames.contains("files")) d.createObjectStore("files");
        if (!d.objectStoreNames.contains("cache")) d.createObjectStore("cache");
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(stores, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(stores, mode), out = {};
        fn(t, out);
        t.oncomplete = function () { res(out.v); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error || new Error("aborted")); };
      });
    });
  }
  function idbReq(store, mode, op) { return tx([store], mode, function (t, out) { var r = op(t.objectStore(store)); if (r) r.onsuccess = function () { out.v = r.result; }; }); }
  function idbGetAllMeta() { return idbReq("meta", "readonly", function (s) { return s.getAll(); }).then(function (v) { return v || []; }); }
  function idbGetFile(id) { return idbReq("files", "readonly", function (s) { return s.get(id); }); }
  function idbPutFile(id, blob) { return idbReq("files", "readwrite", function (s) { s.put(blob, id); }); }
  function idbDelFile(id) { return idbReq("files", "readwrite", function (s) { s.delete(id); }); }
  function idbFileKeys() { return idbReq("files", "readonly", function (s) { return s.getAllKeys(); }).then(function (v) { return v || []; }); }
  function cacheGet(k) { return idbReq("cache", "readonly", function (s) { return s.get(k); }); }
  function cachePut(k, v) { return idbReq("cache", "readwrite", function (s) { s.put(v, k); }); }
  function idbPut(meta, file) { return tx(["meta", "files"], "readwrite", function (t) { t.objectStore("meta").put(meta); if (file) t.objectStore("files").put(file, meta.id); }); }
  function idbDelete(id) { return tx(["meta", "files"], "readwrite", function (t) { t.objectStore("meta").delete(id); t.objectStore("files").delete(id); }); }

  /* ---------- private (this-device) uploads ---------- */
  var coverURLs = {};
  function userBook(m) {
    if (coverURLs[m.id]) { URL.revokeObjectURL(coverURLs[m.id]); delete coverURLs[m.id]; }
    if (m.thumb) coverURLs[m.id] = URL.createObjectURL(m.thumb);
    return {
      id: m.id, title: m.title, project: m.project, ticker: m.ticker || "", authors: m.authors || "", year: m.year || null,
      cat: CAT[m.cat] && m.cat !== "CM" ? m.cat : "UP", url: "", summary: m.notes || "", tags: [], kind: "pdf", local: "idb:" + m.id, localKind: "pdf",
      cover: "", thumb: coverURLs[m.id] || "", user: true, size: m.size || 0, fileName: m.fileName || "", added: m.added || 0, pages: m.pages || 0
    };
  }
  function putBook(b) {
    var i; for (i = 0; i < BOOKS.length; i++) if (BOOKS[i].id === b.id) { BOOKS[i] = b; break; }
    if (i === BOOKS.length) BOOKS.push(b);
    BY[b.id] = b; return b;
  }
  function addUserBook(m) { return putBook(userBook(m)); }
  function removeBook(id) {
    BOOKS = BOOKS.filter(function (b) { return b.id !== id; }); delete BY[id];
    if (coverURLs[id]) { URL.revokeObjectURL(coverURLs[id]); delete coverURLs[id]; }
    st.recent = st.recent.filter(function (x) { return x !== id; }); st.want = st.want.filter(function (x) { return x !== id; }); save();
  }

  /* ---------- Community (Supabase) ---------- */
  var COMM = { status: SB ? "loading" : "off", at: 0, cachedAt: 0, saved: {}, reported: {}, busy: null };
  try { (JSON.parse(localStorage.getItem("wp-reported") || "[]") || []).forEach(function (i) { COMM.reported[i] = 1; }); } catch (e) {}
  var COVER_RE = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+\/=]+$/;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  // New-style "sb_publishable_" keys go only in the apikey header; legacy anon JWT keys also go in Authorization.
  function sbHeaders(extra) { var h = { apikey: SB.key }; if (!/^sb_/.test(SB.key)) h.Authorization = "Bearer " + SB.key; for (var k in extra) h[k] = extra[k]; return h; }
  function sbJSON(method, path, body, prefer) {
    return fetch(SB.url + path, { method: method, cache: "no-store", headers: sbHeaders({ "Content-Type": "application/json", Prefer: prefer || "return=minimal" }), body: body ? JSON.stringify(body) : undefined })
      .catch(function () { var e = new Error("NETWORK"); e.network = true; throw e; })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var err = new Error((j && (j.message || j.error)) || ("HTTP " + r.status)); err.status = r.status; err.code = j && j.code; throw err; }
          return j;
        });
      });
  }
  function commBook(r) {
    if (!r || !UUID_RE.test(r.id) || !/^[0-9a-f-]{36}\.pdf$/.test(r.storage_path || "")) return null;
    return {
      id: "c-" + r.id, sid: r.id, title: String(r.title || "Untitled").slice(0, 200), project: String(r.project || "").slice(0, 100), ticker: "", authors: "",
      year: typeof r.year === "number" ? r.year : null, cat: "CM", topic: CAT[r.shelf] && r.shelf !== "CM" && r.shelf !== "UP" ? r.shelf : "OT",
      url: "", summary: r.description ? String(r.description).slice(0, 1000) : "", tags: [], kind: "pdf", local: "remote", localKind: "pdf",
      remote: SB.url + "/storage/v1/object/public/papers/" + r.storage_path, cover: "",
      thumb: (typeof r.cover === "string" && r.cover.length <= 150000 && COVER_RE.test(r.cover)) ? r.cover : "",
      community: true, size: r.size_bytes || 0, pages: r.page_count || 0, created: r.created_at
    };
  }
  function setCommunity(rows) {
    var keep = {};
    (rows || []).forEach(function (r) { var b = commBook(r); if (b) { putBook(b); keep[b.id] = 1; } });
    BOOKS.filter(function (b) { return b.community && !keep[b.id]; }).forEach(function (b) { BOOKS = BOOKS.filter(function (x) { return x !== b; }); delete BY[b.id]; });
  }
  var COLS = "id,title,project,year,shelf,description,storage_path,size_bytes,cover,page_count,created_at";
  function loadCommunity() {
    if (!SB) return Promise.resolve();
    if (COMM.busy) return COMM.busy;
    COMM.busy = sbJSON("GET", "/rest/v1/papers?select=" + COLS + "&order=created_at.desc&limit=500").then(function (rows) {
      COMM.status = "online"; COMM.at = Date.now(); COMM.err = null;
      setCommunity(rows || []);
      cachePut("community", { at: Date.now(), rows: rows || [] }).catch(function () {});
    }).catch(function (e) {
      COMM.status = COMM.cachedAt ? "cached" : "error"; COMM.err = e;
    }).then(function () { COMM.busy = null; if ($("reader").hidden) render(); });
    return COMM.busy;
  }
  function communityStatus() {
    if (!SB) return "Community uploads aren't set up in this build.";
    if (COMM.status === "loading") return "Loading community uploads…";
    if (COMM.status === "online") return "Live · updated " + ago(COMM.at);
    if (COMM.status === "cached") return "Offline · showing the list saved " + ago(COMM.cachedAt);
    return COMM.err && COMM.err.network ? "Offline · connect to the internet to see community uploads" : "Couldn't load community uploads" + (COMM.err ? " (" + COMM.err.message + ")" : "");
  }

  function sortBooks(list) {
    var a = list.slice();
    if (st.sort === "title") a.sort(function (x, y) { return tkey(x.title).localeCompare(tkey(y.title)); });
    else if (st.sort === "project") a.sort(function (x, y) { return x.project.localeCompare(y.project) || (x.year || 9999) - (y.year || 9999); });
    else a.sort(function (x, y) { return (y.year || 0) - (x.year || 0) || tkey(x.title).localeCompare(tkey(y.title)); });
    return a;
  }

  function coverHTML(b, big) {
    var c = CAT[b.cat], dyn = b.user || b.community, h = hash(b.project + (dyn ? b.title : "")), ang = 120 + (h % 90), rx = 20 + (h % 60), ry = 10 + ((h >> 3) % 40);
    var img = dyn ? "" : b.cover, label = b.community ? (b.topic && CAT[b.topic] ? CAT[b.topic].label : "Community") : (b.ticker || c.label);
    var badge = b.community ? (COMM.saved[b.id] ? "SAVED" : "COMMUNITY") : b.user ? "PRIVATE" : "OFFLINE";
    return '<div class="cover' + (img ? ' has-img' : '') + (dyn ? ' user' : '') + '">' +
      '<div class="cbg" style="background:linear-gradient(' + ang + 'deg,' + c.from + ',' + c.to + ');filter:hue-rotate(' + ((h % 56) - 28) + 'deg)"></div>' +
      '<div class="ring" style="width:90%;aspect-ratio:1;left:' + rx + '%;top:' + ry + '%;border:14px solid rgba(255,255,255,.10)"></div>' +
      '<div class="ring" style="width:45%;aspect-ratio:1;left:' + (rx - 30) + '%;top:' + (60 + h % 20) + '%;background:rgba(255,255,255,.08)"></div>' +
      '<div class="spine"></div>' +
      '<div class="cv"><div class="tk">' + esc(label) + '</div><div class="tt">' + esc(b.title) + '</div>' +
      '<div class="ft"><span>' + esc(b.project) + '</span><span>' + (b.year || "") + '</span></div></div>' +
      (img ? '<img class="cimg" src="' + esc(img) + '" alt="" ' + (big ? '' : 'loading="lazy" ') + 'decoding="async" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()">' : '') +
      (dyn && b.thumb ? '<img class="pthumb" src="' + esc(b.thumb) + '" alt="" decoding="async" onerror="this.remove()">' : '') +
      (b.local && !big ? '<span class="badge">' + badge + '</span>' : '') +
      '</div>';
  }
  function bookHTML(b) {
    var w = st.want.indexOf(b.id) >= 0;
    return '<button class="book" data-id="' + esc(b.id) + '" aria-label="' + esc(b.title) + '">' + coverHTML(b) +
      '<div class="meta"><div class="p">' + esc(b.project) + '</div><div class="s">' + (b.year || "Undated") + ' · ' + (b.community ? "Community" : b.user ? "Private" : kindLabel(b)) + (w ? ' · <b>Want to Read</b>' : '') + '</div></div></button>';
  }
  function isOffline(b) { return b.community ? !!COMM.saved[b.id] : !!b.local; }

  function filtered() {
    var q = st.q.trim().toLowerCase();
    return BOOKS.filter(function (b) {
      if (st.wantOnly && st.want.indexOf(b.id) < 0) return false;
      if (st.localOnly && !isOffline(b)) return false;
      if (!q) return true;
      var extra = b.user ? " private upload my uploads " + b.fileName : b.community ? " community upload " + (CAT[b.topic] ? CAT[b.topic].label : "") : "";
      return (b.title + " " + b.project + " " + b.ticker + " " + b.authors + " " + b.summary + " " + b.year + extra).toLowerCase().indexOf(q) >= 0;
    });
  }

  function render() {
    var list = filtered(), html = "", shown = {};
    var rec = st.recent.map(function (i) { return BY[i]; }).filter(Boolean);
    var want = st.want.map(function (i) { return BY[i]; }).filter(Boolean);
    var filtering = st.q || st.shelf !== "all" || st.wantOnly || st.localOnly;
    if (rec.length && !filtering) html += '<section class="shelf"><div class="shelf-head"><h2>Reading Now</h2><button data-clear="recent">Clear</button></div><div class="row">' + rec.map(bookHTML).join("") + "</div></section>";
    if (want.length && !filtering) html += '<section class="shelf"><div class="shelf-head"><h2>Want to Read</h2><span>' + want.length + '</span></div><div class="row">' + want.map(bookHTML).join("") + "</div></section>";
    var order = [CAT.CM, CAT.UP].concat(TOPICS);
    order.forEach(function (c) {
      if (st.shelf !== "all" && st.shelf !== c.key) return;
      var bs = list.filter(function (b) { return onShelf(b, c.key); });
      bs = c.key === "CM" && st.sort === "year" ? bs.slice().sort(function (x, y) { return String(y.created || "").localeCompare(String(x.created || "")); }) : sortBooks(bs);
      if (c.key === "CM" && SB && (!filtering || st.shelf === "CM")) {
        bs.forEach(function (b) { shown[b.id] = 1; });
        html += '<section class="shelf community" id="shelf-CM"><div class="shelf-head"><h2>Community</h2><span>' + bs.length + (bs.length === 1 ? " paper" : " papers") + '</span></div>' +
          '<p class="comm-note"><span id="commStatus">' + esc(communityStatus()) + '</span> · Shared by app users and public to everyone. <button class="link-btn" id="commUpload" type="button">Upload a white paper</button></p>' +
          (bs.length ? '<div class="grid">' + bs.map(bookHTML).join("") + '</div>' : '<p class="empty small">' + (COMM.status === "loading" ? "Loading…" : "No community uploads yet. Be the first to share one.") + '</p>') + '</section>';
        return;
      }
      if (!bs.length) return;
      bs.forEach(function (b) { shown[b.id] = 1; });
      html += '<section class="shelf" id="shelf-' + c.key + '"><div class="shelf-head"><h2>' + esc(c.label) + '</h2><span>' + bs.length + (bs.length === 1 ? " paper" : " papers") + '</span></div><div class="grid">' + bs.map(bookHTML).join("") + "</div></section>";
    });
    var n = Object.keys(shown).length;
    if (!n && !(st.shelf === "CM" && SB)) html += '<p class="empty">' + (st.shelf === "UP" && !st.q ? 'No private uploads yet. Tap “+ Upload white paper” and choose “Only on this device”.' : 'No papers match these filters.') + '</p>';
    $("main").innerHTML = html;
    $("count").textContent = n === BOOKS.length ? BOOKS.length + " papers" : n + " of " + BOOKS.length;
  }

  function openSheet(id) {
    var b = BY[id]; if (!b) return;
    st.recent = [id].concat(st.recent.filter(function (x) { return x !== id; })).slice(0, 12); save();
    var w = st.want.indexOf(id) >= 0, eid = esc(b.id);
    var shelves = b.community ? "Community" + (b.topic && CAT[b.topic] ? " · " + CAT[b.topic].label : "") : [CAT[b.cat].label].concat(b.tags.map(function (t) { return CAT[t].label; })).join(", ");
    var read = b.local ? '<button class="btn primary" data-read="' + eid + '">Read' + (b.localKind === "pdf" ? "" : " offline copy") + '</button>' : '';
    var orig = (b.user || b.community) ? '' : '<a class="btn' + (b.local ? '' : ' primary') + '" href="' + esc(b.url) + '" target="_blank" rel="noopener">' + (b.kind === "pdf" ? "Open paper" : "Open official page") + ' ↗</a>';
    var extra = b.user ? '<button class="btn" data-edit="' + eid + '">Edit details</button><button class="btn danger" data-del="' + eid + '">Delete</button>'
      : b.community ? (COMM.saved[b.id] ? '<button class="btn" data-unsave="' + eid + '">Remove offline copy</button>' : '<button class="btn" data-save="' + eid + '">Save for offline</button>') +
        (COMM.reported[b.sid] ? '<button class="btn" disabled>Reported</button>' : '<button class="btn danger" data-report="' + eid + '">Report</button>') : '';
    var fmt = b.user ? "PDF · private, on this device only" + (b.size ? " · " + mb(b.size) : "") + (b.pages ? " · " + b.pages + " pages" : "")
      : b.community ? "PDF · community upload" + (b.size ? " · " + mb(b.size) : "") + (b.pages ? " · " + b.pages + " pages" : "") + (b.created ? " · shared " + ago(b.created) : "") + (COMM.saved[b.id] ? " · saved offline" : "")
      : kindLabel(b) + (b.local ? " · bundled offline copy" : " · online only");
    $("sheetBody").innerHTML = '<div class="detail"><div class="big">' + coverHTML(b, true) + '</div><div>' +
      '<h3>' + esc(b.title) + '</h3><p class="by">' + esc(b.authors || (b.community ? "Shared by a community member" : "Authors not stated")) + '</p>' +
      '<dl class="props"><dt>Project</dt><dd>' + esc(b.project) + '</dd>' + ((b.user || b.community) ? '' : '<dt>Ticker</dt><dd>' + esc(b.ticker || "None") + '</dd>') + '<dt>Year</dt><dd>' + esc(b.year || "Undated or living document") + '</dd><dt>Shelf</dt><dd>' + esc(shelves) + '</dd><dt>Format</dt><dd>' + esc(fmt) + '</dd></dl>' +
      (b.summary ? '<p class="summary plain">' + esc(b.summary) + '</p>' : '') + '<div class="actions">' + read + orig +
      '<button class="btn" data-want="' + eid + '">' + (w ? "✓ Want to Read" : "+ Want to Read") + '</button>' + extra + '</div>' +
      (b.user ? '<p class="src">Stored only on this device' + (b.fileName ? ' · original file: ' + esc(b.fileName) : '') + '</p>'
        : b.community ? '<p class="src">Uploaded by a user of this app and visible to everyone. It hasn\'t been reviewed: report anything spam, offensive or infringing.</p>'
        : '<p class="src">Official source: <a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(host(b.url)) + '</a></p>') + '</div></div>';
    showSheet();
    render();
  }
  function showSheet() { $("sheet").hidden = false; document.body.style.overflow = "hidden"; $("sheet").querySelector(".sheet-card").scrollTop = 0; }
  function closeSheet() { $("sheet").hidden = true; document.body.style.overflow = ""; pending = null; }

  /* ---------- PDF.js ---------- */
  var BASE = new URL(".", location.href).href;
  var libp = null;
  function pdfjs() {
    if (!libp) libp = import(BASE + "pdfjs/pdf.min.mjs").then(function (m) { m.GlobalWorkerOptions.workerSrc = BASE + "pdfjs/pdf.worker.min.mjs"; return m; });
    return libp;
  }
  function openDoc(bytes) {
    return pdfjs().then(function (lib) {
      return lib.getDocument({ data: bytes, cMapUrl: BASE + "pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: BASE + "pdfjs/standard_fonts/",
        isEvalSupported: false, enableXfa: false }).promise;
    });
  }
  function destroyDoc(doc) { try { if (doc && doc.loadingTask) doc.loadingTask.destroy(); else if (doc && doc.destroy) doc.destroy(); } catch (e) {} }

  /* ---------- Reader ---------- */
  var R = { doc: null, token: 0, scale: 1, fit: 1, pages: [], obs: null, kind: "", zoomHtml: 1, renders: {}, book: null };
  var DPR = Math.min(window.devicePixelRatio || 1, 3);
  var MAX_PX = 12e6;

  function readerStatus(t) { var e = $("pdfStatus"); e.textContent = t || ""; e.hidden = !t; }
  function getCommunityPdf(b) {
    return idbGetFile(b.id).catch(function () { return null; }).then(function (blob) {
      if (blob) return blob.arrayBuffer();
      return fetch(b.remote).catch(function () { throw new Error("You're offline and this paper isn't saved on this device yet."); })
        .then(function (r) { if (!r.ok) throw new Error(r.status === 400 || r.status === 404 ? "This paper is no longer available." : "Download failed (HTTP " + r.status + ")."); return r.arrayBuffer(); })
        .then(function (buf) {
          var copy = new Blob([buf], { type: "application/pdf" });
          idbPutFile(b.id, copy).then(function () { COMM.saved[b.id] = true; }).catch(function () {});
          return buf;
        });
    });
  }
  function openReader(id) {
    var b = BY[id]; if (!b || !b.local) return;
    $("readerTitle").textContent = b.title; R.book = b;
    var nt = $("readerNewTab");
    if (nt) { if (!IS_APK && !b.user && !b.community && b.local) { nt.hidden = false; nt.href = encodeURI(b.local); } else if (!IS_APK && b.community) { nt.hidden = false; nt.href = b.remote; } else nt.hidden = true; }
    $("reader").hidden = false; document.body.style.overflow = "hidden";
    if (!(history.state && history.state.reader)) history.pushState({ reader: id }, "");
    var my = ++R.token;
    if (b.localKind === "pdf") {
      R.kind = "pdf"; $("readerFrame").hidden = true; $("readerFrame").src = "about:blank"; $("pdfView").hidden = false;
      $("pdfPages").innerHTML = ""; readerStatus(b.community && !COMM.saved[b.id] ? "Downloading…" : "Opening…"); $("pageNo").textContent = "";
      var get = b.user ? idbGetFile(b.id).then(function (blob) { if (!blob) throw new Error("This upload's file is missing."); return blob.arrayBuffer(); })
        : b.community ? getCommunityPdf(b)
        : fetch(encodeURI(b.local)).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); });
      get.then(function (buf) { if (my !== R.token) return null; return openDoc(new Uint8Array(buf)); })
        .then(function (doc) { if (!doc) return; if (my !== R.token) { destroyDoc(doc); return; } R.doc = doc; return setupPages(doc, my); })
        .catch(function (e) { if (my === R.token) readerStatus("Couldn't open this PDF: " + (e && e.message || e)); });
    } else {
      R.kind = "html"; $("pdfView").hidden = true; $("readerFrame").hidden = false; R.zoomHtml = 1; readerStatus("");
      $("readerFrame").src = encodeURI(b.local); $("pageNo").textContent = "";
    }
  }
  function closeReader(fromPop) {
    if ($("reader").hidden) return;
    R.token++;
    $("reader").hidden = true; $("readerFrame").src = "about:blank";
    teardownPdf(); readerStatus("");
    if ($("sheet").hidden) document.body.style.overflow = "";
    if (!fromPop && history.state && history.state.reader) history.back();
    render();
  }
  function teardownPdf() {
    if (R.obs) { R.obs.disconnect(); R.obs = null; }
    Object.keys(R.renders).forEach(function (k) { try { R.renders[k].cancel(); } catch (e) {} });
    R.renders = {}; R.pages = [];
    $("pdfPages").innerHTML = "";
    if (R.doc) { destroyDoc(R.doc); R.doc = null; }
  }
  function setupPages(doc, my) {
    return doc.getPage(1).then(function (p1) {
      if (my !== R.token) return;
      var vp = p1.getViewport({ scale: 1 }), view = $("pdfView");
      R.fit = Math.max(0.2, (view.clientWidth - 16) / vp.width);
      R.scale = Math.min(R.fit, 2.2); R.fit = R.scale;
      var frag = document.createDocumentFragment();
      R.pages = [];
      for (var n = 1; n <= doc.numPages; n++) {
        var d = document.createElement("div"); d.className = "pg"; d.setAttribute("data-n", n);
        R.pages.push({ n: n, el: d, w: vp.width, h: vp.height, sized: n === 1, scale: 0, canvas: null }); frag.appendChild(d);
      }
      $("pdfPages").appendChild(frag);
      layout();
      readerStatus("");
      R.obs = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) { var pg = R.pages[+e.target.getAttribute("data-n") - 1]; if (!pg) return; pg.vis = e.isIntersecting; if (e.isIntersecting) renderPage(pg); else releasePage(pg); });
      }, { root: view, rootMargin: "1200px 300px" });
      R.pages.forEach(function (pg) { R.obs.observe(pg.el); });
      view.scrollTop = 0; view.scrollLeft = 0; updatePageNo(); updateZoomLabel();
    });
  }
  function layout() { R.pages.forEach(function (pg) { pg.el.style.width = Math.floor(pg.w * R.scale) + "px"; pg.el.style.height = Math.floor(pg.h * R.scale) + "px"; }); }
  function renderPage(pg) {
    if (!R.doc || pg.scale === R.scale || R.renders[pg.n]) return;
    var my = R.token, want = R.scale;
    R.renders[pg.n] = { cancel: function () {} };
    R.doc.getPage(pg.n).then(function (page) {
      if (my !== R.token || !pg.vis) { delete R.renders[pg.n]; return; }
      var base = page.getViewport({ scale: 1 });
      if (!pg.sized) { pg.w = base.width; pg.h = base.height; pg.sized = true; pg.el.style.width = Math.floor(pg.w * R.scale) + "px"; pg.el.style.height = Math.floor(pg.h * R.scale) + "px"; }
      var out = want * DPR; if (base.width * base.height * out * out > MAX_PX) out = Math.sqrt(MAX_PX / (base.width * base.height));
      var vp = page.getViewport({ scale: out });
      var c = document.createElement("canvas"); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      var task = page.render({ canvasContext: c.getContext("2d"), canvas: c, viewport: vp });
      R.renders[pg.n] = task;
      return task.promise.then(function () {
        delete R.renders[pg.n];
        if (my !== R.token) return;
        if (pg.canvas) pg.canvas.remove();
        pg.canvas = c; pg.scale = want; pg.el.appendChild(c);
        if (want !== R.scale && pg.vis) renderPage(pg);
      });
    }).catch(function () { delete R.renders[pg.n]; });
  }
  function releasePage(pg) {
    if (R.renders[pg.n]) { try { R.renders[pg.n].cancel(); } catch (e) {} delete R.renders[pg.n]; }
    if (pg.canvas) { pg.canvas.width = 0; pg.canvas.height = 0; pg.canvas.remove(); pg.canvas = null; pg.scale = 0; }
  }
  var rerenderT = 0;
  function setScale(ns, fx, fy) {
    if (R.kind === "html") { R.zoomHtml = Math.min(3, Math.max(0.5, ns)); applyHtmlZoom(); updateZoomLabel(); return; }
    if (!R.pages.length) return;
    ns = Math.min(R.fit * 6, Math.max(R.fit * 0.4, ns));
    var view = $("pdfView");
    if (fx == null) { fx = view.clientWidth / 2; fy = view.clientHeight / 2; }
    var ratio = ns / R.scale, cx = view.scrollLeft + fx, cy = view.scrollTop + fy;
    R.scale = ns; layout();
    view.scrollLeft = cx * ratio - fx; view.scrollTop = cy * ratio - fy;
    updateZoomLabel();
    clearTimeout(rerenderT);
    rerenderT = setTimeout(function () { R.pages.forEach(function (pg) { if (pg.vis) renderPage(pg); }); }, 120);
  }
  function updateZoomLabel() { $("zoomLbl").textContent = Math.round((R.kind === "html" ? R.zoomHtml : R.scale / R.fit) * 100) + "%"; }
  function updatePageNo() {
    if (R.kind !== "pdf" || !R.pages.length) return;
    var view = $("pdfView"), mid = view.scrollTop + view.clientHeight / 3, cur = 1;
    for (var i = 0; i < R.pages.length; i++) { if (R.pages[i].el.offsetTop <= mid) cur = i + 1; else break; }
    $("pageNo").textContent = cur + " / " + R.pages.length;
  }
  function applyHtmlZoom() { try { var d = $("readerFrame").contentDocument; if (d && d.body) d.body.style.zoom = R.zoomHtml; } catch (e) {} }

  (function () {
    var view = $("pdfView"), inner = $("pdfPages"), p0 = null;
    function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
    view.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        var r = view.getBoundingClientRect();
        p0 = { d: dist(e.touches), fx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, fy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top, k: 1 };
        inner.style.transformOrigin = (view.scrollLeft + p0.fx) + "px " + (view.scrollTop + p0.fy) + "px";
      }
    }, { passive: true });
    view.addEventListener("touchmove", function (e) {
      if (!p0 || e.touches.length !== 2) return;
      e.preventDefault();
      var ns = Math.min(R.fit * 6, Math.max(R.fit * 0.4, R.scale * dist(e.touches) / p0.d)); p0.k = ns / R.scale;
      inner.style.transform = "scale(" + p0.k + ")";
    }, { passive: false });
    function end(e) {
      if (!p0 || (e.touches && e.touches.length >= 2)) return;
      var k = p0.k, fx = p0.fx, fy = p0.fy; p0 = null;
      inner.style.transform = ""; inner.style.transformOrigin = "";
      if (Math.abs(k - 1) > 0.01) setScale(R.scale * k, fx, fy);
    }
    view.addEventListener("touchend", end); view.addEventListener("touchcancel", end);
    var raf = 0;
    view.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; updatePageNo(); }); }, { passive: true });
    var lastTap = 0;
    view.addEventListener("touchend", function (e) {
      if (e.changedTouches.length !== 1 || e.touches.length) return;
      var now = Date.now();
      if (now - lastTap < 300) { var r = view.getBoundingClientRect(), t = e.changedTouches[0]; setScale(R.scale > R.fit * 1.3 ? R.fit : R.fit * 2, t.clientX - r.left, t.clientY - r.top); lastTap = 0; }
      else lastTap = now;
    });
    window.addEventListener("resize", function () {
      if (R.kind !== "pdf" || !R.pages.length || $("reader").hidden) return;
      var w = R.pages[0].w, rel = R.scale / R.fit;
      R.fit = Math.min(2.2, Math.max(0.2, ($("pdfView").clientWidth - 16) / w)); setScale(R.fit * rel);
    });
    // ctrl/cmd + wheel zoom on desktop
    view.addEventListener("wheel", function (e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); var r = view.getBoundingClientRect(); setScale(R.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  })();
  $("zoomIn").addEventListener("click", function () { setScale(R.kind === "html" ? R.zoomHtml + 0.15 : R.scale * 1.25); });
  $("zoomOut").addEventListener("click", function () { setScale(R.kind === "html" ? R.zoomHtml - 0.15 : R.scale / 1.25); });
  $("zoomLbl").addEventListener("click", function () { setScale(R.kind === "html" ? 1 : R.fit); });
  $("readerFrame").addEventListener("load", function () {
    var d; try { d = $("readerFrame").contentDocument; } catch (e) { return; }
    if (!d || !d.body) return;
    applyHtmlZoom(); updateZoomLabel();
    d.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
      var href = a.href; if (!href) return;
      try {
        var u = new URL(href, d.baseURI);
        if (u.origin === location.origin) {
          if (u.hash && u.pathname === new URL(d.baseURI).pathname) return;
          e.preventDefault();
          if (R.book && R.book.url && u.pathname.indexOf("/library/") < 0) openExternal(new URL(a.getAttribute("href"), R.book.url).href);
          return;
        }
      } catch (x) { return; }
      e.preventDefault(); openExternal(href);
    });
  });

  /* ---------- Upload (public Community or private) / edit ---------- */
  var pending = null;
  var pick = document.createElement("input");
  pick.type = "file"; pick.accept = "application/pdf,.pdf"; pick.hidden = true; pick.id = "pdfPick";
  document.body.appendChild(pick);
  function choosePdf() { pick.value = ""; pick.click(); }
  $("addPaper").addEventListener("click", choosePdf);
  pick.addEventListener("change", function () { var f = pick.files && pick.files[0]; if (f) startUpload(f); });

  function shelfOptions(sel) {
    return '<option value="OT"' + (sel === "OT" || sel === "UP" || !sel ? " selected" : "") + '>Other / no specific shelf</option>' +
      TOPICS.map(function (c) { return '<option value="' + c.key + '"' + (c.key === sel ? " selected" : "") + '>' + esc(c.label) + '</option>'; }).join("");
  }
  function formHTML(v, mode, info) {
    var isEdit = mode === "edit", canPublic = !!SB && !isEdit;
    return '<form id="upForm" class="upform" autocomplete="off" novalidate>' +
      '<h3>' + (isEdit ? "Edit white paper" : "Upload white paper") + '</h3>' +
      '<div class="up-top"><div class="up-thumb" id="upThumb">' + (v.thumbURL ? '<img src="' + esc(v.thumbURL) + '" alt="">' : '<span>PDF</span>') + '</div>' +
      '<p class="muted" id="upInfo">' + esc(info) + '</p></div>' +
      (canPublic ? '<div class="vis" role="radiogroup"><label class="vis-opt"><input type="radio" name="vis" value="public" checked> <span><b>Share with everyone</b><br><small>Adds it to the public Community shelf for all users of the app and website.</small></span></label>' +
        '<label class="vis-opt"><input type="radio" name="vis" value="private"> <span><b>Only on this device</b><br><small>Private copy in My Uploads. Nothing leaves your phone.</small></span></label></div>' : '') +
      '<label>Title<input name="title" required maxlength="200" value="' + esc(v.title) + '"></label>' +
      '<label>Project / blockchain<input name="project" required maxlength="100" value="' + esc(v.project) + '" placeholder="e.g. Ethereum"></label>' +
      '<div class="up-row"><label>Year<input name="year" type="number" inputmode="numeric" min="1900" max="2100" value="' + esc(v.year || "") + '" placeholder="e.g. 2024"></label>' +
      '<label>Shelf<select name="cat">' + shelfOptions(v.cat) + '</select></label></div>' +
      '<label>Description (optional)<textarea name="notes" rows="3" maxlength="1000" placeholder="What is this paper about?">' + esc(v.notes || "") + '</textarea></label>' +
      (canPublic ? '<p class="public-note" id="pubNote">Uploads are <b>public</b>: anyone can read and download them. Only share papers that are already public or that you have the right to share. Max 25 MB. The owner removes reported or inappropriate uploads.</p>' : '') +
      '<div class="up-progress" id="upProg" hidden><div></div></div>' +
      '<div class="actions"><button type="submit" class="btn primary" id="upSave">' + (isEdit ? "Save changes" : canPublic ? "Upload" : "Add to My Uploads") + '</button><button type="button" class="btn" data-close>Cancel</button></div>' +
      '<p class="up-status" id="upStatus" role="status"></p></form>';
  }
  function cleanName(n) { return n.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200); }
  function startUpload(file) {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { alertSheet("That file isn't a PDF. Choose a .pdf white paper."); return; }
    pending = { file: file, thumb: null, pages: 0 };
    var me = pending;
    $("sheetBody").innerHTML = formHTML({ title: cleanName(file.name), project: "", year: "", cat: TOPICS.some(function (c) { return c.key === st.shelf; }) ? st.shelf : "OT" }, "new", file.name + " · " + mb(file.size) + " · reading…");
    showSheet(); wireForm();
    if (file.size > MAX_UP && SB) { $("upStatus").textContent = "This PDF is " + mb(file.size) + ". Community uploads are limited to 25 MB; you can still keep it only on this device."; }
    file.arrayBuffer().then(function (buf) {
      var head = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength)), s = "";
      for (var i = 0; i < head.length; i++) s += String.fromCharCode(head[i]);
      if (s.indexOf("%PDF") < 0) throw new Error("This file doesn't look like a PDF.");
      me.bytes = buf;
      return openDoc(new Uint8Array(buf.slice(0)));
    }).then(function (doc) {
      me.pages = doc.numPages;
      return doc.getMetadata().catch(function () { return {}; }).then(function (md) {
        var info = (md && md.info) || {}, f = $("upForm");
        if (pending === me && f) {
          if (info.Title && String(info.Title).trim().length > 3 && !/^(untitled|microsoft word)/i.test(info.Title) && f.title.value === cleanName(file.name)) f.title.value = String(info.Title).trim().slice(0, 200);
          var y = /D:(\d{4})/.exec(info.CreationDate || "");
          if (y && !f.year.value && +y[1] >= 1990 && +y[1] <= 2100) f.year.value = y[1];
        }
        return makeThumb(doc);
      }).then(function (blob) {
        me.thumb = blob; me.thumbDone = true; destroyDoc(doc);
        if (pending === me && $("upThumb")) {
          if (blob) $("upThumb").innerHTML = '<img src="' + URL.createObjectURL(blob) + '" alt="">';
          $("upInfo").textContent = file.name + " · " + mb(file.size) + " · " + me.pages + (me.pages === 1 ? " page" : " pages");
        }
      });
    }).catch(function (e) {
      me.error = (e && e.message) || "Couldn't read this PDF."; me.thumbDone = true;
      if (pending === me && $("upInfo")) { $("upInfo").textContent = file.name + " · " + me.error; $("upSave").disabled = true; }
    });
  }
  function makeThumb(doc) {
    return doc.getPage(1).then(function (page) {
      var v1 = page.getViewport({ scale: 1 }), sc = 300 / v1.width, vp = page.getViewport({ scale: sc });
      var c = document.createElement("canvas"); c.width = Math.floor(vp.width); c.height = Math.min(Math.floor(vp.height), Math.floor(vp.width * 1.5));
      var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      return page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise.then(function () {
        return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/jpeg", 0.72); });
      });
    }).catch(function () { return null; });
  }
  function blobToDataURL(b) { return new Promise(function (res) { if (!b) return res(null); var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { res(null); }; r.readAsDataURL(b); }); }
  function readForm(f) {
    var y = parseInt(f.year.value, 10), vis = f.querySelector('input[name="vis"]:checked');
    return { title: f.title.value.trim().slice(0, 200), project: f.project.value.trim().slice(0, 100), year: y >= 1900 && y <= 2100 ? y : null, cat: f.cat.value,
      notes: f.notes.value.trim().slice(0, 1000), vis: vis ? vis.value : "private" };
  }
  function friendly(e) {
    var m = (e && e.message) || String(e);
    if (e && e.network || m === "NETWORK" || !navigator.onLine) return "You're offline or the Community library can't be reached. Check your connection and try again.";
    if (/RATE_LIMIT_HOUR/.test(m)) return "Upload limit reached: at most 5 uploads per hour. Please try again later.";
    if (/RATE_LIMIT_DAY/.test(m)) return "Upload limit reached: at most 20 uploads per day. Please try again tomorrow.";
    if (/TOO_LARGE|exceeded the maximum allowed size|Payload too large/i.test(m) || (e && e.status === 413)) return "That PDF is too large. Community uploads are limited to 25 MB.";
    if (/NOT_PDF|mime type|invalid_mime/i.test(m) || (e && e.status === 415)) return "Only PDF files can be uploaded.";
    if (/row-level security/i.test(m)) return "Uploads are paused for a moment because a lot of papers were shared recently. Please try again later.";
    return "Upload failed: " + m;
  }
  function xhrUpload(name, blob, onp) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open("POST", SB.url + "/storage/v1/object/papers/" + name);
      var hh = sbHeaders({}); Object.keys(hh).forEach(function (k) { x.setRequestHeader(k, hh[k]); });
      x.setRequestHeader("Content-Type", "application/pdf"); x.setRequestHeader("x-upsert", "false");
      x.upload.onprogress = function (e) { if (e.lengthComputable) onp(e.loaded / e.total); };
      x.onload = function () {
        if (x.status >= 200 && x.status < 300) return res();
        var j = null; try { j = JSON.parse(x.responseText); } catch (e) {}
        var er = new Error((j && (j.message || j.error)) || ("HTTP " + x.status)); er.status = +(j && j.statusCode) || x.status; rej(er);
      };
      x.onerror = function () { var e = new Error("NETWORK"); e.network = true; rej(e); };
      x.send(blob);
    });
  }
  function publicUpload(me, v, status, prog) {
    if (!navigator.onLine) return Promise.reject(Object.assign(new Error("NETWORK"), { network: true }));
    if (me.file.size > MAX_UP) return Promise.reject(Object.assign(new Error("TOO_LARGE"), { status: 413 }));
    var path = uuid4() + ".pdf", cover = null;
    status("Checking your upload limit…");
    return sbJSON("POST", "/rest/v1/rpc/upload_quota", { p_uploader: deviceId() }, "return=representation").then(function (q) {
      if (q && q.hour_left === 0) throw new Error("RATE_LIMIT_HOUR");
      if (q && q.day_left === 0) throw new Error("RATE_LIMIT_DAY");
      return blobToDataURL(me.thumb);
    }).then(function (c) {
      cover = c && c.length <= 150000 && COVER_RE.test(c) ? c : null;
      status("Uploading…"); prog(0);
      return xhrUpload(path, new Blob([me.bytes], { type: "application/pdf" }), function (p) { prog(p); status("Uploading… " + Math.round(p * 100) + "%"); });
    }).then(function () {
      status("Publishing…"); prog(1);
      return sbJSON("POST", "/rest/v1/papers?select=id", {
        title: v.title, project: v.project, year: v.year, shelf: v.cat === "UP" ? "OT" : v.cat, description: v.notes || null,
        storage_path: path, size_bytes: me.file.size, cover: cover, page_count: me.pages || null, uploader_id: deviceId()
      }, "return=representation");
    }).then(function (rows) {
      var id = rows && rows[0] && rows[0].id;
      // keep a local copy so the uploader can read it offline right away
      if (id) idbPutFile("c-" + id, new Blob([me.bytes], { type: "application/pdf" })).then(function () { COMM.saved["c-" + id] = true; }).catch(function () {});
      return loadCommunity().then(function () { return id ? "c-" + id : null; });
    });
  }
  function wireForm() {
    var f = $("upForm");
    function status(t) { $("upStatus").textContent = t; }
    function prog(p) { var e = $("upProg"); if (!e) return; e.hidden = false; e.firstChild.style.width = Math.round(p * 100) + "%"; }
    Array.prototype.forEach.call(f.querySelectorAll('input[name="vis"]'), function (r) {
      r.addEventListener("change", function () { var pub = readForm(f).vis === "public"; $("pubNote").hidden = !pub; $("upSave").textContent = pub ? "Upload" : "Add to My Uploads"; });
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = readForm(f), me = pending; if (!me) return;
      if (!v.title || !v.project) { status("Title and project are required."); return; }
      if (me.error) { status(me.error); return; }
      $("upSave").disabled = true; status("Preparing…");
      var waitThumb = new Promise(function (res) { var t0 = Date.now(); (function chk() { if (me.thumbDone || me.editId || Date.now() - t0 > 6000) res(); else setTimeout(chk, 100); })(); });
      var ready = me.editId ? Promise.resolve() : (me.bytes ? Promise.resolve() : me.file.arrayBuffer().then(function (b) { me.bytes = b; }));
      Promise.all([ready, waitThumb]).then(function () {
        if (!me.editId && v.vis === "public") return publicUpload(me, v, status, prog);
        var meta, file = null;
        if (me.editId) meta = Object.assign({}, me.meta, { title: v.title, project: v.project, year: v.year, cat: v.cat === "OT" ? "UP" : v.cat, notes: v.notes });
        else {
          meta = { id: "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), added: Date.now(), size: me.file.size, fileName: me.file.name, pages: me.pages, thumb: me.thumb || null,
            title: v.title, project: v.project, year: v.year, cat: v.cat === "OT" ? "UP" : v.cat, notes: v.notes };
          file = new Blob([me.bytes], { type: "application/pdf" });
        }
        return idbPut(meta, file).then(function () { return addUserBook(meta).id; });
      }).then(function (id) {
        pending = null;
        if (st.shelf !== "all") { st.shelf = "all"; $("shelf").value = "all"; }
        window.scrollTo(0, 0);
        if (id && BY[id]) openSheet(id); else { closeSheet(); render(); }
      }).catch(function (e) {
        $("upSave").disabled = false;
        var p = $("upProg"); if (p) p.hidden = true;
        status((e && e.name === "QuotaExceededError") ? "Couldn't save: this device is out of storage space for the app." : friendly(e));
      });
    });
  }
  function editUpload(id) {
    var b = BY[id]; if (!b || !b.user) return;
    idbGetAllMeta().then(function (all) {
      var m = all.filter(function (x) { return x.id === id; })[0]; if (!m) return;
      pending = { editId: id, meta: m };
      $("sheetBody").innerHTML = formHTML({ title: m.title, project: m.project, year: m.year, cat: m.cat, notes: m.notes, thumbURL: b.thumb }, "edit",
        (m.fileName || "PDF") + (m.size ? " · " + mb(m.size) : "") + (m.pages ? " · " + m.pages + " pages" : "") + " · private");
      showSheet(); wireForm();
    });
  }
  var delArm = null;
  function deleteUpload(id, btn) {
    if (delArm !== id) { delArm = id; btn.textContent = "Tap again to delete"; btn.classList.add("armed"); setTimeout(function () { if (delArm === id) { delArm = null; if (btn.isConnected) { btn.textContent = "Delete"; btn.classList.remove("armed"); } } }, 3500); return; }
    delArm = null;
    idbDelete(id).then(function () { removeBook(id); closeSheet(); render(); })
      .catch(function (e) { btn.textContent = "Delete failed: " + ((e && e.message) || e); });
  }
  function alertSheet(msg) { $("sheetBody").innerHTML = '<div class="upform"><h3>Upload white paper</h3><p>' + esc(msg) + '</p><div class="actions"><button class="btn" data-close>OK</button></div></div>'; showSheet(); }

  /* ---------- Community: save offline, report ---------- */
  function saveOffline(id, btn) {
    var b = BY[id]; if (!b || !b.community) return;
    btn.disabled = true; btn.textContent = "Saving…";
    fetch(b.remote).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
      .then(function (blob) { return idbPutFile(b.id, new Blob([blob], { type: "application/pdf" })); })
      .then(function () { COMM.saved[b.id] = true; openSheet(id); })
      .catch(function (e) { btn.disabled = false; btn.textContent = e instanceof TypeError ? "Offline: try again later" : "Save failed"; });
  }
  function unsaveOffline(id) { idbDelFile(id).then(function () { delete COMM.saved[id]; openSheet(id); }); }
  function reportForm(id) {
    var b = BY[id]; if (!b || !b.community) return;
    $("sheetBody").innerHTML = '<form id="repForm" class="upform"><h3>Report this upload</h3><p class="muted">“' + esc(b.title) + '”</p>' +
      '<p>Report spam, offensive content, malware, copyright problems or anything that isn\'t a crypto white paper. Uploads with several reports are hidden automatically and the owner reviews them.</p>' +
      '<label>Reason (optional)<textarea name="reason" rows="3" maxlength="500" placeholder="What\'s wrong with it?"></textarea></label>' +
      '<div class="actions"><button type="submit" class="btn danger armed" id="repSend">Send report</button><button type="button" class="btn" data-back="' + esc(id) + '">Cancel</button></div><p class="up-status" id="repStatus" role="status"></p></form>';
    showSheet();
    $("repForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var reason = this.reason.value.trim().slice(0, 500);
      $("repSend").disabled = true; $("repStatus").textContent = "Sending…";
      sbJSON("POST", "/rest/v1/reports", { paper_id: b.sid, reporter_id: deviceId(), reason: reason || null }).then(function () { return "ok"; }, function (err) {
        if (err.status === 409) return "dup";
        throw err;
      }).then(function (r) {
        COMM.reported[b.sid] = 1; try { localStorage.setItem("wp-reported", JSON.stringify(Object.keys(COMM.reported).slice(-500))); } catch (x) {}
        $("sheetBody").innerHTML = '<div class="upform"><h3>' + (r === "dup" ? "Already reported" : "Thanks for the report") + '</h3><p>' + (r === "dup" ? "You've already reported this upload." : "The owner will review it. Uploads with several reports are hidden for everyone automatically.") + '</p><div class="actions"><button class="btn" data-back="' + esc(id) + '">Back</button><button class="btn" data-close>Close</button></div></div>';
        loadCommunity();
      }).catch(function (err) {
        $("repSend").disabled = false;
        $("repStatus").textContent = err.network ? "You're offline. Try again when you're connected." : /NOT_FOUND/.test(err.message) ? "This upload was already removed." : /RATE_LIMIT/.test(err.message) ? "Too many reports from this device. Try again later." : "Couldn't send the report: " + err.message;
      });
    });
  }

  /* ---------- controls ---------- */
  var sel = $("shelf");
  sel.innerHTML = '<option value="all">All shelves</option>' + [CAT.CM, CAT.UP].concat(TOPICS).map(function (c) { return '<option value="' + c.key + '">' + esc(c.label) + "</option>"; }).join("");
  sel.addEventListener("change", function () { st.shelf = sel.value; render(); });
  $("q").addEventListener("input", function (e) { st.q = e.target.value; render(); });
  $("wantOnly").addEventListener("change", function (e) { st.wantOnly = e.target.checked; render(); });
  $("localOnly").addEventListener("change", function (e) { st.localOnly = e.target.checked; render(); });
  Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (btn) {
    if (btn.getAttribute("data-sort") === st.sort) { document.querySelector(".seg .on").classList.remove("on"); btn.classList.add("on"); }
    btn.addEventListener("click", function () { document.querySelector(".seg .on").classList.remove("on"); btn.classList.add("on"); st.sort = btn.getAttribute("data-sort"); save(); render(); });
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentNode;
    var el;
    if ((el = t.closest("a[href]"))) {
      var href = el.getAttribute("href") || "";
      if (IS_APK && /^(https?:|mailto:)/i.test(href) && el.href.indexOf(location.origin) !== 0) { e.preventDefault(); openExternal(el.href); }
      return;
    }
    if ((el = t.closest("#commUpload"))) { choosePdf(); return; }
    if ((el = t.closest("[data-read]"))) { openReader(el.getAttribute("data-read")); return; }
    if ((el = t.closest("[data-want]"))) { var id = el.getAttribute("data-want"); st.want = st.want.indexOf(id) >= 0 ? st.want.filter(function (x) { return x !== id; }) : [id].concat(st.want); save(); openSheet(id); return; }
    if ((el = t.closest("[data-edit]"))) { editUpload(el.getAttribute("data-edit")); return; }
    if ((el = t.closest("[data-del]"))) { deleteUpload(el.getAttribute("data-del"), el); return; }
    if ((el = t.closest("[data-save]"))) { saveOffline(el.getAttribute("data-save"), el); return; }
    if ((el = t.closest("[data-unsave]"))) { unsaveOffline(el.getAttribute("data-unsave")); return; }
    if ((el = t.closest("[data-report]"))) { reportForm(el.getAttribute("data-report")); return; }
    if ((el = t.closest("[data-back]"))) { if (BY[el.getAttribute("data-back")]) openSheet(el.getAttribute("data-back")); else closeSheet(); return; }
    if ((el = t.closest("[data-clear]"))) { st.recent = []; save(); render(); return; }
    if ((el = t.closest("[data-close]"))) { closeSheet(); return; }
    if ((el = t.closest(".book"))) { openSheet(el.getAttribute("data-id")); }
  });
  $("readerBack").addEventListener("click", function () { closeReader(false); });
  window.addEventListener("popstate", function () { closeReader(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") window.__appBack(); });

  // Android back button (called from the APK). Returns true when handled inside the app.
  window.__appBack = function () {
    if (!$("reader").hidden) { closeReader(false); return true; }
    if (!$("sheet").hidden) { closeSheet(); return true; }
    if (st.q || st.shelf !== "all" || st.wantOnly || st.localOnly) {
      st.q = ""; $("q").value = ""; st.shelf = "all"; sel.value = "all"; st.wantOnly = st.localOnly = false; $("wantOnly").checked = $("localOnly").checked = false; render(); window.scrollTo(0, 0); return true;
    }
    return false;
  };

  // refresh the Community list when the app comes back to the foreground, and every 2 min while visible
  document.addEventListener("visibilitychange", function () { if (!document.hidden && Date.now() - COMM.at > 30000) loadCommunity(); });
  window.addEventListener("online", function () { loadCommunity(); });
  setInterval(function () { if (!document.hidden && $("reader").hidden && $("sheet").hidden) loadCommunity(); }, 120000);

  // offline / service worker (web only; the APK bundles everything)
  var localCount = window.LIBRARY ? window.LIBRARY.filter(function (b) { return b.local; }).length : 0;
  if (IS_APK) {
    $("offlineNote").textContent = "All " + localCount + " bundled papers are stored inside the app and work offline. Community papers you open are saved for offline reading.";
  } else if (location.protocol === "file:") {
    $("offlineNote").textContent = "Running from local files: all " + localCount + " bundled papers work offline.";
  } else if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(function () {
      $("offlineNote").textContent = "Installable app. Papers you open are kept for offline reading.";
      var btn = $("cacheAll"); if (!btn) return; btn.hidden = false;
      btn.addEventListener("click", function () {
        btn.disabled = true; $("cacheStatus").textContent = "Saving…";
        navigator.serviceWorker.ready.then(function (reg) { reg.active.postMessage({ type: "cache-all" }); });
      });
      navigator.serviceWorker.addEventListener("message", function (e) {
        if (e.data && e.data.type === "progress") $("cacheStatus").textContent = e.data.done + " / " + e.data.total + " saved" + (e.data.done === e.data.total ? " · ready offline" : "");
      });
    }).catch(function () {});
  }

  render();
  Promise.all([
    idbGetAllMeta().then(function (all) { all.sort(function (a, b) { return (a.added || 0) - (b.added || 0); }).forEach(addUserBook); }).catch(function () {}),
    idbFileKeys().then(function (keys) { keys.forEach(function (k) { if (/^c-/.test(k)) COMM.saved[k] = true; }); }).catch(function () {}),
    SB ? cacheGet("community").then(function (c) { if (c && c.rows && !COMM.at) { COMM.cachedAt = c.at; setCommunity(c.rows); } }).catch(function () {}) : null
  ]).then(function () {
    render();
    return loadCommunity();
  }).then(function () {
    st.recent = st.recent.filter(function (i) { return BY[i] || (/^c-/.test(i) && COMM.status !== "online"); });
    st.want = st.want.filter(function (i) { return BY[i] || (/^c-/.test(i) && COMM.status !== "online"); }); save();
    render();
  });
})();
