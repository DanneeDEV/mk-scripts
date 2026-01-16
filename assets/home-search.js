(() => {
  // =========================
  // CONFIG
  // =========================
  const SNAPSHOT_URL =
    "https://rjndhhdwmmonsrniunhc.supabase.co/storage/v1/object/public/snapshots/search/search-index.v1.json";

  const MAX_RESULTS = 5;        // ✅ bara 5
  const MIN_CHARS = 2;
  const DEBOUNCE_MS = 90;

  // Vart ska vi skicka användaren vid klick / “visa alla”?
  const SEARCH_PAGE_URL = "/search";

  // ✅ maxhöjd för listan (scroll efter detta)
  const LIST_MAX_PX = 420;

  // =========================
  // HELPERS
  // =========================
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const isBad = (v) =>
    v == null || String(v).trim() === "" || String(v).trim() === "—";

  const fmtPrice = (p) => {
    const n = Number(p);
    return Number.isFinite(n) && n > 0 ? `${n.toLocaleString("sv-SE")} kr` : "—";
  };

  // “åäö” → aao, + lowercase, + bort extra
  const fold = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/å/g, "a")
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9\s\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function safeText(el, v) {
    if (el) el.textContent = isBad(v) ? "—" : String(v);
  }

  function safeBg(el, url) {
    if (!el) return;
    if (!url) {
      el.style.backgroundImage = "";
      return;
    }
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";
  }

  function openPanel(panel) {
    if (!panel) return;
    panel.style.display = "";
    panel.setAttribute("data-open", "1");
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.setAttribute("data-open", "0");
    panel.style.display = "none";
  }

  // ✅ lista scroll + dynamisk max-height
  function setListHeight(listEl, count) {
    if (!listEl) return;

    // alltid scrollbart, men klipp vid max
    listEl.style.overflowY = "auto";
    listEl.style.overflowX = "hidden";

    // försök räkna verklig höjd av synliga items
    const items = [...listEl.querySelectorAll('[data-mk="search_item"]')];
    let h = 0;

    for (let i = 0; i < items.length && i < count; i++) {
      const r = items[i].getBoundingClientRect();
      h += r.height || 0;
    }

    // fallback om getBoundingClientRect inte ger höjd direkt (t.ex. första paint)
    if (!h) {
      listEl.style.maxHeight = `${Math.min(LIST_MAX_PX, 360)}px`;
      return;
    }

    const px = Math.min(Math.ceil(h), LIST_MAX_PX);
    listEl.style.maxHeight = `${px}px`;
  }

  // =========================
  // LOAD SNAPSHOT (cache i sessionStorage)
  // =========================
  const SS_KEY = "mk_search_index_v1";
  const SS_TS = "mk_search_index_v1_ts";
  const SS_TTL = 8 * 60 * 1000; // 8 min

  async function loadIndex() {
    try {
      const cached = sessionStorage.getItem(SS_KEY);
      const ts = Number(sessionStorage.getItem(SS_TS) || "0");
      if (cached && Date.now() - ts < SS_TTL) {
        const parsed = JSON.parse(cached);
        return parsed?.items || [];
      }
    } catch (_) {}

    const res = await fetch(SNAPSHOT_URL, { cache: "force-cache" });
    if (!res.ok) throw new Error(`search snapshot HTTP ${res.status}`);
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({ items }));
      sessionStorage.setItem(SS_TS, String(Date.now()));
    } catch (_) {}

    return items;
  }

  // =========================
  // SEARCH + RENDER
  // =========================
  function scoreItem(q, it) {
    const t = fold(it.title);
    const b = fold(it.brand);
    const m = fold(it.model);
    const loc = fold(it.location);
    const cm = fold(it.category_main);
    const cs = fold(it.category_sub);

    let s = 0;

    if (t.startsWith(q)) s += 80;
    if (t.includes(q)) s += 60;

    const bm = (b + " " + m).trim();
    if (bm.startsWith(q)) s += 40;
    if (bm.includes(q)) s += 30;

    if (loc.includes(q)) s += 15;
    if (cs.includes(q)) s += 12;
    if (cm.includes(q)) s += 8;

    return s;
  }

  function topMatches(items, query) {
    const q = fold(query);
    if (q.length < MIN_CHARS) return [];

    const scored = [];
    for (const it of items) {
      if (!it || !it.id) continue;
      const sc = scoreItem(q, it);
      if (sc > 0) scored.push({ it, sc });
    }
    scored.sort((a, b) => b.sc - a.sc);

    return scored.slice(0, MAX_RESULTS).map((x) => x.it);
  }

  function clearList(list, tpl) {
    if (!list) return;
    qsa('[data-mk="search_item"]', list).forEach((n) => n.remove());
    if (tpl) tpl.style.display = "none";
  }

  function render(list, tpl, items) {
    clearList(list, tpl);
    if (!list || !tpl) return;

    items.forEach((it) => {
      const node = tpl.cloneNode(true);
      node.style.display = "";
      node.classList.remove("is-template");
      node.setAttribute("data-mk", "search_item");
      node.dataset.id = String(it.id);

      safeBg(qs('[data-mk="search_img"]', node), it.imageUrl);
      safeText(qs('[data-mk="search_title"]', node), it.title);
      safeText(qs('[data-mk="search_location"]', node), it.location);
      safeText(qs('[data-mk="search_price"]', node), fmtPrice(it.price));
      safeText(
        qs('[data-mk="search_source"]', node),
        String(it.source || "").toUpperCase() || "—"
      );

      list.appendChild(node);
    });

    // ✅ efter render: sätt max-height så 5 rader syns (eller färre om färre hits)
    // kör i nästa frame så layout hunnit uppdateras
    requestAnimationFrame(() => setListHeight(list, Math.min(items.length, MAX_RESULTS)));
  }

  function goToSearch(query, openId = null) {
    const u = new URL(SEARCH_PAGE_URL, location.origin);
    if (query) u.searchParams.set("q", query);
    if (openId) u.searchParams.set("open", String(openId));
    location.href = u.toString();
  }

  // =========================
  // INIT
  // =========================
  async function init() {
    const input = qs('[data-mk="search_input"]');
    const panel = qs('[data-mk="search_panel"]');
    const list = qs('[data-mk="search_list"]');
    const tpl = qs('[data-mk="search_item_tpl"]');
    const showAll = qs('[data-mk="search_show_all"]');
    const showAllLbl = qs('[data-mk="search_show_all_label"]');

    if (!input || !panel || !list || !tpl) {
      console.warn("[MK search] saknar data-mk hooks (input/panel/list/tpl)");
      return;
    }

    closePanel(panel);
    tpl.style.display = "none";

    // ✅ se till att listan aldrig påverkar blur på panelen:
    // panelen kan ha overflow hidden för blur, listan får scroll.
    list.style.overflowY = "auto";
    list.style.overflowX = "hidden";
    list.style.maxHeight = `${LIST_MAX_PX}px`;

    const allItems = await loadIndex();
    window.__MK_SEARCH_INDEX = allItems;

    const updateShowAll = (q) => {
      if (!showAllLbl) return;
      showAllLbl.textContent = q
        ? `Visa alla resultat för '${q}'`
        : `Visa alla resultat`;
    };

    const doSearch = debounce((q) => {
      const query = String(q || "").trim();
      updateShowAll(query);

      if (query.length < MIN_CHARS) {
        clearList(list, tpl);
        closePanel(panel);
        return;
      }

      const hits = topMatches(allItems, query);

      if (!hits.length) {
        clearList(list, tpl);
        closePanel(panel);
        return;
      }

      render(list, tpl, hits);
      openPanel(panel);
    }, DEBOUNCE_MS);

    input.addEventListener("input", (e) => doSearch(e.target.value));

    input.addEventListener("focus", () => {
      const q = String(input.value || "").trim();
      updateShowAll(q);
      if (q.length >= MIN_CHARS) doSearch(q);
    });

    // Klick på resultat → till söksida med open=id
    document.addEventListener("click", (e) => {
      const row = e.target.closest('[data-mk="search_item"][data-id]');
      if (!row) return;

      e.preventDefault();
      e.stopPropagation();

      const id = row.getAttribute("data-id");
      const q = String(input.value || "").trim();
      goToSearch(q, id);
    });

    // “Visa alla”
    if (showAll) {
      showAll.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const q = String(input.value || "").trim();
        goToSearch(q, null);
      });
    }

    // Klick utanför → stäng
    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-mk="search_panel"]')) return;
      if (e.target.closest('[data-mk="search_input"]')) return;
      closePanel(panel);
    });

    // ESC → stäng
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel(panel);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

