(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S=window.SITES||{};
let LAUNCHES=[];
let LL2=[];            // Raw-Daten The Space Devs (Launch Library 2)
let LL2_STATE='idle';  // idle | loading | ok | error
const state={tz:localStorage.getItem('tz')||'local',theme:localStorage.getItem('theme')||'system',q:'',sq:'',sel:null,
  f:{company:'',rocket:'',pad:'',country:'',type:''},sf:{company:'',rocket:'',pad:'',country:'',type:''}};
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
$('#reloadBtn').onclick=()=>{$('#menu').hidden=true;try{localStorage.removeItem(LL2_CACHE_KEY)}catch(e){}load()};
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
const esc=s=>String(s==null?'':s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const site=l=>S[l.site]||{name:l.pad||'Unbekannt',country:'Unbekannt',info:''};
function rel(ms){
  if(ms<=0)return 'l\u00e4uft';
  const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60;
  return (d?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}
function fmtDiff(min){
  const a=Math.abs(min);
  if(a<60)return a+' Min.';
  const h=Math.floor(a/60),m=a%60;
  return h+' Std.'+(m?' '+m+' Min.':'');
}

// ---- The Space Devs (Launch Library 2) ----
const LL2_URL='https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=50&mode=normal&hide_recent_previous=true';
const LL2_CACHE_KEY='ll2cache.v1';
const LL2_TTL=30*60*1000; // 30 Min, Free-Tier ist stark rate-limitiert

async function loadLL2(){
  LL2_STATE='loading';
  try{
    const raw=localStorage.getItem(LL2_CACHE_KEY);
    if(raw){
      const c=JSON.parse(raw);
      if(c&&Date.now()-c.t<LL2_TTL&&Array.isArray(c.results)){LL2=c.results;LL2_STATE='ok';return}
    }
  }catch(e){}
  try{
    const r=await fetch(LL2_URL,{headers:{'Accept':'application/json'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    LL2=(j.results||[]).map(x=>({
      id:x.id,
      name:x.name||'',
      net:x.net,
      status:(x.status&&x.status.abbrev)||'',
      statusName:(x.status&&x.status.name)||'',
      rocket:(x.rocket&&x.rocket.configuration&&(x.rocket.configuration.full_name||x.rocket.configuration.name))||'',
      rocketShort:(x.rocket&&x.rocket.configuration&&x.rocket.configuration.name)||'',
      provider:(x.launch_service_provider&&x.launch_service_provider.name)||'',
      mission:(x.mission&&x.mission.name)||'',
      missionType:(x.mission&&x.mission.type)||'',
      padName:(x.pad&&x.pad.name)||'',
      location:(x.pad&&x.pad.location&&x.pad.location.name)||'',
      vids:(x.vidURLs||[]).map(v=>({url:v.url,title:v.title||'',priority:v.priority||0,live:!!v.live}))
    }));
    LL2_STATE='ok';
    try{localStorage.setItem(LL2_CACHE_KEY,JSON.stringify({t:Date.now(),results:LL2}))}catch(e){}
  }catch(e){
    console.warn('Space Devs API nicht verf\u00fcgbar:',e);
    // abgelaufenen Cache besser als nichts verwenden
    try{
      const raw=localStorage.getItem(LL2_CACHE_KEY);
      if(raw){const c=JSON.parse(raw);if(c&&Array.isArray(c.results)){LL2=c.results;LL2_STATE='ok';return}}
    }catch(e2){}
    LL2=[];LL2_STATE='error';
  }
}

// Raketen-Namen normalisieren, um Wikipedia- und LL2-Bezeichnungen zu vergleichen
function rocketKey(s){
  s=String(s||'').toLowerCase();
  if(/falcon\s*heavy/.test(s))return 'falconheavy';
  if(/falcon\s*9/.test(s))return 'falcon9';
  if(/starship/.test(s))return 'starship';
  if(/electron/.test(s))return 'electron';
  if(/neutron/.test(s))return 'neutron';
  if(/vulcan/.test(s))return 'vulcan';
  if(/atlas/.test(s))return 'atlas';
  if(/new\s*glenn/.test(s))return 'newglenn';
  if(/ariane\s*6/.test(s))return 'ariane6';
  if(/vega/.test(s))return 'vega';
  if(/soyuz|sojus/.test(s))return 'soyuz';
  if(/angara/.test(s))return 'angara';
  if(/proton/.test(s))return 'proton';
  if(/pslv/.test(s))return 'pslv';
  if(/gslv/.test(s))return 'gslv';
  if(/lvm\s*3/.test(s))return 'lvm3';
  if(/h3|h-iii/.test(s))return 'h3';
  const cz=s.match(/(?:cz|long\s*march|langer\s*marsch)[\s-]*(\d+[a-z]?)/);
  if(cz)return 'cz'+cz[1];
  const zq=s.match(/zhuque[\s-]*(\d+[a-z]?)/);
  if(zq)return 'zhuque'+zq[1];
  return s.replace(/[^a-z0-9]/g,'').slice(0,14);
}
const MATCH_WINDOW=12*3600e3;
function findLL2(l){
  if(!LL2.length)return null;
  const t=new Date(l.utc).getTime(),k=rocketKey(l.rocket);
  let best=null,bd=Infinity;
  for(const x of LL2){
    if(rocketKey(x.rocket)!==k&&rocketKey(x.rocketShort)!==k)continue;
    const d=Math.abs(new Date(x.net).getTime()-t);
    if(d<MATCH_WINDOW&&d<bd){best=x;bd=d}
  }
  return best;
}
function bestVid(x){
  if(!x||!x.vids||!x.vids.length)return null;
  const yt=u=>/youtube\.com|youtu\.be/i.test(u);
  const sorted=[...x.vids].sort((a,b)=>(yt(b.url)-yt(a.url))||(b.priority-a.priority));
  return sorted[0];
}
function streamLinks(l,x){
  const out=[];
  const v=bestVid(x);
  if(v)out.push({url:v.url,label:(/youtube\.com|youtu\.be/i.test(v.url)?'Livestream (YouTube)':'Livestream'),live:v.live});
  const q=encodeURIComponent(((x&&x.name)||(l.rocket+' '+l.payload))+' launch live');
  out.push({url:'https://www.youtube.com/results?search_query='+q+'&sp=EgJAAQ%253D%253D',label:v?'Weitere Streams auf YouTube':'Livestream auf YouTube suchen',live:false,search:true});
  return out;
}
// Vergleich Wikipedia <-> LL2 fuer einen Eintrag
function compare(l){
  if(LL2_STATE!=='ok')return null;
  const x=findLL2(l);
  if(!x)return {kind:'missing',x:null};
  const diff=Math.round((new Date(x.net).getTime()-new Date(l.utc).getTime())/60000);
  const tol=l.approx?180:10;
  return {kind:Math.abs(diff)<=tol?'ok':'diff',x,diff};
}
function badge(c){
  if(!c)return '';
  if(c.kind==='ok')return '<span class="badge ok" title="Wikipedia und The Space Devs stimmen \u00fcberein">\u2713 Quellen gleich</span>';
  if(c.kind==='diff')return '<span class="badge hot" title="Wikipedia und The Space Devs weichen ab">\u0394 '+(c.diff>0?'+':'\u2212')+esc(fmtDiff(c.diff))+'</span>';
  return '<span class="badge" title="Kein passender Eintrag bei The Space Devs">nur Wikipedia</span>';
}

// ---- Gemergte Startliste (Wikipedia + Space Devs) ----
function merged(){
  const base=LAUNCHES.map(l=>({...l,src:'wiki'}));
  if(LL2_STATE!=='ok')return base;
  const used=new Set();
  for(const l of base){const x=findLL2(l);if(x)used.add(x.id)}
  const extra=[];
  for(const x of LL2){
    if(used.has(x.id))continue;
    const loc=(x.location||'').toLowerCase()+' '+(x.padName||'').toLowerCase();
    let siteId=null;
    for(const [id,s] of Object.entries(S)){
      const n=(s.name||'').toLowerCase().split(/[,(]/)[0].trim();
      if(n&&n.length>3&&loc.includes(n)){siteId=id;break}
    }
    extra.push({
      utc:x.net,approx:/TBD|TBC/i.test(x.status),
      rocket:x.rocketShort||x.rocket||'Unbekannt',
      pad:x.padName||'',site:siteId,
      payload:x.mission||x.name.split('|').pop().trim()||'Nutzlast noch unbekannt',
      detail:'',type:x.missionType||'',src:'ll2',ll2:x
    });
  }
  return base.concat(extra);
}
function upcoming(){const now=Date.now()-2*3600e3;return merged().filter(l=>new Date(l.utc)>=now).sort((a,b)=>new Date(a.utc)-new Date(b.utc))}

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
// Startplatz-Anzeige: bevorzugt pad, sonst Site-Name aus sites.js
const padOf=l=>{const s=site(l);return l.pad||s.name||'Unbekannt'};

function fillSelect(el,label,values,cur){
  el.innerHTML=`<option value="">${label}: alle</option>`+values.map(v=>`<option ${v===cur?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');
  el.classList.toggle('on',!!cur);
}
const uniq=a=>[...new Set(a.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));

// Filter-Konfiguration: jede Definition zieht ihre Werte dynamisch aus den Daten.
// Reihenfolge = Reihenfolge in der UI. Neue Felder einfach hier ergaenzen.
const FILTER_DEFS=[
  {key:'company', label:'Firma',  get:l=>company(l)},
  {key:'rocket',  label:'Rakete', get:l=>l.rocket},
  {key:'pad',     label:'Startplatz', get:l=>padOf(l)},
  {key:'country', label:'Land',   get:l=>site(l).country},
  {key:'type',    label:'Zweck',  get:l=>typeOf(l)},
];

function match(l,f,q){
  const s=site(l);
  if(f.company&&company(l)!==f.company)return false;
  if(f.rocket&&l.rocket!==f.rocket)return false;
  if(f.pad&&padOf(l)!==f.pad)return false;
  if(f.country&&s.country!==f.country)return false;
  if(f.type&&typeOf(l)!==f.type)return false;
  if(q&&![l.rocket,l.payload,l.detail,l.type,s.name,l.pad,company(l),s.country].join(' ').toLowerCase().includes(q))return false;
  return true;
}

function setupFilters(ids,f,cb){
  const up=upcoming();
  ids.forEach((selId,i)=>{
    const def=FILTER_DEFS[i];
    if(!def)return;
    const el=$(selId);
    fillSelect(el,def.label,uniq(up.map(def.get)),f[def.key]);
    el.onchange=()=>{f[def.key]=el.value;cb()};
  });
}

// ---- Liste ----
function render(){
  setupFilters(['#fCompany','#fRocket','#fPad','#fCountry','#fType'],state.f,render);
  const q=state.q.toLowerCase();
  const items=upcoming().filter(l=>match(l,state.f,q));
  let html='',last='';
  for(const l of items){
    const day=fmtDay(new Date(l.utc));
    if(day!==last){html+=`<div class="day">${day}</div>`;last=day}
    const s=site(l);
    const c=l.src==='ll2'?null:compare(l);
    const x=l.src==='ll2'?l.ll2:(c&&c.x);
    const links=streamLinks(l,x);
    const main=links[0];
    const hasVid=!!bestVid(x);
    const liveNow=!!(main&&main.live);
    const badges=l.src==='ll2'
      ?'<span class="badge" title="Nur bei The Space Devs gelistet">nur Space Devs</span>'
      :badge(c);
    html+=`<details class="card"><summary>
      <div class="cc">${esc(s.code||'--')}</div>
      <div class="grow"><div class="t1">${esc(l.rocket)}</div><div class="t2">${esc(l.payload)} \u00b7 ${esc(s.short||s.name)}</div></div>
      <div class="time">${fmtTime(l)}<small>${fmtShort(l)}</small></div>
      ${hasVid?`<a class="live${liveNow?' now':''}" href="${esc(main.url)}" target="_blank" rel="noopener" title="${esc(main.label)}" aria-label="${esc(main.label)}" onclick="event.stopPropagation()">\u25b6</a>`:''}
      <div class="chev">\u203a</div>
    </summary>
    <div class="body">
      <div class="badges">${badges}${x&&x.statusName?`<span class="badge" title="Status laut The Space Devs">${esc(x.statusName)}</span>`:''}</div>
      <dl>
      <dt>Rakete</dt><dd>${esc(l.rocket)} ${esc(company(l))}</dd>
      <dt>Nutzlast</dt><dd>${esc(l.payload)}</dd>
      ${l.detail?`<dt>Details</dt><dd>${esc(l.detail)}</dd>`:''}
      ${l.type?`<dt>Zweck</dt><dd>${esc(l.type)}</dd>`:''}
      <dt>Startplatz</dt><dd>${esc(s.name)}${l.pad?` \u00b7 ${esc(l.pad)}`:''}</dd>
      <dt>Land</dt><dd>${esc(s.country)}</dd>
      <dt>${l.src==='ll2'?'UTC':'UTC (Wikipedia)'}</dt><dd>${new Date(l.utc).toISOString().replace('T',' ').slice(0,16)}${l.approx?' (ca.)':''}</dd>
      ${l.src!=='ll2'&&x?`<dt>UTC (Space Devs)</dt><dd>${new Date(x.net).toISOString().replace('T',' ').slice(0,16)}${c&&c.kind==='diff'?` <b class="diff">(${c.diff>0?'+':'\u2212'}${esc(fmtDiff(c.diff))})</b>`:''}</dd>`:''}
      ${s.lat!=null?`<dt>Karte</dt><dd><a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=9/${s.lat}/${s.lon}" target="_blank" rel="noopener">Auf Karte</a> <a href="https://de.wikipedia.org/wiki/Liste_geplanter_orbitaler_Raketenstarts" target="_blank" rel="noopener">Wikipedia</a></dd>`:''}
    </dl>
    <div class="streams">${links.map(k=>`<a class="btn${k.search?' ghost':''}" href="${esc(k.url)}" target="_blank" rel="noopener">${k.live?'\ud83d\udd34 ':'\u25b6 '}${esc(k.label)}</a>`).join('')}</div>
    </div></details>`;
  }
  $('#list').innerHTML=html||'<div class="empty">Keine Starts gefunden.</div>';
  tick();
  srcInfo();
}
function srcInfo(){
  const el=$('#srcinfo');if(!el)return;
  const m={ok:'Quellen: Wikipedia + The Space Devs',loading:'Lade The Space Devs \u2026',error:'The Space Devs nicht erreichbar \u2013 nur Wikipedia',idle:''};
  el.textContent=m[LL2_STATE]||'';
  el.classList.toggle('warn',LL2_STATE==='error');
}
function tick(){
  const n=upcoming().find(l=>new Date(l.utc)>Date.now());
  $('#countdown').innerHTML=n?`N\u00e4chster Start<div class="name">${esc(n.rocket)} \u00b7 ${esc(n.payload)}</div><div class="big">${rel(new Date(n.utc)-Date.now())}</div><small>${esc(site(n).name)}</small>`:'Keine anstehenden Starts';
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
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,noWrap:true,bounds:bounds,attribution:'\u00a9 OpenStreetMap'}).addTo(map);
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
  box.innerHTML=`<button class="x" aria-label="Schlie\u00dfen">\u00d7</button><b>${esc(s.name)}</b><p class="muted">${esc(s.country)}</p><p>${esc(s.info)}</p>${ls.map(l=>`<p>${fmtShort(l)} ${fmtTime(l)} \u2013 ${esc(l.rocket)} \u00b7 ${esc(l.payload)}</p>`).join('')}`;
  box.querySelector('.x').onclick=()=>{state.sel=null;info()};
}

// ---- Startplaetze ----
function siteCard(s,n,planned){
  return `<details class="card"><summary>
    <div class="cc">${esc(s.code||'--')}</div>
    <div class="grow"><div class="t1">${esc(s.name)}</div><div class="t2">${esc(s.country)}${planned?` \u00b7 ${n.length} geplant`:''}</div></div>
    <div class="chev">\u203a</div>
  </summary>
  <div class="body"><p>${esc(s.info)}</p><dl>
    <dt>Koordinaten</dt><dd>${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}</dd>
  </dl>${n.map(l=>`<p>${fmtShort(l)} ${fmtTime(l)} \u2013 ${esc(l.rocket)} \u00b7 ${esc(l.payload)}</p>`).join('')}<a class="btn ghost" href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=10/${s.lat}/${s.lon}" target="_blank" rel="noopener">Auf Karte</a></div></details>`;
}
function renderSites(){
  setupFilters(['#sCompany','#sRocket','#sPad','#sCountry','#sType'],state.sf,renderSites);
  const q=state.sq.toLowerCase(),up=upcoming();
  const filtering=state.sf.company||state.sf.rocket||state.sf.type||state.sf.pad;
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
  const planned=arr.filter(x=>x.n.length).sort(byName);
  const rest=arr.filter(x=>!x.n.length).sort(byName);
  let html='';
  if(planned.length)html+=`<div class="sep">Geplant</div>`+planned.map(x=>siteCard(x.s,x.n,true)).join('');
  if(rest.length)html+=`<div class="sep">Weitere</div>`+rest.map(x=>siteCard(x.s,x.n,false)).join('');
  $('#sites').innerHTML=html||'<div class="empty">Keine Startpl\u00e4tze gefunden.</div>';
}

function safe(fn,sel){
  try{const el=$(sel);if(el)fn();else console.warn('missing',sel)}catch(e){console.error(e)}
}
function renderAll(){
  safe(render,'#list');
  safe(renderSites,'#sites');
  try{drawMap()}catch(e){console.error(e)}
}

// ---- Daten laden ----
async function loadWiki(){
  try{
    const r=await fetch('data/launches.json',{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    LAUNCHES=Array.isArray(j)?j:(j.launches||[]);
    const u=$('#updated');if(u&&j.updated)u.textContent=j.updated.replace('T',' ').replace('Z',' UTC');
  }catch(e){
    console.error(e);
    const fb=await fetch('data/launches.js',{cache:'no-store'}).then(r=>r.ok?r.text():'');
    if(fb){try{LAUNCHES=eval(fb.replace(/^window\.LAUNCHES\s*=\s*/,'[')+';]');}catch(e2){LAUNCHES=[]}}
  }
}
async function load(){
  // Wikipedia-Daten zuerst anzeigen, Space Devs danach nachladen und neu rendern
  LL2_STATE='loading';
  await loadWiki();
  renderAll();
  await loadLL2();
  renderAll();
}
applyTheme();load();
})();
