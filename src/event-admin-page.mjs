import { studioLegacyPage } from "./admin-studio.mjs";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function localDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function field(label, name, value = "", type = "text", extra = "") {
  return `<label><span>${esc(label)}</span><input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
}

function editor(event, csrf) {
  const existing = Boolean(event?.id);
  return `<details class="editor"><summary>${existing ? "Bewerken" : "+ Handmatig evenement"}</summary>
    <form method="post" action="/admin/events/save">
      <input type="hidden" name="csrf" value="${esc(csrf)}">
      <input type="hidden" name="providerExternalId" value="${esc(event?.providerExternalId || "")}">
      <div class="fields">
        ${field("Titel", "title", event?.title, "text", "required")}
        ${field("Start", "startsAt", localDate(event?.startsAt), "datetime-local", "required")}
        ${field("Einde", "endsAt", localDate(event?.endsAt), "datetime-local")}
        ${field("Plaats", "city", event?.city)}
        ${field("Locatie", "venueName", event?.venueName)}
        ${field("Adres", "address", event?.address)}
        ${field("Bron", "sourceName", event?.sourceName || "Champagne Atlas", "text", "required")}
        ${field("Bron-URL", "sourceUrl", event?.sourceUrl, "url")}
        ${field("Producent", "producerName", event?.producerName)}
        ${field("Reserveringslink", "bookingUrl", event?.bookingUrl, "url")}
        ${field("Afbeelding-URL", "imageUrl", event?.imageUrl, "url")}
        ${field("Fotocredit", "imageCredit", event?.imageCredit)}
        ${field("Beeldrecht vanaf", "imageRightsStart", localDate(event?.imageRightsStart), "datetime-local")}
        ${field("Beeldrecht t/m", "imageRightsEnd", localDate(event?.imageRightsEnd), "datetime-local")}
        ${field("Volgorde", "editorialOrder", event?.editorialOrder || 0, "number")}
        <label><span>Status</span><select name="status">${["active","hidden","archived"].map((status) => `<option ${event?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
      </div>
      <label><span>Korte omschrijving</span><textarea name="shortDescription" rows="2">${esc(event?.shortDescription)}</textarea></label>
      <label><span>Volledige omschrijving</span><textarea name="longDescription" rows="5">${esc(event?.longDescription)}</textarea></label>
      <label><span>Titel (EN)</span><input name="titleEn" value="${esc(event?.localizedContent?.en?.title)}" placeholder="Automatisch wanneer leeg"></label>
      <label><span>Korte omschrijving (EN)</span><textarea name="shortDescriptionEn" rows="2" placeholder="Automatisch wanneer leeg">${esc(event?.localizedContent?.en?.shortDescription)}</textarea></label>
      <label><span>Volledige omschrijving (EN)</span><textarea name="longDescriptionEn" rows="5" placeholder="Automatisch wanneer leeg">${esc(event?.localizedContent?.en?.longDescription)}</textarea></label>
      <label class="check"><input type="checkbox" name="lockEn" value="yes" ${Object.values(event?.localizationMeta?.en?.fields || {}).some((field) => field?.locked) ? "checked" : ""}> Handmatig Engels vergrendelen</label>
      ${existing ? `<label class="check"><input type="checkbox" name="retranslateEn" value="yes"> Engelse machinevertaling opnieuw maken</label>` : ""}
      <label class="check"><input type="checkbox" name="allDay" ${event?.allDay ? "checked" : ""}> Hele dag</label>
      <label class="check"><input type="checkbox" name="editorialFeatured" ${event?.editorialFeatured ? "checked" : ""}> Uitlichten</label>
      <button type="submit">Opslaan</button>
    </form>
  </details>`;
}

export function eventAdminPage(...args) {
  return studioLegacyPage({ document: legacyEventAdminPage(...args), title: "Evenementen", active: "events", profile: args[1] });
}

function legacyEventAdminPage(events, profile, csrf, syncStatus, message = "", filters = {}) {
  const lastSync = syncStatus?.started_at ? new Date(syncStatus.started_at).toLocaleString("nl-NL") : "Nog niet uitgevoerd";
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Evenementen beheren · Champagne Atlas</title><style>
  :root{--forest:#0f3b2e;--gold:#c9a227;--cream:#f7f2e6;--line:#dfd7c7;--muted:#69665e}*{box-sizing:border-box}body{margin:0;background:#faf8f3;color:#20201d;font:14px/1.45 Arial,sans-serif}header{height:76px;padding:12px 3vw;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;position:sticky;top:0;z-index:5}header img{width:176px;height:48px;object-fit:contain}nav{margin-left:auto;display:flex;gap:7px}nav a{padding:10px;color:var(--forest);font-weight:700;text-decoration:none;border-radius:9px}.active{background:#edf2ef}main{width:min(1240px,94vw);margin:30px auto 70px}h1,h2{font-family:Georgia,serif;color:var(--forest);font-weight:500}.head{display:flex;justify-content:space-between;align-items:end;gap:20px}.head h1{margin:0;font-size:38px}.head p{margin:4px 0;color:var(--muted)}button{border:0;border-radius:10px;background:var(--forest);color:#fff;font-weight:750;padding:11px 16px;cursor:pointer}.notice,.sync{border:1px solid var(--line);border-radius:14px;background:#fff;padding:15px 18px;margin:18px 0}.notice{background:#edf5f1;color:var(--forest)}.sync{display:flex;align-items:center;gap:18px}.sync form{margin-left:auto}.filters{display:grid;grid-template-columns:2fr repeat(3,1fr) auto;gap:10px;margin:18px 0}.filters input,.filters select{margin:0}.editor{background:#fff;border:1px solid var(--line);border-radius:14px;margin:14px 0;overflow:hidden}.editor summary{padding:15px 18px;color:var(--forest);font-weight:800;cursor:pointer}.editor form{padding:0 18px 18px;display:grid;gap:12px}.fields{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}label span{display:block;font-size:12px;font-weight:750;color:var(--muted);margin-bottom:4px}input,select,textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:9px;background:#fff;font:inherit}.check{display:flex;align-items:center;gap:8px}.check input{width:auto}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{background:#fff;border:1px solid var(--line);border-radius:15px;padding:17px}.card h2{font-size:24px;margin:0}.meta{color:var(--muted)}.badges{display:flex;gap:6px;flex-wrap:wrap}.badge{padding:4px 8px;border-radius:999px;background:var(--cream);font-size:11px;font-weight:800}.featured{background:#f8eab4}.failed{color:#982c36}@media(max-width:850px){.filters,.fields{grid-template-columns:1fr}.grid{grid-template-columns:1fr}nav a:not(.active){display:none}}
  </style></head><body><header><a href="/admin"><img src="/assets/champagne-atlas-logo.png" alt="Champagne Atlas"></a><nav><a href="/admin">Huizen</a><a href="/admin/regions">Regio's</a><a href="/admin/places">Plaatsen</a><a class="active" href="/admin/events">Evenementen</a><a href="/auth/logout" title="Uitloggen">${profile.authMethod === "google" ? "✓ Ingelogd met Google" : "Uitloggen"}</a></nav></header>
  <main><div class="head"><div><h1>Eventkalender</h1><p>Live brondata en handmatige premiumselecties voor Explore.</p></div></div>
  ${message ? `<p class="notice">${esc(message)}</p>` : ""}
  <section class="sync"><div><strong>DATAtourisme-sync</strong><br><span class="${syncStatus?.status === "failed" ? "failed" : ""}">Laatste poging: ${esc(lastSync)} · ${esc(syncStatus?.status || "niet gestart")}${syncStatus?.error_message ? ` · ${esc(syncStatus.error_message)}` : ""}</span></div><form method="post" action="/admin/events/sync"><input type="hidden" name="csrf" value="${esc(csrf)}"><button type="submit">Nu synchroniseren</button></form></section>
  ${editor(null, csrf)}
  <form class="filters" method="get"><input name="q" placeholder="Zoek titel of plaats" value="${esc(filters.q)}"><select name="status"><option value="">Alle statussen</option>${["active","hidden","archived"].map((v)=>`<option ${filters.status===v?"selected":""}>${v}</option>`).join("")}</select><select name="provider"><option value="">Alle bronnen</option><option ${filters.provider==="datatourisme"?"selected":""}>datatourisme</option><option ${filters.provider==="manual"?"selected":""}>manual</option></select><input type="date" name="from" value="${esc(filters.from)}"><button>Filter</button></form>
  <div class="grid">${events.map((event) => `<article class="card"><div class="badges"><span class="badge">${esc(event.status)}</span><span class="badge">${esc(event.provider)}</span>${event.editorialFeatured ? `<span class="badge featured">Uitgelicht</span>` : ""}</div><h2>${esc(event.title)}</h2><p class="meta">${esc(new Date(event.startsAt).toLocaleString("nl-NL"))} · ${esc(event.city || event.venueName || "Locatie onbekend")}</p><p>${esc(event.shortDescription || "Geen korte omschrijving")}</p><small>Bron: ${esc(event.sourceName)}${event.producerName ? ` · ${esc(event.producerName)}` : ""}</small>${event.provider === "manual" ? editor(event, csrf) : `<form method="post" action="/admin/events/editorial"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="id" value="${esc(event.id)}"><div class="fields"><label><span>Status</span><select name="status">${["active","hidden","archived"].map((v)=>`<option ${event.status===v?"selected":""}>${v}</option>`).join("")}</select></label>${field("Volgorde", "editorialOrder", event.editorialOrder || 0, "number")}<label class="check"><input type="checkbox" name="editorialFeatured" ${event.editorialFeatured?"checked":""}> Uitlichten</label></div><button type="submit">Redactie opslaan</button></form>`}</article>`).join("") || `<p>Geen evenementen gevonden.</p>`}</div></main></body></html>`;
}
