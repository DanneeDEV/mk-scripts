(() => {
  const SNAPSHOT_URL =
    "https://rjndhhdwmmonsrniunhc.supabase.co/storage/v1/object/public/snapshots/search/search-index.v1.json";

  const MAX_RESULTS = 5;
  const MIN_CHARS = 2;
  const DEBOUNCE_MS = 90;
  const SEARCH_PAGE_URL = "/search";

  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];

  const isBad = (v) => v == null || String(v).trim() === "" || String(v).trim() === "—";
  const fmtPrice = (p) => {
    const n = Number(p);
    return Number.isFinite(n) && n > 0 ? `${n.toLocaleString("sv-SE")} kr` : "—";
  };

  const fold = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
      .replace(/[^a-z0-9\s\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  function debounce(fn, ms){
    let t=null;
    return (...args) => { clearTimeout(t); t=setTimeout(() => fn(...args), ms); };
  }

  function setText(el, v){ if (el) el.textContent = isBad(v) ? "—" : String(v); }
  function setBg(el, url){
    if (!el) return;
    if (!url) { el.style.backgroundImage=""; return; }
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";
  }

  // --- Height calc helpers ---
  function px(n){ return `${Math.max(0, Math.round(n))}px`; }

  function getPadY(el){
    const cs = getComputedStyle(el);
    return (parseFloat(cs.paddingTop)||0) + (parseFloat(cs.paddingBottom)||0);
  }

  function getListVisibleHeight(list){
    // Om du har max-height på listan -> använd det som cap
    const cs = getComputedStyle(list);
    const mh = parseFloat(cs.maxHeight);
    const cap = Number.isFinite(mh) ? mh : Infinity;
    return Math.min(list.scrollHeight, cap);
  }

  function setPanelHeight(panel, list, footer, open){
    if (!panel) return;

    // Döda Webflow inline “height: 1px” osv
    panel.style.removeProperty("max-height"); // vi använder inte den längre
    panel.style.removeProperty("min-height");

    if (!open){
      panel.setAttribute("data-open","0");
      panel.style.height = "0px";
      return;
    }

    // Mät efter DOM har renderats
    const padY = getPadY(panel);
    const listH = list ? getListVisibleHeight(list) : 0;
    const footerH = footer ? footer.offsetHeight : 0;

    const target = padY + listH + footerH + 6; // liten buffert
    panel.setAttribute("data-open","1");
    panel.style.height = px(target);
  }

  // =========================
  // LOAD SNAPSHOT (session cache)
  // =========================
  const SS_KEY="mk_search_index_v1";
  const SS_TS="mk_search_index_v1_ts";
  const SS_TTL=8*60*1000;

  async function loadIndex(){
    try{
      const cached=sessionStorage.getItem(SS_KEY);
      const ts=Number(sessionStorage.getItem(SS_TS)||"0");
      if (cached && Date.now()-ts < SS_TTL){
        const parsed=JSON.parse(cached);
        return parsed?.items || [];
      }
    } catch(_){}

    const res = await fetch(SNAPSHOT_URL, { cache:"force-cache" });
    if (!res.ok) throw new Error(`search snapshot HTTP ${res.status}`);
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    try{
      sessionStorage.setItem(SS_KEY, JSON.stringify({items}));
      sessionStorage.setItem(SS_TS, String(Date.now()));
    } catch(_){}

    return items;
  }

  // =========================
  // SEARCH + RANK
  // =========================
  function scoreItem(q, it){
    const t = fold(it.title);
    const b = fold(it.brand);
    const m = fold(it.model);
    const loc = fold(it.location);
    const cm = fold(it.category_main);
    const cs = fold(it.category_sub);

    let s=0;
    if (t.startsWith(q)) s+=80;
    if (t.includes(q)) s+=60;

    const bm=(b+" "+m).trim();
    if (bm.startsWith(q)) s+=40;
    if (bm.includes(q)) s+=30;

    if (loc.includes(q)) s+=15;
    if (cs.includes(q)) s+=12;
    if (cm.includes(q)) s+=8;

    return s;
  }

  function topMatches(items, query){
    const q=fold(query);
    if (q.length < MIN_CHARS) return [];

    const scored=[];
    for (const it of items){
      if (!it || !it.id) continue;
      const sc=scoreItem(q,it);
      if (sc>0) scored.push({it, sc});
    }
    scored.sort((a,b) => b.sc - a.sc);
    return scored.slice(0, MAX_RESULTS).map(x => x.it);
  }

  // =========================
  // RENDER
  // =========================
  function clearList(list, tpl){
    if (!list) return;
    qsa('[data-mk="search_item"]', list).forEach(n => n.remove());
    if (tpl) tpl.style.display="none";
  }

  function render(list, tpl, items){
    clearList(list, tpl);
    if (!list || !tpl) return;

    for (const it of items){
      const node = tpl.cloneNode(true);
      node.style.display="";
      node.classList.remove("is-template");
      node.setAttribute("data-mk","search_item");
      node.setAttribute("data-id", String(it.id));

      setBg(qs('[data-mk="search_img"]', node), it.imageUrl);
      setText(qs('[data-mk="search_title"]', node), it.title);
      setText(qs('[data-mk="search_location"]', node), it.location);
      setText(qs('[data-mk="search_price"]', node), fmtPrice(it.price));
      setText(qs('[data-mk="search_source"]', node), String(it.source||"").toUpperCase() || "—");

      list.appendChild(node);
    }
  }

  function goToSearch(query, openId=null){
    const u = new URL(SEARCH_PAGE_URL, location.origin);
    if (query) u.searchParams.set("q", query);
    if (openId) u.searchParams.set("open", String(openId));
    location.href = u.toString();
  }

  // =========================
  // INIT
  // =========================
  async function init(){
    const input = qs('[data-mk="search_input"]');
    const panel = qs('[data-mk="search_panel"]');
    const list  = qs('[data-mk="search_list"]');
    const tpl   = qs('[data-mk="search_item_tpl"]');
    const footer= qs('[data-mk="search_show_all"]');
    const footerLbl = qs('[data-mk="search_show_all_label"]');

    if (!input || !panel || !list || !tpl){
      console.warn("[MK search] saknar data-mk hooks (input/panel/list/tpl)");
      return;
    }

    tpl.style.display="none";

    // Start closed (height=0)
    panel.style.transition = panel.style.transition || ""; // rör inte din styling
    setPanelHeight(panel, list, footer, false);

    const allItems = await loadIndex();
    window.__MK_SEARCH_INDEX = allItems;

    const updateFooter = (q) => {
      if (!footerLbl) return;
      footerLbl.textContent = q ? `Visa alla resultat för '${q}'` : `Visa alla resultat`;
    };

    const run = debounce((raw) => {
      const q = String(raw||"").trim();
      updateFooter(q);

      if (q.length < MIN_CHARS){
        clearList(list, tpl);
        setPanelHeight(panel, list, footer, false);
        return;
      }

      const hits = topMatches(allItems, q);
      render(list, tpl, hits);

      // öppna efter render → mät → sätt height
      requestAnimationFrame(() => setPanelHeight(panel, list, footer, true));
    }, DEBOUNCE_MS);

    input.addEventListener("input", (e) => run(e.target.value));

    input.addEventListener("focus", () => {
      const q = String(input.value||"").trim();
      updateFooter(q);
      if (q.length >= MIN_CHARS){
        requestAnimationFrame(() => setPanelHeight(panel, list, footer, true));
      }
    });

    document.addEventListener("click", (e) => {
      const row = e.target.closest('[data-mk="search_item"][data-id]');
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      const id = row.getAttribute("data-id");
      const q = String(input.value||"").trim();
      goToSearch(q, id);
    });

    if (footer){
      footer.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const q = String(input.value||"").trim();
        goToSearch(q, null);
      });
    }

    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-mk="search_panel"]')) return;
      if (e.target.closest('[data-mk="search_input"]')) return;
      setPanelHeight(panel, list, footer, false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setPanelHeight(panel, list, footer, false);
    });

    // Recalc vid resize (så inte height blir fel)
    window.addEventListener("resize", debounce(() => {
      if (panel.getAttribute("data-open") === "1"){
        setPanelHeight(panel, list, footer, true);
      }
    }, 120));
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
