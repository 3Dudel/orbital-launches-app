(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S=window.SITES||{};
let LAUNCHES=[];
const state={tz:localStorage.getItem('tz')||'local',theme:localStorage.getItem('theme')||'system',q:'',sq:'',sel:null,
  f:{company:'',rocket:'',country:'',type:''},sf:{company:'',rocket:'',country:'',type:''}};
if(state.theme==='auto')state.theme='system';
const mq=matchMedia('(prefers-color-scheme: dark)');

// ---- Theme ----
function applyTheme(){
  const dark=state.theme==='dark'||(state.theme==='system'&&mq.matches);
  document.documentElement.dataset.mode=dark?'dark':'light';
  const tc=document.querySelector('meta[name=theme-color]');
  if(tc)tc.content=dark?'#16150f':'#f3f1ec';
  $$('[data-theme]').forEach(b=>b.classList.toggle('sel',b.dataset.theme===state.theme));
}
if(mq.addEventListener)mq.addEventListener('change',applyTheme);else if(mq.addListener)mq.addListener(applyTheme);

// ---- Menue ----
$('#menuBtn').onclick=e=>{e.stopPropagation();$('#menu').hidden=!$('#menu').hidden};
document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap'))$('#menu').hidden=true});
$$('[data-theme]').forEach(b=>b.onclick=()=>{state.theme=b.dataset.theme;localStorage.setItem('theme',state.theme);applyTheme();$('#menu').hidden=true});
$('#tzBtn').onclick=()=>{state.tz=state.tz==='local'?'UTC':'local';localStorage.setItem('tz',state.tz);$('#tzLabel').textContent=state.tz==='local'?'Lokal':'UTC';renderAll()};
$('#aboutBtn').onclick=()=>{$('#menu').hidden=true;$('#about').showModal()};
$('#legalBtn').onclick=()=>{$('#menu').hidden=true;$('#legal').showModal()};
$('#reloadBtn').onclick=()=>{$('#menu').hidden=true;load()};
$('#tzLabel').textContent=state.tz==='local'?'Lokal':'UTC';

// ---- Tabs ----
const titles={list:'N\u00e4chste Starts',map:'Karte',sites:'Startpl\u00e4tze'};
let map=null,layer=null;
function mapMsg(t){
  const b=$('#mapinfo');b.hidden=false;b.innerHTML='<div class="t2">'+esc(t)+'</div>';
}
function show(v){
  $$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  $('#title').textContent=titles[v];
  if(v==='map'){
    if(!window.L||!window.L.map){mapMsg('Kartenbibliothek konnte nicht geladen werden. Bitte Internetverbindung pr\u00fcfen.');return}
    try{initMap();setTimeout(()=>{map.invalidateSize();drawMap()},30)}catch(e){mapMsg('Kartenfehler: '+e.message)}
  } else scrollTo(0,0);
}
$$('.tab').forEach(t=>t.onclick=()=>show(t.dataset.view));

// ---- Helfer ----
const tzOpt=()=>state.tz==='UTC'?{timeZone:'UTC'}:{};
const fmtDay=d=>d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric',...tzOpt()});
const fmtTime=l=>{const d=new Date(l.utc);return (l.approx?'ca. ':'')+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',...tzOpt()})+(state.tz==='UTC'?' UTC':'')};
const fmtShort=l=>new Date(l.utc).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',...tzOpt()});
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const site=l=>S[l.site]||{name:l.pad||'Unbekannt',country:'Unbekannt',info:''};
function rel(ms){
  if(ms<=0)return 'l\u00e4uft';
  const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60;
  return (d?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}
function upcoming(){const now=Date.now()-2*3600e3;return LAUNCHES.filter(l=>new Date(l.utc)>=now).sort((a,b)=>new Date(a.utc)-new Date(b.utc))}

const COMPANIES=[
 [/Falcon|Starship|Dragon/i,'SpaceX'],[/Electron|Neutron/i,'Rocket Lab'],[/Vulcan|Atlas|Delta/i,'ULA'],
 [/New Glenn|New Shepard/i,'Blue Origin'],[/Ariane|Vega/i,'Arianespace'],[/Antares|Minotaur|Pegasus/i,'Northrop Grumman'],
 [/Firefly|Alpha/i,'Firefly'],[/Terran|Relativity/i,'Relativity Space'],
 [/Zhuque/i,'LandSpace'],
 [/CZ-|Langer Marsch|Long March|Kuaizhou|Ceres|Tianlong|Kinetica|Gravity|Jielong|Lijian|Hyperbola|Smart Dragon/i,'China (CASC/Privat)'],
 [/Sojus|Soyuz|Proton|Angara|Rus-M/i,'Roskosmos'],[/PSLV|GSLV|LVM3|SSLV/i,'ISRO'],[/H3|H-IIA|H-IIB|Epsilon/i,'JAXA / MHI'],
 [/Nuri|Innospace|Hanbit/i,'Korea'],[/Eris|Gilmour/i,'Gilmour Space'],[/RFA|Spectrum|Isar/i,'Isar / RFA'],[/Shavit/i,'Israel'],[/Simorgh|Qaem|Qased|Safir/i,'Iran'],
 [/Unha|Chollima/i,'Nordkorea'],[/Vikram|Agnibaan/i,'Indien (privat)']
];
function company(l){for(const [re,n] of COMPANIES)if(re.test(l.rocket||''))return n;return 'Sonstige'}
const typeOf=l=>l.type||'Unbekannt';

function fillSelect(el,label,values,cur){
  el.innerHTML=`<option value="">${label}: alle</option>`+values.map(v=>`<option ${v===cur?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');
  el.classList.toggle('on',!!cur);
}
const uniq=a=>[...new Set(a.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
function match(l,f,q){
  const s=site(l);
  if(f.company&&company(l)!==f.company)return false;
  if(f.rocket&&l.rocket!==f.rocket)return false;
  if(f.country&&s.country!==f.country)return false;
  if(f.type&&typeOf(l)!==f.type)return false;
  if(q&&![l.rocket,l.payload,l.detail,l.type,s.name,l.pad,company(l),s.country].join(' ').toLowerCase().includes(q))return false;
  return true;
}
function setupFilters(ids,f,cb){
  const up=upcoming();
  const [c,r,co,t]=ids.map(i=>$(i));
  fillSelect(c,'Firma',uniq(up.map(company)),f.company);
  fillSelect(r,'Rakete',uniq(up.map(l=>l.rocket)),f.rocket);
  fillSelect(co,'Land',uniq(up.map(l=>site(l).country)),f.country);
  fillSelect(t,'Zweck',uniq(up.map(typeOf)),f.type);
  c.onchange=()=>{f.company=c.value;cb()};r.onchange=()=>{f.rocket=r.value;cb()};
  co.onchange=()=>{f.country=co.value;cb()};t.onchange=()=>{f.type=t.value;cb()};
}

// ---- Liste ----
function render(){
  setupFilters(['#fCompany','#fRocket','#fCountry','#fType'],state.f,render);
  const q=state.q.toLowerCase();
  const items=upcoming().filter(l=>match(l,state.f,q));
  let html='',last='';
  for(const l of items){
    const day=fmtDay(new Date(l.utc));
    if(day!==last){html+=`<div class="day">${day}</div>`;last=day}
    const s=site(l);
    html+=`<details class="card"><summary><span class="cc">${esc(s.code||'--')}</span><div class="grow"><div class="t1">${esc(l.rocket)}</div><div class="t2">${esc(l.payload)} \u00b7 ${esc(s.short||s.name)}</div></div><div class="time">${fmtTime(l)}<small>${fmtShort(l)}</small></div><span class="chev">\u203a</span></summary>
    <div class="body"><dl>
    <dt>Rakete</dt><dd>${esc(l.rocket)} <span class="badge">${esc(company(l))}</span></dd>
    <dt>Nutzlast</dt><dd>${esc(l.payload)}</dd>
    ${l.detail?`<dt>Details</dt><dd>${esc(l.detail)}</dd>`:''}
    ${l.type?`<dt>Zweck</dt><dd>${esc(l.type)}</dd>`:''}
    <dt>Startplatz</dt><dd>${esc(s.name)}${l.pad?` <span class="badge">${esc(l.pad)}</span>`:''}</dd>
    <dt>Land</dt><dd>${esc(s.country)}</dd>
    <dt>UTC</dt><dd>${new Date(l.utc).toISOString().replace('T',' ').slice(0,16)}${l.approx?' (ca.)':''}</dd>
    </dl>${s.lat!=null?`<a class="btn" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=9/${s.lat}/${s.lon}">Auf Karte</a>`:''}
    <a class="btn ghost" target="_blank" rel="noopener" href="https://de.wikipedia.org/wiki/Liste_geplanter_orbitaler_Raketenstarts">Wikipedia</a></div></details>`;
  }
  $('#list').innerHTML=html||'<div class="empty">Keine Starts gefunden.</div>';
  tick();
}
function tick(){
  const n=upcoming().find(l=>new Date(l.utc)>Date.now());
  $('#countdown').innerHTML=n?`<small>N\u00e4chster Start</small><div class="name">${esc(n.rocket)} \u00b7 ${esc(n.payload)}</div><div class="big">${rel(new Date(n.utc)-Date.now())}</div><small>${esc(site(n).name)}</small>`:'<small>Keine anstehenden Starts</small>';
}
$('#search').oninput=e=>{state.q=e.target.value;safe(render,'#list')};
setInterval(()=>{try{tick()}catch(e){}},1000);

// ---- Karte (Leaflet + OpenStreetMap), nicht endlos scrollbar ----
function initMap(){
  if(map)return;
  const bounds=window.L.latLngBounds([[-85,-180],[85,180]]);
  map=window.L.map('map',{
    zoomControl:false,attributionControl:true,
    worldCopyJump:false,
    maxBounds:bounds,maxBoundsViscosity:1.0,
    minZoom:2,maxZoom:18
  }).setView([25,10],2);
  window.L.control.zoom({position:'bottomright'}).addTo(map);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,noWrap:true,bounds:bounds,attribution:'&copy; OpenStreetMap'}).addTo(map);
  layer=window.L.layerGroup().addTo(map);
  map.on('click',()=>{state.sel=null;info()});
}
function drawMap(){
  if(!map)return;
  layer.clearLayers();
  const up=upcoming(),pts=[];
  for(const [id,s] of Object.entries(S)){
    const n=up.filter(l=>l.site===id).length;
    if(!n||s.lat==null)continue;
    const icon=window.L.divIcon({className:'',html:`<div class="pin">${n}</div>`,iconSize:[26,26],iconAnchor:[13,13]});
    window.L.marker([s.lat,s.lon],{icon}).addTo(layer).on('click',e=>{window.L.DomEvent.stopPropagation(e);state.sel=id;info()});
    pts.push([s.lat,s.lon]);
  }
  if(pts.length&&!drawMap.fitted){map.fitBounds(pts,{padding:[40,40],maxZoom:4});drawMap.fitted=true}
  info();
}
function info(){
  const box=$('#mapinfo');
  if(!state.sel){box.hidden=true;return}
  const s=S[state.sel],ls=upcoming().filter(l=>l.site===state.sel);
  box.hidden=false;
  box.innerHTML=`<button class="x" aria-label="Schlie\u00dfen">\u00d7</button><b>${esc(s.name)}</b><div class="t2">${esc(s.country)}</div><p>${esc(s.info)}</p>${ls.map(l=>`<div class="t2">${fmtShort(l)} ${fmtTime(l)} \u2013 ${esc(l.rocket)} \u00b7 ${esc(l.payload)}</div>`).join('')}`;
  box.querySelector('.x').onclick=()=>{state.sel=null;info()};
}

// ---- Startplaetze ----
function siteCard(s,n,planned){
  return `<details class="card"><summary><span class="cc">${esc(s.code||'--')}</span><div class="grow"><div class="t1">${esc(s.name)}</div><div class="t2">${esc(s.country)}</div></div>${planned?`<span class="badge hot">${n.length} geplant</span>`:''}<span class="chev">\u203a</span></summary><div class="body"><p>${esc(s.info)}</p><dl><dt>Koordinaten</dt><dd>${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}</dd></dl>${n.map(l=>`<div class="t2">${fmtShort(l)} ${fmtTime(l)} \u2013 ${esc(l.rocket)} \u00b7 ${esc(l.payload)}</div>`).join('')}<a class="btn" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=10/${s.lat}/${s.lon}">Auf Karte</a></div></details>`;
}
function renderSites(){
  setupFilters(['#sCompany','#sRocket','#sCountry','#sType'],state.sf,renderSites);
  const q=state.sq.toLowerCase(),up=upcoming();
  const filtering=state.sf.company||state.sf.rocket||state.sf.type;
  const arr=Object.entries(S).map(([id,s])=>{
    const n=up.filter(l=>l.site===id&&match(l,{...state.sf,country:''},''));
    return {id,s,n};
  }).filter(({s,n})=>{
    if(state.sf.country&&s.country!==state.sf.country)return false;
    if(filtering&&!n.length)return false;
    if(q){const hay=(s.name+' '+s.country+' '+s.info+' '+n.map(l=>l.rocket+' '+l.payload+' '+company(l)).join(' ')).toLowerCase();if(!hay.includes(q))return false}
    return true;
  });
  const byName=(a,b)=>a.s.name.localeCompare(b.s.name,'de');
  const planned=arr.filter(x=>x.n.length).sort((a,b)=>b.n.length-a.n.length||byName(a,b));
  const rest=arr.filter(x=>!x.n.length).sort(byName);
  let html='';
  if(planned.length)html+=`<div class="sep">Mit geplanten Starts (${planned.length})</div>`+planned.map(x=>siteCard(x.s,x.n,true)).join('');
  if(rest.length)html+=`<div class="sep">Weitere Startpl\u00e4tze (${rest.length})</div>`+rest.map(x=>siteCard(x.s,x.n,false)).join('');
  $('#sites').innerHTML=html||'<div class="empty">Nichts gefunden.</div>';
}
$('#siteSearch').oninput=e=>{state.sq=e.target.value;safe(renderSites,'#sites')};

function safe(fn,sel){
  try{fn()}catch(e){console.error(e);const el=$(sel);if(el)el.innerHTML='<div class="empty">Fehler: '+esc(e.message)+'</div>'}
}
function renderAll(){
  safe(render,'#list');
  safe(renderSites,'#sites');
  try{drawMap()}catch(e){console.error(e)}
}

// ---- Daten laden ----
async function load(){
  try{
    const r=await fetch('data/launches.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    LAUNCHES=Array.isArray(j)?j:(j.launches||[]);
    if(j.updated)$('#updated').textContent=new Date(j.updated).toLocaleString('de-DE');
  }catch(e){
    console.error(e);
    if(window.LAUNCHES_FALLBACK)LAUNCHES=window.LAUNCHES_FALLBACK;
    else{$('#list').innerHTML='<div class="empty">Daten konnten nicht geladen werden: '+esc(e.message)+'</div>';return}
  }
  renderAll();
}
applyTheme();load();
})();
