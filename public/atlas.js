const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const API_BASE = /(^|\.)champagneatlas\.nl$/i.test(location.hostname) && location.hostname !== "api.champagneatlas.nl" ? "https://api.champagneatlas.nl" : "";
const initialLocale = new URLSearchParams(location.search).get("lang") === "en" || (!new URLSearchParams(location.search).has("lang") && document.cookie.split("; ").includes("atlas_language=en")) ? "en" : "nl";
const state = { houses: [], regions: [], places: [], events: [], tours: [], saved: new Set(), visits: new Set(), trips: [], journal: [], profile: null, account: null, entitlement: null, csrfToken: "", houseLimit: 9, mapFilter: "all", mapRegion: "", exploreTab: "events", locale: initialLocale };
const mapView = { zoom: 1, minZoom: 1, maxZoom: 4, panX: 0, panY: 0, dragging: false, pointerId: null, startX: 0, startY: 0, startPanX: 0, startPanY: 0 };
const en = {"Kaart":"Map","Regio’s":"Regions","Huizen":"Houses","Reizen":"Trips","Mijn Atlas":"My Atlas","Inloggen":"Sign in","Het huis":"The house","Oprichting":"Founded","Plaats":"Location","Eigenaar":"Owner","Classificatie":"Classification","Prestige-cuvée":"Prestige cuvée","Huisinformatie":"House information","De mensen achter de maison":"The people behind the maison","Oprichter":"Founder","Directeur Maison":"Maison director","Chef de Cave":"Cellar master","Karakter en erfgoed":"Character and heritage","Geschiedenis":"History","Wijnstijl":"Wine style","Druiven":"Grapes","Bezoekersinfo":"Visitor information","Onder de Champagne":"Beneath Champagne","Kelders":"Cellars","De kelders":"The cellars","Ligging kelders":"Cellar location","Plan je bezoek":"Plan your visit","Bezoekersinformatie":"Visitor information","Bezoek mogelijk":"Visits available","Bezoek nog niet bevestigd":"Visits not yet confirmed","Proeverijen beschikbaar":"Tastings available","Collectie":"Collection","Prestige-cuvées":"Prestige cuvées","Verder verkennen":"Explore further","Website van het huis ↗":"House website ↗","Reserveer een bezoek ↗":"Book a visit ↗","Route via Google Maps ↗":"Directions via Google Maps ↗","Voor thuis":"For home","Verkrijgbaar bij Muselet.nl":"Available at Muselet.nl","Champagnes en accessoires voor thuis. Flessen worden altijd eerst getoond.":"Champagnes and accessories for home. Bottles are always shown first.","♡ Bewaar in Mijn Atlas":"♡ Save to My Atlas","✓ Bewaard in Mijn Atlas":"✓ Saved to My Atlas","Markeer als bezocht":"Mark as visited","✓ Huis bezocht":"✓ House visited","+ Voeg toe aan reis":"+ Add to trip"};
const tr = (value) => state.locale === "en" ? (en[value] || value) : value;
const tasteQuestions = [
  ["tasteDirection", "Welke smaak spreekt je het meeste aan?", ["Fris en citrusachtig", "Zacht en fruitig", "Rijk en romig", "Droog en mineraal", "Krachtig en kruidig", "Dat weet ik nog niet"], 2],
  ["dryness", "Hoe droog drink je champagne graag?", ["Zeer droog - Brut Nature", "Droog - Extra Brut", "Klassiek droog - Brut", "Iets zachter - Extra Dry", "Liever wat zoeter", "Geen voorkeur"], 1],
  ["aromas", "Welke aroma's vind je aantrekkelijk?", ["Citroen en grapefruit", "Appel en peer", "Perzik en abrikoos", "Aardbei en rood fruit", "Brioche en toast", "Noten en karamel", "Bloemen en kruiden", "Krijt en mineralen"], 3],
  ["mouthfeel", "Wat voor mondgevoel zoek je?", ["Licht en levendig", "Fijn en elegant", "Rond en romig", "Vol en krachtig", "Verschillend per moment"], 1],
  ["champagneStyle", "Welke champagnestijl trekt je aan?", ["Blanc de Blancs", "Blanc de Noirs", "Rosé", "Klassieke assemblage", "Vintage", "Ik wil dit ontdekken"], 6],
  ["occasion", "Wanneer drink je meestal champagne?", ["Als aperitief", "Bij een diner", "Bij een feestelijk moment", "Tijdens een proeverij", "Om rustig van te genieten", "Ik zoek graag foodpairings"], 6],
  ["budget", "Wat wil je ongeveer uitgeven?", ["Tot €35", "€35-€55", "€55-€85", "€85-€150", "Meer dan €150", "Prijs is niet het belangrijkste"], 1],
  ["avoid", "Zijn er smaken die je juist niet lekker vindt?", ["Erg zuur", "Erg droog", "Erg zoet", "Bitter", "Veel hout", "Sterke gist- of toasttonen", "Geen uitgesproken afkeer"], 7]
];
const api = async (path, options = {}) => {
  const method = String(options.method || "GET").toUpperCase();
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(!["GET", "HEAD"].includes(method) && state.csrfToken ? { "X-CSRF-Token": state.csrfToken } : {}), ...(options.headers || {}) }, ...options });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw Object.assign(new Error(error?.error?.message || error?.error || `HTTP ${response.status}`), { status: response.status, code: error?.error?.code }); }
  return response.status === 204 ? null : response.json();
};
const node = (tag, attrs = {}, children = []) => {
  const element = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null) return;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2).toLowerCase(), value);
    else element.setAttribute(key, String(value));
  });
  (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => element.append(child.nodeType ? child : document.createTextNode(String(child))));
  return element;
};
const safeUrl = (value) => { try { const url = new URL(value, location.origin); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
const clip = (value, length = 145) => String(value || "").trim().replace(/\s+/g, " ").slice(0, length);
const slugText = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const formatDate = (value) => value ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : "Datum volgt";
const formatPrice = (value, currency = "EUR") => Number.isFinite(Number(value)) ? new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(value) : "Prijs bekijken";
const initials = (name) => String(name || "CA").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
let toastTimer;
function toast(message) { const element = $("#toast"); element.textContent = message; element.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove("show"), 3300); }
function showEmpty(target, message) { target.replaceChildren(node("div", { class: "empty-state", text: message })); }

async function boot() {
  recordWebsiteVisit();
  applyLanguage();
  $("#year").textContent = new Date().getFullYear();
  bindNavigation(); bindSearch(); bindFilters(); bindDialogs(); bindMapViewport();
  const results = await Promise.allSettled([
    api(`/api/v1/producers?locale=${state.locale}`), api(`/api/v1/regions?locale=${state.locale}`), api(`/api/v1/places?locale=${state.locale}`),
    api(`/api/v1/explore/events?limit=9&locale=${state.locale}`), api(`/api/v1/explore/experiences?limit=9&locale=${state.locale}`)
  ]);
  state.houses = results[0].status === "fulfilled" ? results[0].value.producers || [] : [];
  state.regions = results[1].status === "fulfilled" ? results[1].value.regions || [] : [];
  state.places = results[2].status === "fulfilled" ? results[2].value.places || [] : [];
  state.events = results[3].status === "fulfilled" ? results[3].value.items || [] : [];
  state.tours = results[4].status === "fulfilled" ? results[4].value.items || [] : [];
  updateStats(); populateRegions(); renderRegions(); renderHouses(); renderMap(); renderExplore();
  await loadAccount(false);
  const requestedHouse = new URLSearchParams(location.search).get("huis");
  if (requestedHouse) state.houses.find((item) => item.id === requestedHouse) && openHouse(requestedHouse, false);
}

function recordWebsiteVisit() {
  const payload = JSON.stringify({ path: `${location.pathname}${location.hash || ""}`, referrer: document.referrer || "", language: navigator.language || "" });
  fetch(`${API_BASE}/api/v1/web/analytics/pageview`, { method: "POST", mode: "cors", credentials: "omit", keepalive: true,
    headers: { "Content-Type": "application/json" }, body: payload }).catch(() => {});
}

function bindNavigation() {
  addEventListener("scroll", () => $("#siteHeader").classList.toggle("scrolled", scrollY > 35), { passive: true });
  $("#menuButton").addEventListener("click", () => { const open = $("#mainNav").classList.toggle("open"); $("#menuButton").setAttribute("aria-expanded", open); });
  $$("#mainNav a").forEach((link) => link.addEventListener("click", () => $("#mainNav").classList.remove("open")));
  $("#showAllHouses").addEventListener("click", () => { state.houseLimit = state.houseLimit === Infinity ? 9 : Infinity; renderHouses(); });
  $("#accountButton").addEventListener("click", openAccount);
  $("#savedButton").addEventListener("click", openAccount);
  $("#journeyButton").addEventListener("click", openAccount);
  $("#languageButton").addEventListener("click", () => { const locale = state.locale === "nl" ? "en" : "nl"; document.cookie = `atlas_language=${locale}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`; const url = new URL(location.href); url.searchParams.set("lang", locale); location.href = url.href; });
}

function applyLanguage() {
  document.documentElement.lang = state.locale; const button = $("#languageButton");
  button.innerHTML = state.locale === "nl" ? "🇬🇧 <span>EN</span>" : "🇳🇱 <span>NL</span>";
  button.title = button.ariaLabel = state.locale === "nl" ? "Switch to English" : "Schakel naar Nederlands";
  if (state.locale !== "en") return;
  [["#mainNav a:nth-child(1)","Map"],["#mainNav a:nth-child(2)","Regions"],["#mainNav a:nth-child(3)","Houses"],["#mainNav a:nth-child(5)","Trips"],["#savedButton .desktop-label","My Atlas"],["#accountButton","Sign in"],[".hero .eyebrow","Your guide through Champagne"],[".hero-copy","From iconic maisons to hidden growers. Find the house that suits you and keep every discovery in one personal atlas."],["#heroSearch button","Discover"],["#huizen h2","Champagne houses"],["#showAllHouses","View full catalogue →"],["#explore h2","Agenda & experiences"],["[data-explore-tab='events']","Events"],["[data-explore-tab='places']","Places"],["#journeyButton","Start planning"]].forEach(([selector,value])=>{const element=$(selector);if(element)element.textContent=value});
  $("#heroSearchInput").placeholder="Search house, place or region"; $("#houseSearch").placeholder="Search a Champagne house"; $("#houseRegion option").textContent="All regions";
  [["#mapRegionGuideEyebrow","The wine regions of Champagne"],["#mapRegionGuideTitle","Terroirs of Champagne"],["#mapRegionGuideIntro","Choose a region to show its Champagne houses on the map."],["#mapRegionReset","All regions"]].forEach(([selector,value])=>{const element=$(selector);if(element)element.textContent=value});
  const factLabels = ["vineyards","crus","Grand Cru","Premier Cru","World Heritage","northern winegrowing limit","Pinot Noir · Chardonnay · Meunier"];
  $$("#mapFacts small").forEach((element,index)=>{if(factLabels[index])element.textContent=factLabels[index]});
}

function bindSearch() {
  const input = $("#heroSearchInput"), suggestions = $("#searchSuggestions");
  const candidates = () => [
    ...state.houses.map((item) => ({ label: item.name, meta: [item.city, item.region].filter(Boolean).join(" · "), action: () => openHouse(item.id) })),
    ...state.regions.map((item) => ({ label: item.name, meta: "Regio", action: () => location.href = `${API_BASE}/regions/${item.id}` })),
    ...state.places.map((item) => ({ label: item.name, meta: item.region || "Plaats", action: () => location.href = `${API_BASE}/places/${item.id}` }))
  ];
  input.addEventListener("input", () => {
    const query = slugText(input.value.trim()); suggestions.replaceChildren();
    if (query.length < 2) { suggestions.hidden = true; return; }
    candidates().filter((item) => slugText(`${item.label} ${item.meta}`).includes(query)).slice(0, 7).forEach((item) => {
      suggestions.append(node("button", { type: "button", onClick: () => { suggestions.hidden = true; item.action(); } }, [node("span", { text: item.label }), node("small", { text: ` — ${item.meta}` })]));
    });
    suggestions.hidden = !suggestions.childElementCount;
  });
  $("#heroSearch").addEventListener("submit", (event) => { event.preventDefault(); const first = $("button", suggestions); if (first) first.click(); else { $("#houseSearch").value = input.value; location.hash = "huizen"; renderHouses(); } });
  document.addEventListener("click", (event) => { if (!event.target.closest("#heroSearch")) suggestions.hidden = true; });
}

function bindFilters() {
  $("#houseSearch").addEventListener("input", renderHouses); $("#houseRegion").addEventListener("change", renderHouses); $("#visitableOnly").addEventListener("change", renderHouses);
  $$("#mapFilters button").forEach((button) => button.addEventListener("click", () => { $$("#mapFilters button").forEach((item) => item.classList.remove("active")); button.classList.add("active"); state.mapFilter = button.dataset.filter; renderMap(); }));
  $$('[data-map-region-name]').forEach((button) => button.addEventListener("click", () => {
    const requested = slugText(button.dataset.mapRegionName || "");
    const region = requested ? state.regions.find((item) => { const available = slugText(item.name || ""); return available.includes(requested) || requested.includes(available); }) : null;
    state.mapRegion = region?.id || "";
    syncMapRegionGuide(region || !requested ? button : null);
    renderMap();
  }));
  $$("[data-explore-tab]").forEach((button) => button.addEventListener("click", () => { $$("[data-explore-tab]").forEach((item) => item.classList.remove("active")); button.classList.add("active"); state.exploreTab = button.dataset.exploreTab; renderExplore(); }));
}

function bindDialogs() {
  $("[data-close-dialog]").addEventListener("click", () => closeDialog($("#houseDialog")));
  $("[data-close-account]").addEventListener("click", () => closeDialog($("#accountDialog")));
  [$("#houseDialog"), $("#accountDialog")].forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); }));
  addEventListener("popstate", () => { if (!new URLSearchParams(location.search).has("huis") && $("#houseDialog").open) closeDialog($("#houseDialog"), false); });
}

