// IELTS Writing Cards: cards in print order by lesson, search, show/hide backs, My cards (★), offline.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("wcards." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("wcards." + k, JSON.stringify(v)); } catch { toast("Couldn't save on this device"); } },
  };

  const D = window.WCARDS;
  const cards = D.cards;
  const lessons = D.lessons;
  const byId = new Map(cards.map((c, i) => [c.id, i]));
  const index = window.WritingSearch.createIndex(D);
  const book = $("book");
  const results = $("results");
  const qBox = $("q");

  // ---------- state ----------
  let showAll = store.get("backAll", false);
  let extra = store.get("extra", false);
  let textSize = store.get("size", 15);
  let mine = store.get("mine", {}); // card id → { n: times wrong, first, last }
  const opened = new Set();
  const closed = new Set();
  const inBook = (c) => extra || c.p === 1;
  const isOpen = (i) => (showAll && !closed.has(i)) || opened.has(i);
  const today = () => new Date().toISOString().slice(0, 10);

  // ---------- card ----------
  function cardHtml(i, { open = isOpen(i), anchor = true, meta = "" } = {}) {
    const c = cards[i];
    const m = mine[c.id];
    return `<article class="card${open ? " open" : ""}${c.p ? "" : " np"}"${anchor ? ` id="${c.id}"` : ""} data-i="${i}">` +
      `<div class="ch"><a class="cid" href="#${c.id}" data-a="go">${c.id}</a><span class="typ">${esc(c.st)}</span>` +
      `<span class="stars" title="Importance">${"⭐".repeat(c.s)}</span><span class="tools">` +
      `<button type="button" data-a="star" class="${m ? "on" : ""}" title="I got this wrong (+1)" aria-label="I got this wrong"><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg>${m ? m.n : ""}</button>` +
      `<button type="button" data-a="copy" title="Copy this card" aria-label="Copy card"><svg class="ic" aria-hidden="true"><use href="#i-copy"/></svg></button></span></div>` +
      meta +
      `<div class="face" data-a="flip"><div class="front">${c.f}</div></div>` +
      `<button type="button" class="flip" data-a="flip">Show back ▾</button>` +
      `<div class="back"${open ? "" : " hidden"}></div></article>`;
  }
  const backHtml = (c) => (c.a ? `<div class="key"><span class="arrow" aria-hidden="true">👉</span>${c.a}</div>` : "") + c.b +
    (c.tags.length ? `<div class="tags">${c.tags.map((t) => `<a href="#q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>` : "") +
    `<button type="button" class="close" data-a="flip">Hide back ▴</button>`;

  function fill(el) {
    const back = el.querySelector(".back");
    if (el.classList.contains("open") && !back.firstChild) back.innerHTML = backHtml(cards[+el.dataset.i]);
  }
  function setOpen(el, open) {
    el.classList.toggle("open", open);
    el.querySelector(".back").hidden = !open;
    if (open) fill(el);
  }

  // Backs are filled only when a card comes near the screen, so "Back" on all cards stays fast on a phone.
  const near = new Set();
  const io = new IntersectionObserver((list) => {
    for (const e of list) {
      if (e.isIntersecting) { near.add(e.target); fill(e.target); } else near.delete(e.target);
    }
  }, { rootMargin: "1500px 0px" });
  function observe(root) { root.querySelectorAll(".card").forEach((el) => io.observe(el)); }

  const whereText = (l) => l.w === 0 ? "Topic lexicon" : `Week ${l.w} · Day ${l.d}`;

  // ---------- book: one section per lesson ----------
  function renderBook() {
    io.disconnect();
    near.clear();
    const parts = lessons.map((l, li) => {
      const ids = [];
      cards.forEach((c, i) => { if (c.l === li && inBook(c)) ids.push(i); });
      return `<section class="lesson" id="${l.c}" data-l="${li}"><h2><span class="lc">${l.c}</span><span>${esc(l.t)}</span>` +
        `<span class="wk">${whereText(l)} · ${ids.length} cards</span></h2>` +
        `<div class="grid">${ids.map((i) => cardHtml(i)).join("")}</div></section>`;
    });
    book.innerHTML = parts.join("");
    observe(book);
    if (!results.hidden) observe(results);
  }

  let currentLesson = 0;
  function trackLesson() {
    if (book.hidden) return;
    const top = document.querySelector("#bar").getBoundingClientRect().bottom + 30;
    let cur = 0;
    for (const s of book.children) { if (s.getBoundingClientRect().top <= top) cur = +s.dataset.l; else break; }
    if (cur !== currentLesson) { currentLesson = cur; showWhere(); }
  }
  function showWhere() { $("where").textContent = lessons[currentLesson].c; }
  let ticking = false;
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; trackLesson(); }); } }, { passive: true });

  function showBook() {
    results.hidden = true;
    results.innerHTML = "";
    book.hidden = false;
  }
  function showResults(html) {
    results.innerHTML = html;
    results.hidden = false;
    book.hidden = true;
    observe(results);
    scrollTo(0, 0);
  }
  function flash(el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  // With every back shown, backs above the target fill in after the jump and push it down.
  // Fill the nearby ones first so the jump lands where it should.
  function land(target, card) {
    if (showAll) {
      const list = [...book.querySelectorAll(".card")];
      const at = card ? list.indexOf(card) : 0;
      for (let k = Math.max(0, at - 40); k < Math.min(list.length, at + 12); k++) fill(list[k]);
    }
    target.scrollIntoView({ block: "start" });
  }

  function goCard(i) {
    const c = cards[i];
    opened.add(i);
    closed.delete(i);
    if (!inBook(c)) {
      // E cards are not in the book unless turned on in Settings: show the card by itself.
      showResults(`<div class="rhead"><span class="grow">Not on paper (Error card). Turn on E cards in Settings to see it in the book.</span></div>` +
        `<div class="grid">${cardHtml(i, { open: true, anchor: false })}</div>`);
      return;
    }
    clearBox();
    showBook();
    const el = document.getElementById(c.id);
    setOpen(el, true);
    land(el, el);
    flash(el);
    currentLesson = c.l;
    showWhere();
  }
  function goLesson(li) {
    clearBox();
    showBook();
    const sec = document.getElementById(lessons[li].c);
    land(sec, sec.querySelector(".card"));
    currentLesson = li;
    showWhere();
  }

  // ---------- links inside the page: #W3D2-S-01, #W3D2, #q=…, #mine ----------
  function go(hash) {
    if (location.hash === "#" + hash) route();
    else location.hash = hash;
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) { if (!qBox.value.trim()) showBook(); return; }
    if (h.startsWith("q=")) { qBox.value = h.slice(2); runSearch(false); return; }
    if (h === "mine") { clearBox(); showMine(); return; }
    const id = h.toUpperCase();
    if (byId.has(id)) { goCard(byId.get(id)); return; }
    const li = lessons.findIndex((l) => l.c === id);
    if (li >= 0) { goLesson(li); return; }
    qBox.value = h;
    runSearch(false);
  }
  addEventListener("hashchange", route);

  // ---------- search ----------
  const PAGE = 80;
  let last = null;
  let typeOnly = null;
  let shown = PAGE;
  function clearBox() { qBox.value = ""; last = null; }
  function runSearch(updateHash) {
    const q = qBox.value.trim();
    if (updateHash) history.replaceState(null, "", q ? "#q=" + encodeURIComponent(q) : location.pathname + location.search);
    if (!q) { last = null; showBook(); return; }
    last = { q, r: window.WritingSearch.search(index, q) };
    typeOnly = null;
    shown = PAGE;
    renderResults();
  }
  function renderResults() {
    const { q, r } = last;
    if (r.kind === "card") {
      const c = cards[r.card];
      showResults(`<div class="rhead"><span class="grow">Card <b>${c.id}</b> · ${esc(lessons[c.l].t)}</span>` +
        (inBook(c) ? `<a class="btn" href="#${c.id}">Open in book →</a>` : "") + `</div>` +
        `<div class="grid">${cardHtml(r.card, { open: true, anchor: false })}</div>`);
      return;
    }
    if (r.kind === "lesson") {
      const l = lessons[r.lesson];
      const ids = cards.map((c, i) => i).filter((i) => cards[i].l === r.lesson && inBook(cards[i]));
      showResults(`<div class="rhead"><span class="grow">Lesson <b>${l.c}</b> · ${esc(l.t)} · ${ids.length} cards</span><a class="btn" href="#${l.c}">Open in book →</a></div>` +
        `<div class="grid">${ids.map((i) => cardHtml(i, { anchor: false })).join("")}</div>`);
      return;
    }
    const all = r.hits.filter((h) => inBook(cards[h.i]));
    const types = [...new Set(all.map((h) => cards[h.i].t))].sort();
    const list = typeOnly ? all.filter((h) => cards[h.i].t === typeOnly) : all;
    let html = `<div class="rhead"><span class="grow">${list.length} card${list.length === 1 ? "" : "s"} for “${esc(q)}”</span>`;
    if (types.length > 1) {
      html += `<button type="button" data-a="type" data-t="" aria-pressed="${!typeOnly}">All</button>` +
        types.map((t) => `<button type="button" data-a="type" data-t="${t}" aria-pressed="${typeOnly === t}">${t}</button>`).join("");
    }
    html += `</div>`;
    if (r.lessons.length) {
      html += `<div class="lessonhits">${r.lessons.map((li) => `<a href="#${lessons[li].c}"><b>${lessons[li].c}</b>${esc(lessons[li].t)}</a>`).join("")}</div>`;
    }
    if (!list.length) {
      const hidden = r.hits.length - all.length;
      html += `<p class="nope">No card found.${hidden ? ` ${hidden} Error (E) card${hidden === 1 ? "" : "s"} match — turn them on in Settings.` : " Try fewer words, an English phrase (overview), or a card code like w3d2s1."}</p>`;
    }
    html += `<div class="grid">${list.slice(0, shown).map((h) => cardHtml(h.i, { anchor: false })).join("")}</div>`;
    if (list.length > shown) html += `<div class="rhead"><button type="button" data-a="more">Show ${Math.min(PAGE, list.length - shown)} more</button></div>`;
    showResults(html);
  }

  let timer = 0;
  qBox.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => runSearch(true), 140); });
  qBox.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { clearBox(); runSearch(true); qBox.blur(); }
    if (ev.key === "Enter") { clearTimeout(timer); runSearch(true); qBox.blur(); }
  });
  $("qClear").addEventListener("click", () => { clearBox(); runSearch(true); qBox.focus(); });
  addEventListener("keydown", (ev) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "");
    if ((ev.key === "/" && !typing) || (ev.key.toLowerCase() === "k" && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); qBox.focus(); qBox.select(); }
  });

  // ---------- My cards (★ = I got this wrong) ----------
  function saveMine() { store.set("mine", mine); updateMineCount(); }
  function updateMineCount() {
    const n = Object.keys(mine).length;
    $("mineCount").hidden = !n;
    $("mineCount").textContent = n;
  }
  function refreshStars(id) {
    const m = mine[id];
    document.querySelectorAll(`.card[data-i="${byId.get(id)}"] [data-a="star"]`).forEach((b) => {
      b.classList.toggle("on", !!m);
      if (b.lastChild.nodeType === 3) b.lastChild.textContent = m ? m.n : "";
      else if (m) b.append(String(m.n));
    });
  }
  function showMine() {
    const ids = Object.keys(mine).filter((id) => byId.has(id))
      .sort((a, b) => mine[b].n - mine[a].n || (mine[b].last > mine[a].last ? 1 : -1));
    let html = `<div class="rhead"><span class="grow"><b>My cards</b> · ${ids.length} card${ids.length === 1 ? "" : "s"} you got wrong</span>`;
    if (ids.length) html += `<button type="button" data-a="copyMine">Copy list</button>`;
    html += `</div>`;
    if (!ids.length) html += `<p class="nope">Nothing yet. Tap ☆ on a card when you get it wrong. The list stays on this device.</p>`;
    html += `<div class="grid">${ids.map((id) => {
      const m = mine[id];
      const meta = `<div class="minemeta">★ ${m.n} · first ${m.first} · last ${m.last}<span class="grow"></span><button type="button" data-a="less">−1</button><button type="button" data-a="unmine">Remove</button></div>`;
      return cardHtml(byId.get(id), { anchor: false, meta });
    }).join("")}</div>`;
    showResults(html);
  }
  $("mine").addEventListener("click", () => go("mine"));

  // ---------- copy ----------
  const toText = (h) => String(h)
    .replace(/<span class="lbl">([^<]*)<\/span>/g, "$1: ")
    .replace(/<\/(p|li|div|tr|pre|blockquote)>|<br>/g, "\n").replace(/<\/t[dh]>/g, " | ")
    .replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  const cardText = (c) => `${c.id} (${c.st})\n${toText(c.f)}\n${c.a ? "Answer: " + toText(c.a) + "\n" : ""}${toText(c.b)}`;
  async function copy(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done); return; } catch { /* fall back below */ }
    const t = document.createElement("textarea");
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    toast(ok ? done : "Couldn't copy");
  }

  // ---------- clicks ----------
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-a]");
    if (!a) return;
    const el = a.closest(".card");
    const i = el ? +el.dataset.i : -1;
    switch (a.dataset.a) {
      case "flip": {
        if (String(getSelection?.() || "")) return; // selecting text should not flip the card
        const open = !el.classList.contains("open");
        if (open) { opened.add(i); closed.delete(i); } else { opened.delete(i); closed.add(i); }
        setOpen(el, open);
        if (!open && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
        break;
      }
      case "go": ev.preventDefault(); go(cards[i].id); break;
      case "star": {
        const id = cards[i].id;
        const m = mine[id] || { n: 0, first: today() };
        m.n += 1;
        m.last = today();
        mine[id] = m;
        saveMine();
        refreshStars(id);
        toast(`★ ${m.n} · saved in My cards`);
        break;
      }
      case "less": case "unmine": {
        const id = cards[i].id;
        if (a.dataset.a === "less" && mine[id].n > 1) mine[id].n -= 1; else delete mine[id];
        saveMine();
        refreshStars(id);
        showMine();
        break;
      }
      case "copy": copy(cardText(cards[i]), "Card copied"); break;
      case "copyMine": {
        const lines = Object.entries(mine).sort((x, y) => y[1].n - x[1].n)
          .map(([id, m]) => `${id} ★${m.n} (last ${m.last}) ${toText(cards[byId.get(id)]?.f || "")}`);
        copy(lines.join("\n"), "List copied");
        break;
      }
      case "type": typeOnly = a.dataset.t || null; shown = PAGE; renderResults(); break;
      case "more": shown += PAGE; { const y = scrollY; renderResults(); scrollTo(0, y); } break;
      case "lesson": $("jump").close(); go(lessons[+a.dataset.l].c); break;
    }
  });

  // ---------- show all backs ----------
  function setShowAll(on) {
    showAll = on;
    store.set("backAll", on);
    opened.clear();
    closed.clear();
    $("backAll").setAttribute("aria-pressed", String(on));
    $("setBack").checked = on;
    document.querySelectorAll(".card").forEach((el) => {
      el.classList.toggle("open", on);
      el.querySelector(".back").hidden = !on;
    });
    if (on) near.forEach(fill);
  }
  $("backAll").addEventListener("click", () => setShowAll(!showAll));
  $("setBack").addEventListener("change", (ev) => setShowAll(ev.target.checked));

  // ---------- jump dialog ----------
  function buildJump() {
    let html = "";
    for (let w = 0; w <= 12; w++) {
      const ls = lessons.map((l, li) => [l, li]).filter(([l]) => l.w === w);
      if (!ls.length) continue;
      html += `<h4>${w ? "Week " + w : "W00"}${D.weeks[w] ? " · " + esc(D.weeks[w]) : ""}</h4><div class="ls">` +
        ls.map(([l, li]) => `<button type="button" data-a="lesson" data-l="${li}"><b>${l.c}</b>${esc(l.t)}</button>`).join("") + `</div>`;
    }
    $("lessons").innerHTML = html;
  }
  $("where").addEventListener("click", () => {
    $("lessons").querySelectorAll("button").forEach((b) => b.classList.toggle("here", +b.dataset.l === currentLesson));
    $("jump").showModal();
    $("lessons").querySelector(".here")?.scrollIntoView({ block: "center" });
  });

  // ---------- settings ----------
  function applySize() { document.documentElement.style.setProperty("--size", textSize + "px"); }
  $("gear").addEventListener("click", () => $("settings").showModal());
  $("sizeDown").addEventListener("click", () => { textSize = Math.max(12, textSize - 1); store.set("size", textSize); applySize(); });
  $("sizeUp").addEventListener("click", () => { textSize = Math.min(22, textSize + 1); store.set("size", textSize); applySize(); });
  $("setExtra").addEventListener("change", (ev) => {
    extra = ev.target.checked;
    store.set("extra", extra);
    const keep = lessons[currentLesson].c;
    renderBook();
    if (last) renderResults();
    else if (!book.hidden) document.getElementById(keep).scrollIntoView({ block: "start" });
  });

  // ---------- toast ----------
  let toastTimer = 0;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
  }

  // ---------- start ----------
  applySize();
  $("setExtra").checked = extra;
  $("backAll").setAttribute("aria-pressed", String(showAll));
  $("setBack").checked = showAll;
  $("build").textContent = `Build ${D.build} · ${cards.filter((c) => c.p).length} printed cards (S, P), ${cards.length} with E cards.`;
  updateMineCount();
  buildJump();
  renderBook();
  showWhere();
  route();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
