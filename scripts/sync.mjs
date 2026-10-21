// Synchronisiert data/launches.json mit der deutschen Wikipedia-Liste.
// Laeuft in GitHub Actions (Node 20, global fetch).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const API = 'https://de.wikipedia.org/w/api.php?action=parse&page=Liste_geplanter_orbitaler_Raketenstarts&prop=text&format=json&formatversion=2&redirects=1';
const UA = 'orbital-launches-app/1.0 (https://github.com/3Dudel/orbital-launches-app)';

const sitesSrc = readFileSync('data/sites.js', 'utf8');
const aliasBlock = sitesSrc.slice(sitesSrc.indexOf('window.SITE_ALIAS'));
const ALIAS = [...aliasBlock.matchAll(/\[\/(.+?)\/i,\s*"(\w+)"\]/g)].map(m => [new RegExp(m[1], 'i'), m[2]]);

const MONTHS = { 'Januar':1,'Februar':2,'März':3,'April':4,'Mai':5,'Juni':6,'Juli':7,'August':8,'September':9,'Oktober':10,'November':11,'Dezember':12 };

const decode = s => s
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const clean = html => decode(html
  .replace(/<sup[\s\S]*?<\/sup>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<br\s*\/?>/gi, ' / ')
  .replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

function siteFor(text) {
  for (const [re, id] of ALIAS) if (re.test(text)) return id;
  return null;
}

// Berlin -> UTC (MEZ/MESZ). Letzter Sonntag im Maerz/Oktober, 01:00 UTC.
function lastSunday(y, m) { const d = new Date(Date.UTC(y, m + 1, 0)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d; }
function berlinOffset(y, mo, d, h) {
  const s = lastSunday(y, 2); s.setUTCHours(1);
  const e = lastSunday(y, 9); e.setUTCHours(1);
  const t = Date.UTC(y, mo - 1, d, h) - 3600e3; // grob als MEZ interpretiert
  return t >= s.getTime() && t < e.getTime() ? 2 : 1;
}

const res = await fetch(API, { headers: { 'User-Agent': UA } });
if (!res.ok) throw new Error('Wikipedia HTTP ' + res.status);
const html = (await res.json()).parse.text;

const launches = [];
let year = new Date().getUTCFullYear();
const now = new Date();

// Alle Tabellenzeilen durchgehen
const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
let curDate = null; // {mo, d}
for (const row of rows) {
  const cells = [...row.matchAll(/<t([hd])([^>]*)>([\s\S]*?)<\/t\1>/gi)].map(m => ({ th: m[1] === 'h', attrs: m[2], txt: clean(m[3]) }));
  if (!cells.length) continue;
  const joined = cells.map(c => c.txt).join(' | ');

  // Datumszelle: "21. Oktober" o. ae.
  const dm = joined.match(/(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?:\s+(\d{4}))?/);
  const tm = joined.match(/(ca\.\s*)?(\d{1,2}):(\d{2})\s*(?:Uhr)?/);
  if (dm) { curDate = { d: +dm[1], mo: MONTHS[dm[2]] }; if (dm[3]) year = +dm[3]; }
  if (!curDate || !tm) continue;

  const data = cells.filter(c => !c.th);
  const texts = data.map(c => c.txt).filter(Boolean);
  if (texts.length < 3) continue;

  const hh = +tm[2], mm = +tm[3];
  let y = year;
  // Jahreswechsel: Monat deutlich kleiner als aktueller -> naechstes Jahr
  if (curDate.mo < now.getUTCMonth() + 1 - 6) y = now.getUTCFullYear() + 1;
  const off = berlinOffset(y, curDate.mo, curDate.d, hh);
  const utc = new Date(Date.UTC(y, curDate.mo - 1, curDate.d, hh - off, mm));
  if (isNaN(utc)) continue;

  // Felder heuristisch: Zeit/Datum-Zellen herausfiltern
  const rest = texts.filter(t => !/^(ca\.\s*)?\d{1,2}:\d{2}/.test(t) && !/^\d{1,2}\.\s*[A-ZÄÖÜ][a-zäöü]+/.test(t));
  const rocket = rest[0] || 'Unbekannt';
  const padText = rest[1] || '';
  const payload = rest[2] || 'Nutzlast noch unbekannt';
  const detail = rest[3] || '';
  const type = rest[4] || '';
  const site = siteFor(padText + ' ' + rocket + ' ' + joined);

  launches.push({
    utc: utc.toISOString().replace('.000Z', 'Z'),
    approx: !!tm[1],
    rocket, pad: padText, site, payload, detail, type
  });
}

// Nur zukuenftige/aktuelle, dedupliziert, sortiert
const seen = new Set();
const out = launches
  .filter(l => new Date(l.utc).getTime() > Date.now() - 24 * 3600e3)
  .filter(l => { const k = l.utc + l.rocket + l.payload; if (seen.has(k)) return false; seen.add(k); return true; })
  .sort((a, b) => a.utc.localeCompare(b.utc));

if (out.length < 3) {
  console.error('Zu wenige Starts geparst (' + out.length + ') - behalte bestehende Daten.');
  process.exit(0);
}

mkdirSync('data', { recursive: true });
writeFileSync('data/launches.json', JSON.stringify({ updated: new Date().toISOString(), source: 'https://de.wikipedia.org/wiki/Liste_geplanter_orbitaler_Raketenstarts', launches: out }, null, 1));
console.log('Starts geschrieben:', out.length);