function clampMapPan() {
  const viewport = $("#atlasMap");
  if (!viewport) return;
  const minX = viewport.clientWidth * (1 - mapView.zoom);
  const minY = viewport.clientHeight * (1 - mapView.zoom);
  mapView.panX = Math.min(0, Math.max(minX, mapView.panX));
  mapView.panY = Math.min(0, Math.max(minY, mapView.panY));
}
function positionMapPins() {
  const viewport = $("#atlasMap");
  if (!viewport) return;
  $$("#mapPins .map-marker").forEach((marker) => {
    const mapX = Number(marker.dataset.mapX);
    const mapY = Number(marker.dataset.mapY);
    marker.style.left = `${mapView.panX + viewport.clientWidth * mapView.zoom * mapX / 100}px`;
    marker.style.top = `${mapView.panY + viewport.clientHeight * mapView.zoom * mapY / 100}px`;
  });
}
function applyMapView() {
  const world = $("#mapWorld");
  if (!world) return;
  clampMapPan();
  world.style.transform = `translate3d(${mapView.panX}px, ${mapView.panY}px, 0) scale(${mapView.zoom})`;
  positionMapPins();
  $("#mapZoomLevel").textContent = `${Math.round(mapView.zoom * 100)}%`;
  $("#mapZoomIn").disabled = mapView.zoom >= mapView.maxZoom;
  $("#mapZoomOut").disabled = mapView.zoom <= mapView.minZoom;
  $("#atlasMap").classList.toggle("is-zoomed", mapView.zoom > 1);
}
function setMapZoom(nextZoom, clientX, clientY) {
  const viewport = $("#atlasMap");
  if (!viewport) return;
  const zoom = Math.min(mapView.maxZoom, Math.max(mapView.minZoom, Math.round(nextZoom * 100) / 100));
  if (zoom === mapView.zoom) return;
  const rect = viewport.getBoundingClientRect();
  const pointX = Number.isFinite(clientX) ? clientX - rect.left : rect.width / 2;
  const pointY = Number.isFinite(clientY) ? clientY - rect.top : rect.height / 2;
  const ratio = zoom / mapView.zoom;
  mapView.panX = pointX - (pointX - mapView.panX) * ratio;
  mapView.panY = pointY - (pointY - mapView.panY) * ratio;
  mapView.zoom = zoom;
  applyMapView();
}
function resetMapView() {
  mapView.zoom = 1; mapView.panX = 0; mapView.panY = 0;
  applyMapView();
}
function bindMapViewport() {
  const viewport = $("#atlasMap");
  $("#mapZoomIn").addEventListener("click", () => setMapZoom(mapView.zoom + .5));
  $("#mapZoomOut").addEventListener("click", () => setMapZoom(mapView.zoom - .5));
  $("#mapZoomReset").addEventListener("click", resetMapView);
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    setMapZoom(mapView.zoom + (event.deltaY < 0 ? .3 : -.3), event.clientX, event.clientY);
  }, { passive: false });
  viewport.addEventListener("dblclick", (event) => {
    if (event.target.closest("button")) return;
    setMapZoom(mapView.zoom + .5, event.clientX, event.clientY);
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button") || mapView.zoom <= 1) return;
    event.preventDefault();
    mapView.dragging = true; mapView.pointerId = event.pointerId;
    mapView.startX = event.clientX; mapView.startY = event.clientY;
    mapView.startPanX = mapView.panX; mapView.startPanY = mapView.panY;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-dragging");
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!mapView.dragging || event.pointerId !== mapView.pointerId) return;
    mapView.panX = mapView.startPanX + event.clientX - mapView.startX;
    mapView.panY = mapView.startPanY + event.clientY - mapView.startY;
    applyMapView();
  });
  const stopDragging = (event) => {
    if (!mapView.dragging || event.pointerId !== mapView.pointerId) return;
    mapView.dragging = false; mapView.pointerId = null;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener("pointerup", stopDragging);
  viewport.addEventListener("pointercancel", stopDragging);
  viewport.addEventListener("dragstart", (event) => event.preventDefault());
  new ResizeObserver(applyMapView).observe(viewport);
  applyMapView();
}
function closeDialog(dialog, updateUrl = true) { dialog.close(); document.body.classList.remove("dialog-open"); if (updateUrl && dialog.id === "houseDialog") history.replaceState({}, "", `${location.pathname}${location.hash || ""}`); }

