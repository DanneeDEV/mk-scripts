(() => {
  const SNAPSHOT_URL =
    "https://rjndhhdwmmonsrniunhc.supabase.co/storage/v1/object/public/snapshots/search/search-index.v1.json";

  const MAX_RESULTS = 5;
  const MIN_CHARS = 2;
  const DEBOUNCE_MS = 90;

  const SEARCH_PAGE_URL = "/search";

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const isBad = (v) => v == null || String(v).trim() === "" || String(v).trim() === "—";

  const fmtPrice = (p) => {
    const n = Number(p);
    return Number.isFinite(n) && n > 0 ? `${n.toLocaleString("sv-SE")} kr` : "—";
  };

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

  function setText(el, v) {
    if (!el) return;
    el.textContent = isBad(v) ? "—" : String(v);
  }

  function setBg(el, url) {
    if (!el) return;
    if (!url) { el.style.backgroundImage = ""; return; }
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";
  }

  // Läs max-height från CSS (t.ex. 420px)
  function getMaxPx(el) {
    const mh = getComputedStyle(el).maxHeight;
    const n = parseFloat(mh);
    return Number.isFinite(n) ? n : Infinity;
  }

  function calcOpenMaxHeight(panel, list, footer) {
    // panel padding
    const cs = getComputedStyle(panel);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;

    // list synliga höjd = min(scrollHeight, max-height)
    const listMax = getMaxPx(list);
    const listVisible = Math.min(list.scrollHeight, listMax);

    const footerH = footer ? footer.offsetHeight : 0;

    // + en liten buffert (typ borders/gap)
    return Math.ceil(pt + listVisible + footerH + pb + 6);
  }

  function openPanel(panel, list, footer) {
    if (!panel) return;

    // 🚑 Webflow kan ha satt en inline height -> döda den
    panel.style.removeProperty("height");
    panel.style.height = "auto";

    panel.setAttribute("data-open", "1");

    // nolla först så transition triggas
    panel.style.maxHeight = "0px";

    requestAnimationFrame(() => {
      // tvinga layout
      panel.getBoundingClientRect();

      const h = calcOpenMaxHeight(panel, list, footer);
      panel.style.maxHeight = `${h}px`;
    });
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.setAttribute("data-open", "0");
    panel.style.maxHeight = "0px";
  }

  // =========================
  // LOAD SNAPSHOT (session cache)
  // =========================
  const SS_KEY = "mk_search_index_v1";
  const SS_TS = "mk_search_index_v1_ts";
  const SS_TTL = 8 * 60 * 1000;

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
  // SEARCH + RANK
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

  // =========================
  // RENDER
  // =========================
  function clearList(list, tpl) {
    if (!list) return;
    qsa('[data-mk="search_item"]', list).forEach((n) => n.remove());
    if (tpl) tpl.style.display = "none";
  }

  function render(list, tpl, items) {
    clearList(list, tpl);
    if (!list || !tpl) return;

    for (const it of items) {
      const node = tpl.cloneNode(true);

      node.style.display = "";
      node.classList.remove("is-template");
      node.setAttribute("data-mk", "search_item");
      node.setAttribute("data-id", String(it.id));

      setBg(qs('[data-mk="search_img"]', node), it.imageUrl);
      setText(qs('[data-mk="search_title"]', node), it.title);
      setText(qs('[data-mk="search_location"]', node), it.location);
      setText(qs('[data-mk="search_price"]', node), fmtPrice(it.price));
      setText(qs('[data-mk="search_source"]', node), String(it.source || "").toUpperCase() || "—");

      list.appendChild(node);
    }
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

    tpl.style.display = "none";
    closePanel(panel);

    const allItems = await loadIndex();
    window.__MK_SEARCH_INDEX = allItems;

    const updateShowAll = (q) => {
      if (!showAllLbl) return;
      showAllLbl.textContent = q ? `Visa alla resultat för '${q}'` : `Visa alla resultat`;
    };

    const run = debounce((raw) => {
      const query = String(raw || "").trim();
      updateShowAll(query);

      if (query.length < MIN_CHARS) {
        clearList(list, tpl);
        closePanel(panel);
        return;
      }

      const hits = topMatches(allItems, query);
      render(list, tpl, hits);

      // öppna efter render (så höjd blir korrekt)
      requestAnimationFrame(() => openPanel(panel, list, showAll));
    }, DEBOUNCE_MS);

    input.addEventListener("input", (e) => run(e.target.value));

    input.addEventListener("focus", () => {
      const q = String(input.value || "").trim();
      updateShowAll(q);
      if (q.length >= MIN_CHARS) requestAnimationFrame(() => openPanel(panel, list, showAll));
    });

    document.addEventListener("click", (e) => {
      const row = e.target.closest('[data-mk="search_item"][data-id]');
      if (!row) return;

      e.preventDefault();
      e.stopPropagation();

      const id = row.getAttribute("data-id");
      const q = String(input.value || "").trim();
      goToSearch(q, id);
    });

    if (showAll) {
      showAll.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const q = String(input.value || "").trim();
        goToSearch(q, null);
      });
    }

    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-mk="search_panel"]')) return;
      if (e.target.closest('[data-mk="search_input"]')) return;
      closePanel(panel);
    });

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

