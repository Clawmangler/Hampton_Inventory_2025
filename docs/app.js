// Hotel Remodel Inventory UI (static site)
// - Loads data/items.json
// - Lets you edit warranty / on-hand / vendor fields
// - Persists edits in localStorage
// - Exports/imports a small JSON updates file so you can commit it to the repo

const DATA_URL = "data/items.json";
const EDITS_KEY = "inventory_edits_v1";

let table = null;
let items = [];
let edits = loadEdits();
let selectedItemId = null;

function loadEdits(){
  try{
    return JSON.parse(localStorage.getItem(EDITS_KEY) || "{}");
  }catch(e){
    console.warn("Bad local edits, clearing.", e);
    localStorage.removeItem(EDITS_KEY);
    return {};
  }
}

function saveEdits(){
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
}

function applyEditsToItems(){
  for(const row of items){
    const patch = edits[row.item_id];
    if(patch){
      Object.assign(row, patch);
    }
    // convenience auto-calc for warranty_end if blank
    row.warranty_end = computeWarrantyEnd(row.warranty_start, row.warranty_months, row.warranty_end);
  }
}

function computeWarrantyEnd(startDate, months, existingEnd){
  if(existingEnd && String(existingEnd).trim() !== "") return existingEnd;
  const s = String(startDate || "").trim();
  const m = parseInt(months, 10);
  if(!s || !Number.isFinite(m) || m <= 0) return "";
  const dt = new Date(s + "T00:00:00");
  if(Number.isNaN(dt.getTime())) return "";
  dt.setMonth(dt.getMonth() + m);
  // ISO yyyy-mm-dd
  return dt.toISOString().slice(0,10);
}

function uniq(arr){
  return Array.from(new Set(arr.filter(x => x !== null && x !== undefined && String(x).trim() !== "")));
}

function formatRoomQty(cell){
  const v = cell.getValue();
  if(!v || typeof v !== "object") return "";
  const keys = Object.keys(v);
  if(keys.length === 0) return "";
  return keys.length + " room-types";
}

function formatImages(cell){
  const v = cell.getValue();
  if(!Array.isArray(v) || v.length === 0) return "";
  return v.length + " image(s)";
}