function updateStats() { $("#houseCount").textContent = state.houses.length || "300+"; $("#regionCount").textContent = state.regions.length || "9"; $("#placeCount").textContent = state.places.length || "—"; }
function populateRegions() {
  const unique = [...new Map(state.regions.map((region) => [region.id, region])).values()];
  unique.forEach((region) => $("#houseRegion").append(node("option", { value: region.id, text: region.name })));
}

function syncMapRegionGuide(preferredButton = null) {
  $$('[data-map-region-name]').forEach((button) => button.classList.remove("active"));
  if (preferredButton) return preferredButton.classList.add("active");
  const activeRegion = state.regions.find((item) => item.id === state.mapRegion);
  const activeName = slugText(activeRegion?.name || "");
  const match = activeName && $$('[data-map-region-name]').find((button) => {
    const requested = slugText(button.dataset.mapRegionName || "");
    return requested && (activeName.includes(requested) || requested.includes(activeName));
  });
  (match || $("#mapRegionReset"))?.classList.add("active");
}

function renderRegions() {
  const target = $("#regionCards"); target.replaceChildren();
  if (!state.regions.length) return showEmpty(target, "De regio’s konden niet worden geladen.");
  state.regions.forEach((region) => {
    const image = node("img", { src: `${API_BASE}/regions/${region.id}/banner`, alt: "", loading: "lazy" }); image.addEventListener("error", () => image.remove());
    target.append(node("a", { class: "region-card", href: `${API_BASE}/regions/${region.id}` }, [image, node("div", { class: "region-card-content" }, [node("small", { text: `${region.producerCount || region.producerIds?.length || 0} huizen` }), node("h3", { text: region.name }), node("p", { text: clip(region.description, 130) || "Ontdek het landschap, de druiven en de huizen van deze regio." })])]));
  });
}

