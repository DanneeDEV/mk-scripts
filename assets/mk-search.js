
(() => {
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];

  window.__MK_FADE = {
    ready(scope = document) {
      qsa('[data-mk-fade]', scope).forEach(el => el.classList.add("is-ready"));
    },
    readyOne(sel) {
      const el = document.querySelector(sel);
      if (el) el.classList.add("is-ready");
    }
  };
})();







(() => {

  // ---------- tiny helpers ----------
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];
  const norm = (s) => (s ?? "").toString().trim().toLowerCase();

  function slugifySv(s) {
    return (s ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
      .replace(/&/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  const fmtInt = (n) => Number.isFinite(+n) ? (+n).toLocaleString("sv-SE") : null;

  // Uppdatera träffar (stöd båda dina hooks)
  function setHitsUI(n) {
    const text = `${Number(n || 0).toLocaleString("sv-SE")}`;
    const el1 = qs('[data-mk="cat_hits"]');
    if (el1) el1.textContent = text;
    const el2 = qs('[data-mk="hits_count"]');
    if (el2) el2.textContent = text;
  }

  function prettyFromSlug(slug) {
    if (!slug) return null;
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ✅ Robust: hitta sök-input även om du inte satt data-mk än
  function getSearchInput() {
    return (
      qs('[data-mk="search_input"]') ||
      qs('[data-mk="search"] input') ||
      qs('input[type="search"]') ||
      qs('input[placeholder*="Sök"], input[placeholder*="sök"]') ||
      null
    );
  }

  // ---------- SEARCH SNAPSHOT BOOT ----------
  const SEARCH_SNAPSHOT_URL =
    "https://rjndhhdwmmonsrniunhc.supabase.co/storage/v1/object/public/snapshots/search/search-all.v1.json";
  
  function getSearchQ() {
    return (new URL(location.href)).searchParams.get("q")?.trim() || "";
  }
  
  if (!window.__MK_SEARCH_BOOT) {
    window.__MK_SEARCH_BOOT = (async () => {
      const res = await fetch(SEARCH_SNAPSHOT_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error("search-all snapshot http " + res.status);
      const snapshot = await res.json();
      const q = getSearchQ();
      return { snapshot, q };
    })();
  }
  
  // ✅ Always ensure CAT_BOOT shim exists (even if SEARCH_BOOT already existed)
  if (!window.__MK_CAT_BOOT) {
    window.__MK_CAT_BOOT = Promise.resolve(window.__MK_SEARCH_BOOT).then(({ snapshot, q }) => ({
      mainName: "Sök",
      mainSlug: "search",
      subSlug: null,
      snapshot,
      q,
    }));
  }


  



  // ---------- shared lookup: subSlug -> original label (åäö & etc) ----------
  async function buildSubLabelLookup() {
    const boot = await window.__MK_CAT_BOOT;
    const items = Array.isArray(boot?.snapshot?.items) ? boot.snapshot.items : [];
    const map = new Map();

    const clean = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();

    for (const it of items) {
      const raw = clean(it?.category_sub);
      if (!raw) continue;
      const k = slugifySv(raw);
      if (!k) continue;
      if (!map.has(k)) map.set(k, raw);
    }

    return map;
  }

  // ---------- CAT UI ----------
  async function initCatUI(subLabelBySlug) {
    const boot = await window.__MK_CAT_BOOT;
    const { mainName, subSlug, snapshot } = boot;

    const h1 = qs('[data-mk="cat_title"]') || qs("h1");
    const initialSubLabel = subSlug ? (subLabelBySlug.get(slugifySv(subSlug)) || prettyFromSlug(subSlug)) : null;
    if (h1) h1.textContent = initialSubLabel || mainName;

    const total = snapshot?.stats?.total ?? snapshot?.items?.length ?? 0;
    setHitsUI(total);

    const totalEl = qs('[data-mk="stat_total"]');
    if (totalEl) totalEl.textContent = Number(total).toLocaleString("sv-SE");

    const ends24El = qs('[data-mk="stat_ends24h"]');
    if (ends24El) ends24El.textContent = Number(snapshot?.stats?.ends_24h ?? 0).toLocaleString("sv-SE");

    const new24El = qs('[data-mk="stat_new24h"]');
    if (new24El) {
      const n = snapshot?.stats?.new_24h;
      new24El.textContent = Number.isFinite(+n) ? Number(n).toLocaleString("sv-SE") : "—";
    }


    window.addEventListener("mk:subcat-changed", (e) => {
      const raw = e?.detail?.sub;
      const h = qs('[data-mk="cat_title"]') || qs("h1");
      if (!h) return;

      if (raw == null) {
        h.textContent = mainName;
        return;
      }

      const key = slugifySv(raw);
      const label = subLabelBySlug.get(key) || prettyFromSlug(raw) || mainName;
      h.textContent = label;
    });

    console.log("[MK-CAT] loaded", boot.mainSlug, "items:", snapshot?.items?.length);
  }

  // ---------- FILTERS ----------
  async function initFilters() {
    const boot = await window.__MK_SEARCH_BOOT;
    const snap = boot?.snapshot || {};
    const allItems = Array.isArray(snap?.items) ? snap.items : (snap.items || snap.listings || snap.rows || []);
    const fmt = (n) => Number.isFinite(+n) ? (+n).toLocaleString("sv-SE") : "0";

    const LAN_LABEL = {
      "blekinge": "Blekinge",
      "dalarna": "Dalarna",
      "gavleborg": "Gävleborg",
      "gotland": "Gotland",
      "halland": "Halland",
      "jamtland": "Jämtland",
      "jonkoping": "Jönköping",
      "kalmar": "Kalmar",
      "kronoberg": "Kronoberg",
      "norrbotten": "Norrbotten",
      "skane": "Skåne",
      "stockholm": "Stockholm",
      "sodermanland": "Södermanland",
      "uppsala": "Uppsala",
      "varmland": "Värmland",
      "vasterbotten": "Västerbotten",
      "vasternorrland": "Västernorrland",
      "vastmanland": "Västmanland",
      "vastragotaland": "Västra Götaland",
      "orebro": "Örebro",
      "ostergotland": "Östergötland",
    };

    const MAX_PER_SECTION = 10;

    const state = {
      source: new Set(),
      lan: new Set(),
      brand: new Set(),
      priceMin: null,
      priceMax: null,
      yearMin: null,
      yearMax: null,
      hoursMin: null,
      hoursMax: null,
      endsIn: null,
      q: boot?.q || "",

    };

    const facetUI = { lan: { query: "" }, brand: { query: "" } };

    let currentSubSlug = boot?.subSlug ? slugifySv(boot.subSlug) : null;

    function titleCase(s) {
      return (s || "")
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }

    function displayLabel(facet, key) {
      if (!key) return "—";
      if (facet === "source") return String(key).toUpperCase();

      if (facet === "lan") {
        const slug = norm(key);
        if (LAN_LABEL[slug]) return LAN_LABEL[slug];
        return titleCase(String(key).replace(/-/g, " "));
      }

      if (facet === "brand") return String(key);
      return String(key);
    }

    function debounce(fn, ms=120) {
      let t = null;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    }

    function preventWebflowFormSubmit(inputEl) {
      inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
      const form = inputEl.closest("form");
      if (form && form.dataset.mkNoSubmit !== "1") {
        form.dataset.mkNoSubmit = "1";
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        });
      }
    }

    function setRowSelected(rowEl, selected) {
      rowEl.dataset.selected = selected ? "1" : "0";
    }

    function parseNumberInput(v) {
      const s = String(v || "").replace(/[^\d]/g, "");
      if (!s) return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }

    function activeCount() {
      let n = state.source.size + state.lan.size + state.brand.size;
      if (state.priceMin != null || state.priceMax != null) n += 1;
      if (state.yearMin  != null || state.yearMax  != null) n += 1;
      if (state.hoursMin != null || state.hoursMax != null) n += 1;
      if (state.endsIn   != null) n += 1;
      if ((state.q || "").trim()) n += 1;
      return n;
    }

    function setActiveCountUI() {
      const el = qs('[data-mk="filter_active_count"]');
      if (!el) return;
      el.textContent = `${activeCount()} aktiva filter`;
    }

    function emitChanged() {
      window.dispatchEvent(new CustomEvent("mk:filters-changed", {
        detail: {
          source: [...state.source],
          lan: [...state.lan],
          brand: [...state.brand],
          priceMin: state.priceMin,
          priceMax: state.priceMax,
          yearMin: state.yearMin,
          yearMax: state.yearMax,
          hoursMin: state.hoursMin,
          hoursMax: state.hoursMax,
          endsIn: state.endsIn,
          q: state.q,
        }
      }));
    }

    function baseItems() {
      if (!currentSubSlug) return allItems || [];
      return (allItems || []).filter(it => slugifySv(it?.category_sub) === currentSubSlug);
    }

    function computeFacetsFromItems(items) {
      const src = new Map();
      const lan = new Map();
      const br  = new Map();

      const add = (m, k) => {
        const key = norm(k);
        if (!key) return;
        m.set(key, (m.get(key) || 0) + 1);
      };

      for (const it of (items || [])) {
        add(src, it?.source);
        add(lan, it?.lan_slug);
        add(br,  it?.brand);
      }

      const toArr = (m, limit=null) => {
        const arr = [...m.entries()].map(([k,n]) => ({ k, n }));
        arr.sort((a,b) => b.n - a.n);
        return limit ? arr.slice(0, limit) : arr;
      };

      return {
        source: toArr(src),
        lan:    toArr(lan),
        brand:  toArr(br, 200),
      };
    }

    function computeStatsFromItems(items) {
      const now = Date.now();
      const cutoffNew = now - 24 * 3600_000;
      const cutoffEnd = now + 24 * 3600_000;

      let ends24 = 0;
      let new24  = 0;
      let canComputeNew = false;

      for (const it of (items || [])) {
        const end = Date.parse(it?.auction_ends_at || "");
        if (Number.isFinite(end) && end >= now && end <= cutoffEnd) ends24++;

        const seenIso = it?.first_seen_at || it?.created_at || null;
        if (seenIso) {
          const seen = Date.parse(seenIso);
          if (Number.isFinite(seen)) {
            canComputeNew = true;
            if (seen >= cutoffNew) new24++;
          }
        }
      }

      return {
        total: (items || []).length,
        ends24h: ends24,
        new24h: canComputeNew ? new24 : null,
      };
    }

    function setStat(key, val) {
      const el = qs(`[data-mk="${key}"]`);
      if (!el) return;
      el.textContent = (val == null) ? "—" : Number(val || 0).toLocaleString("sv-SE");
    }

    let facetData = computeFacetsFromItems(baseItems());

    function withSelectedIncluded(facetName, arr) {
      const selected = state[facetName] ? [...state[facetName]] : [];
      if (!selected.length) return arr;

      const map = new Map((arr || []).map(x => [norm(x.k), Number(x.n || 0)]));
      for (const k of selected) {
        if (!map.has(k)) map.set(k, 0);
      }
      const out = [...map.entries()].map(([k,n]) => ({ k, n }));
      out.sort((a,b) => b.n - a.n);
      return out;
    }

    function getFacetItems(facetName) {
      const base = facetData?.[facetName] || [];
      return withSelectedIncluded(facetName, base);
    }

    function getFilteredFacetItems(facetName, facetItems) {
      let list = facetItems || [];

      if ((facetName === "lan" || facetName === "brand") && facetUI[facetName]) {
        const q = norm(facetUI[facetName].query);
        if (q) list = list.filter(x => norm(x?.k).includes(q));
      }

      if (facetUI[facetName]?.query) return list.slice(0, 50);

      const capped = list.slice(0, MAX_PER_SECTION);

      const selected = state[facetName] ? [...state[facetName]] : [];
      const has = new Set(capped.map(x => norm(x.k)));
      for (const k of selected) {
        if (!has.has(k)) capped.unshift({ k, n: 0 });
      }

      return capped.slice(0, MAX_PER_SECTION);
    }

    function renderFacetSection(sectionEl, facetName, facetItems) {
      const tpl = qs('[data-mk="facet_row_tpl"]', sectionEl);
      if (!tpl) return;

      qsa('[data-mk="facet_row_item"]', sectionEl).forEach(el => el.remove());

      const list = getFilteredFacetItems(facetName, facetItems);
      const frag = document.createDocumentFragment();

      for (const it of list) {
        const keyRaw = it?.k ?? "";
        const key = norm(keyRaw);
        const count = Number(it?.n ?? 0);

        const row = tpl.cloneNode(true);
        row.classList.remove("is-template");
        row.removeAttribute("style");
        row.style.display = "";
        row.setAttribute("data-mk", "facet_row_item");
        row.dataset.facet = facetName;
        row.dataset.key = key;

        const labelEl = qs('[data-mk="facet_label"]', row);
        const countEl = qs('[data-mk="facet_count"]', row);

        if (labelEl) labelEl.textContent = displayLabel(facetName, String(keyRaw));
        if (countEl) countEl.textContent = fmt(count);

        setRowSelected(row, state[facetName].has(key));

        row.addEventListener("click", (e) => {
          e.preventDefault();

          const nowSelected = !state[facetName].has(key);
          if (nowSelected) state[facetName].add(key);
          else state[facetName].delete(key);

          setRowSelected(row, nowSelected);
          setActiveCountUI();
          emitChanged();
        });

        frag.appendChild(row);
      }

      tpl.style.display = "none";
      sectionEl.appendChild(frag);
    }

    function wireFacetSearch(sectionEl, facetName) {
      if (facetName !== "lan" && facetName !== "brand") return;

      const input = qs('[data-mk="facet_search"]', sectionEl);
      if (!input) return;

      preventWebflowFormSubmit(input);

      if (input.dataset.mkBound === "1") return;
      input.dataset.mkBound = "1";

      input.value = facetUI[facetName].query || "";

      const onInput = debounce(() => {
        facetUI[facetName].query = input.value || "";
        renderFacetSection(sectionEl, facetName, getFacetItems(facetName));
      }, 120);

      input.addEventListener("input", onInput);
    }

    function wireRangeInput(sel, setterFn) {
      const el = qs(sel);
      if (!el) return;

      preventWebflowFormSubmit(el);

      if (el.dataset.mkBound === "1") return;
      el.dataset.mkBound = "1";

      const handler = debounce(() => {
        setterFn(parseNumberInput(el.value));
        setActiveCountUI();
        emitChanged();
      }, 120);

      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    }

    function setEndsInUI(tag) {
      qsa('[data-mk="endsin_btn"]').forEach(btn => {
        btn.dataset.selected = (btn.dataset.endsin === tag) ? "1" : "0";
      });
    }

    function wireSearch() {
      const input = getSearchInput();
      if (!input) return;
      if (state.q && !input.value) input.value = state.q;


      preventWebflowFormSubmit(input);

      if (input.dataset.mkBound === "1") return;
      input.dataset.mkBound = "1";

      const onInput = debounce(() => {
        state.q = input.value || "";
        setActiveCountUI();
        emitChanged();
      }, 120);

      input.addEventListener("input", onInput);
      input.addEventListener("change", onInput);
    }

    function wireEndsIn() {
      const btns = qsa('[data-mk="endsin_btn"]');
      if (!btns.length) return;

      btns.forEach(btn => {
        if (btn.dataset.mkBound === "1") return;
        btn.dataset.mkBound = "1";

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const v = btn.dataset.endsin;

          if (v === "24h") state.endsIn = 24 * 60;
          else if (v === "3d") state.endsIn = 3 * 24 * 60;
          else if (v === "7d") state.endsIn = 7 * 24 * 60;
          else state.endsIn = null;

          setEndsInUI(v);
          setActiveCountUI();
          emitChanged();
        });
      });

      setEndsInUI("all");
    }

    function setInputValue(sel, value) {
      const el = qs(sel);
      if (el) el.value = value;
    }

    function rerenderAllFacetSections() {
      const sections = qsa('[data-mk="facet_section"]');
      for (const sec of sections) {
        const facet = sec.getAttribute("data-facet");
        if (!facet) continue;
        renderFacetSection(sec, facet, getFacetItems(facet));
      }
    }

    function updatePillsForBaseItems() {
      const items = baseItems();
      const s = computeStatsFromItems(items);

      setStat("stat_total", s.total);
      setStat("stat_ends24h", s.ends24h);

      if (!currentSubSlug) {
        const backend = snap?.stats?.new_24h;
        if (Number.isFinite(+backend)) setStat("stat_new24h", Number(backend));
        else setStat("stat_new24h", s.new24h);
      } else {
        setStat("stat_new24h", s.new24h);
      }
    }

    function wireReset() {
      const btn = qs('[data-mk="filter_reset"]');
      if (!btn) return;

      if (btn.dataset.mkBound === "1") return;
      btn.dataset.mkBound = "1";

      btn.addEventListener("click", (e) => {
        e.preventDefault();

        state.source.clear();
        state.lan.clear();
        state.brand.clear();

        facetUI.lan.query = "";
        facetUI.brand.query = "";

        qsa('[data-mk="facet_section"][data-facet="lan"] [data-mk="facet_search"]').forEach(i => i.value = "");
        qsa('[data-mk="facet_section"][data-facet="brand"] [data-mk="facet_search"]').forEach(i => i.value = "");

        state.priceMin = state.priceMax = null;
        state.yearMin  = state.yearMax  = null;
        state.hoursMin = state.hoursMax = null;
        state.endsIn   = null;
        state.q = "";

        const sInput = getSearchInput();
        if (sInput) sInput.value = "";

        setInputValue('[data-mk="price_min"]', "");
        setInputValue('[data-mk="price_max"]', "");
        setInputValue('[data-mk="year_min"]', "");
        setInputValue('[data-mk="year_max"]', "");
        setInputValue('[data-mk="hours_min"]', "");
        setInputValue('[data-mk="hours_max"]', "");

        setEndsInUI("all");

        qsa('[data-mk="facet_row_item"]').forEach(row => setRowSelected(row, false));

        rerenderAllFacetSections();

        setActiveCountUI();
        emitChanged();
      });
    }

    const sections = qsa('[data-mk="facet_section"]');
    for (const sec of sections) {
      const facet = sec.getAttribute("data-facet");
      if (!facet) continue;
      wireFacetSearch(sec, facet);
      renderFacetSection(sec, facet, getFacetItems(facet));
    }

    wireRangeInput('[data-mk="price_min"]', (v) => state.priceMin = v);
    wireRangeInput('[data-mk="price_max"]', (v) => state.priceMax = v);
    wireRangeInput('[data-mk="year_min"]',  (v) => state.yearMin  = v);
    wireRangeInput('[data-mk="year_max"]',  (v) => state.yearMax  = v);
    wireRangeInput('[data-mk="hours_min"]', (v) => state.hoursMin = v);
    wireRangeInput('[data-mk="hours_max"]', (v) => state.hoursMax = v);

    wireEndsIn();
    wireReset();
    wireSearch();
    setActiveCountUI();

    updatePillsForBaseItems();

    window.addEventListener("mk:subcat-changed", (e) => {
      const raw = e?.detail?.sub ?? null;
      currentSubSlug = raw ? slugifySv(raw) : null;

      facetData = computeFacetsFromItems(baseItems());
      rerenderAllFacetSections();
      updatePillsForBaseItems();
    });

    window.__MK_FILTER_STATE = state;

    // ✅ Exponera en minimal UI-hook så Cards kan uppdatera counts i panelen
    window.__MK_FILTER_UI = window.__MK_FILTER_UI || {};

    window.__MK_FILTER_UI.updateCountsFromItems = (items) => {
    const src = new Map();
    const lan = new Map();
    const br  = new Map();

    const add = (m, k) => {
        const key = norm(k);
        if (!key) return;
        m.set(key, (m.get(key) || 0) + 1);
    };

    for (const it of (items || [])) {
        add(src, it?.source);
        add(lan, it?.lan_slug);
        add(br,  it?.brand);
    }

    // Uppdatera enbart de rader som redan renderats (minimalt & stabilt)
    document.querySelectorAll('[data-mk="facet_row_item"]').forEach(row => {
        const facet = row.dataset.facet; // source | lan | brand
        const key   = row.dataset.key;   // redan normad
        const countEl = row.querySelector('[data-mk="facet_count"]');
        if (!countEl) return;

        let n = 0;
        if (facet === "source") n = src.get(key) || 0;
        if (facet === "lan")    n = lan.get(key) || 0;
        if (facet === "brand")  n = br.get(key)  || 0;

        countEl.textContent = Number(n).toLocaleString("sv-SE");

        // valfritt: dimma 0
        row.classList.toggle("is-zero", n === 0);
    });
    };


    console.log("[MK-FILTER] ready", {
      sub: currentSubSlug,
      sources: (facetData.source || []).length,
      lan: (facetData.lan || []).length,
      brands: (facetData.brand || []).length,
      maxPerSection: MAX_PER_SECTION
    });
  }

  // ---------- CARDS ----------
  async function initCards() {
    const log = (...a) => console.log("[MK-CARDS]", ...a);

    const grid = qs('[data-mk="cards_grid"]');
    const tpl  = qs('[data-mk="card_tpl"]');
    if (!grid || !tpl) {
      console.warn("[MK-CARDS] Missing cards_grid or card_tpl");
      return;
    }

    // ---------- LISTING MODAL (matches your Webflow markup) ----------
    const modalOverlay = qs('[data-mk="listing_modal_overlay"]');
    const modalEl      = qs('[data-mk="listing_modal"]', modalOverlay || document);
    
    const modalCloseEl = qs('[data-mk="listing_modal_close"]', modalOverlay || document);
    const modalImgEl   = qs('[data-mk="listing_modal_image"]', modalOverlay || document);
    
    const modalTimeEl  = qs('[data-mk="listing_modal_timeleft"]', modalOverlay || document);
    const modalSourceEl= qs('[data-mk="listing_modal_source"]', modalOverlay || document);
    
    const modalSubEl   = qs('[data-mk="listing_modal_sub"]', modalOverlay || document);
    const modalTitleEl = qs('[data-mk="listing_modal_title"]', modalOverlay || document);
    const modalLocEl   = qs('[data-mk="listing_modal_location"]', modalOverlay || document);
    
    const modalAnalysisEl = qs('[data-mk="listing_modal_analysis"]', modalOverlay || document);
    
    const modalPriceEl = qs('[data-mk="listing_modal_price"]', modalOverlay || document);
    const modalUpdatedEl = qs('[data-mk="listing_modal_updated"]', modalOverlay || document);
    
    const modalOpenEl  = qs('[data-mk="listing_modal_open"]', modalOverlay || document);
    const modalCopyEl  = qs('[data-mk="listing_modal_copy"]', modalOverlay || document);
    
    const modalChipsTpl  = qs('[data-mk="listing_modal_chips"]', modalOverlay || document); // template (din befintliga chip)
    const modalChipsWrap = modalChipsTpl ? modalChipsTpl.parentElement : null;              // wrap/listan

    
    const itemById = new Map();
    let lastActiveEl = null;
    let currentModalUrl = "";

    let __mkScrollLockPad = 0;
    
    function getScrollbarWidth() {
      return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    }
    
    function lockScroll() {
      __mkScrollLockPad = getScrollbarWidth();
    
      // Lägg padding så layout inte hoppar när scrollbar försvinner
      document.body.style.paddingRight = __mkScrollLockPad ? `${__mkScrollLockPad}px` : "";
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    
      try { window.lenis?.stop?.(); } catch(e) {}
    }
    
    function unlockScroll() {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";   // reset padding
    
      try { window.lenis?.start?.(); } catch(e) {}
    }

    
    function stopBackgroundScroll() { lockScroll(); }
    function startBackgroundScroll() { unlockScroll(); }

    

    let __mkModalClosing = false;
    
    function waitForTransition(el, fallbackMs = 320) {
      return new Promise((resolve) => {
        let done = false;
    
        const finish = () => {
          if (done) return;
          done = true;
          el.removeEventListener("transitionend", onEnd);
          clearTimeout(t);
          resolve();
        };
    
        const onEnd = (e) => {
          if (e.target !== el) return;
          if (e.propertyName !== "opacity" && e.propertyName !== "transform") return;
          finish();
        };
    
        const t = setTimeout(finish, fallbackMs);
        el.addEventListener("transitionend", onEnd);
      });
    }

function renderModalChips(item) {
  if (!modalChipsWrap || !modalChipsTpl) return;


  const tpl = modalChipsTpl.cloneNode(true);


  modalChipsWrap.innerHTML = "";


  const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
  const seen = new Set();
  const chips = [];

  const push = (t) => {
    const s = clean(t);
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    chips.push(s);
  };

  const ai = Array.isArray(item?.system_chips) ? item.system_chips : [];
  for (const t of ai) push(t);


  if (chips.length === 0) {
    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const year = toNum(item?.year);
    if (year) push(year);

    const hours = toNum(item?.operating_hours ?? item?.hours);
    if (hours && hours > 0) push(`${fmtInt(hours)} h`);

    const weightKg = toNum(item?.weight_kg);
    if (weightKg && weightKg > 0) {
      const tons = weightKg / 1000;
      push(tons >= 1 ? `${tons.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} ton` : `${fmtInt(weightKg)} kg`);
    }

    const kw = toNum(item?.engine_power_kw);
    if (kw && kw > 0) {
      const kwTxt = Number.isInteger(kw) ? fmtInt(kw) : kw.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
      push(`${kwTxt} kW`);
    }

    const fuel = clean(item?.fuel);
    if (fuel) push(fuel.toUpperCase());

    const drive = clean(item?.drive);
    if (drive) push(drive);

    const specs = item?.specs && typeof item.specs === "object" ? item.specs : null;
    const truthy = (v) =>
      v === true || v === "true" || v === 1 || v === "1" || String(v).toLowerCase() === "ja";

    if (specs) {
      if (truthy(specs.rototilt) || truthy(specs.tiltrotator)) push("Rototilt");
      if (truthy(specs.snabbfaste) || truthy(specs["snabbfäste"])) push("Snabbfäste");
      if (truthy(specs.ac) || truthy(specs.klimat)) push("AC");
      if (truthy(specs.webasto) || truthy(specs.värmare)) push("Värmare");
    }
  }


  const MAX = 10;
  for (const text of chips.slice(0, MAX)) {
    const chip = tpl.cloneNode(true);
    chip.style.display = "";
    chip.textContent = text;

    // undvik duplikat data-mk
    chip.removeAttribute("data-mk");

    // behåll exakt samma klass som template (mk-modal-chips)
    chip.className = modalChipsTpl.className;

    modalChipsWrap.appendChild(chip);
  }

  // 4) Visa/dölj wrappern
  modalChipsWrap.style.display = chips.length ? "" : "none";
}

    



    
    
    function openModal(item) {
      if (!modalOverlay || !modalEl || !item) return;
    
      lastActiveEl = document.activeElement;
    
      stopBackgroundScroll();
    
      // --- fyll din data som du redan gör ---
      const imgUrl = item?.imageUrl || item?.image_url || item?.image || "";
      if (modalImgEl) modalImgEl.style.backgroundImage = imgUrl ? `url("${imgUrl}")` : "";
    
      if (modalTimeEl) {
        const t = fmtTimeLeft(item?.auction_ends_at);
        modalTimeEl.textContent = t ? t.toLowerCase() + "" : "—";
      }
    
      if (modalSourceEl) modalSourceEl.textContent = (item?.source ? String(item.source).toUpperCase() : "—");
      if (modalSubEl) modalSubEl.textContent = item?.category_sub || item?.category_main || "—";
      if (modalTitleEl) modalTitleEl.textContent = item?.title || "—";
      if (modalLocEl) modalLocEl.textContent = (item?.location || item?.lan_slug || "—");
      if (modalPriceEl) modalPriceEl.textContent = fmtPriceSEK(item?.price);
    
      if (modalUpdatedEl) {
        const iso = item?.updated_at || item?.last_seen_at || item?.first_seen_at || item?.created_at || null;
        const ms = iso ? Date.parse(iso) : NaN;
        if (Number.isFinite(ms)) {
          const mins = Math.max(0, Math.floor((Date.now() - ms) / 60000));
          modalUpdatedEl.textContent = mins < 1 ? "Uppdaterat nyss" : `Uppdaterat för ${mins} minuter sedan`;
        } else {
          modalUpdatedEl.textContent = "";
        }
      }
    
      if (modalAnalysisEl) {
        const txt = (item?.system_analysis || item?.analysis || "").toString().trim();
      
        // 1) visa/göm analysen
        modalAnalysisEl.style.display = txt ? "" : "none";
        modalAnalysisEl.textContent = txt || "";
      
        // 2) globals till feedback-systemet
        window.__MK_CURRENT_LISTING_ID = item?.id ? String(item.id) : "";
        window.__MK_CURRENT_TITLE = (item?.title || "").toString().trim();
        window.__MK_CURRENT_URL = (item?.url || item?.external_url || item?.source_url || "").toString().trim();
        window.__MK_CURRENT_MODEL = (item?.analysis_model || item?.model || "").toString().trim();
        window.__MK_CURRENT_ANALYSIS = txt;
      
        // 3) visa/göm feedback (sök INUTI modalen) + reset state
        const fb = modalEl.querySelector('[data-mk="analysis_feedback"]');
        if (fb) {
          fb.style.display = txt ? "" : "none";
      
          const upBtn = fb.querySelector('[data-mk="analysis_up"]');
          const downBtn = fb.querySelector('[data-mk="analysis_down"]');
          upBtn?.classList.remove("is-selected");
          downBtn?.classList.remove("is-selected");
        }

      }


    
      renderModalChips(item);
    
      currentModalUrl = item?.url || item?.external_url || "#";
      if (modalOpenEl && modalOpenEl.tagName === "A") {
        modalOpenEl.href = currentModalUrl;
        modalOpenEl.target = "_blank";
        modalOpenEl.rel = "noopener noreferrer";
      }
    
      // --- öppna smooth ---
      __mkModalClosing = false;
      modalEl.setAttribute("aria-hidden", "false");
    
      // säkerställ startläge innan vi togglar
      modalOverlay.classList.remove("is-open");
      void modalOverlay.offsetHeight;
    
      requestAnimationFrame(() => {
        modalOverlay.classList.add("is-open");
        setTimeout(() => modalCloseEl?.focus?.(), 0);
      });
    }
    
    async function closeModal() {
      if (!modalOverlay || !modalEl) return;
      if (__mkModalClosing) return;
      __mkModalClosing = true;
    
      modalOverlay.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
    
      // vänta tills själva modalen animat färdigt (transform/opacity)
      await waitForTransition(modalEl, 340);
    
      startBackgroundScroll();
      __mkModalClosing = false;
      setTimeout(() => lastActiveEl?.focus?.(), 0);
    }

    
    // bind once
    if (modalOverlay && !modalOverlay.dataset.mkBound) {
      modalOverlay.dataset.mkBound = "1";
    
      // click outside closes
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    
      // close button
      if (modalCloseEl) {
        modalCloseEl.addEventListener("click", (e) => {
          e.preventDefault();
          closeModal();
        });
      }
    
      // esc closes
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalOverlay.classList.contains("is-open")) closeModal();
      });
    
      // open listing (om inte <a>)
      if (modalOpenEl && modalOpenEl.tagName !== "A") {
        modalOpenEl.addEventListener("click", (e) => {
          e.preventDefault();
          if (currentModalUrl && currentModalUrl !== "#") window.open(currentModalUrl, "_blank", "noopener,noreferrer");
        });
      }
    
      // copy link
      if (modalCopyEl) {
        modalCopyEl.addEventListener("click", async (e) => {
          e.preventDefault();
          const href = currentModalUrl || "";
          if (!href || href === "#") return;
    
          try {
            await navigator.clipboard.writeText(href);
          } catch (err) {
            const ta = document.createElement("textarea");
            ta.value = href;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          }
        });
      }
    }
        
    // click on card -> open modal (delegation, works with pagination)
    if (grid && !grid.dataset.mkModalBound) {
      grid.dataset.mkModalBound = "1";
    
      grid.addEventListener("click", (e) => {
        const card = e.target.closest('[data-mk="card_item"]');
        if (!card) return;
    
        // allow ctrl/cmd/middle click to behave normally
        if (e.ctrlKey || e.metaKey || e.button === 1) return;
    
        // allow ctrl/cmd/middle click
        if (e.ctrlKey || e.metaKey || e.button === 1) return;
        
        // 👇 om du vill: låt bara “öppna extern länk”-ikonen funka som vanlig länk
        const a = e.target.closest("a");
        if (a && a.closest('[data-mk="card_link"]')) {
          // Stoppa navigation, vi öppnar modal istället
          e.preventDefault();
        } else if (a) {
          // annan länk inuti kortet (om du har någon)
          return;
        }
        
            
        e.preventDefault();
    
        const id = String(card.dataset.id || "");
        const item = itemById.get(id);
        openModal(item);
      });
    }



    // ---------- NO RESULTS UI ----------
    const noResultsEl =
      qs('[data-mk="no_results"]') ||
      qs("#mkNoResults") ||
      qs(".mk-no-results");

    const noResultsResetBtn =
      qs('[data-mk="no_results_reset"]', noResultsEl || document) ||
      qs('[data-mk="no_results_reset"]') ||
      qs("#mkNoResultsReset");

    function setNoResultsVisible(isVisible) {
    if (!noResultsEl) return;

    const want = !!isVisible;
    const has  = noResultsEl.classList.contains("is-visible");
    if (want === has) return;

    // force reflow när vi visar, så transition alltid triggas
    if (want) {
        noResultsEl.classList.remove("is-visible");
        void noResultsEl.offsetHeight;
        noResultsEl.classList.add("is-visible");
    } else {
        noResultsEl.classList.remove("is-visible");
    }
    }


    if (noResultsResetBtn && !noResultsResetBtn.dataset.mkBound) {
      noResultsResetBtn.dataset.mkBound = "1";
      noResultsResetBtn.addEventListener("click", (e) => {
        e.preventDefault();

        // Klicka din befintliga reset-knapp (så vi inte duplicerar logik)
        const reset = qs('[data-mk="filter_reset"]');
        if (reset) reset.click();

        // Extra safety: se till att rutan uppdateras direkt
        // (apply() kommer ändå köras via events)
        setNoResultsVisible(false);
      });
    }

    // ---------- "VISA FLER" (pagination) ----------
    const moreWrap = qs('[data-mk="cards_more_wrap"]'); // wrappern du har
    const moreBtn  = qs('[data-mk="cards_more"]');      // knappen (du sa att du satt data-mk här)

    // klickyta: använd knappen om den finns, annars wrappern
    const moreClick = moreBtn || moreWrap;

    const PAGE_SIZE = 24;  // ändra om du vill
    let page = 1;
    if (moreWrap) moreWrap.style.display = "none";

    function setMoreVisible(show) {
      if (!moreWrap) return;
      moreWrap.style.display = show ? "flex" : "none"; // eller "block" om din wrapper inte är flex
    }


    // starta gömd tills vi vet att den behövs
    setMoreVisible(false);

    function wireMoreUI() {
      if (!moreClick) return;

      if (moreClick.dataset.mkBound === "1") return;
      moreClick.dataset.mkBound = "1";

      moreClick.addEventListener("click", (e) => {
        e.preventDefault();
        page += 1;
        apply();
      });
    }




    const LAN_LABEL = {
      "blekinge": "Blekinge",
      "dalarna": "Dalarna",
      "gavleborg": "Gävleborg",
      "gotland": "Gotland",
      "halland": "Halland",
      "jamtland": "Jämtland",
      "jonkoping": "Jönköping",
      "kalmar": "Kalmar",
      "kronoberg": "Kronoberg",
      "norrbotten": "Norrbotten",
      "skane": "Skåne",
      "stockholm": "Stockholm",
      "sodermanland": "Södermanland",
      "uppsala": "Uppsala",
      "varmland": "Värmland",
      "vasterbotten": "Västerbotten",
      "vasternorrland": "Västernorrland",
      "vastmanland": "Västmanland",
      "vastragotaland": "Västra Götaland",
      "orebro": "Örebro",
      "ostergotland": "Östergötland",
    };

    function fmtPriceSEK(n) {
      const v = Number(n);
      if (!Number.isFinite(v) || v <= 0) return "—";
      return `${v.toLocaleString("sv-SE")} kr`;
    }

    function lanLabelFromItem(item) {
      const slug = norm(item?.lan_slug);
      if (slug && LAN_LABEL[slug]) return LAN_LABEL[slug];
      const loc = (item?.location ?? "").toString().trim();
      return loc || "—";
    }

    function sourceLabel(s) {
      const v = (s ?? "").toString().trim();
      return v ? v.toUpperCase() : "—";
    }

    function minutesUntil(iso) {
      if (!iso) return null;
      const t = Date.parse(iso);
      if (!Number.isFinite(t)) return null;
      return Math.floor((t - Date.now()) / 60000);
    }

    function fmtTimeLeft(iso) {
      const mins = minutesUntil(iso);
      if (mins == null) return null;
      if (mins <= 0) return "SLUT";
      if (mins < 60) return `${mins} MIN`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h < 24) return `${h}H ${m}MIN`;
      const d = Math.floor(h / 24);
      const hh = h % 24;
      return `${d}D ${hh}H`;
    }

    const MAX_CHIPS = 5;

    function renderChips(cardEl, item) {
      const wrap = qs('[data-mk="chips_wrap"]', cardEl);
      const chipTpl = qs('[data-mk="chip_tpl"]', cardEl);
      if (!wrap || !chipTpl) return;

      qsa('[data-mk="chip_item"]', wrap).forEach(n => n.remove());

      const MAX_LEN = 14;
      const chips = [];

      const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const cleanText = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
      const shorten = (s, max = MAX_LEN) => {
        const t = cleanText(s);
        if (!t) return "";
        if (t.length <= max) return t;
        return t.slice(0, max - 1) + "…";
      };
      const push = (v) => {
        const t = shorten(v);
        if (!t) return;
        if (chips.includes(t)) return;
        chips.push(t);
      };

      const year = toNum(item?.year);
      if (year && year > 0) push(String(year));

      const hours = toNum(item?.operating_hours ?? item?.hours);
      if (hours && hours > 0) push(`${fmtInt(hours)} h`);

      const kg = toNum(item?.weight_kg);
      if (kg && kg > 0) push(`${fmtInt(kg)} kg`);

      const kw = toNum(item?.engine_power_kw);
      if (kw && kw > 0) {
        const kwTxt = Number.isInteger(kw)
          ? fmtInt(kw)
          : kw.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
        push(`${kwTxt} kW`);
      }

      const fuel = cleanText(item?.fuel);
      if (fuel && fuel !== "0") push(fuel.toUpperCase());

      const drive = cleanText(item?.drive);
      if (drive && drive !== "0") push(drive);

      const specs = item?.specs && typeof item.specs === "object" ? item.specs : null;
      if (specs && chips.length < MAX_CHIPS) {
        const SPEC_KEYS = [
          "rototilt", "tiltrotator",
          "snabbfaste", "snabbfäste",
          "hydraulik",
          "bredd", "skopbredd",
          "skopa", "skopor",
        ];

        for (const k of SPEC_KEYS) {
          if (chips.length >= MAX_CHIPS) break;
          const v = specs[k];
          if (v == null) continue;

          if (v === true) { push(k.replace(/_/g, " ")); continue; }

          const n = toNum(v);
          if (n !== null && n <= 0) continue;

          const txt = cleanText(v);
          if (!txt || txt === "0") continue;

          push(txt);
        }
      }

      const candidates = chips.slice(0, MAX_CHIPS);

      let firstTop = null;
      for (const text of candidates) {
        const chip = chipTpl.cloneNode(true);
        chip.classList.remove("is-template");
        chip.removeAttribute("style");
        chip.style.display = "";
        chip.setAttribute("data-mk", "chip_item");

        const textEl = qs('[data-mk="chip_text"]', chip) || chip;
        textEl.textContent = text;

        wrap.appendChild(chip);

        const top = chip.offsetTop;
        if (firstTop == null) firstTop = top;

        if (top > firstTop + 1) {
          chip.remove();
          break;
        }
      }

      chipTpl.style.display = "none";
    }

    let all = []; // { item, el }

    function fillCard(el, item) {
      el.dataset.id = item?.id ?? "";
      el.dataset.source = norm(item?.source);
      el.dataset.lan = norm(item?.lan_slug);
      el.dataset.brand = norm(item?.brand);
      el.dataset.sub = slugifySv(item?.category_sub);

      const linkEl = qs('[data-mk="card_link"]', el) || el.closest("a");
      const url = item?.url || item?.external_url || "#";
      if (linkEl && linkEl.tagName === "A") {
        linkEl.href = url;
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";
      }

      const imgDiv = qs('[data-mk="card_image"]', el);
      const imgUrl = item?.imageUrl || item?.image_url || item?.image || "";
      if (imgDiv) imgDiv.style.backgroundImage = imgUrl ? `url("${imgUrl}")` : "";

      const titleEl = qs('[data-mk="title"]', el);
      if (titleEl) titleEl.textContent = item?.title || "—";

      const priceEl = qs('[data-mk="price"]', el) || qs('[data-mk="pickBPrice"]', el);
      if (priceEl) priceEl.textContent = fmtPriceSEK(item?.price);

      const yearEl = qs('[data-mk="year"]', el);
      if (yearEl) yearEl.textContent = Number.isFinite(+item?.year) ? String(item.year) : "—";

      const lanEl = qs('[data-mk="lan"]', el);
      if (lanEl) lanEl.textContent = lanLabelFromItem(item);

      const sourceText = qs('[data-mk="source_text"]', el) || qs('[data-mk="source"]', el);
      if (sourceText) sourceText.textContent = sourceLabel(item?.source);

      const t = fmtTimeLeft(item?.auction_ends_at);
      const timeWrap = qs('[data-mk="timeleft_badge"]', el);
      const timeText = qs('[data-mk="timeleft_text"]', el) || qs('[data-mk="timeleft"]', el);
      if (!t) {
        if (timeWrap) timeWrap.style.display = "none";
        if (timeText) timeText.textContent = "";
      } else {
        if (timeWrap) timeWrap.style.display = "";
        if (timeText) timeText.textContent = t;
      }

      renderChips(el, item);
    }

    function buildAll(items) {
      qsa('[data-mk="card_item"]', grid).forEach(n => n.remove());
      all = [];

      const frag = document.createDocumentFragment();

      for (const item of items) {
        itemById.set(String(item?.id ?? ""), item);

        const el = tpl.cloneNode(true);
        el.classList.remove("is-template");
        el.removeAttribute("style");
        el.style.display = "";
        el.setAttribute("data-mk", "card_item");

        fillCard(el, item);
        frag.appendChild(el);
        all.push({ item, el });
      }

      tpl.style.display = "none";
      grid.appendChild(frag);
      log("built cards:", all.length);
    }

    function withinRange(v, min, max) {
      const n = Number(v);
      if (!Number.isFinite(n)) return false;
      if (min != null && n < min) return false;
      if (max != null && n > max) return false;
      return true;
    }

    let currentFilters = {
      source: [], lan: [], brand: [],
      priceMin: null, priceMax: null,
      yearMin: null, yearMax: null,
      hoursMin: null, hoursMax: null,
      endsIn: null,
      q: ""
    };

    let currentSort = "ends_soon";
    let currentSubcat = null;

    function matchesFilters(item, f) {
      if (f.source?.length) {
        const s = norm(item?.source);
        if (!f.source.includes(s)) return false;
      }
      if (f.lan?.length) {
        const l = norm(item?.lan_slug);
        if (!f.lan.includes(l)) return false;
      }
      if (f.brand?.length) {
        const b = norm(item?.brand);
        if (!f.brand.includes(b)) return false;
      }

      if (f.priceMin != null || f.priceMax != null) {
        if (!withinRange(item?.price, f.priceMin, f.priceMax)) return false;
      }
      if (f.yearMin != null || f.yearMax != null) {
        if (!withinRange(item?.year, f.yearMin, f.yearMax)) return false;
      }
      if (f.hoursMin != null || f.hoursMax != null) {
        const h = item?.operating_hours ?? item?.hours;
        if (!withinRange(h, f.hoursMin, f.hoursMax)) return false;
      }

      if (f.endsIn != null) {
        const t = Date.parse(item?.auction_ends_at);
        if (!Number.isFinite(t)) return false;
        const mins = Math.floor((t - Date.now()) / 60000);
        if (mins <= 0 || mins > f.endsIn) return false;
      }

      if (currentSubcat) {
        const sub = slugifySv(item?.category_sub);
        if (sub !== currentSubcat) return false;
      }

      // ✅ Search (multi-word): alla ord måste matcha
      const q = (f.q ?? "").toString().trim().toLowerCase();
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        if (tokens.length) {
          const hay = [
            item?.title,
            item?.brand,
            item?.model,
            item?.location,
            item?.lan_slug,
            item?.category_sub,
            item?.category_main
          ]
            .filter(Boolean)
            .map(v => String(v).toLowerCase())
            .join(" | ");

          for (const t of tokens) {
            if (!hay.includes(t)) return false;
          }
        }
      }

      return true;
    }

    function sortFn(kind) {
      const k = kind || "ends_soon";
      if (k === "price_asc")  return (a,b) => (Number(a.item.price)||0) - (Number(b.item.price)||0);
      if (k === "price_desc") return (a,b) => (Number(b.item.price)||0) - (Number(a.item.price)||0);
      if (k === "year_desc")  return (a,b) => (Number(b.item.year)||0) - (Number(a.item.year)||0);
      if (k === "year_asc")   return (a,b) => (Number(a.item.year)||0) - (Number(b.item.year)||0);
      if (k === "hours_asc")  return (a,b) => (Number(a.item.operating_hours ?? a.item.hours)||0) - (Number(b.item.operating_hours ?? b.item.hours)||0);
      if (k === "hours_desc") return (a,b) => (Number(b.item.operating_hours ?? b.item.hours)||0) - (Number(a.item.operating_hours ?? a.item.hours)||0);

      return (a,b) => {
        const am = (() => { const t = Date.parse(a.item.auction_ends_at); return Number.isFinite(t) ? Math.floor((t - Date.now())/60000) : null; })();
        const bm = (() => { const t = Date.parse(b.item.auction_ends_at); return Number.isFinite(t) ? Math.floor((t - Date.now())/60000) : null; })();
        if (am == null && bm == null) return 0;
        if (am == null) return 1;
        if (bm == null) return -1;
        return am - bm;
      };
    }

    function apply() {
      // ✅ liten “pop/fade” på hela grid:en varje apply
      grid.classList.remove("mk-grid-anim");
      void grid.offsetWidth;
      grid.classList.add("mk-grid-anim");

      const visible = [];

      for (const c of all) {
        const ok = matchesFilters(c.item, currentFilters);

        // tracka tidigare synlighet (för anim in)
        const wasVisible = c.el.dataset.mkVis === "1";

        c.el.dataset.mkMatch = ok ? "1" : "0"; // matchar filter (oavsett pagination)

        if (ok) {
          visible.push(c);

          // animera in när den blir synlig
          if (!wasVisible) {
            c.el.classList.remove("mk-card-anim");
            void c.el.offsetWidth;
            c.el.classList.add("mk-card-anim");
          }
        }

        c.el.dataset.mkVis = ok ? "1" : "0";
      }

      // sortera hela resultatmängden först
      visible.sort(sortFn(currentSort));

      // ✅ pagination
      const total = visible.length;
      const limit = page * PAGE_SIZE;
      const pageItems = visible.slice(0, limit);

      // först: göm alla
      for (const c of all) c.el.style.display = "none";

      // sen: visa bara pageItems, i rätt ordning
      const frag = document.createDocumentFragment();
      for (const c of pageItems) {
        c.el.style.display = "";
        frag.appendChild(c.el);
      }
      grid.appendChild(frag);

      requestAnimationFrame(() => {
        if (window.lenis?.resize) window.lenis.resize();
        else window.dispatchEvent(new Event("resize"));
      });

      // ✅ träffar ska visa totalen (inte bara sidan)
      setHitsUI(total);

      // ✅ facet-counts baserat på ALLA matchande (inte bara sidan)
      window.__MK_FILTER_UI?.updateCountsFromItems?.(visible.map(v => v.item));

      // ✅ No results
      setNoResultsVisible(total === 0);

      // ✅ Visa/Dölj “Visa fler”
      setMoreVisible(total > pageItems.length);

      log("apply -> total:", total, "showing:", pageItems.length, "page:", page);
    }



    function openFromUrlOnce() {
      const u = new URL(location.href);
      const openId = u.searchParams.get("open");
      if (!openId) return;
    
      const item = itemById.get(String(openId));
      if (!item) return;
    
      requestAnimationFrame(() => openModal(item));
    
      // ta bort param så refresh/back inte öppnar igen
      u.searchParams.delete("open");
      history.replaceState({}, "", u.toString());
    }
    






    function wireSortUI() {
      const sel = qs('[data-mk="sort_select"]');
      if (!sel) return;

      if (sel.dataset.mkBound === "1") return;
      sel.dataset.mkBound = "1";

      sel.addEventListener("change", () => {
        currentSort = sel.value || "ends_soon";
        page = 1; 
        apply();
      });
    }

    const boot = await window.__MK_SEARCH_BOOT;
    const snap = boot?.snapshot || {};
    const items = Array.isArray(snap?.items) ? snap.items : (snap.items || snap.listings || snap.rows || []);

    buildAll(items);
    wireSortUI();
    wireMoreUI()

    if (boot?.subSlug) currentSubcat = slugifySv(boot.subSlug);

    apply();
    openFromUrlOnce(); // ✅ Öppnar modal om ?open=ID finns

    window.addEventListener("mk:filters-changed", (e) => {
      const d = e?.detail || {};
      currentFilters = {
        source: (d.source || []).map(norm),
        lan:    (d.lan || []).map(norm),
        brand:  (d.brand || []).map(norm),
        priceMin: d.priceMin ?? null,
        priceMax: d.priceMax ?? null,
        yearMin:  d.yearMin  ?? null,
        yearMax:  d.yearMax  ?? null,
        hoursMin: d.hoursMin ?? null,
        hoursMax: d.hoursMax ?? null,
        endsIn:   d.endsIn   ?? null,
        q:        (d.q || "")
      };
      page = 1;
      apply();
    });

    window.addEventListener("mk:subcat-changed", (e) => {
      const sub = e?.detail?.sub ?? null;
      currentSubcat = sub ? slugifySv(sub) : null;
      page = 1;
      apply();
    });

    window.__MK_CARDS = {
      apply,
      setSort: (v)=>{ currentSort=v; apply(); },
      setSub:  (v)=>{ currentSubcat=v ? slugifySv(v) : null; apply(); }
    };

    log("ready", { items: items.length });
  }

  // ---------- SUBCAT DROPDOWN ----------
  async function initSubcatDropdown(subLabelBySlug) {
    const log = (...a) => console.log("[MK-SUBCAT]", ...a);

    const TOP_SUB_PAGES = {
      // "grävmaskiner": "/category/entreprenad/gravmaskiner",
      // "hjullastare": "/category/entreprenad/hjullastare",
    };
    const topMap = new Map(Object.entries(TOP_SUB_PAGES).map(([k,v]) => [slugifySv(k), v]));

    const DEFAULT_LIMIT = 10;

    const titleCaseSvKeepChars = (s) => {
      const t = (s ?? "").toString().replace(/\s+/g, " ").trim();
      if (!t) return "";
      return t
        .toLowerCase()
        .split(/[\s\-_/]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    };

    function preventEnterSubmit(inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") e.preventDefault();
      });
      const form = inputEl.closest("form");
      if (form && form.dataset.mkNoSubmit !== "1") {
        form.dataset.mkNoSubmit = "1";
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        });
      }
    }

    function setListHeightToContent(listEl) {
      if (!listEl) return;
      const current = Math.round(listEl.getBoundingClientRect().height);
      listEl.style.height = "auto";
      const target = Math.round(listEl.scrollHeight);
      listEl.style.height = `${current}px`;
      void listEl.offsetHeight;
      listEl.style.height = `${target}px`;
    }

    function makeRowFromTpl(tpl, { label, count, mode, value, selected, href }) {
      const node = tpl.cloneNode(true);
      node.classList.remove("is-template");
      node.removeAttribute("style");
      node.style.display = "";
      node.setAttribute("data-mk", "subcat_item");

      node.dataset.mode = mode || "";
      node.dataset.value = value || "";
      node.dataset.selected = selected ? "1" : "0";

      node.setAttribute("href", href || "#");

      const labelEl = qs('[data-mk="subcat_item_label"]', node);
      const countEl = qs('[data-mk="subcat_item_count"]', node);
      if (labelEl) labelEl.textContent = label;
      if (countEl) countEl.textContent = String(count ?? "");

      return node;
    }

    const boot = await window.__MK_CAT_BOOT;
    const items = Array.isArray(boot?.snapshot?.items) ? boot.snapshot.items : [];

    const listWrap = qs('[data-mk="subcat_dynamic_list"]');
    const tpl      = qs('[data-mk="subcat_item_tpl"]', listWrap || document);
    const searchEl = qs('[data-mk="subcat_search"]');
    const moreBtn  = qs('[data-mk="subcat_more"]');
    const overlay  = qs('[data-mk="subcat_overlay"]');

    if (!listWrap || !tpl) {
      console.warn("[MK-SUBCAT] missing list/template");
      return;
    }

    if (searchEl) preventEnterSubmit(searchEl);

    const totalInMain = boot?.snapshot?.stats?.total ?? items.length;

    const counts = new Map();
    for (const it of items) {
      const sub = slugifySv(it?.category_sub);
      if (!sub) continue;
      counts.set(sub, (counts.get(sub) || 0) + 1);
    }

    const allRows = [...counts.entries()]
      .map(([k,n]) => ({ k, n, raw: subLabelBySlug.get(k) || prettyFromSlug(k) || k }))
      .sort((a,b) => b.n - a.n);

    const ui = { expanded: false, q: "", selected: null };
    if (boot?.subSlug) ui.selected = slugifySv(boot.subSlug);

    function setMoreBtn() {
      if (!moreBtn) return;

      const total = allRows.length;
      const showing = ui.expanded ? total : Math.min(DEFAULT_LIMIT, total);

      if (ui.q) {
        moreBtn.style.display = "none";
        return;
      }

      moreBtn.style.display = "";
      moreBtn.textContent = ui.expanded
        ? "VISA FÄRRE"
        : `VISA MER (${Math.max(0, total - showing)})`;
    }

    function dispatchSelected() {
      window.dispatchEvent(new CustomEvent("mk:subcat-changed", {
        detail: { sub: ui.selected ? ui.selected : null }
      }));
    }

    function render() {
      qsa('[data-mk="subcat_item"]', listWrap).forEach(n => n.remove());

      const q = norm(ui.q);
      let rows = allRows;

      if (q) rows = rows.filter(r => norm(String(r.raw)).includes(q) || norm(String(r.k)).includes(q));
      if (!q && !ui.expanded) rows = rows.slice(0, DEFAULT_LIMIT);

      const frag = document.createDocumentFragment();

      const allNode = makeRowFromTpl(tpl, {
        label: "Alla",
        count: totalInMain,
        mode: "all",
        value: "__all__",
        selected: !ui.selected,
        href: "#"
      });

      allNode.addEventListener("click", (e) => {
        e.preventDefault();
        ui.selected = null;
        dispatchSelected();
        render();
        if (overlay) overlay.click();
      });

      frag.appendChild(allNode);

      for (const r of rows) {
        const keySlug = r.k;
        const navUrl = topMap.get(keySlug);

        const node = makeRowFromTpl(tpl, {
          label: titleCaseSvKeepChars(String(r.raw)),
          count: r.n,
          mode: navUrl ? "nav" : "filter",
          value: keySlug,
          selected: ui.selected === keySlug,
          href: navUrl ? navUrl : "#"
        });

        if (!navUrl) {
          node.addEventListener("click", (e) => {
            e.preventDefault();
            ui.selected = (ui.selected === keySlug) ? null : keySlug;
            dispatchSelected();
            render();
            if (overlay) overlay.click();
          });
        } else {
          node.addEventListener("click", () => {
            if (overlay) overlay.click();
          });
        }

        frag.appendChild(node);
      }

      tpl.style.display = "none";
      listWrap.appendChild(frag);

      setMoreBtn();
      setListHeightToContent(listWrap);
    }

    if (searchEl && searchEl.dataset.mkBound !== "1") {
      searchEl.dataset.mkBound = "1";
      searchEl.addEventListener("input", () => {
        ui.q = searchEl.value || "";
        render();
      });
    }

    if (moreBtn && moreBtn.dataset.mkBound !== "1") {
      moreBtn.dataset.mkBound = "1";
      moreBtn.addEventListener("click", (e) => {
        e.preventDefault();
        ui.expanded = !ui.expanded;
        render();
      });
    }

    render();
    if (ui.selected) dispatchSelected();

    window.__MK_SUBCAT = {
      set: (v) => { ui.selected = v ? slugifySv(v) : null; dispatchSelected(); render(); },
      clear: () => { ui.selected = null; dispatchSelected(); render(); }
    };

    log("ready", { total: allRows.length, totalInMain, selected: ui.selected });
  }

  // ---------- BREADCRUMBS ----------
  async function initBreadcrumbs(subLabelBySlug) {
    if (document.readyState === "loading") {
      await new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true }));
    }

    const clean = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();

    const elHome = qs('[data-mk="bc_home"]');
    const elMain = qs('[data-mk="bc_main"]');
    const elSub  = qs('[data-mk="bc_sub"]');
    const sep2   = qs('[data-mk="bc_sep2"]');

    if (!elHome || !elMain) {
      console.warn("[MK-BC] Missing bc_home/bc_main data-mk elements");
      return;
    }

    let boot;
    try {
      boot = await window.__MK_CAT_BOOT;
    } catch (e) {
      console.warn("[MK-BC] __MK_CAT_BOOT missing/failed", e);
      return;
    }

    const mainName = clean(boot?.mainName) || "Kategori";
    const mainSlug = clean(boot?.mainSlug) || "";
    const subSlugFromUrl = clean(boot?.subSlug) || "";

    elMain.textContent = mainName;
    elMain.setAttribute("href", mainSlug ? `/${mainSlug}` : "#");

    function setSubCrumb(label) {
      const t = clean(label);
      const hide = !t || t.toLowerCase() === "alla";

      if (elSub) {
        elSub.textContent = t || "";
        elSub.setAttribute("href", "#");
        elSub.dataset.hidden = hide ? "1" : "0";
      }
      if (sep2) sep2.dataset.hidden = hide ? "1" : "0";
    }

    if (subSlugFromUrl) {
      const key = slugifySv(subSlugFromUrl);
      const label = subLabelBySlug.get(key) || prettyFromSlug(subSlugFromUrl);
      setSubCrumb(label);
    } else {
      setSubCrumb("Alla");
    }

    document.documentElement.classList.add("mk-bc-ready");

    window.addEventListener("mk:subcat-changed", (e) => {
      const raw = e?.detail?.sub;
      if (raw == null) { setSubCrumb("Alla"); return; }
      const key = slugifySv(raw);
      const label = subLabelBySlug.get(key) || prettyFromSlug(raw) || "Alla";
      setSubCrumb(label);
    });

    console.log("[MK-BC] ready", { main: mainName, urlSub: subSlugFromUrl, mapSize: subLabelBySlug.size });
  }

  // ---------- RUN ORDER (SEARCH) ----------
  (async () => {
    try {
      if (document.readyState === "loading") {
        await new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true }));
      }
  
      // ✅ Sätt snygg titel för söksidan
      const boot = await window.__MK_SEARCH_BOOT;
      const q = (boot?.q || "").trim();
  
      const h1 = qs('[data-mk="cat_title"]') || qs("h1");
      if (h1) h1.textContent = q ? `Sökresultat för “${q}”` : "Sök";
  
      // ❌ Ingen subcat/breadcrumbs på söksidan
      // const subLabelBySlug = await buildSubLabelLookup();
      // await initCatUI(subLabelBySlug);
      // await initSubcatDropdown(subLabelBySlug);
      // await initBreadcrumbs(subLabelBySlug);
  
      await initFilters();
      window.__MK_FADE?.readyOne?.(".mk-filter-panel[data-mk-fade]");
  
      await initCards();
      window.__MK_FADE?.readyOne?.('[data-mk="cards_grid"][data-mk-fade]');
  
      // (valfritt) hits-fade om du har den på sidan
      window.__MK_FADE?.readyOne?.('[data-mk="hits"][data-mk-fade]');
  
      console.log("[MK-SEARCH] all modules ready");
    } catch (e) {
      console.error("[MK-SEARCH] failed:", e);
    }
  })();

})();










