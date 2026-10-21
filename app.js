(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S=window.SITES, L=window.LAUNCHES;
const state={tz:localStorage.getItem('tz')||'local',theme:localStorage.getItem('theme')||'auto',country:'Alle',q:'',map:null};

// ---- Theme ----
function applyTheme(){
  const dark=state.theme==='dark'||(state.theme==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.mode=dark?'dark':'light';
  document.querySelector('meta[name=theme-color]').content=dark?'#0b1020':'#f4f6fb';
  $$('[data-theme]').forEach(b=>b.classList.toggle('sel',b.dataset.theme===state.theme));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);

// ---- Menü ----
$('#menuBtn').onclick=e=>{e.stopPropagation();$('#menu').hidden=!$('#menu').hidden};
document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap'))$('#menu').hidden=true});
$$('[data-theme]').forEach(b=>b.onclick=()=>{state.theme=b.dataset.theme;localStorage.setItem('theme',state.theme);applyTheme();$('#menu').hidden=true});
$('#tzBtn').onclick=()=>{state.tz=state.tz==='local'?'UTC':'local';localStorage.setItem('tz',state.tz);$('#tzLabel').textContent=state.tz==='local'?'Lokal':'UTC';render()};
$('#aboutBtn').onclick=()=>{$('#menu').hidden=true;$('#about').showModal()};
$('#tzLabel').textContent=state.tz==='local'?'Lokal':'UTC';
$('#updated').textContent=window.LAUNCHES_UPDATED;

// ---- Tabs ----
const titles={list:'🚀 Nächste Starts',map:'🗺️ Startplatz-Karte',sites:'📍 Startplätze'};
function show(v){
  $$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  $('#title').textContent=titles[v];
  if(v==='map'){initMap();setTimeout(()=>state.map.invalidateSize(),50)}
  scrollTo(0,0);
}
$$('.tab').forEach(t=>t.onclick=()=>show(t.dataset.view));

// ---- Helfer ----
const tzOpt=()=>state.tz==='UTC'?{timeZone:'UTC'}:{};
const fmtDay=d=>d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric',...tzOpt()});
const fmtTime=l=>{const d=new Date(l.utc);return (l.approx?'ca. ':'')+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',...tzOpt()})+(state.tz==='UTC'?' UTC':'')};
const fmtShort=l=>new Date(l.utc).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',...tzOpt()});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const site=l=>S[l.site]||{name:l.pad||'Unbekannt',country:l.country,flag:l.flag,info:''};
function rel(ms){
  if(ms<=0)return 'gestartet / läuft';
  const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60;
  return (d?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}
function upcoming(){const now=Date.now()-2*3600e3;return L.filter(l=>new Date(l.utc)>=now).sort((a,b)=>new Date(a.utc)-new Date(b.utc))}

// ---- Liste ----
function chips(){
  const cs=['Alle',...new Set(upcoming().map(l=>site(l).country))];
  $('#chips').innerHTML=cs.map(c=>`<button class="chip ${c===state.country?'on':''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  $$('.chip').forEach(b=>b.onclick=()=>{state.country=b.dataset.c;render()});
}
function render(){
  chips();
  const q=state.q.toLowerCase();
  const items=upcoming().filter(l=>(state.country==='Alle'||site(l).country===state.country)&&(!q||[l.rocket,l.payload,l.detail,l.type,site(l).name,l.pad].join(' ').toLowerCase().includes(q)));
  let html='',last='';
  for(const l of items){
    const day=fmtDay(new Date(l.utc));
    if(day!==last){html+=`<div class="day">${day}</div>`;last=day}
    const s=site(l);
    html+=`<details class="card"><summary><span class="flag">${l.flag||s.flag}</span><div class="grow"><div class="t1">${esc(l.payload)}</div><div class="t2">${esc(l.rocket)} · ${esc(s.short||s.name)}</div></div><div class="time">${fmtTime(l)}<small>${fmtShort(l)}</small></div><span class="chev">›</span></summary>
    <div class="body"><dl>
    <dt>Rakete</dt><dd>${esc(l.rocket)}</dd>
    <dt>Startplatz</dt><dd>${esc(s.name)}${l.pad?` <span class="badge">${esc(l.pad)}</span>`:''}</dd>
    <dt>Land</dt><dd>${esc(l.country)}</dd>
    ${l.detail?`<dt>Nutzlast</dt><dd>${esc(l.detail)}</dd>`:''}
    ${l.type?`<dt>Art / Zweck</dt><dd>${esc(l.type)}</dd>`:''}
    <dt>UTC</dt><dd>${new Date(l.utc).toISOString().replace('T',' ').slice(0,16)}${l.approx?' (ca.)':''}</dd>
    </dl>${s.lat?`<a class="btn" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=9/${s.lat}/${s.lon}">Auf Karte</a>`:''}
    <a class="btn ghost" target="_blank" rel="noopener" href="https://de.wikipedia.org/wiki/Liste_geplanter_orbitaler_Raketenstarts">Wikipedia</a></div></details>`;
  }
  $('#list').innerHTML=html||'<div class="empty">Keine Starts gefunden.</div>';
  tick();
}
function tick(){
  const n=upcoming().find(l=>new Date(l.utc)>Date.now());
  $('#countdown').innerHTML=n?`<small>Nächster Start</small><div class="name">${esc(n.payload)} · ${esc(n.rocket)}</div><div class="big">${rel(new Date(n.utc)-Date.now())}</div><small>${esc(site(n).name)}</small>`:'';
}
$('#search').oninput=e=>{state.q=e.target.value;render()};
setInterval(tick,1000);

// ---- Karte ----
function initMap(){
  if(state.map)return;
  state.map=L.map('map',{worldCopyJump:true}).setView([25,10],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(state.map);
  const up=upcoming();
  Object.entries(S).forEach(([id,s])=>{
    const ls=up.filter(l=>l.site===id);
    const icon=L.divIcon({className:'',html:`<div style="background:${ls.length?'#f5524f':'#4f6df5'};color:#fff;border-radius:50%;width:${ls.length?30:20}px;height:${ls.length?30:20}px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${ls.length||''}</div>`,iconSize:[30,30],iconAnchor:[15,15]});
    L.marker([s.lat,s.lon],{icon}).addTo(state.map).bindPopup(`<b>${s.flag} ${esc(s.name)}</b><br>${esc(s.country)}<br><small>${esc(s.info)}</small><br>${ls.length?'<hr>'+ls.map(l=>`${fmtShort(l)} ${fmtTime(l)} – ${esc(l.payload)} (${esc(l.rocket)})`).join('<br>'):'<i>Keine geplanten Starts</i>'}`);
  });
}

// ---- Startplätze ----
function renderSites(){
  const q=$('#siteSearch').value.toLowerCase(),up=upcoming();
  const arr=Object.entries(S).map(([id,s])=>({id,s,n:up.filter(l=>l.site===id)})).filter(({s})=>!q||(s.name+s.country+s.info).toLowerCase().includes(q)).sort((a,b)=>b.n.length-a.n.length||a.s.name.localeCompare(b.s.name));
  $('#sites').innerHTML=arr.map(({s,n})=>`<details class="card"><summary><span class="flag">${s.flag}</span><div class="grow"><div class="t1">${esc(s.name)}</div><div class="t2">${esc(s.country)}</div></div><span class="badge">${n.length} geplant</span><span class="chev">›</span></summary><div class="body"><p>${esc(s.info)}</p><dl><dt>Koordinaten</dt><dd>${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}</dd></dl>${n.map(l=>`<div class="t2">• ${fmtShort(l)} ${fmtTime(l)} – ${esc(l.payload)} (${esc(l.rocket)})</div>`).join('')}</div></details>`).join('')||'<div class="empty">Nichts gefunden.</div>';
}
$('#siteSearch').oninput=renderSites;

applyTheme();render();renderSites();
})();