function regionIdForHouse(house) { const match = state.regions.find((region) => region.name === house.region || (region.aliases || []).includes(house.region)); return match?.id || ""; }
function matchesHouse(house) {
  const query = slugText($("#houseSearch").value); const region = $("#houseRegion").value; const visitable = $("#visitableOnly").checked;
  return (!query || slugText(`${house.name} ${house.city} ${house.region}`).includes(query)) && (!region || regionIdForHouse(house) === region) && (!visitable || house.visitable || house.tastings);
}
function logoNode(house) { const image = node("img", { src: `${API_BASE}/producers/${house.id}/logo`, alt: `Logo ${house.name}`, loading: "lazy" }); const fallback = node("span", { text: initials(house.name) }); image.addEventListener("error", () => image.replaceWith(fallback)); return node("div", { class: "house-logo" }, image); }
function renderHouses() {
  const target = $("#houseGrid"), matches = state.houses.filter(matchesHouse); target.replaceChildren();
  if (!matches.length) showEmpty(target, "Geen champagnehuizen gevonden. Pas je zoekopdracht of filters aan.");
  matches.slice(0, state.houseLimit).forEach((house) => {
    target.append(node("article", {
      class: "house-card", tabindex: "0", onClick: () => openHouse(house.id),
      onKeydown: (event) => ["Enter", " "].includes(event.key) && openHouse(house.id)
    }, [
      logoNode(house),
      node("div", { class: "house-card-body" }, [
        node("h3", { text: house.name }),
        node("p", { text: [house.city, house.region].filter(Boolean).join(" · ") || "Champagne" }),
        node("div", { class: "house-badges" }, [
          house.visitable && node("span", { class: "badge gold", text: "Bezoekbaar" }),
          house.tastings && node("span", { class: "badge", text: "Proeverij" }),
          state.saved.has(house.id) && node("span", { class: "badge", text: "Bewaard" })
        ])
      ])
    ]));
  });
  $("#houseResultNote").textContent = `${Math.min(matches.length, state.houseLimit)} van ${matches.length} huizen getoond`;
  $("#showAllHouses").textContent = state.houseLimit === Infinity ? "Toon selectie ↑" : "Bekijk volledige catalogus →";
}

function mapMatches(house) {
  if (!Number.isFinite(Number(house.latitude)) || !Number.isFinite(Number(house.longitude))) return false;
  if (state.mapRegion && regionIdForHouse(house) !== state.mapRegion) return false;
  if (state.mapFilter === "visitable" && !house.visitable) return false;
  if (state.mapFilter === "tastings" && !house.tastings) return false;
  if (state.mapFilter === "saved" && !state.saved.has(house.id)) return false;
  return true;
}
function renderMap() {
  const target = $("#mapPins"), items = state.houses.filter(mapMatches); target.replaceChildren(); $("#mapEmpty").hidden = items.length > 0;
  const occupiedLabelCells = new Set();
  items.slice(0, 180).forEach((house) => {
    const left = Math.max(4, Math.min(96, ((Number(house.longitude) - 3.15) / 2.15) * 100));
    const top = Math.max(4, Math.min(96, ((49.65 - Number(house.latitude)) / 1.85) * 100));
    const labelCell = `${Math.round(left / 6)}:${Math.round(top / 3.5)}`;
    const showLabel = !occupiedLabelCells.has(labelCell);
    if (showLabel) occupiedLabelCells.add(labelCell);
    const pin = node("button", { class: `map-pin ${house.visitable ? "visitable" : ""}`, type: "button", title: house.name, "aria-label": `${house.name}, ${house.city || "Champagne"}`, onClick: (event) => selectMapHouse(house, event.currentTarget) });
    const label = node("span", { class: `map-pin-label${showLabel ? " visible" : ""}`, text: house.name, "aria-hidden": "true" });
    target.append(node("div", { class: "map-marker", "data-map-x": left, "data-map-y": top }, [pin, label]));
  });
  positionMapPins();
}
function selectMapHouse(house, pin) {
  $$(".map-pin.active").forEach((item) => item.classList.remove("active")); pin.classList.add("active");
  $("#mapSelection").replaceChildren(node("h4", { text: house.name }), node("p", { text: [house.city, house.region].filter(Boolean).join(" · ") }), node("p", { text: house.visitable ? "Bezoek mogelijk — controleer vooraf de actuele voorwaarden." : "Bekijk het huisprofiel voor praktische informatie." }), node("button", { type: "button", text: "Open huisprofiel →", onClick: () => openHouse(house.id) }));
}

function exploreImage(item) { const wrap = node("div", { class: "explore-image" }); const url = safeUrl(item.imageUrl); if (url) { const image = node("img", { src: url, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }); image.addEventListener("error", () => image.remove()); wrap.append(image); } return wrap; }
function renderExplore() {
  const target = $("#exploreGrid"); target.replaceChildren();
  const items = state.exploreTab === "events" ? state.events : state.exploreTab === "tours" ? state.tours : state.places;
  if (!items.length) return showEmpty(target, "Er zijn momenteel geen items beschikbaar. Probeer het later opnieuw.");
  items.slice(0, 9).forEach((item) => {
    const event = state.exploreTab === "events", tour = state.exploreTab === "tours";
    const href = safeUrl(tour ? item.bookingUrl : event ? item.sourceUrl || item.bookingUrl : `${API_BASE}/places/${item.id}`);
    target.append(node("article", { class: "explore-card" }, [exploreImage(item), node("div", { class: "explore-card-body" }, [node("small", { text: event ? formatDate(item.startsAt) : tour ? item.supplierName || "Boekbare ervaring" : item.region || "Bijzondere plek" }), node("h3", { text: item.title || item.name }), node("p", { text: item.city || item.venueName || "Champagne" }), node("p", { text: clip(item.shortDescription || item.description, 155) }), tour && node("p", { text: `${formatPrice(item.priceFrom, item.currency || "EUR")}${item.rating ? ` · ★ ${item.rating}` : ""}` }), href && node("a", { href, target: href.startsWith(location.origin) ? "_self" : "_blank", rel: "noopener noreferrer", text: event ? "Bekijk evenement →" : tour ? "Bekijk tour →" : "Ontdek deze plek →" })])]));
  });
}

