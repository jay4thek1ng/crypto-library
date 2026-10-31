(function () {
  "use strict";
  var BOOKS = window.LIBRARY || [];
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
    { key: "CR", label: "Cryptography & Consensus", from: "#17263A", to: "#2E5E7E" }
  ];
  var CAT = {}; CATS.forEach(function (c) { CAT[c.key] = c; });
  var BY = {}; BOOKS.forEach(function (b) { BY[b.id] = b; });
  var KEY = "crypto-wp-library-v1";
  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var inlinePdf = !(isIOS || isAndroid); // mobile browsers can't show multi-page PDFs inside an iframe

  var st = { q: "", shelf: "all", sort: "year", wantOnly: false, localOnly: false, recent: [], want: [] };
  try { var s = JSON.parse(localStorage.getItem(KEY) || "{}"); st.recent = (s.recent || []).filter(function (i) { return BY[i]; }); st.want = (s.want || []).filter(function (i) { return BY[i]; }); if (s.sort) st.sort = s.sort; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ recent: st.recent, want: st.want, sort: st.sort })); } catch (e) {} }

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function tkey(t) { return t.replace(/^(the|a|an)\s+/i, "").toLowerCase(); }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } }
  function onShelf(b, k) { return b.cat === k || b.tags.indexOf(k) >= 0; }
  function kindLabel(b) { return b.kind === "docs" ? "Docs" : b.kind === "web" ? "Web" : "Paper"; }

  function sortBooks(list) {
    var a = list.slice();
    if (st.sort === "title") a.sort(function (x, y) { return tkey(x.title).localeCompare(tkey(y.title)); });
    else if (st.sort === "project") a.sort(function (x, y) { return x.project.localeCompare(y.project) || (x.year || 9999) - (y.year || 9999); });
    else a.sort(function (x, y) { return (y.year || 0) - (x.year || 0) || tkey(x.title).localeCompare(tkey(y.title)); });
    return a;
  }

  function coverHTML(b, big) {
    var c = CAT[b.cat], h = hash(b.project), ang = 120 + (h % 90), rx = 20 + (h % 60), ry = 10 + ((h >> 3) % 40);
    // CSS gradient cover is always rendered underneath; the illustrated image (if any) sits on top
    // and removes itself on error so the CSS cover shows through as a fallback.
    return '<div class="cover' + (b.cover ? ' has-img' : '') + '">' +
      '<div class="cbg" style="background:linear-gradient(' + ang + 'deg,' + c.from + ',' + c.to + ');filter:hue-rotate(' + ((h % 56) - 28) + 'deg)"></div>' +
      '<div class="ring" style="width:90%;aspect-ratio:1;left:' + rx + '%;top:' + ry + '%;border:14px solid rgba(255,255,255,.10)"></div>' +
      '<div class="ring" style="width:45%;aspect-ratio:1;left:' + (rx - 30) + '%;top:' + (60 + h % 20) + '%;background:rgba(255,255,255,.08)"></div>' +
      '<div class="spine"></div>' +
      '<div class="cv"><div class="tk">' + esc(b.ticker || c.label) + '</div><div class="tt">' + esc(b.title) + '</div>' +
      '<div class="ft"><span>' + esc(b.project) + '</span><span>' + (b.year || "") + '</span></div></div>' +
      (b.cover ? '<img class="cimg" src="' + esc(b.cover) + '" alt="" ' + (big ? '' : 'loading="lazy" ') + 'decoding="async" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()">' : '') +
      (b.local && !big ? '<span class="badge">OFFLINE</span>' : '') +
      '</div>';
  }
  function bookHTML(b) {
    var w = st.want.indexOf(b.id) >= 0;
    return '<button class="book" data-id="' + b.id + '" aria-label="' + esc(b.title) + '">' + coverHTML(b) +
      '<div class="meta"><div class="p">' + esc(b.project) + '</div><div class="s">' + (b.year || "Undated") + ' · ' + kindLabel(b) + (w ? ' · <b>Want to Read</b>' : '') + '</div></div></button>';
  }

  function filtered() {
    var q = st.q.trim().toLowerCase();
    return BOOKS.filter(function (b) {
      if (st.wantOnly && st.want.indexOf(b.id) < 0) return false;
      if (st.localOnly && !b.local) return false;
      if (!q) return true;
      return (b.title + " " + b.project + " " + b.ticker + " " + b.authors + " " + b.summary + " " + b.year).toLowerCase().indexOf(q) >= 0;
    });
  }

  function render() {
    var list = filtered(), html = "", shown = {};
    var rec = st.recent.map(function (i) { return BY[i]; }).filter(Boolean);
    var want = st.want.map(function (i) { return BY[i]; }).filter(Boolean);
    var filtering = st.q || st.shelf !== "all" || st.wantOnly || st.localOnly;
    if (rec.length && !filtering) html += '<section class="shelf"><div class="shelf-head"><h2>Reading Now</h2><button data-clear="recent">Clear</button></div><div class="row">' + rec.map(bookHTML).join("") + "</div></section>";
    if (want.length && !filtering) html += '<section class="shelf"><div class="shelf-head"><h2>Want to Read</h2><span>' + want.length + '</span></div><div class="row">' + want.map(bookHTML).join("") + "</div></section>";
    CATS.forEach(function (c) {
      if (st.shelf !== "all" && st.shelf !== c.key) return;
      var bs = sortBooks(list.filter(function (b) { return onShelf(b, c.key); }));
      if (!bs.length) return;
      bs.forEach(function (b) { shown[b.id] = 1; });
      html += '<section class="shelf" id="shelf-' + c.key + '"><div class="shelf-head"><h2>' + esc(c.label) + '</h2><span>' + bs.length + (bs.length === 1 ? " paper" : " papers") + '</span></div><div class="grid">' + bs.map(bookHTML).join("") + "</div></section>";
    });
    var n = Object.keys(shown).length;
    if (!n) html += '<p class="empty">No papers match these filters.</p>';
    $("main").innerHTML = html;
    $("count").textContent = n === BOOKS.length ? BOOKS.length + " papers" : n + " of " + BOOKS.length;
  }

  function openSheet(id) {
    var b = BY[id]; if (!b) return;
    st.recent = [id].concat(st.recent.filter(function (x) { return x !== id; })).slice(0, 12); save();
    var w = st.want.indexOf(id) >= 0;
    var shelves = [CAT[b.cat].label].concat(b.tags.map(function (t) { return CAT[t].label; })).join(", ");
    var read = b.local ? '<button class="btn primary" data-read="' + b.id + '">Read' + (b.localKind === "pdf" ? "" : " offline copy") + '</button>' : '';
    var orig = '<a class="btn' + (b.local ? '' : ' primary') + '" href="' + esc(b.url) + '" target="_blank" rel="noopener">' + (b.kind === "pdf" ? "Open paper" : "Open official page") + ' ↗</a>';
    $("sheetBody").innerHTML = '<div class="detail"><div class="big">' + coverHTML(b, true) + '</div><div>' +
      '<h3>' + esc(b.title) + '</h3><p class="by">' + esc(b.authors || "Authors not stated") + '</p>' +
      '<dl class="props"><dt>Project</dt><dd>' + esc(b.project) + '</dd><dt>Ticker</dt><dd>' + esc(b.ticker || "None") + '</dd><dt>Year</dt><dd>' + (b.year || "Undated or living document") + '</dd><dt>Shelf</dt><dd>' + esc(shelves) + '</dd><dt>Format</dt><dd>' + kindLabel(b) + (b.local ? " · bundled offline copy" : " · online only") + '</dd></dl>' +
      '<p class="summary">' + esc(b.summary) + '</p><div class="actions">' + read + orig +
      '<button class="btn" data-want="' + b.id + '">' + (w ? "✓ Want to Read" : "+ Want to Read") + '</button></div>' +
      '<p class="src">Official source: <a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(host(b.url)) + '</a></p></div></div>';
    $("sheet").hidden = false; document.body.style.overflow = "hidden";
    render();
  }
  function closeSheet() { $("sheet").hidden = true; document.body.style.overflow = ""; }

  function openReader(id) {
    var b = BY[id]; if (!b || !b.local) return;
    var url = encodeURI(b.local);
    if (b.localKind === "pdf" && !inlinePdf) { window.open(url, "_blank"); return; } // phone: system PDF viewer
    $("readerTitle").textContent = b.title;
    $("readerNewTab").href = url;
    $("readerFrame").src = url + (b.localKind === "pdf" ? "#view=FitH" : "");
    $("reader").hidden = false; document.body.style.overflow = "hidden";
    history.pushState({ reader: id }, "");
  }
  function closeReader(fromPop) {
    if ($("reader").hidden) return;
    $("reader").hidden = true; $("readerFrame").src = "about:blank";
    if ($("sheet").hidden) document.body.style.overflow = "";
    if (!fromPop && history.state && history.state.reader) history.back();
  }

  // controls
  var sel = $("shelf");
  sel.innerHTML = '<option value="all">All shelves</option>' + CATS.map(function (c) { return '<option value="' + c.key + '">' + esc(c.label) + "</option>"; }).join("");
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
    if ((el = t.closest("[data-read]"))) { openReader(el.getAttribute("data-read")); return; }
    if ((el = t.closest("[data-want]"))) { var id = el.getAttribute("data-want"); st.want = st.want.indexOf(id) >= 0 ? st.want.filter(function (x) { return x !== id; }) : [id].concat(st.want); save(); openSheet(id); return; }
    if ((el = t.closest("[data-clear]"))) { st.recent = []; save(); render(); return; }
    if ((el = t.closest("[data-close]"))) { closeSheet(); return; }
    if ((el = t.closest(".book"))) { openSheet(el.getAttribute("data-id")); }
  });
  $("readerBack").addEventListener("click", function () { closeReader(false); });
  window.addEventListener("popstate", function () { closeReader(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (!$("reader").hidden) closeReader(false); else closeSheet(); } });

  // offline / service worker
  var localCount = BOOKS.filter(function (b) { return b.local; }).length;
  if (location.protocol === "file:") {
    $("offlineNote").textContent = "Running from local files: all " + localCount + " bundled papers work offline.";
  } else if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(function () {
      $("offlineNote").textContent = "Installable app. Papers you open are kept for offline reading.";
      var btn = $("cacheAll"); btn.hidden = false;
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
})();