function globalSearchFilter(data, searchText){
  const q = (searchText || "").toLowerCase().trim();
  if(!q) return true;
  const hay = [
    data.area, data.zone, data.category, data.section,
    data.spec, data.description, data.notes, data.vendor, data.model, data.part_number,
    Array.isArray(data.tags) ? data.tags.join(" ") : "",
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

function buildFilters(){
  const areas = uniq(items.map(x => x.area)).sort();
  const zones = uniq(items.map(x => x.zone)).sort();
  const types = uniq(items.map(x => x.category)).sort();

  const areaSel = ensureEl("areaFilter","select",".controls");
  const zoneSel = ensureEl("zoneFilter","select",".controls");
  const typeSel = ensureEl("typeFilter","select",".controls");

  // Ensure default options exist
  if(!areaSel.querySelector("option")) areaSel.innerHTML = '<option value="">All areas</option>';
  if(!zoneSel.querySelector("option")) zoneSel.innerHTML = '<option value="">All zones</option>';
  if(!typeSel.querySelector("option")) typeSel.innerHTML = '<option value="">All types</option>';
for(const a of areas){
    const opt = document.createElement("option");
    opt.value = a; opt.textContent = a;
    areaSel.appendChild(opt);
  }
  for(const z of zones){
    const opt = document.createElement("option");
    opt.value = z; opt.textContent = z;
    zoneSel.appendChild(opt);
  }
  for(const t of types){
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    typeSel.appendChild(opt);
  }
}

function applyExternalFilters(){
  const searchText = document.getElementById("search").value;
  const area = document.getElementById("areaFilter").value;
  const zone = document.getElementById("zoneFilter").value;
  const type = document.getElementById("typeFilter").value;

  table.setFilter((data) => {
    if(area && data.area !== area) return false;
    if(zone && data.zone !== zone) return false;
    if(type && data.category !== type) return false;
    return globalSearchFilter(data, searchText);
  });
}

function makeNewItem(){
  const now = new Date();
  const id = "NEW-" + now.getTime();
  return {
    item_id: id,
    spec: "",
    description: "",
    area: "Public Areas",
    zone: "Public Spaces",
    category: "",
    attic_stock: "",
    total: "",
    uom: "",
    notes: "",
    room_type_quantities: null,
    source_page: "",
    vendor: "",
    model: "",
    part_number: "",
    unit_cost: "",
    warranty_months: "",
    warranty_start: "",
    warranty_end: "",
    installed_date: "",
    last_replaced: "",
    on_hand: "",
    min_on_hand: "",
    storage_location: "",
    link: "",
    image_urls: [],
    tags: [],
  };
}

function initTable(){
  table = new Tabulator("#inventoryTable", {
    data: items,
    layout: "fitDataStretch",
    height: "calc(100vh - 220px)",
    movableColumns: true,
    reactiveData: true,
    pagination: true,
    paginationSize: 50,
    rowHeight: 48,
    initialSort: [{column:"area", dir:"asc"}, {column:"zone", dir:"asc"}, {column:"category", dir:"asc"}, {column:"spec", dir:"asc"}],
    columns: [
      {title:"Area", field:"area", width:120, headerFilter:"list", headerFilterParams:{valuesLookup:true, clearable:true}},
      {title:"Zone", field:"zone", width:160, headerFilter:"list", headerFilterParams:{valuesLookup:true, clearable:true}},
      {title:"Type", field:"category", width:170, headerFilter:"list", headerFilterParams:{valuesLookup:true, clearable:true}},
      {title:"Spec", field:"spec", width:110},
      {title:"Description", field:"description", minWidth:340, formatter:"textarea"},
      {title:"Total", field:"total", width:80, hozAlign:"right"},
      {title:"UoM", field:"uom", width:70},
      {title:"Attic", field:"attic_stock", width:80, hozAlign:"right"},
      {title:"On-hand", field:"on_hand", width:90, editor:"input"},
      {title:"Min", field:"min_on_hand", width:70, editor:"input"},
      {title:"Vendor", field:"vendor", width:160, editor:"input"},
      {title:"Warranty (mo)", field:"warranty_months", width:120, editor:"input"},
      {title:"W.Start", field:"warranty_start", width:110, editor:"input"},
      {title:"W.End", field:"warranty_end", width:110, editor:"input"},
      {title:"Storage", field:"storage_location", width:140, editor:"input"},
      {title:"Link", field:"link", width:90, formatter:(cell)=>{
          const v = (cell.getValue()||"").trim();
          return v ? "<span style='text-decoration:underline'>open</span>" : "";
        }, cellClick:(e, cell)=>{
          const v = (cell.getValue()||"").trim();
          if(v) window.open(v, "_blank");
        }
      },
      {title:"Imgs", field:"image_urls", width:80, formatter:formatImages},
      {title:"Room Qtys", field:"room_type_quantities", width:110, formatter:formatRoomQty},
      {title:"Notes", field:"notes", minWidth:220, formatter:"textarea"},
      {title:"item_id", field:"item_id", visible:false},
    ],
    rowClick: (e, row) => openDetails(row.getData()),
    cellEdited: (cell) => {
      const row = cell.getRow().getData();
      // keep warranty_end computed if empty
      row.warranty_end = computeWarrantyEnd(row.warranty_start, row.warranty_months, row.warranty_end);
      rememberRow(row);
    },
  });

  // external filter controls
  document.getElementById("search").addEventListener("input", applyExternalFilters);
  document.getElementById("areaFilter").addEventListener("change", applyExternalFilters);
  document.getElementById("zoneFilter").addEventListener("change", applyExternalFilters);
  document.getElementById("typeFilter").addEventListener("change", applyExternalFilters);

  document.getElementById("saveBtn").addEventListener("click", () => {
    saveEdits();
    toast("Saved locally.");
  });

  document.getElementById("exportBtn").addEventListener("click", exportUpdates);
  document.getElementById("importFile").addEventListener("change", importUpdates);
  document.getElementById("clearBtn").addEventListener("click", clearLocalEdits);
  document.getElementById("csvBtn").addEventListener("click", () => table.download("csv","inventory.csv"));
  document.getElementById("addItemBtn").addEventListener("click", () => {
    const n = makeNewItem();
    items.unshift(n);
    table.replaceData(items);
    openDetails(n);
    rememberRow(n);
  });

  // details panel buttons
  document.getElementById("closeDetails").addEventListener("click", closeDetails);
  document.getElementById("applyDetailsBtn").addEventListener("click", applyDetailsToRow);
  document.getElementById("addImgBtn").addEventListener("click", addImageToSelected);
  document.getElementById("addTagBtn").addEventListener("click", addTagToSelected);
}

function rememberRow(row){
  const id = row.item_id;
  if(!id) return;

  // store only the editable fields (keeps export small)
  const patch = {
    vendor: row.vendor || "",
    model: row.model || "",
    part_number: row.part_number || "",
    unit_cost: row.unit_cost || "",
    warranty_months: row.warranty_months || "",
    warranty_start: row.warranty_start || "",
    warranty_end: row.warranty_end || "",
    installed_date: row.installed_date || "",
    last_replaced: row.last_replaced || "",
    on_hand: row.on_hand || "",
    min_on_hand: row.min_on_hand || "",
    storage_location: row.storage_location || "",
    link: row.link || "",
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
  };

  edits[id] = patch;
}

function exportUpdates(){
  saveEdits();
  const blob = new Blob([JSON.stringify(edits, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-updates.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importUpdates(ev){
  const file = ev.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const incoming = JSON.parse(reader.result);
      if(typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("Not an object map");
      edits = Object.assign(edits, incoming);
      saveEdits();
      applyEditsToItems();
      table.replaceData(items);
      toast("Imported updates.");
    }catch(e){
      alert("Could not import updates: " + e.message);
    }finally{
      ev.target.value = "";
    }
  };
  reader.readAsText(file);
}

function clearLocalEdits(){
  if(!confirm("Clear ALL locally saved edits on this browser?")) return;
  edits = {};
  localStorage.removeItem(EDITS_KEY);
  // reload original data
  fetch(DATA_URL).then(r => r.json()).then(data => {
    items = data;
    applyEditsToItems();
    table.replaceData(items);
    closeDetails();
  });
}

function openDetails(data){
  selectedItemId = data.item_id;
  document.getElementById("detailsPanel").classList.add("open");

  // static fields
  setText("d_spec", data.spec || "—");
  setText("d_desc", data.description || "—");
  setText("d_item_id", data.item_id || "—");
  setText("d_area", data.area || "—");
  setText("d_zone", data.zone || "—");
  setText("d_type", data.category || "—");
  setText("d_total", data.total ?? "—");
  setText("d_uom", data.uom || "—");
  setText("d_attic", data.attic_stock ?? "—");
  setText("d_notes", (data.notes || "").trim() || "—");

  // inputs
  setVal("d_vendor", data.vendor);
  setVal("d_model", data.model);
  setVal("d_part", data.part_number);
  setVal("d_cost", data.unit_cost);
  setVal("d_onhand", data.on_hand);
  setVal("d_min", data.min_on_hand);
  setVal("d_storage", data.storage_location);
  setVal("d_wm", data.warranty_months);
  setVal("d_ws", data.warranty_start);
  setVal("d_we", data.warranty_end);
  setVal("d_installed", data.installed_date);
  setVal("d_last", data.last_replaced);
  setVal("d_link", data.link);

  // link preview
  const prev = document.getElementById("d_link_preview");
  prev.innerHTML = (data.link || "").trim() ? `<a href="${escapeHtml(data.link)}" target="_blank" rel="noreferrer">Open link</a>` : "";

  // room-type quantities
  const rt = document.getElementById("d_roomtypes");
  const qty = data.room_type_quantities;
  if(qty && typeof qty === "object" && Object.keys(qty).length){
    rt.textContent = Object.entries(qty).map(([k,v]) => `${k}: ${v}`).join("\n");
  }else{
    rt.textContent = "—";
  }

  // images
  renderImages(data.image_urls || []);
  renderTags(data.tags || []);
}

function closeDetails(){
  selectedItemId = null;
  document.getElementById("detailsPanel").classList.remove("open");
}

function applyDetailsToRow(){
  if(!selectedItemId) return;
  const row = items.find(x => x.item_id === selectedItemId);
  if(!row) return;

  row.vendor = getVal("d_vendor");
  row.model = getVal("d_model");
  row.part_number = getVal("d_part");
  row.unit_cost = getVal("d_cost");
  row.on_hand = getVal("d_onhand");
  row.min_on_hand = getVal("d_min");
  row.storage_location = getVal("d_storage");
  row.warranty_months = getVal("d_wm");
  row.warranty_start = getVal("d_ws");
  row.warranty_end = getVal("d_we");
  row.installed_date = getVal("d_installed");
  row.last_replaced = getVal("d_last");
  row.link = getVal("d_link");

  row.warranty_end = computeWarrantyEnd(row.warranty_start, row.warranty_months, row.warranty_end);

  rememberRow(row);
  table.updateData([row]);
  openDetails(row);
  toast("Applied changes.");
}

function addImageToSelected(){
  if(!selectedItemId) return;
  const url = (document.getElementById("imgUrl").value || "").trim();
  if(!url) return;
  const row = items.find(x => x.item_id === selectedItemId);
  if(!row) return;
  row.image_urls = Array.isArray(row.image_urls) ? row.image_urls : [];
  row.image_urls.push(url);
  document.getElementById("imgUrl").value = "";
  rememberRow(row);
  table.updateData([row]);
  openDetails(row);
}

function addTagToSelected(){
  if(!selectedItemId) return;
  const t = (document.getElementById("tagText").value || "").trim();
  if(!t) return;
  const row = items.find(x => x.item_id === selectedItemId);
  if(!row) return;
  row.tags = Array.isArray(row.tags) ? row.tags : [];
  if(!row.tags.includes(t)) row.tags.push(t);
  document.getElementById("tagText").value = "";
  rememberRow(row);
  table.updateData([row]);
  openDetails(row);
}

function renderImages(urls){
  const wrap = document.getElementById("d_images");
  wrap.innerHTML = "";
  if(!urls || !urls.length){
    wrap.innerHTML = "<div class='smallText'>No images yet (you can add URLs above).</div>";
    return;
  }
  for(const u of urls){
    const img = document.createElement("img");
    img.src = u;
    img.loading = "lazy";
    img.title = u;
    img.onerror = () => { img.style.display="none"; };
    wrap.appendChild(img);
  }
}

function renderTags(tags){
  const wrap = document.getElementById("d_tags");
  wrap.innerHTML = "";
  if(!tags || !tags.length){
    wrap.innerHTML = "<div class='smallText'>No tags yet.</div>";
    return;
  }
  for(const t of tags){
    const div = document.createElement("div");
    div.className = "tag";
    div.textContent = t;
    wrap.appendChild(div);
  }
}

function setText(id, txt){ document.getElementById(id).textContent = txt; }
function setVal(id, v){ document.getElementById(id).value = (v ?? ""); }
function getVal(id){ return document.getElementById(id).value ?? ""; }

// tiny toast
let toastTimer = null;
function toast(msg){
  let el = document.getElementById("toast");
  if(!el){
    el = document.createElement("div");
    el.id = "toast";
    el.style.position = "fixed";
    el.style.bottom = "16px";
    el.style.left = "16px";
    el.style.padding = "10px 12px";
    el.style.background = "rgba(0,0,0,.7)";
    el.style.border = "1px solid rgba(255,255,255,.12)";
    el.style.borderRadius = "12px";
    el.style.color = "white";
    el.style.zIndex = 10;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.style.display="none", 1600);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

async function main(){
  const res = await fetch(DATA_URL);
  items = await res.json();

  applyEditsToItems();
  buildFilters();

  initTable();
  applyExternalFilters();
}

// Run after DOM is ready (more robust on GitHub Pages / local preview)
document.addEventListener('DOMContentLoaded', () => {
  main().catch(err => {
    console.error(err);
    alert('Failed to load data. If you\'re opening the HTML file directly, run a local server (or use GitHub Pages).');
  });
});