async function openHouse(id, updateUrl = true) {
  const house = state.houses.find((item) => item.id === id); if (!house) return;
  const dialog = $("#houseDialog"), body = $("#houseDialogBody");
  const heroLogo = logoNode(house); heroLogo.className = "house-hero-logo";
  const heroFacts = [[tr("Oprichting"), house.founded], [tr("Plaats"), house.city], [tr("Eigenaar"), house.owner], [tr("Classificatie"), house.cruLabel || house.cruStatus?.replaceAll("_", " ")]].filter(([, value]) => value);
  const hero = node("section", { class: "house-hero house-profile-hero" }, [
    node("div", { class: "house-identity" }, [heroLogo, node("div", {}, [node("p", { class: "eyebrow light", text: [house.city, house.region].filter(Boolean).join(" · ") || "Champagne" }), node("h2", { id: "houseDialogTitle", text: house.name }), house.prestigeCuvee && node("p", { class: "house-signature", text: `Prestige-cuvée · ${clip(house.prestigeCuvee, 90)}` })])]),
    heroFacts.length && node("div", { class: "hero-facts" }, heroFacts.map(([label, value]) => node("div", {}, [node("span", { text: label }), node("strong", { text: value })])))
  ]);
  const actions = node("div", { class: "detail-actions" }, [
    node("button", { class: "primary-button", type: "button", text: tr(state.saved.has(id) ? "✓ Bewaard in Mijn Atlas" : "♡ Bewaar in Mijn Atlas"), onClick: () => toggleSaved(house) }),
    node("button", { class: "secondary-button", type: "button", text: tr(state.visits.has(id) ? "✓ Huis bezocht" : "Markeer als bezocht"), onClick: () => markVisited(house) }),
    node("button", { class: "secondary-button", type: "button", text: tr("+ Voeg toe aan reis"), onClick: () => addToJourney(house) })
  ]);
  const detail = node("div", { class: "house-detail rich-house-detail" }, [actions]);
  const intro = house.description || house.history;
  if (intro) detail.append(node("section", { class: "house-intro" }, [node("p", { class: "eyebrow", text: tr("Het huis") }), node("p", { text: intro })]));
  const themes = [["Geschiedenis", house.history, "◷"], ["Terroir", house.terroir, "⌁"], ["Wijnstijl", house.wineStyle, "♢"], ["Druiven", house.grapes, "♧"], ["Bezoekersinfo", house.visitorInformation, "⌂"], ["Prestige-cuvée", house.prestigeCuvee, "✦"]].filter(([, value]) => value);
  if (themes.length) detail.append(node("section", { class: "profile-section" }, [node("div", { class: "section-title" }, [node("p", { class: "eyebrow", text: "Maison" }), node("h3", { text: tr("Karakter en erfgoed") })]), node("div", { class: "story-grid" }, themes.map(([title, value, icon]) => node("article", { class: "story-card" }, [node("span", { class: "story-icon", text: icon }), node("h4", { text: tr(title) }), node("p", { text: value })]))) ]));
  const houseFacts = [["Oprichting", house.founded], ["Oprichter", house.founder], ["Eigenaar", house.owner], ["Directeur Maison", house.maisonDirector], ["Chef de Cave", house.chefDeCave]].filter(([, value]) => value);
  if (houseFacts.length) detail.append(node("section", { class: "house-information" }, [node("div", {}, [node("p", { class: "eyebrow light", text: tr("Huisinformatie") }), node("h3", { text: tr("De mensen achter de maison") })]), node("dl", {}, houseFacts.flatMap(([label, value]) => [node("dt", { text: tr(label) }), node("dd", { text: value })]))]));
  if (house.cellars || house.cellarLocation) detail.append(node("section", { class: "cellar-section" }, [node("div", { class: "section-title" }, [node("p", { class: "eyebrow", text: tr("Onder de Champagne") }), node("h3", { text: tr("Kelders") })]), node("div", { class: "cellar-grid" }, [house.cellars && node("article", {}, [node("h4", { text: tr("De kelders") }), node("p", { text: house.cellars })]), house.cellarLocation && node("article", {}, [node("h4", { text: tr("Ligging kelders") }), node("p", { text: house.cellarLocation })])]) ]));
  detail.append(node("section", { class: "visit-section" }, [node("div", { class: "section-title" }, [node("p", { class: "eyebrow", text: "Plan je bezoek" }), node("h3", { text: "Bezoekersinformatie" })]), node("div", { class: "visit-grid" }, [node("article", {}, [node("strong", { text: house.visitable ? "Bezoek mogelijk" : "Bezoek nog niet bevestigd" }), node("p", { text: house.visitorInformation || (house.visitable ? "Reserveer vooraf en controleer de actuele voorwaarden bij het huis." : "Neem rechtstreeks contact op met het huis voor de mogelijkheden.") }), house.tastings && node("span", { class: "badge gold", text: "Proeverijen beschikbaar" })]), node("article", {}, [node("strong", { text: house.city || "Champagne" }), house.address && node("p", { text: house.address }), house.openingHours && node("p", { text: house.openingHours })])]) ]));
  if (house.cuvees || house.prestigeCuvee) { const cuvees = String(house.prestigeCuvee || house.cuvees).split(/\s*(?:,|;|\s-\s)\s*/).filter(Boolean).slice(0, 8); detail.append(node("section", { class: "profile-section" }, [node("div", { class: "section-title" }, [node("p", { class: "eyebrow", text: "Collectie" }), node("h3", { text: "Prestige-cuvées" })]), node("div", { class: "cuvee-grid" }, cuvees.map((cuvee) => node("article", { class: "cuvee-card" }, [node("span", { text: "♜" }), node("strong", { text: cuvee })]))) ])); }
  const links = node("section", { class: "detail-panel explore-links" }, [node("h3", { text: tr("Verder verkennen") })]);
  [[house.website, "Website van het huis ↗"], [house.bookingUrl, "Reserveer een bezoek ↗"], [house.mapsUrl, "Route via Google Maps ↗"]].forEach(([url, label]) => { const href = safeUrl(url); if (href) links.append(node("p", {}, node("a", { href, target: "_blank", rel: "noopener noreferrer", text: tr(label) }))); });
  detail.append(links);
  const muselet = node("section", { class: "detail-panel muselet-section" }, [node("p", { class: "eyebrow", text: tr("Voor thuis") }), node("h3", { text: tr("Verkrijgbaar bij Muselet.nl") }), node("p", { text: tr("Champagnes en accessoires voor thuis. Flessen worden altijd eerst getoond.") }), node("div", { class: "muselet-products" }, node("div", { class: "loading-card" }))]);
  detail.append(muselet); body.replaceChildren(hero, detail); dialog.showModal(); document.body.classList.add("dialog-open");
  if (updateUrl) history.pushState({ house: id }, "", `?huis=${encodeURIComponent(id)}#huizen`);
  loadMuselet(house, $(".muselet-products", muselet));
}
async function loadMuselet(house, target) {
  try {
    const data = await api(`/api/v1/producers/${encodeURIComponent(house.id)}/muselet-products`); target.replaceChildren();
    if (!(data.products || []).length) return showEmpty(target, "Voor dit huis is nu geen actueel assortiment gevonden.");
    data.products.slice(0, 6).forEach((product) => { const href = safeUrl(product.url || product.productUrl), imageUrl = safeUrl(product.imageUrl); const card = node("a", { class: "muselet-product", href: href || "https://muselet.nl", target: "_blank", rel: "sponsored noopener noreferrer" }, [imageUrl && node("img", { src: imageUrl, alt: "", loading: "lazy" }), node("strong", { text: product.name || product.title }), node("span", { text: product.priceFormatted || formatPrice(product.price) })]); target.append(card); });
  } catch { showEmpty(target, "Het Muselet-assortiment is tijdelijk niet beschikbaar."); }
}

