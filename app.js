(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S=window.SITES;
let L=[];
const state={tz:localStorage.getItem('tz')||'local',theme:localStorage.getItem('theme')||'auto',country:'Alle',q:'',sel:null};

// Theme
function applyTheme(){
  const dark=state.theme==='dark'||(state.theme==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.mode=dark?'dark':'light';
  document.querySelector('meta[name=theme-color]').content=dark?'#0b1020':'#f4f6fb';
  $$('[data-theme]').forEach(b=>b.classList.toggle('sel',b.dataset.theme===state.theme));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);

// Menue
$('#menuBtn').onclick=e=>{e.stopPropagation();$('#menu').hidden=!$('#menu').hidden};
document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap'))$('#menu').hidden=true});
$$('[data-theme]').forEach(b=>b.onclick=()=>{state.theme=b.dataset.theme;localStorage.setItem('theme',state.theme);applyTheme();$('#menu').hidden=true});
$('#tzBtn').onclick=()=>{state.tz=state.tz==='local'?'UTC':'local';localStorage.setItem('tz',state.tz);$('#tzLabel').textContent=state.tz==='local'?'Lokal':'UTC';renderAll()};
$('#aboutBtn').onclick=()=>{$('#menu').hidden=true;$('#about').showModal()};
$('#reloadBtn').onclick=()=>{$('#menu').hidden=true;load()};
$('#tzLabel').textContent=state.tz==='local'?'Lokal':'UTC';

// Tabs
const titles={list:'N\u00e4chste Starts',map:'Startplatz-Karte',sites:'Startpl\u00e4tze'};
function show(v){
  $$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  $('#title').textContent=titles[v];
  scrollTo(0,0);
}
$$('.tab').forEach(t=>t.onclick=()=>show(t.dataset.view));

// Helfer
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
function upcoming(){const now=Date.now()-2*3600e3;return L.filter(l=>new Date(l.utc)>=now).sort((a,b)=>new Date(a.utc)-new Date(b.utc))}

// Liste
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
    html+=`<details class="card"><summary><span class="cc">${esc(s.code||'--')}</span><div class="grow"><div class="t1">${esc(l.payload)}</div><div class="t2">${esc(l.rocket)} \u00b7 ${esc(s.short||s.name)}</div></div><div class="time">${fmtTime(l)}<small>${fmtShort(l)}</small></div><span class="chev">\u203a</span></summary>
    <div class="body"><dl>
    <dt>Rakete</dt><dd>${esc(l.rocket)}</dd>
    <dt>Startplatz</dt><dd>${esc(s.name)}${l.pad?` <span class="badge">${esc(l.pad)}</span>`:''}</dd>
    <dt>Land</dt><dd>${esc(s.country)}</dd>
    ${l.detail?`<dt>Nutzlast</dt><dd>${esc(l.detail)}</dd>`:''}
    ${l.type?`<dt>Art / Zweck</dt><dd>${esc(l.type)}</dd>`:''}
    <dt>UTC</dt><dd>${new Date(l.utc).toISOString().replace('T',' ').slice(0,16)}${l.approx?' (ca.)':''}</dd>
    </dl>${s.lat!=null?`<a class="btn" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=9/${s.lat}/${s.lon}">Auf Karte</a>`:''}
    <a class="btn ghost" target="_blank" rel="noopener" href="https://de.wikipedia.org/wiki/Liste_geplanter_orbitaler_Raketenstarts">Wikipedia</a></div></details>`;
  }
  $('#list').innerHTML=html||'<div class="empty">Keine Starts gefunden.</div>';
  tick();
}
function tick(){
  const n=upcoming().find(l=>new Date(l.utc)>Date.now());
  $('#countdown').innerHTML=n?`<small>N\u00e4chster Start</small><div class="name">${esc(n.payload)} \u00b7 ${esc(n.rocket)}</div><div class="big">${rel(new Date(n.utc)-Date.now())}</div><small>${esc(site(n).name)}</small>`:'<small>Keine anstehenden Starts</small>';
}
$('#search').oninput=e=>{state.q=e.target.value;render()};
setInterval(tick,1000);

// Karte (eigenes SVG, keine externen Kacheln)
// Vereinfachte Kontinent-Umrisse als [lon,lat]-Polygone
const LAND=[
 [[-168,66],[-162,70],[-140,70],[-125,70],[-95,72],[-80,73],[-62,66],[-56,52],[-66,45],[-71,41],[-76,35],[-81,31],[-80,25],[-83,29],[-90,30],[-97,27],[-97,21],[-90,21],[-87,21],[-83,10],[-77,8],[-80,7],[-86,12],[-92,15],[-105,20],[-110,24],[-113,31],[-118,34],[-124,40],[-124,48],[-135,58],[-150,60],[-165,60],[-168,66]],
 [[-80,9],[-62,10],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-65,-42],[-68,-52],[-73,-50],[-72,-35],[-71,-18],[-77,-12],[-81,-5],[-78,2],[-80,9]],
 [[-10,36],[-9,43],[-2,47],[-5,50],[3,52],[8,55],[10,58],[18,60],[22,66],[28,71],[40,68],[60,69],[80,73],[110,77],[140,72],[170,70],[180,66],[160,60],[156,51],[142,52],[140,45],[130,40],[128,35],[122,40],[121,31],[110,20],[106,10],[100,13],[104,2],[98,8],[92,22],[80,14],[77,8],[72,20],[67,25],[57,25],[50,30],[56,25],[59,22],[52,16],[43,13],[35,28],[34,31],[27,37],[30,41],[40,42],[28,41],[24,38],[16,40],[12,44],[3,43],[-10,36]],
 [[-17,21],[-10,35],[10,37],[32,31],[43,12],[51,12],[40,-2],[40,-15],[33,-26],[20,-35],[14,-22],[12,-6],[9,4],[-8,5],[-17,14],[-17,21]],
 [[113,-22],[130,-12],[142,-11],[146,-19],[153,-28],[150,-37],[140,-38],[131,-31],[115,-34],[113,-22]],
 [[-73,78],[-50,83],[-20,82],[-20,70],[-45,60],[-55,68],[-73,78]],
 [[-24,64],[-14,66],[-14,64],[-22,63],[-24,64]],
 [[130,31],[141,41],[142,45],[135,35],[130,31]],
 [[-6,50],[2,53],[-3,58],[-6,56],[-6,50]],
 [[166,-46],[174,-41],[178,-38],[172,-34],[168,-44],[166,-46]],
 [[95,5],[105,-6],[115,-8],[120,-5],[110,2],[100,4],[95,5]]
];
const W=1000,H=500;
const px=(lon,lat)=>[(lon+180)/360*W,(90-lat)/180*H];
const view={x:0,y:0,w:W,h:H};
function setView(){const m=$('#map svg');if(m)m.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);const k=view.w/W;$$('#map .mk').forEach(g=>g.setAttribute('transform',g.dataset.t+` scale(${k})`));}
function zoomBy(f,cx,cy){
  const nw=Math.max(60,Math.min(W,view.w/f)),nh=nw/2;
  cx=cx==null?view.x+view.w/2:cx;cy=cy==null?view.y+view.h/2:cy;
  view.x=cx-(cx-view.x)*nw/view.w;view.y=cy-(cy-view.y)*nh/view.h;view.w=nw;view.h=nh;
  view.x=Math.max(0,Math.min(W-view.w,view.x));view.y=Math.max(0,Math.min(H-view.h,view.y));setView();
}
function drawMap(){
  const up=upcoming();
  let g='';
  for(let lon=-180;lon<=180;lon+=30){const [x]=px(lon,0);g+=`<line x1="${x}" y1="0" x2="${x}" y2="${H}" class="grid"/>`}
  for(let lat=-60;lat<=60;lat+=30){const [,y]=px(0,lat);g+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="grid"/>`}
  g+=LAND.map(p=>`<polygon class="land" points="${p.map(([lo,la])=>px(lo,la).map(v=>v.toFixed(1)).join(',')).join(' ')}"/>`).join('');
  const entries=Object.entries(S).map(([id,s])=>({id,s,n:up.filter(l=>l.site===id).length})).sort((a,b)=>a.n-b.n);
  for(const {id,s,n} of entries){
    const [x,y]=px(s.lon,s.lat);
    g+=`<g class="mk ${n?'hot':''} ${state.sel===id?'act':''}" data-id="${id}" data-t="translate(${x.toFixed(1)} ${y.toFixed(1)})" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${n?11:7}"/>${n?`<text y="4" text-anchor="middle">${n}</text>`:''}</g>`;
  }
  $('#map').innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><rect width="${W}" height="${H}" class="sea"/>${g}</svg>`;
  $$('#map .mk').forEach(m=>m.onclick=e=>{e.stopPropagation();state.sel=m.dataset.id;info();drawMap()});
  setView();
}
function info(){
  const box=$('#mapinfo');
  if(!state.sel){box.hidden=true;return}
  const s=S[state.sel],ls=upcoming().filter(l=>l.site===state.sel);
  box.hidden=false;
  box.innerHTML=`<button class="x" aria-label="Schlie\u00dfen">\u00d7</button><b>${esc(s.name)}</b><div class="t2">${esc(s.country)}</div><p>${esc(s.info)}</p>${ls.length?ls.map(l=>`<div class="t2">${fmtShort(l)} ${fmtTime(l)} \u2013 ${esc(l.payload)} (${esc(l.rocket)})</div>`).join(''):'<div class="t2"><i>Keine geplanten Starts</i></div>'}`;
  box.querySelector('.x').onclick=()=>{state.sel=null;info();drawMap()};
}
(function mapControls(){
  const m=$('#map');
  $('#zin').onclick=()=>zoomBy(1.6);
  $('#zout').onclick=()=>zoomBy(1/1.6);
  $('#zreset').onclick=()=>{view.x=0;view.y=0;view.w=W;view.h=H;setView()};
  m.addEventListener('wheel',e=>{e.preventDefault();const r=m.getBoundingClientRect();zoomBy(e.deltaY<0?1.2:1/1.2,view.x+(e.clientX-r.left)/r.width*view.w,view.y+(e.clientY-r.top)/r.height*view.h)},{passive:false});
  let drag=null,pinch=null;
  const pts=new Map();
  m.addEventListener('pointerdown',e=>{pts.set(e.pointerId,e);drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};});
  m.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId))return;pts.set(e.pointerId,e);
    const r=m.getBoundingClientRect();
    if(pts.size===2){
      const [a,b]=[...pts.values()],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      if(pinch){zoomBy(d/pinch)}
      pinch=d;drag=null;return;
    }
    if(drag){
      const sc=view.w/r.width;
      view.x=Math.max(0,Math.min(W-view.w,drag.vx-(e.clientX-drag.x)*sc));
      view.y=Math.max(0,Math.min(H-view.h,drag.vy-(e.clientY-drag.y)*sc));
      setView();
    }
  });
  const up=e=>{pts.delete(e.pointerId);pinch=null;if(!pts.size)drag=null};
  m.addEventListener('pointerup',up);m.addEventListener('pointercancel',up);m.addEventListener('pointerleave',up);
})();

// Startplaetze
function renderSites(){
  const q=$('#siteSearch').value.toLowerCase(),up=upcoming();
  const arr=Object.entries(S).map(([id,s])=>({id,s,n:up.filter(l=>l.site===id)})).filter(({s})=>!q||(s.name+s.country+s.info).toLowerCase().includes(q)).sort((a,b)=>b.n.length-a.n.length||a.s.name.localeCompare(b.s.name));
  $('#sites').innerHTML=arr.map(({s,n})=>`<details class="card"><summary><span class="cc">${esc(s.code||'--')}</span><div class="grow"><div class="t1">${esc(s.name)}</div><div class="t2">${esc(s.country)}</div></div><span class="badge">${n.length} geplant</span><span class="chev">\u203a</span></summary><div class="body"><p>${esc(s.info)}</p><dl><dt>Koordinaten</dt><dd>${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}</dd></dl>${n.map(l=>`<div class="t2">${fmtShort(l)} ${fmtTime(l)} \u2013 ${esc(l.payload)} (${esc(l.rocket)})</div>`).join('')}</div></details>`).join('')||'<div class="empty">Nichts gefunden.</div>';
}
$('#siteSearch').oninput=renderSites;

function renderAll(){render();renderSites();drawMap();info()}

// Daten laden (von Wikipedia per Workflow synchronisiert)
async function load(){
  try{
    const r=await fetch('data/launches.json?t='+Date.now(),{cache:'no-store'});
    const j=await r.json();
    L=j.launches||[];
    $('#updated').textContent=new Date(j.updated).toLocaleString('de-DE');
  }catch(e){
    $('#list').innerHTML='<div class="empty">Daten konnten nicht geladen werden.</div>';
    return;
  }
  renderAll();
}
applyTheme();load();
})();