async function loadAccount(showErrors = true) {
  try {
    const session = await api("/api/v1/web/session"); state.account = session.account || session.user; state.entitlement = session.entitlement || null; state.csrfToken = session.csrfToken || "";
    const [saved, visits, trips, journal, profile] = await Promise.all([api("/api/v1/user-saved-houses"), api("/api/v1/visits"), api("/api/v1/trips?includeItems=true"), api("/api/v1/tasting-journal"), api("/api/v1/chef/profile")]);
    state.saved = new Set((saved.items || []).map((item) => item.houseId)); state.visits = new Set((visits.items || []).map((item) => item.houseId)); state.trips = trips.items || []; state.journal = journal.items || [];
    state.profile = profile.profile || null;
    const accountName = state.account?.name || state.account?.displayName || ""; $("#accountButton").textContent = accountName.split(" ")[0] || "Mijn account"; renderHouses(); renderMap(); return true;
  } catch (error) { state.account = null; if (showErrors && error.status !== 401 && error.status !== 404) toast("Je accountgegevens konden niet worden geladen."); return false; }
}
function requireAccount() { if (state.account) return true; openAccount(); return false; }
async function toggleSaved(house) {
  if (!requireAccount()) return;
  const saved = !state.saved.has(house.id);
  try { await api(`/api/v1/user-saved-houses/${encodeURIComponent(house.id)}`, { method: "PUT", body: JSON.stringify({ saved, idempotencyKey: crypto.randomUUID(), clientUpdatedAt: new Date().toISOString() }) }); saved ? state.saved.add(house.id) : state.saved.delete(house.id); toast(saved ? `${house.name} is bewaard.` : `${house.name} is verwijderd uit Mijn Atlas.`); renderHouses(); renderMap(); openHouse(house.id, false); }
  catch (error) { toast(error.code === "PRO_REQUIRED" ? "Deze functie vraagt Pro of een Trip Pass." : "Bewaren is niet gelukt. Probeer het opnieuw."); }
}
async function addToJourney(house) {
  if (!requireAccount()) return;
  try {
    let trip = state.trips[0];
    if (!trip) trip = await api("/api/v1/trips", { method: "POST", body: JSON.stringify({ clientGeneratedId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), name: "Mijn Champagnereis", status: "DRAFT" }) });
    if ((trip.items || []).some((item) => item.houseId === house.id)) return toast("Dit huis staat al in je reis.");
    await api(`/api/v1/trips/${trip.id}/items`, { method: "POST", body: JSON.stringify({ clientGeneratedId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), houseId: house.id, position: (trip.items || []).length, status: "PLANNED" }) });
    await loadAccount(false); toast(`${house.name} is toegevoegd aan je reis.`);
  } catch (error) { toast(error.code === "PRO_REQUIRED" || error.status === 402 ? "Je gratis reis is al gebruikt. Ontgrendel Pro of een Trip Pass." : "Toevoegen aan je reis is niet gelukt."); }
}

async function markVisited(house) {
  if (!requireAccount()) return;
  if (state.visits.has(house.id)) return toast(`${house.name} staat al als bezocht in je atlas.`);
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  try {
    await api(`/api/v1/visits/${id}`, { method: "PUT", body: JSON.stringify({ clientVisitId: id, houseId: house.id, visitedAt: now, timezoneOffsetMinutes: -new Date().getTimezoneOffset(), source: "MANUAL", idempotencyKey: crypto.randomUUID(), clientUpdatedAt: now }) });
    state.visits.add(house.id); toast(`${house.name} is toegevoegd aan je bezochte huizen.`); openHouse(house.id, false);
  } catch { toast("Het bezoek kon niet worden opgeslagen."); }
}

function formField(label, name, value = "", options = {}) {
  const input = node(options.multiline ? "textarea" : "input", { name, value, type: options.type || "text", min: options.min, max: options.max, placeholder: options.placeholder, required: options.required ? "" : null });
  if (options.multiline) input.textContent = value;
  return node("label", { class: options.wide ? "form-field wide" : "form-field" }, [node("span", { text: label }), input]);
}

function renderJournalEditor(panel, entry = null) {
  panel.replaceChildren();
  const form = node("form", { class: "account-form" });
  form.append(node("div", { class: "form-heading wide" }, [node("button", { class: "back-link", type: "button", text: "← Proefdagboek", onClick: () => renderJournalList(panel) }), node("h3", { text: entry ? "Proefnotitie aanpassen" : "Nieuwe proefnotitie" }), node("p", { text: "Vul je notitie handmatig in. Foto- en etiketherkenning blijven beschikbaar in de app." })]));
  form.append(
    formField("Champagnehuis", "houseName", entry?.houseName || "", { required: true }),
    formField("Cuvée", "cuvee", entry?.cuvee || ""),
    formField("Jaargang", "vintage", entry?.vintage || ""),
    formField("Stijl", "style", entry?.style || ""),
    formField("Waardering (0-5)", "rating", entry?.rating || 0, { type: "number", min: 0, max: 5 }),
    formField("Geproefd op", "tastedAt", (entry?.tastedAt || new Date().toISOString()).slice(0, 10), { type: "date", required: true }),
    formField("Aroma's", "aromas", entry?.aromas || "", { multiline: true, wide: true }),
    formField("Proefnotitie", "notes", entry?.notes || "", { multiline: true, wide: true }),
    formField("Gelegenheid", "occasion", entry?.occasion || "", { wide: true })
  );
  const buyAgain = node("input", { type: "checkbox", name: "buyAgain" }); buyAgain.checked = Boolean(entry?.buyAgain);
  form.append(node("label", { class: "check-field wide" }, [buyAgain, node("span", { text: "Deze champagne zou ik opnieuw kopen" })]));
  const actions = node("div", { class: "form-actions wide" }, [node("button", { class: "primary-button", type: "submit", text: "Proefnotitie bewaren" })]);
  if (entry) actions.append(node("button", { class: "danger-link", type: "button", text: "Verwijderen", onClick: async () => {
    if (!confirm("Wil je deze proefnotitie verwijderen?")) return;
    try { await api(`/api/v1/tasting-journal/${entry.id}`, { method: "DELETE", body: JSON.stringify({ clientUpdatedAt: new Date().toISOString() }) }); state.journal = state.journal.filter((item) => item.id !== entry.id); renderJournalList(panel); toast("Proefnotitie verwijderd."); } catch { toast("Verwijderen is niet gelukt."); }
  } }));
  form.append(actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const values = new FormData(form); const now = new Date().toISOString(); const dateValue = String(values.get("tastedAt") || "");
    const payload = { houseId: entry?.houseId || "", houseName: values.get("houseName"), cuvee: values.get("cuvee"), vintage: values.get("vintage"), style: values.get("style"), rating: Number(values.get("rating") || 0), aromas: values.get("aromas"), notes: values.get("notes"), occasion: values.get("occasion"), buyAgain: values.has("buyAgain"), scanSummary: entry?.scanSummary || "", tastedAt: new Date(`${dateValue}T12:00:00`).toISOString(), clientUpdatedAt: now };
    try { const saved = await api(`/api/v1/tasting-journal/${entry?.id || crypto.randomUUID()}`, { method: "PUT", body: JSON.stringify(payload) }); const item = saved.item; state.journal = [item, ...state.journal.filter((current) => current.id !== item.id)]; renderJournalList(panel); toast("Proefnotitie gesynchroniseerd."); } catch { toast("De proefnotitie kon niet worden opgeslagen."); }
  });
  panel.append(form);
}

function renderJournalList(panel) {
  panel.replaceChildren(node("div", { class: "list-toolbar" }, [node("p", { text: `${state.journal.length} proefnotities` }), node("button", { class: "secondary-button", type: "button", text: "+ Nieuwe notitie", onClick: () => renderJournalEditor(panel) })]));
  if (!state.journal.length) panel.append(node("div", { class: "empty-state", text: "Nog geen proefnotities. Voeg je eerste notitie handmatig toe of scan een etiket in de app." }));
  state.journal.forEach((entry) => panel.append(node("button", { class: "saved-row", type: "button", onClick: () => renderJournalEditor(panel, entry) }, [node("span", {}, [node("strong", { text: entry.houseName || "Onbekend champagnehuis" }), node("small", { text: `  ${[entry.cuvee, entry.vintage, entry.rating ? `${entry.rating}/5` : ""].filter(Boolean).join(" · ")}` })]), node("span", { text: "Bewerk →" })])));
}

function renderTasteProfile(panel) {
  panel.replaceChildren(); const form = node("form", { class: "taste-form" });
  form.append(node("div", { class: "profile-summary" }, [node("p", { class: "eyebrow", text: "Jouw smaakprofiel" }), node("h3", { text: state.profile ? "Verfijn je voorkeuren" : "Ontdek wat bij je past" }), node("p", { text: state.profile?.summary || "Kies je voorkeuren. Dezelfde antwoorden worden gebruikt voor persoonlijke aanbevelingen in de app en op de website." })]));
  tasteQuestions.forEach(([key, question, options, max]) => {
    const selected = new Set(state.profile?.answers?.[key] || []); const group = node("fieldset", { class: "taste-question" }, node("legend", { text: question }));
    options.forEach((option) => { const input = node("input", { type: max === 1 ? "radio" : "checkbox", name: key, value: option }); input.checked = selected.has(option); group.append(node("label", { class: "choice-chip" }, [input, node("span", { text: option })])); });
    if (max > 1) group.append(node("small", { text: `Kies maximaal ${max}` })); form.append(group);
  });
  form.append(node("button", { class: "primary-button", type: "submit", text: "Smaakprofiel bewaren" }));
  form.addEventListener("change", (event) => { const input = event.target; if (input.type !== "checkbox" || !input.checked) return; const question = tasteQuestions.find(([key]) => key === input.name); const checked = $$(`input[name="${input.name}"]:checked`, form); if (question && checked.length > question[3]) { input.checked = false; toast(`Kies maximaal ${question[3]} opties.`); } });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const answers = Object.fromEntries(tasteQuestions.map(([key]) => [key, $$(`input[name="${key}"]:checked`, form).map((input) => input.value)]));
    const missing = tasteQuestions.slice(0, 7).find(([key]) => !answers[key].length); if (missing) return toast("Beantwoord alle smaakvragen om je profiel te bewaren.");
    try { const result = await api("/api/v1/chef/profile", { method: "PUT", body: JSON.stringify({ answers }) }); state.profile = result.profile; renderTasteProfile(panel); toast("Je smaakprofiel is gesynchroniseerd."); } catch { toast("Je smaakprofiel kon niet worden opgeslagen."); }
  });
  panel.append(form);
}

async function openAccount() {
  const dialog = $("#accountDialog"), body = $("#accountBody");
  if (!state.account) await loadAccount(false);
  if (!state.account) {
    body.replaceChildren(node("section", { class: "account-content" }, [node("p", { class: "eyebrow", text: "Mijn Champagne Atlas" }), node("h2", { id: "accountTitle", text: "Neem je ontdekkingen mee" }), node("p", { text: "Log in met hetzelfde account als in de app. Je bewaarde huizen, bezoeken, reis en proefdagboek blijven dan gesynchroniseerd." }), node("div", { class: "account-benefits" }, [node("div", { text: "♡ Bewaar huizen voor later" }), node("div", { text: "✓ Houd je bezoeken en paspoort bij" }), node("div", { text: "⌖ Bereid één eenvoudige reis gratis voor" }), node("div", { text: "☆ Bekijk en bewerk je proefnotities" })]), node("a", { class: "primary-button", href: `${API_BASE}/auth/web/google/start?return_to=${encodeURIComponent(location.pathname + location.search + location.hash)}`, text: "Inloggen met Google" }), node("p", { text: "Antoine, camera, etiketscan en offline kaarten blijven exclusief beschikbaar in de app." })]));
  } else renderExpandedAccountDashboard(body);
  dialog.showModal(); document.body.classList.add("dialog-open");
}
function renderAccountDashboard(body) {
  const accountName = state.account.name || state.account.displayName || "";
  const content = node("section", { class: "account-content" }, [node("p", { class: "eyebrow", text: state.entitlement?.proAccess ? "Champagne Atlas Pro" : "Mijn Champagne Atlas" }), node("h2", { id: "accountTitle", text: `Bonjour ${accountName.split(" ")[0] || ""}` }), node("p", { text: `${state.saved.size} bewaard · ${state.visits.size} bezocht · ${state.trips.length} reis${state.trips.length === 1 ? "" : "en"} · ${state.journal.length} proefnotities` })]);
  const tabs = node("div", { class: "account-tabs" }); const panel = node("div", { class: "saved-list" });
  const renderTab = (name) => { $$("button", tabs).forEach((button) => { const active = button.dataset.tab === name; button.classList.toggle("active", active); button.setAttribute("aria-selected", active); }); panel.replaceChildren();
    if (name === "journal") return renderJournalList(panel);
    if (name === "profile") return renderTasteProfile(panel);
    const rows = name === "saved" ? [...state.saved].map((id) => state.houses.find((house) => house.id === id)).filter(Boolean).map((house) => ({ title: house.name, meta: house.city, action: () => { closeDialog($("#accountDialog")); openHouse(house.id); } }))
      : name === "trips" ? state.trips.map((trip) => ({ title: trip.name, meta: `${trip.items?.length || 0} stops`, action: null }))
      : [];
    if (!rows.length) panel.append(node("div", { class: "empty-state", text: name === "saved" ? "Nog geen huizen bewaard." : "Nog geen reis voorbereid." }));
    rows.forEach((row) => panel.append(node("button", { class: "saved-row", type: "button", onClick: row.action || (() => {}) }, [node("span", {}, [node("strong", { text: row.title }), node("small", { text: `  ${row.meta || ""}` })]), node("span", { text: row.action ? "→" : "" })])));
  };
  [["saved", "Bewaard"], ["trips", "Reizen"], ["journal", "Proefdagboek"], ["profile", "Smaakprofiel"]].forEach(([key, label]) => tabs.append(node("button", { type: "button", role: "tab", "data-tab": key, text: label, onClick: () => renderTab(key) })));
  content.append(tabs, panel, node("button", { class: "text-link", type: "button", text: "Uitloggen", onclick: async () => { await api("/auth/web/logout", { method: "POST" }); state.account = null; state.csrfToken = ""; location.reload(); } })); body.replaceChildren(content); renderTab("saved");
}

function renderExpandedAccountDashboard(body) {
  const accountName = state.account.name || state.account.displayName || "";
  const firstName = accountName.split(" ")[0] || "champagneliefhebber";
  const atlasProgress = state.houses.length ? Math.min(100, Math.round((state.visits.size / state.houses.length) * 100)) : 0;
  const content = node("section", { class: "account-content account-dashboard" });
  const header = node("div", { class: "account-dashboard-header" }, [
    node("div", {}, [
      node("p", { class: "eyebrow", text: state.entitlement?.proAccess ? "Champagne Atlas Pro" : "Mijn Champagne Atlas" }),
      node("h2", { id: "accountTitle", text: `Bonjour ${firstName}` }),
      node("p", { text: "Alles wat je ontdekt, bewaart en proeft komt hier samen." })
    ]),
    node("div", { class: `account-plan ${state.entitlement?.proAccess ? "pro" : ""}`, text: state.entitlement?.proAccess ? "PRO" : "ATLAS" })
  ]);
  const stats = node("div", { class: "account-stats", "aria-label": "Jouw Atlas in cijfers" });
  [
    ["♡", state.saved.size, "bewaard"],
    ["✓", state.visits.size, "bezocht"],
    ["⌖", state.trips.length, state.trips.length === 1 ? "reis" : "reizen"],
    ["☆", state.journal.length, "proefnotities"]
  ].forEach(([icon, value, label]) => stats.append(node("div", { class: "account-stat" }, [
    node("span", { class: "account-stat-icon", text: icon }),
    node("strong", { text: String(value) }),
    node("small", { text: label })
  ])));
  const progress = node("div", { class: "account-progress" }, [
    node("div", {}, [node("strong", { text: `${atlasProgress}% van de Atlas ontdekt` }), node("span", { text: `${state.visits.size} van ${state.houses.length || "300+"} huizen bezocht` })]),
    node("div", { class: "account-progress-track", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(atlasProgress) }, node("i", { style: `width:${atlasProgress}%` }))
  ]);
  const shortcuts = node("div", { class: "account-shortcuts" }, [
    node("button", { type: "button", onClick: () => { closeDialog($("#accountDialog")); location.hash = "kaart"; }, text: "⌖ Open kaart" }),
    node("button", { type: "button", onClick: () => { closeDialog($("#accountDialog")); location.hash = "huizen"; }, text: "⌂ Ontdek huizen" })
  ]);
  const tabs = node("div", { class: "account-tabs", role: "tablist", "aria-label": "Mijn Atlas" });
  const panel = node("div", { class: "saved-list account-panel" });
  const tabItems = [
    ["saved", "Bewaard", state.saved.size],
    ["trips", "Reizen", state.trips.length],
    ["journal", "Proefdagboek", state.journal.length],
    ["profile", "Smaakprofiel", state.profile ? "✓" : ""]
  ];
  const panelHeading = (title, description, count) => panel.append(node("div", { class: "account-panel-heading" }, [
    node("div", {}, [node("h3", { text: title }), node("p", { text: description })]),
    count !== "" && node("span", { text: String(count) })
  ]));
  const renderTab = (name) => {
    $$("button", tabs).forEach((button) => { const active = button.dataset.tab === name; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); });
    panel.replaceChildren();
    if (name === "journal") return renderJournalList(panel);
    if (name === "profile") return renderTasteProfile(panel);
    if (name === "saved") {
      const houses = [...state.saved].map((id) => state.houses.find((house) => house.id === id)).filter(Boolean);
      panelHeading("Bewaarde huizen", "Jouw selectie voor een volgend bezoek of een toekomstige reis.", houses.length);
      if (!houses.length) panel.append(node("div", { class: "empty-state", text: "Nog geen huizen bewaard. Ontdek een maison en voeg die met het hartje toe." }));
      houses.forEach((house) => {
        const image = node("img", { src: `${API_BASE}/producers/${house.id}/logo`, alt: "", loading: "lazy" });
        image.addEventListener("error", () => image.replaceWith(node("span", { text: initials(house.name) })));
        panel.append(node("button", { class: "account-item-card", type: "button", onClick: () => { closeDialog($("#accountDialog")); openHouse(house.id); } }, [
          node("div", { class: "account-item-visual" }, image),
          node("div", { class: "account-item-copy" }, [node("h4", { text: house.name }), node("p", { text: [house.city, house.region].filter(Boolean).join(" · ") || "Champagne" }), node("div", { class: "account-item-tags" }, [house.visitable && node("span", { text: "Bezoekbaar" }), house.tastings && node("span", { text: "Proeverij" })])]),
          node("span", { class: "account-item-arrow", text: "→" })
        ]));
      });
    }
    if (name === "trips") {
      panelHeading("Mijn reizen", "Bereid je route voor en neem de planning automatisch mee in de app.", state.trips.length);
      if (!state.trips.length) panel.append(node("div", { class: "empty-state", text: "Nog geen reis voorbereid. Voeg een huis toe aan Mijn Reis om te beginnen." }));
      state.trips.forEach((trip) => panel.append(node("div", { class: "account-item-card static" }, [
        node("div", { class: "account-item-visual trip", text: "⌖" }),
        node("div", { class: "account-item-copy" }, [node("h4", { text: trip.name || "Mijn Champagnereis" }), node("p", { text: `${trip.items?.length || 0} ${trip.items?.length === 1 ? "stop" : "stops"} · ${trip.status === "ACTIVE" ? "Actief" : "Concept"}` }), node("span", { class: "account-item-note", text: "Volledige routeplanning is beschikbaar in de app" })])
      ])));
    }
  };
  tabItems.forEach(([key, label, count]) => tabs.append(node("button", { type: "button", role: "tab", "data-tab": key, onClick: () => renderTab(key) }, [node("span", { text: label }), count !== "" && node("b", { text: String(count) })])));
  const footer = node("div", { class: "account-footer" }, [
    node("div", {}, [node("strong", { text: accountName || firstName }), node("span", { text: state.account.email || (state.entitlement?.proAccess ? "Champagne Atlas Pro" : "Champagne Atlas-account") })]),
    node("button", { class: "danger-link", type: "button", text: "Uitloggen", onClick: async () => { await api("/auth/web/logout", { method: "POST" }); state.account = null; state.csrfToken = ""; location.reload(); } })
  ]);
  content.append(header, stats, progress, shortcuts, tabs, panel, footer);
  body.replaceChildren(content);
  renderTab("saved");
}

boot().catch((error) => { console.error(error); toast("Champagne Atlas kon niet volledig worden geladen."); });
