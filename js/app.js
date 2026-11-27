/* 생명 임용 랩노트 — 앱 본체
   저장: claude.ai 아티팩트에서는 계정 DB, 그 밖(GitHub Pages 등)에서는 브라우저 IndexedDB */
{
const $ = s => document.querySelector(s);
const view = $('#view');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2400); };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const P = s => new Date(s + 'T00:00:00');
const addD = (s, n) => { const d = P(s); d.setDate(d.getDate() + n); return ymd(d); };
const addM = (s, n) => { const d = P(s); return ymd(new Date(d.getFullYear(), d.getMonth() + n, d.getDate())); };
const today = () => ymd(new Date());
const diff = (a, b) => Math.round((P(b) - P(a)) / 864e5);
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const SUBJ = { edu: '교육학', ped: '교과교육론', maj: '전공' };
const INT = [0, 1, 3, 7, 14, 30, 60];
const REASON = { none: '개념 모름', conf: '헷갈림', kw: '키워드 누락', slip: '실수' };
const use = n => (window.claude && typeof window.claude.use === 'function') ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
const withTO = (p, ms = 10000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r({ code: 'timeout' }), ms))]);
const ICO = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/><circle cx="12" cy="14.5" r="1.6" fill="currentColor"/></svg>',
  learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/></svg>',
  quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14.5 9.5H17M14.5 15.5H17"/></svg>',
  lib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="4" height="16" rx="1"/><rect x="9.5" y="4" width="4" height="16" rx="1"/><path d="M15.5 5.2l3.6-1 3.4 15.6-3.6 1z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="8" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="16" cy="12" r="1.1" fill="currentColor"/></svg>',
};

/* ================= 데이터 ================= */
const D = { books: [], units: [], notes: {}, questions: [], figures: [], text: {}, problems: [], check: {}, trend: null, exams: null };
const UN = {}; const BK = {};
async function loadData() {
  const j = p => fetch(p).then(r => r.ok ? r.json() : null).catch(() => null);
  const [b, u, n, q, f, pr, ck, tr, ex] = await Promise.all(['data/books.json', 'data/units.json', 'data/notes.json', 'data/questions.json', 'data/figures.json', 'data/problems.json', 'data/checklist.json', 'data/trend.json', 'data/exams.json'].map(j));
  D.books = b || []; D.units = u || []; D.notes = n || {}; D.questions = q || []; D.figures = f || []; D.problems = pr || []; D.check = ck || {}; D.trend = tr; D.exams = ex;
  D.books.forEach(x => BK[x.id] = x); D.units.forEach(x => UN[x.id] = x);
}
const unitsOf = s => D.units.filter(u => u.s === s);
const weight = u => u.end && u.start ? Math.max(4, u.end - u.start + 1) : 20;
const pdfPage = (bookId, bp) => bp + ((BK[bookId] || {}).offset || 0);

/* ================= 저장소 ================= */
const S = { settings: { start: '2026-12-01', exam: '2027-11-27', hours: 4 }, srs: { cards: {} }, units: { done: {} }, logs: {}, att: {}, mocks: [], aiq: { list: [] }, pos: {}, lib: { files: [], nbs: [] }, check: {}, expl: {}, conv: {} };
let db = null, sample = null, assets = null, downloads = null, idb = null;
function idbOpen() {
  return new Promise(res => {
    try {
      const r = indexedDB.open('bio-labnote', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('files'); };
      r.onsuccess = () => { idb = r.result; res(true); };
      r.onerror = () => res(false);
    } catch (e) { res(false); }
  });
}
const idbReq = (store, mode, fn) => new Promise((res, rej) => { try { const tx = idb.transaction(store, mode); const r = fn(tx.objectStore(store)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
const Store = {
  async get(path) {
    if (db) { const s = await db.doc(path).get(); return s.exists ? s.data() : null; }
    if (idb) return (await idbReq('kv', 'readonly', s => s.get(path))) || null;
    return null;
  },
  async set(path, obj) {
    if (db) return db.doc(path).set(obj);
    if (idb) return idbReq('kv', 'readwrite', s => s.put(obj, path));
  },
  async listMe() {
    if (db) { const q = await withTO(db.collection('me').get()); return q.docs.map(d => [d.id, d.data()]); }
    if (idb) {
      const keys = await idbReq('kv', 'readonly', s => s.getAllKeys());
      const vals = await idbReq('kv', 'readonly', s => s.getAll());
      return keys.map((k, i) => [k, vals[i]]).filter(([k]) => String(k).startsWith('me/')).map(([k, v]) => [k.slice(3), v]);
    }
    return [];
  }
};
const pending = {}, busy = {};
function save(id, obj) { pending[id] = obj; if (!busy[id]) flush(id); }
async function flush(id) {
  busy[id] = true;
  while (pending[id]) {
    const o = pending[id]; delete pending[id];
    try { await Store.set(id.includes('/') ? id : 'me/' + id, o); }
    catch (e) { toast(e && e.code === 'quota_exceeded' ? '저장 공간이 가득 찼어요' : '저장하지 못했어요'); }
  }
  busy[id] = false;
}
function loadDoc(id, d) {
  if (!d) return;
  if (id === 'settings') Object.assign(S.settings, d);
  else if (id === 'srs') S.srs = { cards: d.cards || {} };
  else if (id === 'units') S.units = { done: d.done || {} };
  else if (id === 'aiq') S.aiq = { list: d.list || [] };
  else if (id === 'pos') S.pos = d.map || {};
  else if (id === 'lib') S.lib = { files: d.files || [], nbs: d.nbs || [] };
  else if (id === 'check') S.check = d.marks || {};
  else if (id.startsWith('log-')) S.logs[id] = d.sessions || [];
  else if (id.startsWith('att-')) S.att[id] = d.list || [];
  else if (id.startsWith('mock-')) S.mocks.push(d);
}
const saveSrs = () => save('srs', S.srs), saveUnits = () => save('units', S.units), saveLib = () => save('lib', S.lib);
let posTimer = null;
function savePos(key, page) { S.pos[key] = { p: page, at: Date.now() }; clearTimeout(posTimer); posTimer = setTimeout(() => save('pos', { map: S.pos }), 1500); }
function addLog(s, min) { const id = 'log-' + today().slice(0, 7); (S.logs[id] = S.logs[id] || []).push({ d: today(), s, m: Math.round(min) }); save(id, { sessions: S.logs[id] }); }
function addAtt(qid, ok, r) { const id = 'att-' + today().slice(0, 7); (S.att[id] = S.att[id] || []).push({ d: today(), q: qid, ok: ok ? 1 : 0, r: r || '' }); save(id, { list: S.att[id] }); }
const allLogs = () => Object.values(S.logs).flat();
const allAtt = () => Object.values(S.att).flat();
const allQ = () => D.questions.concat(S.aiq.list, D.problems).filter(q => UN[q.u]);
const KIND_LABEL = q => q.t === 'img' ? (q.real ? `${q.year}학년도 임용 전공 ${String(q.no)[0]} ${String(q.no).slice(1)}번 (${q.pts}점)` : `${q.year ? q.year + ' ' : ''}${q.kind} 기출 ${q.no}번`) : (q.src || '');
const qById = id => allQ().find(q => q.id === id);
const safeKey = k => String(k).replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 80);

/* ================= 인쇄 ================= */
const PRINT_CSS = `.rq p{margin:1mm 0}.qbox{border:1px solid #000;border-radius:2mm;padding:2mm 3mm;margin:2mm 0}.qbox .lab{display:block;font-size:9.5pt}.qsec{font-weight:700;margin:2mm 0 1mm}.bl{font-weight:700}.step{padding-left:6mm;text-indent:-6mm}.qt th{background:#eee}.qt td,.qt th{text-align:center}.mn{border-left:2px solid #000;padding-left:2mm}img{max-width:100%}body{font:11pt/1.65 -apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#000;margin:18mm 16mm}h1{font-size:18pt;margin:0 0 4mm}h2{font-size:14pt;margin:8mm 0 3mm;border-bottom:1px solid #000;padding-bottom:1mm}h3{font-size:12pt;margin:5mm 0 2mm}table{border-collapse:collapse;width:100%;margin:3mm 0}td,th{border:1px solid #888;padding:2mm;vertical-align:top;font-size:10pt}.q{margin:0 0 5mm;page-break-inside:avoid}.opt{margin-left:5mm}.ans{border:1px solid #000;min-height:22mm;margin-top:2mm}.lined{height:240mm;background:repeating-linear-gradient(#fff 0 9mm,#bbb 9mm 9.25mm);border:1px solid #000}.key{background:#fff3a0}.box,.mn{border:1px solid #bbb;border-radius:2mm;padding:2mm 3mm;margin:2mm 0}.pb{page-break-before:always}.mut{color:#555}img{max-width:100%}@page{size:A4}`;
async function printDoc(body, title) {
  const name = (title || '인쇄').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 80);
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><style>${PRINT_CSS}</style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`;
  if (downloads) {
    try { await downloads.save({ filename: name + '.html', data: html }); toast('저장한 파일을 열면 바로 인쇄 창이 떠요'); return; }
    catch (e) { if (e && e.code === 'declined') return; }
  }
  const pa = $('#printArea'); pa.innerHTML = `<style>${PRINT_CSS.replace(/body\{/, '#printArea{')}</style>` + body;
  try { window.print(); } catch (e) { toast('이 화면에서는 인쇄할 수 없어요'); }
}

/* ================= 계획 ================= */
function phases() {
  const s = S.settings.start, ex = S.settings.exam, m = n => addM(s, n);
  return [
    { f: s, t: m(3), n: '1회독 · 전공+교육학', sp: { maj: .5, edu: .4, rev: .1 } },
    { f: m(3), t: m(5), n: '1회독 · 전공+교과교육론', sp: { maj: .5, ped: .4, rev: .1 } },
    { f: m(5), t: m(6), n: '전공 1회독 마무리 · 기출 분석', sp: { maj: .7, rev: .3 } },
    { f: m(6), t: m(9), n: '2회독 · 3과목 섞어 돌리기', sp: { maj: .45, edu: .2, ped: .15, rev: .2 } },
    { f: m(9), t: m(11), n: '3회독 · 기출+예측 실전', sp: { maj: .4, edu: .2, ped: .15, rev: .25 } },
    { f: m(11), t: addD(ex, 1), n: '파이널 · 실전 모의고사', sp: { maj: .35, edu: .25, ped: .15, rev: .25 } }];
}
function windows(sub) {
  const s = S.settings.start, m = n => addM(s, n), e = addD(S.settings.exam, 1);
  const first = { edu: [s, m(3)], ped: [m(3), m(5)], maj: [s, m(6)] }[sub];
  return [[first[0], first[1], 1], [m(6), m(9), 2], [m(9), m(11), 3], [m(11), e, 4]];
}
function unitAt(sub, date) {
  const us = unitsOf(sub); if (!us.length) return null;
  for (const [f, t, r] of windows(sub)) {
    if (date >= f && date < t) {
      const tot = us.reduce((a, u) => a + weight(u), 0), fr = diff(f, date) / diff(f, t) * tot; let c = 0;
      const per = tot / Math.max(1, diff(f, t));
      for (const u of us) {
        const w = weight(u);
        if (fr < c + w) {
          const pf = u.start ? Math.floor(u.start + (fr - c) / w * (u.end - u.start + 1)) : 0;
          return { u: u.id, r, pf, pt: u.start ? Math.min(u.end, pf + Math.max(1, Math.ceil(per)) - 1) : 0 };
        }
        c += w;
      }
      return { u: us[us.length - 1].id, r };
    }
  }
  return null;
}
function planFor(date) {
  const d = date < S.settings.start ? S.settings.start : date;
  const ph = phases().find(p => d >= p.f && d < p.t) || phases()[5];
  const tot = S.settings.hours * 60, blocks = []; let rev = ph.sp.rev * tot;
  for (const s of ['maj', 'edu', 'ped']) { if (!ph.sp[s]) continue; const u = unitAt(s, d); if (u) blocks.push({ s, u: u.u, r: u.r, pf: u.pf, pt: u.pt, min: Math.round(ph.sp[s] * tot / 10) * 10 }); else rev += ph.sp[s] * tot; }
  const w = P(d).getDay();
  return { d, ph, blocks, rev: Math.round(rev / 10) * 10, type: w === 6 ? 'mock' : w === 0 ? 'review' : 'quiz' };
}
const TYPE = { quiz: '퀴즈 데이', mock: '모의고사 데이', review: '주간 복습 데이' };

/* ================= 간격반복·채점 ================= */
function grade(qid, res, reason) {
  const c = S.srs.cards[qid] || { b: 0, w: 0, c: 0 };
  if (res === 'wrong') { c.b = 1; c.w = (c.w || 0) + 1; c.r = reason || c.r || 'none'; c.due = addD(today(), 1); }
  else if (res === 'unsure') { c.b = Math.max(1, c.b); c.due = addD(today(), INT[c.b]); }
  else { c.b = Math.min(6, c.b + 1); c.c = (c.c || 0) + 1; c.due = addD(today(), INT[c.b]); }
  c.last = today(); S.srs.cards[qid] = c; saveSrs();
}
const dueIds = () => Object.entries(S.srs.cards).filter(([id, c]) => c.due && c.due <= today() && qById(id)).map(([id]) => id);
const norm = s => String(s || '').toLowerCase().replace(/[\s·,.()\-~'"]/g, '');
function checkShort(q, ans) {
  const n = norm(ans); if (!n) return { ok: false, part: 0 };
  if (String(q.a).split('|').map(norm).some(a => a && n.includes(a))) return { ok: true, part: 1 };
  const kw = q.kw || []; if (!kw.length) return { ok: false, part: 0 };
  const hit = kw.filter(k => k.split('|').some(x => n.includes(norm(x)))).length;
  return { ok: hit === kw.length, part: hit / kw.length };
}
const ansText = q => q.t === 'img' ? (q.ans || (S.expl[q.id] && S.expl[q.id].answer) || '해설 보기에서 확인') : q.t === 'mc' ? (q.ch || [])[q.a] : q.t === 'essay' ? (q.model || '') : String(q.a).split('|').join(' / ');

/* ================= 노트 렌더러 (간단 마크다운) ================= */
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<span class="key">$1</span>')
    .replace(/\[p\.(\d+)(?:@([a-z0-9]+))?\]/g, (m, p, b) => `<a href="#" data-a="openp" data-p="${p}"${b ? ` data-b="${b}"` : ''} class="src">p.${p}</a>`);
}
function md(src) {
  const lines = String(src || '').split('\n'); let out = '', list = false, table = [];
  const endList = () => { if (list) { out += '</ul>'; list = false; } };
  const endTable = () => {
    if (!table.length) return;
    const rows = table.filter(r => !/^\|\s*-/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|'));
    out += '<div class="tw"><table class="qt">' + rows.map((r, i) => '<tr>' + r.map(c => i ? `<td>${BL(inline(c.trim()))}</td>` : `<th>${BL(inline(c.trim()))}</th>`).join('') + '</tr>').join('') + '</table></div>';
    table = [];
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (l.startsWith('|')) { endList(); table.push(l); continue; } else endTable();
    if (!l.trim()) { endList(); continue; }
    if (l.startsWith('## ')) { endList(); out += `<h3>${inline(l.slice(3))}</h3>`; }
    else if (l.startsWith('### ')) { endList(); out += `<h4>${inline(l.slice(4))}</h4>`; }
    else if (l.startsWith('> ')) { endList(); out += `<div class="mn">${inline(l.slice(2))}</div>`; }
    else if (l.startsWith('! ')) { endList(); out += `<div class="box">${inline(l.slice(2))}</div>`; }
    else if (/^\s*[-•] /.test(l)) { if (!list) { out += '<ul>'; list = true; } out += `<li>${inline(l.replace(/^\s*[-•] /, ''))}</li>`; }
    else { endList(); out += `<p>${inline(l)}</p>`; }
  }
  endList(); endTable();
  return out;
}

/* ================= 문항 렌더러 (표·작성 방법·보기 상자) ================= */
const BL = s => s.replace(/([㉠-㉯ⓐ-ⓩ])/g, '<b class="bl">$1</b>');
function rich(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n'); let out = '', ul = false, table = [], box = false;
  const f = t => BL(inline(t));
  const endUl = () => { if (ul) { out += '</ul>'; ul = false; } };
  const endBox = () => { endUl(); if (box) { out += '</div>'; box = false; } };
  const endTable = () => {
    if (!table.length) return;
    const rows = table.filter(r => !/^\|[\s:|-]+\|?$/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|'));
    out += '<div class="tw"><table class="qt">' + rows.map((r, i) => '<tr>' + r.map(c => i ? `<td>${f(c.trim())}</td>` : `<th>${f(c.trim())}</th>`).join('') + '</tr>').join('') + '</table></div>';
    table = [];
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith('|')) { endUl(); table.push(l); continue; } else endTable();
    if (!l) { endUl(); continue; }
    const h = l.match(/^[<〈]\s*([^>〉]{1,12})\s*[>〉]\s*(.*)$/);
    if (h) {
      endBox();
      if (/작성|보기|조건/.test(h[1])) { out += `<div class="qbox"><b class="lab">${esc(h[1])}</b>`; box = true; }
      else out += `<div class="qsec">${esc(h[1])}</div>`;
      if (h[2]) out += `<p>${f(h[2])}</p>`;
      continue;
    }
    if (/^[•·\-]\s/.test(l)) { if (!ul) { out += '<ul>'; ul = true; } out += `<li>${f(l.replace(/^[•·\-]\s+/, ''))}</li>`; continue; }
    if (box && !/^[ㄱ-ㅎ]\./.test(l)) endBox(); else endUl();
    if (/^\([가-하]\)\s|^[ㄱ-ㅎ]\.\s/.test(l)) out += `<p class="step">${f(l)}</p>`;
    else out += `<p>${f(l)}</p>`;
  }
  endBox(); endTable();
  return `<div class="rq">${out}</div>`;
}
function qHtml(q) {
  const h = rich(q.q); if (!q.fig) return h.replace('<p>[[그림]]</p>', '');
  const img = svgImg(q.fig);
  if (h.includes('<p>[[그림]]</p>')) return h.replace('<p>[[그림]]</p>', img);
  const i = h.lastIndexOf('<div class="qbox">');
  return i > 0 ? h.slice(0, i) + img + h.slice(i) : h + img;
}
/* 목록 미리보기용 한 줄 요약: 표·기호 제거 */
const brief = (t, n) => { const x = String(t || '').split('\n').filter(l => l.trim() && !l.trim().startsWith('|') && !/^[<〈]/.test(l.trim())).join(' ').replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n) + '…' : x; };
/* 객관식(보기 ㄱㄴㄷ·선지) 기출인가 */
const isObj = q => q && q.t === 'img' && !q.conv && (q.kind !== '임용' || /보\s*기|고른\s*것|있는\s*대로|짝지은\s*것|옳은\s*것은/.test(q.txt || '') || (+q.year && +q.year <= 2013));
const OBJ_TASK = '<작성 방법>\n• 자료의 그림·표를 해석하여 <보기>의 ㄱ, ㄴ, ㄷ 각각의 옳고 그름을 판단할 것.\n• 판단의 근거를 자료에서 찾아 서술하고, 틀린 진술은 바르게 고쳐 쓸 것.';

/* ================= 타이머 ================= */
let T = { s: 'maj', start: null, acc: 0, pomo: false };
try { const t = JSON.parse(localStorage.getItem('bio_timer')); if (t) T = t; } catch (e) {}
const keepT = () => { try { localStorage.setItem('bio_timer', JSON.stringify(T)); } catch (e) {} };
const elapsed = () => T.acc + (T.start ? Date.now() - T.start : 0);
const fmt = ms => { const s = Math.floor(ms / 1000); return (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); };
const minutesOn = (d, s) => allLogs().filter(l => l.d === d && (!s || l.s === s)).reduce((a, l) => a + l.m, 0);
setInterval(() => {
  const el = $('#clock'); if (el) { el.textContent = fmt(elapsed()); if (T.pomo && T.start && elapsed() >= 50 * 60e3 && !T.rang) { T.rang = 1; keepT(); toast('50분 집중 끝! 10분 쉬어요'); } }
  const mc = $('#mclock'); if (mc && M.end) { const left = M.end - Date.now(); mc.textContent = fmt(Math.max(0, left)); if (left <= 0 && M.phase === 'run') { M.phase = 'grade'; toast('시간 종료 — 답안을 제출했어요'); collectMock(); autoScoreMock(); vMore(); } }
}, 1000);

/* ================= 공통 UI 조각 ================= */
const header = (title, sub, right = '') => `<div class="lg"><small>${esc(sub || '')}</small><div class="row"><h1 class="sp">${esc(title)}</h1>${right}</div></div>`;
const seg = (act, items, on) => `<div class="seg">${items.map(([k, l]) => `<button class="${on === k ? 'on' : ''}" data-a="${act}" data-k="${k}">${l}</button>`).join('')}</div>`;
const pill = s => `<span class="pill ${s}">${SUBJ[s]}</span>`;
function openBook(bookId, bookPageOrPdf, isPdfPage) {
  const b = BK[bookId]; if (!b) { toast('교재 파일이 아직 없어요'); return; }
  const p = isPdfPage ? bookPageOrPdf : pdfPage(bookId, bookPageOrPdf || 1);
  Viewer.open({ key: 'b-' + b.id, title: b.short + ' · ' + b.title, parts: b.parts, pages: b.pages, page: p });
}

/* ================= 오늘 ================= */
function vToday() {
  const t = today(), p = planFor(t), pre = t < S.settings.start, due = dueIds().length, done = minutesOn(t), goal = S.settings.hours * 60;
  const last = Object.entries(S.pos).filter(([k]) => k.startsWith('b-')).sort((a, b) => b[1].at - a[1].at)[0];
  const dd = diff(t, S.settings.exam), ds = diff(t, S.settings.start);
  view.innerHTML = header(pre ? `시작 D-${ds}` : `시험 D-${dd}`, `${t.replace(/-/g, '.')} (${DOW[P(t).getDay()]}) · 2028학년도 중등 생물 1차`) + `<main>
  <div class="kpi"><div><b>${Math.floor(done / 60)}:${pad(done % 60)}</b><span>오늘 공부</span></div><div><b>${due}</b><span>복습 카드</span></div><div><b>${Math.max(0, dd)}</b><span>시험까지</span></div></div>
  <div class="sec"><b>${pre ? '첫날 계획' : '오늘 할 일'}</b><span>${TYPE[p.type]} · ${esc(p.ph.n)}</span></div>
  <div class="list">
   ${p.blocks.map(b => `<div class="li" style="padding-right:10px"><button class="li" style="padding:0;min-height:0" data-a="unit" data-u="${b.u}"><span class="ico b-${b.s}">${SUBJ[b.s][0]}</span><span class="grow">${esc(UN[b.u]?.title || '')}<span class="sub">${SUBJ[b.s]} · ${b.r < 4 ? b.r + '회독' : '파이널'} · ${b.min}분${b.pf ? ` · p.${b.pf}–${b.pt}` : ''}</span></span></button>${b.pf ? `<button class="sm" data-a="openbp" data-b="${UN[b.u].book}" data-p="${b.pf}">읽기</button>` : '<span class="chev">›</span>'}</div>`).join('')}
   <button class="li" data-a="go" data-h="quiz"><span class="ico b-blue">↻</span><span class="grow">간격반복 복습 ${due}장 · 오답노트<span class="sub">${p.rev}분</span></span><span class="chev">›</span></button>
   ${p.type === 'mock' ? `<button class="li" data-a="mockhome"><span class="ico b-red">M</span><span class="grow">토요 모의고사<span class="sub">실제 시간·답안지로 응시 후 채점</span></span><span class="chev">›</span></button>` : ''}
  </div>
  <div class="row" style="margin-top:12px"><button class="pri sp" data-a="daily">오늘 퀴즈 10문항</button>${last ? `<button class="sp" data-a="resume" data-k="${esc(last[0])}">이어 읽기</button>` : ''}</div>
  ${!isStandalone() && !inFrame ? `<button class="li card" style="margin-top:12px;width:100%" data-a="go" data-h="more" data-k="set"><span class="ico b-maj">↓</span><span class="grow" style="text-align:left">앱으로 설치하기<span class="sub">iPhone·iPad·Galaxy·PC 홈 화면에 추가</span></span><span class="chev">›</span></button>` : ''}
  ${D.trend ? `<button class="card trendcard li" style="margin-top:12px;width:100%" data-a="go" data-h="more" data-k="trend"><span class="ico b-red">%</span><span class="grow" style="text-align:left"><b>2028 출제 예측</b><span class="sub">${D.trend.pred.slice(0, 3).map(p => esc(p.t.split(':')[0])).join(' · ')} — 근거·예상 문항 보기</span></span><span class="chev">›</span></button>` : ''}
  <div class="cols two" style="margin-top:6px">
   <div><div class="sec"><b>공부 타이머</b><span>${SUBJ[T.s]} ${T.start ? '측정 중' : '대기'}</span></div>
    <div class="card"><div class="seg">${Object.keys(SUBJ).map(s => `<button class="${T.s === s ? 'on' : ''}" data-a="tsub" data-s="${s}">${SUBJ[s]}</button>`).join('')}</div>
     <div class="row" style="margin:18px 0 10px;justify-content:space-between"><div class="big" id="clock">${fmt(elapsed())}</div><div class="ring" style="--p:${Math.min(100, done / goal * 100)}" data-t="${Math.round(done / goal * 100)}%"></div></div>
     <div class="row"><button class="pri" data-a="ttoggle">${T.start ? '일시정지' : '시작'}</button><button data-a="tsave" ${elapsed() < 60e3 ? 'disabled' : ''}>기록 저장</button><button data-a="treset">초기화</button><label class="row mut small" style="margin-left:auto"><input type="checkbox" style="width:22px;height:22px" data-a="tpomo" ${T.pomo ? 'checked' : ''}>50/10</label></div></div></div>
   <div><div class="sec"><b>이번 주</b><button class="plain sm" data-a="printweek">인쇄</button></div>${weekList(t)}</div>
  </div></main>`;
}
function weekDays(t) { const base = t < S.settings.start ? S.settings.start : t, w = P(base).getDay(), mon = addD(base, -((w + 6) % 7)); return [0, 1, 2, 3, 4, 5, 6].map(i => addD(mon, i)); }
function weekList(t) {
  return `<div class="list">${weekDays(t).map(d => { const p = planFor(d), m = minutesOn(d);
    return `<div class="li"${d === t ? ' style="background:color-mix(in srgb,var(--blue) 8%,transparent)"' : ''}><span style="width:3.2em;font-weight:600">${DOW[P(d).getDay()]} ${+d.slice(8)}</span><span class="grow small">${p.type === 'quiz' ? p.blocks.map(b => `<span class="c-${b.s}">${esc(UN[b.u]?.title || '')}${b.pf ? ' ' + b.pf + '–' + b.pt : ''}</span>`).join(' · ') : p.type === 'mock' ? '모의고사 + 채점' : '오답·간격반복 몰아보기'}</span><span class="mut small">${m ? Math.floor(m / 60) + 'h' + pad(m % 60) : ''}</span></div>`; }).join('')}</div>`;
}

/* ================= 학습 ================= */
let L = { sub: 'maj', unit: null, tab: 'note' };
function vLearn() {
  if (L.unit && UN[L.unit]) return vUnit();
  const us = unitsOf(L.sub);
  const byBook = {}; us.forEach(u => (byBook[u.book || '_'] = byBook[u.book || '_'] || []).push(u));
  view.innerHTML = header('학습', '과목을 고르고 단원을 펼치세요') + `<main>${seg('lsub', [['edu', '교육학'], ['ped', '교과교육론'], ['maj', '전공']], L.sub)}
  ${Object.entries(byBook).map(([bk, list]) => `<div class="sec"><b>${esc(BK[bk]?.title || '교재 준비 중')}</b><span>${list.length}단원</span></div>
   <div class="list">${list.map(u => { const c = S.units.done[u.id] || 0, nq = allQ().filter(q => q.u === u.id && q.t !== 'img').length, nf = D.figures.filter(f => f.u === u.id).length, nr = D.problems.filter(q => q.u === u.id).length;
     return `<button class="li" data-a="unit" data-u="${u.id}"><span class="ico b-${u.s}">${esc(u.no || '')}</span><span class="grow">${esc(u.title)}<span class="sub">${u.start ? 'p.' + u.start + '–' + u.end + ' · ' : ''}${D.notes[u.id] ? '노트 · ' : ''}그림 ${nf} · 기출 ${nr} · 문항 ${nq}${c ? ' · ' + c + '회독' : ''}</span></span><span class="chev">›</span></button>`; }).join('')}</div>`).join('')}
  ${us.length ? '' : '<div class="empty" style="margin-top:14px">이 과목 교재는 아직 받지 않았어요. PDF를 주시면 단원과 노트를 채워 넣습니다.</div>'}</main>`;
}
let figObs = null;
function vUnit() {
  const u = UN[L.unit], b = BK[u.book], qs = allQ().filter(q => q.u === u.id && q.t !== 'img'), figs = D.figures.filter(f => f.u === u.id), c = S.units.done[u.id] || 0;
  const reals = D.problems.filter(q => q.u === u.id).sort((x, y) => (y.real || 0) - (x.real || 0) || (+y.year || 0) - (+x.year || 0)), cks = D.check[u.id] || [], vars = qs.filter(q => /^(v|cv|pr)-/.test(q.id));
  let body = '';
  if (L.tab === 'note') body = D.notes[u.id] ? `<div class="card note">${md(D.notes[u.id])}</div><div class="row" style="margin-top:12px"><button data-a="printnote">노트 인쇄</button>${b ? `<button data-a="openp" data-p="${u.start}">교재 원문 열기</button>` : ''}</div>` : '<div class="empty">이 단원 노트는 다음 업데이트에 들어갑니다.</div>';
  else if (L.tab === 'fig') body = figs.length ? `<p class="mut small">그림을 누르면 교재의 그 쪽이 열려요. 바로 필기할 수 있어요.</p><div class="figs">${figs.map((f, i) => `<button class="fig" data-a="figopen" data-i="${D.figures.indexOf(f)}"><canvas data-fig="${D.figures.indexOf(f)}" aria-label="${esc(f.cap)}"></canvas><span>${esc(f.cap)} <span class="mut">p.${f.page}</span></span></button>`).join('')}</div>` : '<div class="empty">이 단원에서 찾은 그림이 아직 없어요.</div>';
  else if (L.tab === 'toc') body = `<div class="list toc">${(u.secs || []).map(s => `<button class="li lv1" data-a="openp" data-p="${s.p || u.start}"><span class="grow">${esc(s.t)}</span><span class="pg">${s.p ? 'p.' + s.p : ''}</span></button>${(s.items || []).map(it => `<button class="li lv2" data-a="openp" data-p="${it.p || s.p || u.start}"><span class="grow">${esc(it.t)}</span><span class="pg">${it.p ? 'p.' + it.p : ''}</span></button>`).join('')}`).join('')}</div>`;
  else if (L.tab === 'real') {
    const f = L.rf || 'all', list = reals.filter(q => f === 'all' || (f === 'im' ? q.kind === '임용' : q.kind !== '임용'));
    body = reals.length ? `<div class="chips">${[['all', `전체 ${reals.length}`], ['im', `임용 ${reals.filter(q => q.kind === '임용').length}`], ['md', `MD·PT ${reals.filter(q => q.kind !== '임용').length}`]].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-a="rf" data-k="${k}">${l}</button>`).join('')}</div>
     <div class="row" style="margin:12px 0"><button class="pri" data-a="realgo" data-k="${f}">순서대로 풀기</button><button data-a="realprint" data-k="${f}">기출 인쇄</button></div>
     <div class="list">${list.map(q => { const cd = S.srs.cards[q.id]; return `<details class="li" style="display:block"><summary class="row"><span class="pill ${q.kind === '임용' ? 'maj' : ''}">${esc(q.kind)}</span><span class="sp">${esc((q.year ? q.year + '학년도 · ' : '') + q.no + '번')}</span>${cd ? `<span class="mut small">${cd.w ? '틀림 ' + cd.w + '회' : '푼 문항'}</span>` : ''}${q.real ? '<span class="pill b-red" style="color:#fff">실제 시험지</span>' : ''}${q.conv ? '<span class="pill ped">서술형 전환</span>' : isObj(q) ? '<span class="pill">객관식→서술</span>' : ''}${q.ans ? '<span class="pill">해설</span>' : ''}</summary>${probHtml(q, false)}<div class="row" style="margin:8px 0"><button class="sm pri" data-a="realone" data-id="${esc(q.conv || q.id)}">${q.conv ? '서술형으로 풀기' : '이 문항 풀기'}</button><button class="sm" data-a="probopen" data-id="${esc(q.id)}">원본 쪽</button></div></details>`; }).join('')}</div>
     <p class="mut small">문제편 원본을 잘라 보여 줘요. 문항 경계가 어긋나면 '원본 쪽'에서 보세요.</p>` : '<div class="empty">이 단원에 연결된 기출이 없어요.</div>';
  }
  else if (L.tab === 'ck') {
    const done = cks.filter(it => S.check[u.id + ':' + it.t] === 'O').length;
    body = cks.length ? `<div class="card"><div class="row"><b class="sp">체크 ${done} / ${cks.length}</b><span class="mut small">O 확실 · △ 애매 · X 모름</span></div><div class="meter" style="margin-top:8px"><i style="width:${done / cks.length * 100}%"></i></div></div>
     <div class="list" style="margin-top:12px">${cks.map((it, i) => { const m = S.check[u.id + ':' + it.t] || ''; return `<div class="li"><span class="grow small">${esc(it.t)}${(it.g || []).map(g => ` <span class="pill maj">기출 ${esc(g)}</span>`).join('')}${it.p ? ` <a href="#" data-a="openp" data-p="${it.p}" class="small">p.${it.p}</a>` : ''}</span><span class="seg" style="flex:none">${['O', '△', 'X'].map(k => `<button class="${m === k ? 'on' : ''}" data-a="ckm" data-i="${i}" data-k="${k}" style="min-width:34px">${k}</button>`).join('')}</span></div>`; }).join('')}</div>
     <div class="row" style="margin-top:12px"><button data-a="ckx">△·X만 모아 보기</button><button data-a="ckprint">체크리스트 인쇄</button></div>` : '<div class="empty">이 단원 체크리스트가 없어요.</div>';
  }
  else body = `<div class="row" style="margin-bottom:12px"><button class="pri" data-a="unitquiz" ${qs.length ? '' : 'disabled'}>이 단원 퀴즈</button><button data-a="vargo" ${vars.length ? '' : 'disabled'}>임용형(변형·전환·예상) ${vars.length}</button><button data-a="printquiz" ${qs.length ? '' : 'disabled'}>문제지 인쇄</button></div><div class="list">${qs.map(q => `<div class="li"><span class="pill">${{ mc: '객관식', ox: 'OX', short: '기입형', essay: '서술형' }[q.t]}</span><span class="grow small">${/^v-/.test(q.id) ? '<b>변형</b> ' : /^cv-/.test(q.id) ? '<b>서술형 전환</b> ' : /^pr-/.test(q.id) ? '<b>예상</b> ' : ''}${esc(brief(q.q, 70))}</span></div>`).join('') || '<div class="li mut">문항이 아직 없어요</div>'}</div>
   ${sample ? '<div class="row" style="margin-top:12px"><button data-a="aigen">AI로 5문항 더 만들기</button></div>' : ''}`;
  view.innerHTML = `<div class="top"><div class="row"><button class="plain" data-a="lback">‹ 학습</button><span class="tt">${esc(u.title)}</span><span style="width:60px"></span></div></div>
  <main><div class="row" style="margin:8px 0 12px">${pill(u.s)}<span class="mut small">${esc(b ? b.short + ' · p.' + u.start + '–' + u.end : '')}</span><span class="sp"></span><button class="sm" data-a="round">${c}회독 +1</button></div>
  ${trendBadge(u.id)}${seg('ltab', [['note', '노트'], ['fig', '그림'], ['real', `기출 ${reals.length}`], ['q', `문제 ${qs.length}`], ['ck', '체크'], ['toc', '목차']], L.tab)}
  <div style="margin-top:14px">${body}</div></main>`;
  if (L.tab === 'fig') lazyFigs();
}
view.addEventListener('toggle', () => drawProbs(), true);
function lazyFigs() {
  if (figObs) figObs.disconnect();
  figObs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; figObs.unobserve(e.target);
    const f = D.figures[+e.target.dataset.fig]; const b = BK[f.book]; if (!b) return;
    const pp = pdfPage(f.book, f.page), part = (b.parts || []).find(x => pp >= x.from && pp <= x.to); if (!part) return;
    Viewer.region(part.file, pp - part.from + 1, f.box, e.target);
  }), { rootMargin: '200px' });
  document.querySelectorAll('canvas[data-fig]').forEach(c => figObs.observe(c));
}

/* ================= 실제 기출 문항 이미지 ================= */
const svgImg = svg => `<img alt="자료 그림" style="display:block;max-width:100%;height:auto;margin:10px auto;background:#fff;border-radius:8px" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">`;
function probHtml(q, big) {
  return `<div class="probimg">${q.segs.map((sg, i) => `<canvas data-pq="${esc(q.id)}" data-si="${i}" data-big="${big ? 1 : 0}" style="display:block;width:100%;height:auto;background:#fff;border-radius:6px;margin:4px 0;min-height:60px" aria-label="기출 문항 그림"></canvas>`).join('')}</div>`;
}
function drawProbs() {
  document.querySelectorAll('canvas[data-pq]:not([data-done])').forEach(c => {
    c.dataset.done = 1;
    const q = D.problems.find(x => x.id === c.dataset.pq); if (!q) return;
    const sg = q.segs[+c.dataset.si];
    Viewer.region(q.file, sg.p, sg.box, c, c.dataset.big === '1' ? 1100 : 420);
  });
}
function probBlob(q) {
  return new Promise(res => {
    const cs = []; let left = q.segs.length;
    q.segs.forEach((sg, i) => { const c = document.createElement('canvas'); cs[i] = c; Viewer.region(q.file, sg.p, sg.box, c, 900, () => { if (--left === 0) {
      const W = Math.max(...cs.map(x => x.width)), H = cs.reduce((a, x) => a + x.height, 0);
      if (!W || !H) { res(null); return; }
      const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      let y = 0; cs.forEach(x => { g.drawImage(x, 0, y); y += x.height; }); out.toBlob(b => res(b), 'image/jpeg', .85);
    } }); });
  });
}
async function loadExpl(q) {
  if (S.expl[q.id] !== undefined) return S.expl[q.id];
  try { S.expl[q.id] = await Store.get('expl/' + safeKey(q.id)); } catch (e) { S.expl[q.id] = null; }
  return S.expl[q.id];
}
async function aiExplain(q) {
  const u = UN[q.u], b = BK[u.book];
  let ctx = '';
  try { const pages = await loadText(u.book); ctx = (q.rel || []).slice(0, 3).map(p => `[교재 p.${p}] ` + (pages[pdfPage(u.book, p) - 1] || '').replace(/\s+/g, ' ').slice(0, 1400)).join('\n'); } catch (e) {}
  const lim = sample.limits ? await sample.limits().catch(() => ({})) : {};
  const blob = lim && lim.images ? await probBlob(q) : null;
  const prompt = `당신은 중등 생물 임용시험 전문 강사입니다. 첨부한 ${q.kind} 기출 문항(그림)의 정답과 해설을 한국어로 작성하세요.${blob ? '' : ' (그림을 볼 수 없으면 아래 OCR 텍스트로 최대한 판단하고, 불확실한 부분은 불확실하다고 밝히세요.)'}
단원: ${u.title}
문항 OCR(오류 있을 수 있음): ${q.txt}
관련 교재 내용(OCR): ${ctx}
규칙: 정답을 먼저 쓰고, 서술형이면 채점 기준 키워드가 들어간 모범답안을 쓰세요. 근거를 교재 개념으로 설명하세요. 확신이 낮으면 그 이유를 쓰세요.
${isObj(q) ? '이 문항은 <보기> ㄱ·ㄴ·ㄷ 고르기형입니다. stmts에 보기마다 판정(O/X), 자료에 근거한 이유, 틀린 보기는 바르게 고친 문장을 쓰세요.\n' : ''}JSON으로만: {"answer":"정답(기입형/선택형) 또는 모범답안 요약","explanation":"해설 4~8문장","keywords":["채점 키워드"],"tip":"암기 팁 1문장","confidence":"high|medium|low"${isObj(q) ? ',"stmts":[{"k":"ㄱ","ox":"O|X","why":"근거","fix":"틀린 경우 고친 문장"}]' : ''}}`;
  const out = await sample.json(prompt, Object.assign({ modelTier: 'complex' }, blob ? { images: [blob] } : {}));
  const rec = { answer: String(out.answer || ''), explanation: String(out.explanation || ''), keywords: Array.isArray(out.keywords) ? out.keywords.map(String) : [], tip: String(out.tip || ''), confidence: String(out.confidence || ''), stmts: Array.isArray(out.stmts) ? out.stmts.map(x => ({ k: String(x.k || ''), ox: String(x.ox || ''), why: String(x.why || ''), fix: String(x.fix || '') })) : [], ai: 1, at: today() };
  S.expl[q.id] = rec; save('expl/' + safeKey(q.id), rec);
  return rec;
}
function explHtml(q) {
  const e = q.ans ? { answer: q.ans, explanation: q.ex, tip: q.tip, keywords: q.kw || [] } : S.expl[q.id];
  const u = UN[q.u];
  const rel = (q.rel || []).length && u.book ? `<p class="small"><b>관련 교재</b> ${q.rel.map(p => `<a href="#" data-a="openp" data-p="${p}" data-b="${u.book}">p.${p}</a>`).join(' · ')}</p>` : '';
  const open = `<button class="sm" data-a="probopen" data-id="${esc(q.id)}">문제 쪽 열어 필기</button>`;
  if (!e) return `<div class="res">${rel}<div class="row">${sample ? `<button class="sm pri" data-a="aiexpl" data-id="${esc(q.id)}">AI 해설 만들기</button>` : '<span class="mut small">해설은 다음 업데이트에 추가됩니다.</span>'}${open}</div></div>`;
  const cv = S.conv[q.id], st = Array.isArray(e.stmts) ? e.stmts : [];
  return `<div class="res"><p><b>정답</b> ${BL(esc(e.answer))}</p>${st.length ? `<div class="tw"><table class="qt"><tr><th>보기</th><th>판정</th><th>근거 · 바르게 고친 문장</th></tr>${st.map(x => `<tr><td>${esc(x.k || '')}</td><td>${esc(x.ox || '')}</td><td style="text-align:left">${BL(esc(x.why || ''))}${x.fix ? `<br><span class="mut">→ ${BL(esc(x.fix))}</span>` : ''}</td></tr>`).join('')}</table></div>` : ''}${e.explanation ? `<p><b>해설</b></p>${rich(e.explanation)}` : ''}${cv && cv.model ? `<p><b>서술형 모범 답안</b></p>${rich(cv.model)}${(cv.rubric || []).length ? `<table class="qt"><tr><th>채점 기준</th><th>배점</th></tr>${cv.rubric.map(x => `<tr><td style="text-align:left">${BL(esc(x.c))}</td><td>${x.p}</td></tr>`).join('')}</table>` : ''}` : ''}${(e.keywords || []).length ? `<p class="small"><b>키워드</b> ${e.keywords.map(esc).join(', ')}</p>` : ''}${e.tip ? `<div class="mn">${BL(esc(e.tip))}</div>` : ''}${e.ai ? `<p class="mut small">AI가 작성한 해설${e.confidence === 'low' ? ' · 확신 낮음, 교재로 꼭 확인하세요' : ''} · ${esc(e.at || '')}</p>` : '<p class="mut small">직접 검토한 해설</p>'}${rel}<div class="row">${open}${e.ai && sample ? `<button class="sm" data-a="aiexpl" data-id="${esc(q.id)}">다시 만들기</button>` : ''}</div></div>`;
}

/* ---- 객관식 기출 → 서술형 풀이 ---- */
const STM = ['ㄱ', 'ㄴ', 'ㄷ'];
function objBody(q, r, sh) {
  const cv = S.conv[q.id];
  const head = `<div class="row" style="margin:2px 0 6px"><span class="pill ped">객관식 → 서술형</span><span class="mut small">자료를 읽고 근거를 써 보세요</span></div>${probHtml(q, true)}`;
  if (cv) return `${head}<div class="qbox" style="margin-top:10px"><b class="lab">AI가 바꾼 서술형 문항</b></div>${rich(cv.q)}<textarea id="ans" placeholder="서술형 답안" style="min-height:120px" ${sh ? 'disabled' : ''}>${esc(r?.ans || '')}</textarea>${sh ? '' : `<div class="row" style="margin-top:10px"><button class="pri" data-a="imgsub">제출하고 해설 보기</button><button data-a="probopen" data-id="${esc(q.id)}">펜으로 풀기</button></div>`}`;
  const ox = (r && r.ox) || {}, why = (r && r.why) || {};
  return `${head}${rich(OBJ_TASK)}<div class="list" id="objList" style="margin-top:6px">${STM.map(k => `<div class="li" style="display:block"><div class="row"><b style="width:28px">${k}.</b><span class="seg" style="flex:none">${['O', 'X'].map(v => `<button type="button" data-a="objox" data-k="${k}" data-v="${v}" class="oxb ${ox[k] === v ? 'on' : ''}" style="min-width:52px" ${sh ? 'disabled' : ''}>${v}</button>`).join('')}</span><span class="sp"></span></div><textarea data-why="${k}" placeholder="${k}의 판단 근거 (틀렸다면 바르게 고친 문장)" style="min-height:56px;margin-top:6px" ${sh ? 'disabled' : ''}>${esc(why[k] || '')}</textarea></div>`).join('')}</div>
  ${sh ? '' : `<div class="row" style="margin-top:10px"><button class="pri" data-a="objsub">제출하고 해설 보기</button><button data-a="probopen" data-id="${esc(q.id)}">펜으로 풀기</button>${sample ? `<button data-a="aiconv" data-id="${esc(q.id)}">AI로 서술형 문항 만들기</button>` : ''}</div>`}`;
}
function origHtml(q) {
  const o = D.problems.find(x => x.id === q.orig); if (!o) return '';
  return `<details class="orig"><summary class="small">원래 객관식 문항 보기 (${esc(KIND_LABEL(o))})</summary>${probHtml(o, false)}</details>`;
}
async function loadConv(q) {
  if (S.conv[q.id] !== undefined) return S.conv[q.id];
  try { S.conv[q.id] = await Store.get('conv/' + safeKey(q.id)); } catch (e) { S.conv[q.id] = null; }
  return S.conv[q.id];
}
async function aiConvert(q) {
  const u = UN[q.u];
  const lim = sample.limits ? await sample.limits().catch(() => ({})) : {};
  const blob = lim && lim.images ? await probBlob(q) : null;
  const prompt = `당신은 중등 생물 임용시험 출제위원입니다. 첨부한 객관식(보기 ㄱ·ㄴ·ㄷ 고르기) 기출 문항을 같은 자료를 쓰는 임용 1차 '서술형(4점)' 문항으로 바꾸세요.
단원: ${u.title}
문항 OCR(오류 있을 수 있음): ${q.txt}
규칙:
- 자료는 그림을 직접 보지 않아도 풀 수 있게 다시 쓰세요. 수치·조건·실험 결과는 마크다운 표(| 칸 | 칸 |, 둘째 줄 |---|)로, 과정은 (가)(나) 줄로 쓰세요.
- 그래프는 표나 '축·곡선 모양·교차점' 설명으로 바꾸세요.
- 마지막에 '<작성 방법>' 줄을 두고 '• '로 시작하는 요구 사항 3개를 쓰세요. 원래 보기 ㄱ·ㄴ·ㄷ의 핵심 개념을 각각 묻되, 용어 쓰기 + 근거 서술 형태로.
- 모범답안은 '• '로 작성 방법 순서대로. 채점 기준은 합 4점.
JSON으로만: {"q":"문항 본문(줄바꿈 \\n 포함)","model":"모범답안","rubric":[{"c":"기준","p":1.5}],"answer":"원문항 정답(예: ③ ㄱ, ㄴ)"}`;
  const out = await sample.json(prompt, Object.assign({ modelTier: 'complex' }, blob ? { images: [blob] } : {}));
  const rec = { q: String(out.q || ''), model: String(out.model || ''), rubric: Array.isArray(out.rubric) ? out.rubric.map(x => ({ c: String(x.c || ''), p: +x.p || 1 })) : [], answer: String(out.answer || ''), ai: 1, at: today() };
  if (!rec.q) throw new Error('empty');
  S.conv[q.id] = rec; save('conv/' + safeKey(q.id), rec);
  return rec;
}

/* ================= 퀴즈 ================= */
let Q = { tab: 'quiz', phase: 'setup', sub: 'today', src: 'mix', n: 10, list: [], i: 0, res: [], shown: false };
const srcOk = q => Q.src === 'mix' || (Q.src === 'real' && (q.t === 'img' || /^cv-/.test(q.id))) || (Q.src === 'im' && q.t === 'img' && q.kind === '임용') || (Q.src === 'var' && /^(v|cv)-/.test(q.id)) || (Q.src === 'pred' && /^pr-/.test(q.id)) || (Q.src === 'basic' && q.t !== 'img' && !/^(v|cv|pr)-/.test(q.id));
function buildQuiz(src) {
  let list = []; const pool = allQ().filter(srcOk);
  if (src === 'due') list = shuffle(dueIds().map(qById).filter(Boolean)).slice(0, 30);
  else if (src === 'wrong') list = shuffle(Object.entries(S.srs.cards).filter(([, c]) => c.w > 0 && c.b < 5).map(([id]) => qById(id)).filter(Boolean)).slice(0, Q.n);
  else if (src && src.startsWith('u:')) list = shuffle(pool.filter(q => q.u === src.slice(2))).slice(0, Q.n);
  else if (src && src.startsWith('ur:')) { const [, u, k] = src.split(':'); list = D.problems.filter(q => q.u === u && (k === 'all' || (k === 'im' ? q.kind === '임용' : q.kind !== '임용'))).sort((x, y) => (y.real || 0) - (x.real || 0)).slice(0, 40); }
  else if (src && src.startsWith('uv:')) list = allQ().filter(q => q.u === src.slice(3) && /^(v|cv|pr)-/.test(q.id));
  else {
    const p = planFor(today()), subs = Q.sub === 'today' ? p.blocks.map(b => b.s) : [Q.sub], units = Q.sub === 'today' ? p.blocks.map(b => b.u) : null;
    const due = shuffle(dueIds().map(qById).filter(q => q && (Q.sub === 'today' || q.s === Q.sub)));
    list = due.slice(0, Math.round(Q.n * .4));
    const add = arr => { for (const q of shuffle(arr)) { if (list.length >= Q.n) break; if (!list.includes(q) && !(q.t === 'essay' && list.some(x => x.t === 'essay'))) list.push(q); } };
    if (units && Q.src === 'mix') { add(shuffle(pool.filter(q => units.includes(q.u) && q.t === 'img' && q.kind === '임용')).slice(0, 2)); add(shuffle(pool.filter(q => units.includes(q.u) && /^v-/.test(q.id))).slice(0, 2)); }
    if (units) add(pool.filter(q => units.includes(q.u)));
    add(pool.filter(q => subs.includes(q.s))); add(pool);
  }
  const seen = new Set();
  return list.map(q => (q.conv && qById(q.conv)) || q).filter(q => !seen.has(q.id) && seen.add(q.id));
}
function startQuiz(src) { Q.tab = 'quiz'; Q.list = buildQuiz(src); Q.i = 0; Q.res = []; Q.shown = false; Q.phase = Q.list.length ? 'run' : 'setup'; if (!Q.list.length) toast('해당 범위에 문항이 아직 없어요'); if (location.hash !== '#quiz') location.hash = 'quiz'; else vQuiz(); }
function vQuiz() {
  if (Q.phase === 'run') return runQuiz();
  if (Q.phase === 'done') return doneQuiz();
  const top = header('퀴즈', `문항 ${allQ().length}개 · 복습 ${dueIds().length}장`) + `<main>${seg('qtab', [['quiz', '퀴즈'], ['review', '간격반복'], ['wrong', '오답노트']], Q.tab)}`;
  if (Q.tab === 'review') return vReview(top);
  if (Q.tab === 'wrong') return vWrong(top);
  const cnt = s => allQ().filter(q => q.s === s).length;
  view.innerHTML = top + `<div class="sec"><b>범위</b></div><div class="card"><div class="chips">${[['today', '오늘 계획'], ['edu', `교육학 ${cnt('edu')}`], ['ped', `교과교육론 ${cnt('ped')}`], ['maj', `전공 ${cnt('maj')}`]].map(([k, l]) => `<button class="${Q.sub === k ? 'on' : ''}" data-a="qsub" data-k="${k}">${l}</button>`).join('')}</div>
  <div class="chips" style="margin-top:10px">${[['mix', '섞어서'], ['im', `임용 기출 ${D.problems.filter(q => q.kind === '임용').length}`], ['real', '모든 기출'], ['var', `변형·전환 ${allQ().filter(q => /^(v|cv)-/.test(q.id)).length}`], ['pred', `예상 ${allQ().filter(q => /^pr-/.test(q.id)).length}`], ['basic', '기본 문항']].map(([k, l]) => `<button class="${Q.src === k ? 'on' : ''}" data-a="qsrc" data-k="${k}">${l}</button>`).join('')}</div>
  <div class="chips" style="margin-top:10px">${[10, 20, 30].map(k => `<button class="${Q.n === k ? 'on' : ''}" data-a="qn" data-k="${k}">${k}문항</button>`).join('')}</div>
  <div class="row" style="margin-top:14px"><button class="pri sp" data-a="qgo">시작</button><button class="sp" data-a="qprint">문제지 인쇄</button></div></div>
  <div class="sec"><b>단원 골라 풀기</b></div><div class="card"><select id="qunit">${Object.keys(SUBJ).map(s => `<optgroup label="${SUBJ[s]}">${unitsOf(s).map(u => `<option value="${u.id}">${esc(u.title)} (${allQ().filter(q => q.u === u.id).length})</option>`).join('')}</optgroup>`).join('')}</select>
  <div class="row" style="margin-top:10px"><button data-a="qunit">이 단원 풀기</button>${sample ? '<button data-a="aigenq">AI로 5문항 만들기</button>' : ''}</div>
  <p class="mut small">AI 생성 문항에는 'AI 생성' 표시가 붙어요. 교재와 다르면 교재를 따르세요.</p></div></main>`;
}
function runQuiz() {
  const q = Q.list[Q.i], r = Q.res[Q.i], sh = Q.shown, u = UN[q.u];
  let body = '';
  if (q.t === 'mc') body = (q.ch || []).map((c, i) => `<button class="opt ${sh ? (i === q.a ? 'ok' : r && r.pick === i ? 'bad' : '') : ''}" data-a="pick" data-i="${i}" ${sh ? 'disabled' : ''}>${'①②③④⑤'[i]} ${BL(esc(c))}</button>`).join('');
  else if (q.t === 'ox') body = `<div class="row">${['O', 'X'].map(o => `<button class="opt sp ${sh ? (o === q.a ? 'ok' : r && r.pick === o ? 'bad' : '') : ''}" style="text-align:center;font-size:26px" data-a="pick" data-i="${o}" ${sh ? 'disabled' : ''}>${o}</button>`).join('')}</div>`;
  else if (q.t === 'img' && isObj(q)) body = objBody(q, r, sh);
  else if (q.t === 'img') body = `${probHtml(q, true)}<textarea id="ans" placeholder="답안을 써 보세요 (선택)" style="min-height:90px;margin-top:8px" ${sh ? 'disabled' : ''}>${esc(r?.ans || '')}</textarea><div class="row" style="margin-top:10px">${sh ? '' : '<button class="pri" data-a="imgsub">해설 보기</button><button data-a="probopen" data-id="' + esc(q.id) + '">펜으로 풀기</button>'}</div>`;
  else if (q.t === 'short') body = `<input id="ans" placeholder="답을 입력하세요" value="${esc(r?.ans || '')}" ${sh ? 'disabled' : ''} autocomplete="off"><div class="row" style="margin-top:10px">${sh ? '' : '<button class="pri" data-a="sub">제출</button><button data-a="skip">모르겠음</button>'}</div>`;
  else body = `<textarea id="ans" placeholder="서술형 답안 (${q.pts || 4}점)" ${sh ? 'disabled' : ''}>${esc(r?.ans || '')}</textarea><div class="row" style="margin-top:10px">${sh ? '' : '<button class="pri" data-a="sub">제출하고 채점</button><button data-a="skip">모르겠음</button>'}</div>`;
  let fb = '';
  if (sh && q.t === 'img') {
    fb = `${explHtml(q)}<p class="mut small" style="margin:14px 0 6px">채점해 보세요</p><div class="chips"><button class="${r.g === 'sure' ? 'on' : ''}" data-a="selfg" data-k="sure">맞음</button><button class="${r.g === 'unsure' ? 'on' : ''}" data-a="selfg" data-k="unsure">애매</button><button class="${r.g === 'wrong' ? 'on' : ''}" data-a="selfg" data-k="wrong">틀림</button></div>
     ${r.g === 'wrong' ? `<p class="mut small" style="margin:12px 0 6px">왜 틀렸나요?</p><div class="chips">${Object.entries(REASON).map(([k, l]) => `<button class="${r.reason === k ? 'on' : ''}" data-a="reason" data-k="${k}">${l}</button>`).join('')}</div>` : ''}
     <div class="row" style="margin-top:14px"><span class="sp"></span><button class="pri" data-a="next" ${r.g ? '' : 'disabled'}>${Q.i + 1 < Q.list.length ? '다음' : '결과 보기'}</button></div>`;
  } else if (sh) {
    const ok = r.ok;
    fb = `<div class="res ${ok ? '' : 'bad'}"><b>${ok ? '정답이에요' : '오답이에요'}${r.part && !ok ? ` · 키워드 ${Math.round(r.part * 100)}%` : ''}</b>
     <p><b>${q.t === 'essay' ? '모범 답안' : '정답'}</b></p>${rich(ansText(q))}
     ${q.rubric ? `<table><tbody>${q.rubric.map((c, i) => `<tr><td><label class="row"><input type="checkbox" style="width:22px;height:22px" data-a="rub" data-i="${i}" ${r.rub && r.rub[i] ? 'checked' : ''}> ${esc(c.c)}</label></td><td class="n">${c.p}점</td></tr>`).join('')}</tbody></table>` : ''}
     ${q.ex ? `<p><b>해설</b></p>${rich(q.ex)}` : ''}${q.tip ? `<div class="mn">${BL(esc(q.tip))}</div>` : ''}${q.origAns ? `<p class="mut small">${esc(q.origAns)}</p>` : ''}
     ${q.ref && u && u.book ? `<p><a href="#" data-a="openp" data-p="${q.ref}" data-b="${u.book}">교재 p.${q.ref} 보기</a></p>` : ''}
     ${r.ai ? `<p><b>AI</b> ${esc(r.ai)}</p>` : ''}
     <div class="row">${q.t === 'short' && !ok ? '<button class="sm" data-a="override">사실 맞았어요</button>' : ''}${q.t === 'essay' && sample ? '<button class="sm" data-a="aiessay">AI 채점</button>' : ''}${sample && !ok ? '<button class="sm" data-a="aitip">AI 암기법</button>' : ''}</div></div>
     ${!ok ? `<p class="mut small" style="margin:14px 0 6px">왜 틀렸나요?</p><div class="chips">${Object.entries(REASON).map(([k, l]) => `<button class="${r.reason === k ? 'on' : ''}" data-a="reason" data-k="${k}">${l}</button>`).join('')}</div>` : `<p class="mut small" style="margin:14px 0 6px">얼마나 확실했나요?</p><div class="chips"><button class="${r.conf === 'unsure' ? 'on' : ''}" data-a="conf" data-k="unsure">찍었음·애매</button><button class="${r.conf === 'sure' ? 'on' : ''}" data-a="conf" data-k="sure">확실</button></div>`}
     <div class="row" style="margin-top:14px"><span class="sp"></span><button class="pri" data-a="next">${Q.i + 1 < Q.list.length ? '다음' : '결과 보기'}</button></div>`;
  }
  view.innerHTML = `<div class="top"><div class="row"><button class="plain" data-a="qquit">그만</button><span class="tt">${Q.i + 1} / ${Q.list.length}</span><span style="width:60px"></span></div><div class="meter" style="margin-top:6px"><i style="width:${(Q.i + (sh ? 1 : 0)) / Q.list.length * 100}%"></i></div></div>
  <main><div class="row" style="margin:6px 0 10px">${pill(q.s)}<span class="mut small">${esc(u?.title || '')}${q.t === 'img' || q.src ? ' · ' + esc(KIND_LABEL(q)) : ''}</span></div><div class="card">${q.t === 'img' ? '' : qHtml(q)}${q.orig ? origHtml(q) : ''}${body}${fb}</div></main>`;
  drawProbs();
  if (isObj(q) && S.conv[q.id] === undefined) loadConv(q).then(c => { if (c && Q.list[Q.i] === q && !Q.shown) runQuiz(); });
  if (q.t === 'img' && sh && !q.ans && S.expl[q.id] === undefined) loadExpl(q).then(e => { if (e && Q.list[Q.i] === q && Q.shown) runQuiz(); });
}
function finishAnswer(res) { const q = Q.list[Q.i]; Q.res[Q.i] = Object.assign({ qid: q.id, conf: res.ok ? 'sure' : '', reason: res.ok ? '' : 'none' }, res); Q.shown = true; runQuiz(); }
function commitCurrent() {
  const q = Q.list[Q.i], r = Q.res[Q.i]; if (!r || r.done) return; r.done = 1;
  if (q.t === 'img') { r.ok = r.g !== 'wrong'; r.conf = r.g; }
  grade(q.id, r.ok ? (r.conf === 'unsure' ? 'unsure' : 'sure') : 'wrong', r.reason); addAtt(q.id, r.ok, r.ok ? '' : r.reason);
  if (r.ai) { const c = S.srs.cards[q.id]; if (c) { c.ai = r.ai; saveSrs(); } }
}
function doneQuiz() {
  const ok = Q.res.filter(r => r && r.ok).length, tot = Q.list.length, wr = Q.list.filter((q, i) => !Q.res[i]?.ok);
  view.innerHTML = header(`${ok} / ${tot}`, '퀴즈 결과') + `<main><div class="card"><div class="meter"><i style="width:${tot ? ok / tot * 100 : 0}%"></i></div><p class="mut small">틀린 문항은 내일, 애매했던 문항은 간격에 맞춰 다시 나와요.</p></div>
  ${wr.length ? `<div class="sec"><b>틀린 문항</b></div><div class="list">${wr.map(q => { const r = Q.res[Q.list.indexOf(q)] || {}; return `<div class="li"><span class="grow small">${esc(q.t === 'img' ? UN[q.u].title + ' · ' + KIND_LABEL(q) : brief(q.q, 80))}<span class="sub">정답: ${esc(ansText(q).slice(0, 80))}</span></span><span class="pill">${REASON[r.reason] || ''}</span></div>`; }).join('')}</div>` : '<div class="empty" style="margin-top:14px">전부 맞혔어요!</div>'}
  <div class="row" style="margin-top:14px"><button class="pri sp" data-a="qagain">새 퀴즈</button><button class="sp" data-a="qtab" data-k="wrong">오답노트</button></div></main>`;
}
function vReview(top) {
  const due = dueIds().length, box = [0, 0, 0, 0, 0, 0, 0]; Object.values(S.srs.cards).forEach(c => box[c.b || 0]++);
  const mx = Math.max(1, ...box.slice(1));
  view.innerHTML = top + `<div class="card" style="margin-top:14px"><div class="row"><div class="sp"><h2>오늘 복습 ${due}장</h2><p class="mut small" style="margin:4px 0 0">틀리면 1일 뒤, 맞히면 3·7·14·30·60일 뒤 다시 나와요.</p></div><button class="pri" data-a="qdue" ${due ? '' : 'disabled'}>시작</button></div>
  <div class="row" style="align-items:flex-end;gap:6px;margin-top:16px">${box.slice(1).map((n, i) => `<div style="flex:1;text-align:center"><div style="height:${8 + n / mx * 80}px;background:var(--blue);opacity:${.3 + i * .14};border-radius:6px 6px 2px 2px"></div><span class="mut small">${i + 1}상자<br>${n}</span></div>`).join('')}</div></div>
  <p class="mut small" style="padding:0 4px">상자 번호가 높을수록 장기기억에 가까워요. 5상자 이상이면 오답노트에서 졸업해요.</p></main>`;
}
let RV = { sub: 'all', reason: 'all' };
function vWrong(top) {
  const rows = Object.entries(S.srs.cards).filter(([id, c]) => c.w > 0 && qById(id)).map(([id, c]) => ({ q: qById(id), c })).filter(x => (RV.sub === 'all' || x.q.s === RV.sub) && (RV.reason === 'all' || x.c.r === RV.reason)).sort((a, b) => b.c.w - a.c.w);
  view.innerHTML = top + `<div class="chips" style="margin-top:14px">${[['all', '전체'], ...Object.entries(SUBJ)].map(([k, l]) => `<button class="${RV.sub === k ? 'on' : ''}" data-a="rvsub" data-k="${k}">${l}</button>`).join('')}</div>
  <div class="chips" style="margin-top:8px">${[['all', '모든 이유'], ...Object.entries(REASON)].map(([k, l]) => `<button class="${RV.reason === k ? 'on' : ''}" data-a="rvr" data-k="${k}">${l}</button>`).join('')}</div>
  <div class="row" style="margin:12px 0"><button class="pri sp" data-a="qwrong" ${rows.length ? '' : 'disabled'}>오답만 다시 풀기</button><button class="sp" data-a="printwrong" ${rows.length ? '' : 'disabled'}>오답노트 인쇄</button></div>
  ${rows.length ? `<div class="list" id="wrongList">${rows.map(({ q, c }) => `<details class="li" style="display:block"><summary class="row"><span class="pill ${q.s}">${esc(UN[q.u]?.title || '')}</span><span class="sp small">${esc(q.t === 'img' ? KIND_LABEL(q) : brief(q.q, 54))}</span><span class="mut small">${c.w}회</span></summary>
   ${q.t === 'img' ? probHtml(q, false) : qHtml(q)}<p class="small"><b>정답</b></p>${rich(ansText(q))}${q.ex ? `<p class="small"><b>해설</b></p>${rich(q.ex)}` : ''}${q.tip ? `<p class="small"><b>암기 팁</b> ${esc(q.tip)}</p>` : ''}${c.ai ? `<p class="small"><b>AI 암기법</b> ${esc(c.ai)}</p>` : ''}<p class="mut small">${REASON[c.r] || ''} · ${c.b}상자 · 다음 ${esc(c.due)}</p></details>`).join('')}</div>` : '<div class="empty">아직 오답이 없어요. 퀴즈를 풀면 자동으로 쌓여요.</div>'}</main>`;
}
function quizPrintHtml(list, title) {
  list = list.filter(q => q.t !== 'img');
  const kind = { mc: '객관식', ox: 'OX', short: '기입형', essay: '서술형' };
  return `<h1>${esc(title)}</h1><p class="mut">이름 ____________ · 날짜 ${today()} · ${list.length}문항</p>` +
    list.map((q, i) => `<div class="q"><b>${i + 1}.</b> <span class="mut">[${kind[q.t]}${q.pts ? ' ' + q.pts + '점' : ''}]</span> ${qHtml(q)}${q.t === 'mc' ? (q.ch || []).map((c, j) => `<div class="opt">${'①②③④⑤'[j]} ${esc(c)}</div>`).join('') : q.t === 'ox' ? '<div class="opt">( O / X )</div>' : `<div class="ans" style="min-height:${q.t === 'essay' ? 60 : 14}mm"></div>`}</div>`).join('') +
    `<h2 class="pb">정답과 해설</h2>` + list.map((q, i) => `<p><b>${i + 1}.</b> ${esc(ansText(q)).replace(/\n/g, '<br>')}${q.ex ? `<br><span class="mut">${esc(q.ex)}</span>` : ''}</p>`).join('');
}

/* ================= 서재 (PDF·필기·검색) ================= */
let LB = { q: '', hits: null, searching: false };
function vLib() {
  const books = D.books;
  view.innerHTML = header('서재', '교재 원문 보기 · 애플펜슬 필기 · 전체 검색') + `<main>
  <div class="card"><form data-f="search" class="row"><input id="sq" type="search" placeholder="교재 전체에서 검색 (예: 트로포닌, 근접발달영역)" value="${esc(LB.q)}" class="sp"><button class="pri">검색</button></form>
  <div id="shits">${LB.searching ? '<p class="mut small">찾는 중…</p>' : LB.hits ? searchHtml() : '<p class="mut small" style="margin:8px 0 0">스캔본을 글자로 읽어 둔 내용에서 찾아요. 인식 오류가 있을 수 있어요.</p>'}</div></div>
  ${['edu', 'ped', 'maj', 'prob'].map(s => { const bs = s === 'prob' ? books.filter(b => b.kind === 'prob') : books.filter(b => b.subject === s && b.kind !== 'prob'); return bs.length ? `<div class="sec"><b>${s === 'prob' ? '문제편 (기출)' : SUBJ[s]}</b><span>${bs.length}권</span></div><div class="list">${bs.map(b => { const ps = S.pos['b-' + b.id]; return `<button class="li" data-a="book" data-b="${b.id}"><span class="ico b-${s === 'prob' ? 'red' : s}">${esc(b.short.replace(/\D/g, '') || b.short.slice(-1))}</span><span class="grow">${esc(b.title)}<span class="sub">${b.pages}쪽${ps ? ' · 마지막 ' + ps.p + '쪽' : ''}</span></span><span class="chev">›</span></button>`; }).join('')}</div>` : ''; }).join('')}
  ${D.exams ? `<div class="sec"><b>실제 임용 기출 2023~2026</b><span>시험지 원본 · 실전 풀이</span></div><div class="list">${['2026', '2025', '2024', '2023'].map(y => `<div class="li" style="display:block"><div class="row"><span class="ico b-red">${y.slice(2)}</span><b class="sp">${y}학년도</b></div><div class="chips" style="margin-top:8px"><button class="sm" data-a="exampdf" data-k="${y}-edu">교육학</button>${['A', 'B'].map(pp => `<button class="sm" data-a="exampdf" data-k="${y}-${pp}">전공 ${pp} 원본</button><button class="sm pri" data-a="examrun" data-k="${y}-${pp}">전공 ${pp} 실전 풀기</button>`).join('')}</div></div>`).join('')}</div>` : ''}
  <div class="sec"><b>내 PDF</b><label class="btn sm" style="display:inline-flex;align-items:center">올리기<input type="file" accept="application/pdf" data-f="upload" hidden></label></div>
  <div class="list">${S.lib.files.length ? S.lib.files.map((f, i) => `<button class="li" data-a="myfile" data-i="${i}"><span class="ico b-gray">PDF</span><span class="grow">${esc(f.name)}<span class="sub">${Math.round((f.size || 0) / 1048576 * 10) / 10}MB · ${esc(f.at || '')}</span></span><span class="chev">›</span></button>`).join('') : '<div class="li mut small">계획표·기출 PDF 등을 올려 두고 바로 보면서 필기할 수 있어요.</div>'}</div>
  <div class="sec"><b>필기 노트</b><button class="plain sm" data-a="newnb">새 노트</button></div>
  <div class="list">${S.lib.nbs.length ? S.lib.nbs.map((n, i) => `<button class="li" data-a="nb" data-i="${i}"><span class="ico b-yel">✎</span><span class="grow">${esc(n.name)}<span class="sub">모눈 노트 · ${n.pages}쪽</span></span><span class="chev">›</span></button>`).join('') : '<div class="li mut small">빈 모눈 노트에 백지 복습·구조도를 그려 보세요.</div>'}</div>
  </main>`;
}
async function loadText(id) { if (!D.text[id]) D.text[id] = await fetch('data/text/' + id + '.json').then(r => r.ok ? r.json() : []).catch(() => []); return D.text[id]; }
async function doSearch(q) {
  LB.q = q.trim(); if (LB.q.length < 2) { toast('두 글자 이상 입력하세요'); return; }
  LB.searching = true; vLib();
  const needle = norm(LB.q), hits = [];
  for (const b of D.books) {
    const pages = await loadText(b.id);
    pages.forEach((t, i) => { if (!t) return; const n = norm(t); const k = n.indexOf(needle); if (k >= 0) hits.push({ b: b.id, p: i + 1, t }); });
  }
  LB.hits = hits; LB.searching = false; if (location.hash === '#lib') vLib();
}
function searchHtml() {
  if (!LB.hits.length) return '<p class="mut small">결과가 없어요. 다른 표현으로 찾아보세요.</p>';
  const word = LB.q.trim();
  return `<p class="mut small" style="margin:10px 0 4px">${LB.hits.length}쪽에서 찾았어요</p>` + LB.hits.slice(0, 60).map(h => {
    const t = h.t.replace(/\s+/g, ' '); const k = t.indexOf(word); const s = k >= 0 ? t.slice(Math.max(0, k - 40), k + word.length + 60) : t.slice(0, 100);
    return `<button class="li search-hit" data-a="hit" data-b="${h.b}" data-p="${h.p}" style="display:block"><b class="small">${esc(BK[h.b].short)} · ${h.p}쪽</b><span class="sub">${esc(s).split(esc(word)).join('<mark>' + esc(word) + '</mark>')}</span></button>`;
  }).join('') + (LB.hits.length > 60 ? `<p class="mut small">상위 60개만 보여요.</p>` : '');
}
async function uploadPdf(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') { toast('PDF 파일만 올릴 수 있어요'); return; }
  const rec = { name: file.name.replace(/\.pdf$/i, ''), size: file.size, at: today() };
  if (assets) {
    if (file.size > 20 * 1048576) { toast('20MB 이하 PDF만 올릴 수 있어요'); return; }
    toast('올리는 중…');
    try { const a = await assets.upload(file); rec.id = a.id; rec.url = '/_blob/' + a.id; }
    catch (e) { toast('올리지 못했어요'); return; }
  } else if (idb) {
    rec.local = 'f' + Date.now();
    try { await idbReq('files', 'readwrite', s => s.put(file, rec.local)); } catch (e) { toast('이 기기에 저장하지 못했어요'); return; }
  } else { toast('이 브라우저는 파일을 저장할 수 없어요'); return; }
  S.lib.files.unshift(rec); saveLib(); toast('올렸어요'); vLib();
}
async function openMyFile(i) {
  const f = S.lib.files[i]; if (!f) return;
  const key = 'f-' + safeKey(f.id || f.local || f.name);
  if (f.url) return Viewer.open({ key, title: f.name, src: f.url, page: S.pos[key]?.p || 1 });
  try { const blob = await idbReq('files', 'readonly', s => s.get(f.local)); const buf = new Uint8Array(await blob.arrayBuffer()); Viewer.open({ key, title: f.name, data: buf, page: S.pos[key]?.p || 1 }); }
  catch (e) { toast('파일을 찾지 못했어요'); }
}

/* ================= 더보기 (모의고사·기록·공부법·설정) ================= */
let MORE = 'mock';
let M = { phase: 'setup' };
const KIND = { edu: { n: '1교시 교육학 논술', min: 60 }, A: { n: '2교시 전공A', min: 90, sh: 4, es: 8 }, B: { n: '3교시 전공B', min: 90, sh: 2, es: 9 }, mini: { n: '미니 모의고사 (주간 범위)', min: 30, sh: 2, es: 2 } };
function buildMock(k) {
  const pool = allQ(), used = new Set(S.mocks.flatMap(m => (m.items || []).map(i => i.qid)));
  const pick = (arr, n) => shuffle(arr.filter(q => !used.has(q.id))).concat(shuffle(arr.filter(q => used.has(q.id)))).slice(0, n);
  if (k === 'edu') return pick(pool.filter(q => q.s === 'edu' && q.t === 'essay' && (q.pts || 0) >= 10), 1);
  let src = pool.filter(q => q.s !== 'edu');
  if (k === 'mini') { const us = new Set(planFor(today()).blocks.map(b => b.u)); const near = src.filter(q => us.has(q.u)); if (near.length >= 4) src = near.concat(src); }
  const ess = src.filter(q => q.t === 'essay' || (q.t === 'img' && q.kind === '임용'));
  const imgs = pick(ess.filter(q => q.t === 'img'), Math.min(4, Math.ceil(KIND[k].es / 2)));
  return pick(src.filter(q => q.t === 'short'), KIND[k].sh).concat(imgs, pick(ess.filter(q => q.t === 'essay'), KIND[k].es - imgs.length));
}
function collectMock() { (M.items || []).forEach((it, i) => { const el = document.getElementById('m' + i); if (el) it.ans = el.value; }); }
function autoScoreMock() { M.items.forEach(it => { const q = qById(it.qid); if (q && q.t === 'short') it.score = checkShort(q, it.ans).ok ? 2 : 0; }); }
/* ================= 출제 동향 ================= */
const YRS = ['2023', '2024', '2025', '2026'];
const PCOL = { '높음': 'b-red', '중간~높음': 'b-ped', '중간': 'b-gray' };
function unitTrend(uid) {
  const T = D.trend; if (!T) return null;
  const by = (T.byUnit || {})[uid] || {}, yrs = YRS.filter(y => by[y]), pr = (T.pred || []).find(p => p.u === uid);
  return { yrs, n: yrs.reduce((a, y) => a + by[y], 0), all: (T.allIm || {})[uid] || 0, pr };
}
function trendBadge(uid) {
  const t = unitTrend(uid); if (!t || UN[uid]?.s !== 'maj') return '';
  const msg = t.yrs.length >= 3 ? `최근 4년 중 ${t.yrs.length}년 출제 (${t.yrs.join('·')}) — 매년 나오는 단원` : t.yrs.length ? `최근 출제: ${t.yrs.join('·')}` : '최근 4년 출제 없음 — 공백이 긴 단원';
  return `<div class="card trendcard"><div class="row"><span class="pill ${t.yrs.length >= 3 ? 'maj' : t.yrs.length ? '' : 'ped'}">출제 동향</span><span class="sp small">${esc(msg)}</span><button class="sm plain" data-a="go" data-h="more" data-k="trend">자세히 ›</button></div>${t.pr ? `<p class="small" style="margin:8px 0 0"><b>2028 예측(${esc(t.pr.p)})</b> ${esc(t.pr.t)} — ${esc(t.pr.study)}</p>` : ''}</div>`;
}
function vTrend(top) {
  const T = D.trend;
  if (!T) { view.innerHTML = top + '<div class="empty">동향 데이터를 불러오지 못했어요.</div></main>'; return; }
  const all = YRS.flatMap(y => T.years[y] || []), maj = unitsOf('maj');
  const groups = [['교과교육론', 'p1', 'p8'], ['세포·대사', 'm01', 'm08'], ['분자', 'm09', 'm13'], ['유전·진화·분류·미생물', 'm14', 'm17'], ['동물생리', 'm18', 'm24'], ['면역·분열·생식·발생', 'm25', 'm29'], ['식물·생태', 'm30', 'm33']];
  const cell = (u, y) => { const n = ((T.byUnit || {})[u] || {})[y] || 0; return `<td class="hm${n ? ' on' + Math.min(n, 3) : ''}">${n || ''}</td>`; };
  const heat = `<div class="tw"><table class="qt heat"><tr><th style="text-align:left">단원</th>${YRS.map(y => `<th>${y.slice(2)}</th>`).join('')}<th>합계</th></tr>${groups.map(([g, a, b]) => `<tr><td colspan="6" class="grp">${g}</td></tr>` + (a[0] === 'p' ? unitsOf('ped') : maj).filter(u => u.id >= a && u.id <= b).map(u => `<tr><td style="text-align:left"><a href="#" data-a="unit" data-u="${u.id}">${esc(u.title)}</a></td>${YRS.map(y => cell(u.id, y)).join('')}<td class="mut">${(T.allIm || {})[u.id] || 0}</td></tr>`).join('')).join('')}</table></div>`;
  const forms = all.reduce((a, it) => (a[it.form] = (a[it.form] || 0) + 1, a), {});
  view.innerHTML = top + `<div class="card"><p class="small" style="margin:0">${esc(T.note)}</p></div>
  <div class="kpi" style="margin-top:12px"><div><b>${all.length}</b><span>실제 기출 문항</span></div><div><b>${forms['서술형(4점)'] || 0}</b><span>서술형(4점)</span></div><div><b>${(T.pred || []).length}</b><span>2028 예측 주제</span></div></div>
  <div class="sec"><b>2028학년도 예측</b><span>근거와 함께</span></div>
  <div class="list">${(T.pred || []).map((p, i) => `<details class="li" style="display:block" ${i < 2 ? 'open' : ''}><summary class="row"><span class="ico ${PCOL[p.p] || 'b-gray'}">${i + 1}</span><span class="sp"><b>${esc(p.t)}</b><span class="sub">${esc(UN[p.u]?.title || '')} · 가능성 ${esc(p.p)}</span></span></summary>
    <p class="small"><b>근거</b> ${esc(p.why)}</p><p class="small"><b>대비 포인트</b> ${esc(p.study)}</p>
    <div class="row" style="margin:6px 0 4px"><button class="sm" data-a="unit" data-u="${p.u}">단원 노트</button>${(p.qs || []).filter(qById).length ? `<button class="sm pri" data-a="qset" data-ids="${esc(p.qs.filter(qById).join(','))}">예상·관련 문항 ${p.qs.filter(qById).length}개 풀기</button>` : ''}</div></details>`).join('')}</div>
  <div class="sec"><b>출제 경향 ${(T.insights || []).length}가지</b></div>
  <div class="cols two">${(T.insights || []).map(it => `<div class="card"><b>${esc(it.t)}</b><p class="small" style="margin:6px 0">${esc(it.d)}</p>${(it.units || []).length ? `<div class="chips">${it.units.map(u => `<button class="sm" data-a="unit" data-u="${u}">${esc(UN[u]?.title || u)}</button>`).join('')}</div>` : ''}</div>`).join('')}</div>
  <div class="sec"><b>단원 × 연도 출제 지도</b><span>숫자 = 수록 문항 수</span></div>${heat}
  <div class="sec"><b>연도별 문항</b><span>누르면 문항이 열려요</span></div>
  ${(T.edu || []).length ? `<div class="sec"><b>교육학 논술 4년</b><span>주제 · 영역</span></div><div class="tw"><table class="qt"><tr><th>연도</th><th style="text-align:left">주제</th><th style="text-align:left">영역</th></tr>${T.edu.map(e => `<tr><td>${e.year}</td><td style="text-align:left"><a href="#" data-a="exampdf" data-k="${e.year}-edu">${esc(e.theme)}</a></td><td style="text-align:left" class="small">${e.parts.map(p => esc(p.t)).join('<br>')}</td></tr>`).join('')}</table></div>` : ''}
  ${YRS.slice().reverse().map(y => `<details class="card" style="margin-bottom:10px" ${y === '2026' ? 'open' : ''}><summary><b>${y}학년도</b> <span class="mut small">${(T.years[y] || []).length}문항</span></summary><div class="tw"><table class="qt"><tr><th>단원</th><th>주제</th><th>형식</th><th>번호</th></tr>${(T.years[y] || []).map(it => `<tr><td>${esc(UN[it.u]?.title || it.u)}</td><td style="text-align:left"><a href="#" data-a="realone" data-id="${esc(it.id)}">${esc(it.topic)}</a></td><td>${esc(it.form)}</td><td>${esc(it.skill)}</td></tr>`).join('')}</table></div></details>`).join('')}
  <div class="row" style="margin-top:8px"><button class="pri sp" data-a="qset" data-ids="${esc(allQ().filter(q => /^pr-/.test(q.id)).map(q => q.id).join(','))}">예상 문항 전부 풀기</button><button class="sp" data-a="trendprint">동향 인쇄</button></div></main>`;
}

function vMore() {
  if (M.phase === 'run') { vMockRun(); drawProbs(); return; }
  if (M.phase === 'grade') { vMockGrade(); drawProbs(); return; }
  const top = header('더보기', '출제 동향 · 모의고사 · 기록 · 공부법 · 설정') + `<main>${seg('more', [['trend', '출제 동향'], ['mock', '모의고사'], ['stat', '기록'], ['how', '공부법'], ['set', '설정']], MORE)}`;
  if (MORE === 'trend') return vTrend(top);
  if (MORE === 'stat') return vStat(top);
  if (MORE === 'how') return vHow(top);
  if (MORE === 'set') return vSet(top);
  const hist = S.mocks.slice().sort((a, b) => b.at - a.at);
  view.innerHTML = top + `<div class="sec"><b>토요 모의고사</b><span>실제 시간표·답안지 형식</span></div><div class="list">
  ${Object.entries(KIND).map(([k, K]) => `<div class="li"><span class="ico ${k === 'edu' ? 'b-edu' : k === 'mini' ? 'b-gray' : 'b-maj'}">${k === 'edu' ? '1' : k === 'A' ? '2' : k === 'B' ? '3' : 'S'}</span><span class="grow">${K.n}<span class="sub">${K.min}분 · ${k === 'edu' ? '논술 1문항 20점 (내용 15 + 구성·표현 5)' : `기입형 ${K.sh}(2점) · 서술형 ${K.es}(4점)`}</span></span><button class="sm" data-a="mprint" data-k="${k}">인쇄</button><button class="sm pri" data-a="mstart" data-k="${k}">시작</button></div>`).join('')}</div>
  <p class="mut small" style="padding:0 4px">1~5월은 미니, 6월부터는 1~3교시 실전을 권해요. 실제 답안지 양식을 주시면 그대로 맞춰 드릴게요.</p>
  <div class="sec"><b>지난 기록</b></div>${hist.length ? `<div class="list">${hist.map(m => `<div class="li"><span class="grow">${esc(KIND[m.k]?.n || m.k)}<span class="sub">${esc(m.d)}</span></span><b>${esc(m.total)} / ${esc(m.max)}</b></div>`).join('')}</div>` : '<div class="empty">아직 응시 기록이 없어요.</div>'}</main>`;
}
function mockPaperHtml(items, k) {
  const K = KIND[k];
  return `<h1>${esc(K.n)}</h1><p class="mut">시험 시간 ${K.min}분 · 수험번호 __________ 성명 __________</p>` + items.map((it, i) => { const q = qById(it.qid) || {}; return `<div class="q"><b>${i + 1}.</b> <span class="mut">[${q.t === 'short' ? '기입형' : q.s === 'edu' ? '논술형' : '서술형'} ${it.max}점]</span><br>${q.t === 'img' ? '<i>[기출 그림 문항 — 앱의 문제지 또는 단원 기출 인쇄로 확인]</i>' : qHtml(q)}</div>`; }).join('') +
    `<h2 class="pb">답안지</h2><p class="mut">수험번호 __________ 성명 __________</p>` + items.map((it, i) => k === 'edu' ? `<div class="lined"></div><div class="lined pb"></div>` : `<div class="q"><b>${i + 1}번</b> <span class="mut">${it.max}점</span><div class="ans" style="min-height:${it.max > 2 ? 55 : 18}mm"></div></div>`).join('');
}
function vMockRun() {
  const K = KIND[M.k];
  view.innerHTML = `<div class="top"><div class="row"><span class="tt" style="text-align:left">${K.n}</span><b id="mclock" style="font-variant-numeric:tabular-nums;font-size:20px">${fmt(M.end - Date.now())}</b><button class="sm red" data-a="msubmit">제출</button></div></div>
  <main><div class="sec"><b>문제지</b></div><div class="card">${M.items.map((it, i) => { const q = qById(it.qid) || {}; return `<div style="margin:6px 0 18px"><b>${i + 1}.</b> <span class="pill">${q.t === 'short' ? '기입형' : q.s === 'edu' ? '논술형' : '서술형'} ${it.max}점</span>${q.t === 'img' ? probHtml(q, true) : qHtml(q)}</div>`; }).join('')}</div>
  <div class="sec"><b>답안지</b></div><div class="sheet"><div class="hd"><div>수험번호 <input aria-label="수험번호"></div><div>성명 <input aria-label="성명"></div></div>
  ${M.items.map((it, i) => { const q = qById(it.qid) || {}; return `<div class="it"><b>${i + 1}번</b> <span style="color:#666;font-size:13px">${q.t === 'short' ? '기입형' : '서술형'} · ${it.max}점</span>${M.k === 'edu' ? `<textarea class="lined" id="m${i}" data-a="cnt">${esc(it.ans || '')}</textarea><p style="color:#666;font-size:13px" id="cnt">${(it.ans || '').length}자</p>` : `<textarea id="m${i}" style="min-height:${q.t === 'short' ? 64 : 160}px">${esc(it.ans || '')}</textarea>`}</div>`; }).join('')}</div></main>`;
}
function vMockGrade() {
  const tot = M.items.reduce((a, i) => a + (+i.score || 0), 0), max = M.items.reduce((a, i) => a + i.max, 0);
  view.innerHTML = header(`${tot} / ${max}`, KIND[M.k].n + ' 채점') + `<main><div class="row">${sample ? '<button class="pri" data-a="maigrade">AI 채점위원에게 맡기기</button>' : ''}<button data-a="msave">점수 저장</button></div>
  ${M.overall ? `<div class="card" style="margin-top:12px"><b>총평</b><p class="small" style="white-space:pre-wrap">${esc(M.overall)}</p></div>` : ''}
  ${M.items.map((it, i) => { const q = qById(it.qid) || {}; return `<div class="sec"><b>${i + 1}번</b><label class="row">점수 <input type="number" min="0" max="${it.max}" step="0.5" style="width:84px" data-a="mscore" data-i="${i}" value="${esc(it.score ?? '')}"> / ${it.max}</label></div><div class="card">
   ${q.t === 'img' ? probHtml(q, false) : qHtml(q)}<p class="small"><b>내 답안</b><br><span class="q">${esc(it.ans || '(빈칸)')}</span></p>${q.t === 'img' ? explHtml(q) : `<p class="small"><b>모범 답안</b></p>${rich(ansText(q))}`}
   ${q.rubric ? `<table><tbody>${q.rubric.map(c => `<tr><td>${esc(c.c)}</td><td class="n">${c.p}점</td></tr>`).join('')}</tbody></table>` : ''}${it.fb ? `<div class="res"><b>채점 의견</b><p>${esc(it.fb)}</p></div>` : ''}</div>`; }).join('')}</main>`;
}
function vStat(top) {
  const t = today(), days = [...Array(7)].map((_, i) => addD(t, i - 6)), col = { edu: 'var(--edu)', ped: 'var(--ped)', maj: 'var(--maj)' };
  const mx = Math.max(S.settings.hours * 60, ...days.map(d => minutesOn(d)));
  const week = days.reduce((a, d) => a + minutesOn(d), 0), att = allAtt();
  const acc = s => { const a = att.filter(x => qById(x.q)?.s === s); return a.length ? Math.round(a.filter(x => x.ok).length / a.length * 100) + '% (' + a.length + ')' : '–'; };
  let streak = 0, sd = minutesOn(t) > 0 ? t : addD(t, -1); while (minutesOn(sd) > 0 && streak < 400) { streak++; sd = addD(sd, -1); }
  const s0 = S.settings.start, e0 = S.settings.exam, span = diff(s0, e0) + 1, x = d => Math.max(0, Math.min(100, diff(s0, d) / span * 100)), now = x(t);
  const lane = sub => windows(sub).map(([f, tt, r]) => `<i style="position:absolute;top:0;bottom:0;left:${x(f)}%;width:${x(tt) - x(f)}%;background:${col[sub]};opacity:${[0, 1, .75, .55, .4][r]};border-radius:6px"></i>`).join('');
  view.innerHTML = top + `<div class="sec"><b>11개월 병행 계획</b><span>${esc(s0)} → ${esc(e0)}</span></div><div class="card">
   ${['edu', 'ped', 'maj'].map(k => `<div class="row" style="flex-wrap:nowrap;margin:6px 0"><span class="small c-${k}" style="width:5.5em">${SUBJ[k]}</span><div style="position:relative;height:22px;flex:1;background:var(--fill);border-radius:6px">${lane(k)}<i style="position:absolute;top:-4px;bottom:-4px;left:${now}%;width:2px;background:var(--red)"></i></div></div>`).join('')}
   <table class="stack" style="margin-top:10px"><thead><tr><th>단계</th><th>기간</th><th>하루 배분</th></tr></thead><tbody>${phases().map((p, i) => `<tr><td>${i + 1}. ${esc(p.n)}</td><td>${p.f.slice(2)} ~ ${addD(p.t, -1).slice(2)}</td><td>${Object.entries(p.sp).map(([k, v]) => `${k === 'rev' ? '복습' : SUBJ[k]} ${Math.round(v * S.settings.hours * 60)}분`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>
  <div class="sec"><b>최근 7일</b><span>${Math.floor(week / 60)}시간 ${week % 60}분 · 연속 ${streak}일</span></div><div class="card">
   ${days.map(d => `<div class="row" style="margin:7px 0;flex-wrap:nowrap"><span class="small" style="width:4.2em">${d.slice(5).replace('-', '/')} ${DOW[P(d).getDay()]}</span><div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--fill);flex:1">${Object.keys(SUBJ).map(s => { const m = minutesOn(d, s); return m ? `<i style="width:${m / mx * 100}%;background:${col[s]}"></i>` : ''; }).join('')}</div><span class="mut small" style="width:3.4em;text-align:right">${minutesOn(d)}분</span></div>`).join('')}
   <p class="small"><span class="c-edu">● 교육학</span> &nbsp;<span class="c-ped">● 교과교육론</span> &nbsp;<span class="c-maj">● 전공</span></p></div>
  ${gichulHtml()}
  <div class="sec"><b>퀴즈 정답률</b></div><div class="list">${Object.entries(SUBJ).map(([k, l]) => `<div class="li"><span class="grow">${l}</span><b>${acc(k)}</b></div>`).join('')}</div>
  <div class="sec"><b>단원별 회독</b></div><div class="list">${D.units.map(u => `<button class="li" data-a="round2" data-u="${u.id}"><span class="ico b-${u.s}">${esc(u.no || '')}</span><span class="grow small">${esc(u.title)}</span><span class="pill">${S.units.done[u.id] || 0}회</span></button>`).join('')}</div></main>`;
}
function gichulHtml() {
  const im = D.problems.filter(q => q.kind === '임용');
  if (!im.length) return '';
  const by = {}; im.forEach(q => { (by[q.u] = by[q.u] || { n: 0, y: [] }).n++; if (q.year) by[q.u].y.push(+q.year); });
  const ys = im.filter(q => q.year).map(q => +q.year), maxY = ys.length ? Math.max(...ys) : 2026;
  const rows = Object.entries(by).map(([u, v]) => ({ u, n: v.n, recent: v.y.filter(y => y > maxY - 5).length, last: v.y.length ? Math.max(...v.y) : null })).sort((a, b) => b.n - a.n);
  const mx = Math.max(...rows.map(r => r.n));
  const pred = rows.filter(r => r.n >= mx * .35).sort((a, b) => (a.recent - b.recent) || (b.n - a.n)).slice(0, 6);
  return `<div class="sec"><b>임용 기출 분석</b><span>문제편 임용 기출 ${im.length}문항 · 연도 확인 ${ys.length}문항</span></div>
  <div class="card">${rows.map(r => `<div class="row" style="margin:6px 0;flex-wrap:nowrap"><span class="small" style="width:8.5em">${esc(UN[r.u].title)}</span><div style="flex:1;height:12px;border-radius:6px;background:var(--fill);overflow:hidden"><i style="display:block;height:100%;width:${r.n / mx * 100}%;background:var(--maj)"></i></div><span class="mut small" style="width:7.5em;text-align:right">${r.n}문항${r.last ? ' · 최근 ' + r.last : ''}</span></div>`).join('')}
  <p class="mut small">연도는 문항 옆 회색 표시를 글자로 읽은 값이라 일부만 확인돼요.</p></div>
  <div class="sec"><b>예측 우선순위</b><span>자주 나왔지만 최근 5년 표시가 적은 단원</span></div>
  <div class="list">${pred.map(r => `<button class="li" data-a="unit" data-u="${r.u}"><span class="ico b-maj">!</span><span class="grow">${esc(UN[r.u].title)}<span class="sub">임용 기출 ${r.n}문항 · 최근 5년 표시 ${r.recent}문항 · 변형 ${allQ().filter(q => q.u === r.u && /^v-/.test(q.id)).length}문항</span></span><span class="chev">›</span></button>`).join('')}</div>`;
}
function vHow(top) {
  view.innerHTML = top + `<div class="sec"><b>장기기억으로 가져가는 법</b></div><div class="card note">${md(`## 매일 지키는 4가지
- **인출 연습**: 읽기보다 떠올리기. 책을 덮고 단원 제목만 보고 핵심어부터 써 보기
- **간격 반복**: 퀴즈 탭의 복습 카드는 그날 다 비우기 (1·3·7·14·30·60일)
- **섞어 풀기**: 끝난 과목도 매일 10분 다시 만나기. 병행 계획이 이것을 자동으로 해 줘요
- **잠**: 자기 전 15분, 그날 오답만 훑고 자기
## 틀린 문제 처리법
|틀린 이유|바로 할 일|
|---|---|
|개념 모름|교재 원문 쪽을 열어 그림과 함께 다시 읽고 노트에 한 줄 요약|
|헷갈림|두 개념의 비교표를 만들기 (예: 경쟁적 vs 비경쟁적 저해)|
|키워드 누락|채점 기준 단어 3개를 뽑아 답안 첫 문장에 넣는 연습|
|실수|문제의 조건에 밑줄 긋는 습관, 단위·부호 다시 보기|
## 서술형 고득점 문장 공식
! **용어 + 근거(기작) + 결과** 순서로 한 문장. 예: "전압 개폐성 Na⁺ 통로가 열려(용어) Na⁺가 세포 안으로 유입되므로(근거) 막이 탈분극된다(결과)."
- 묻는 것만, 묻는 개수만큼 쓰기. (가)(나)가 있으면 반드시 나눠 쓰기
- 교육학 논술은 서론 2줄 · 본론(배점 순서대로 소제목) · 결론 2줄
## 백지 복습 (일요일)
- 서재 탭의 필기 노트에 단원 구조도를 그리고, 교재 목차와 비교해 빠진 가지를 빨간 펜으로 채우기
> 암기는 "왜?"를 붙일 때 오래 남아요. 노트의 암기 팁을 소리 내어 설명해 보세요.`)}</div></main>`;
}
/* ================= 앱 설치(PWA) ================= */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (location.hash === '#more' && MORE === 'set') render(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('설치했어요! 홈 화면에서 열어 보세요'); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
function installCard() {
  const head = `<div class="install"><img src="icons/icon-192.png" alt=""><div class="sp"><b>생명 랩노트 앱으로 설치</b><div class="mut small">홈 화면 아이콘 · 전체 화면 · 오프라인에서도 노트·문항 보기</div></div></div>`;
  let body;
  if (isStandalone()) body = '<p class="small" style="margin:10px 0 0">지금 앱으로 실행 중이에요. ✓</p>';
  else if (inFrame) body = `<p class="small" style="margin:10px 0 4px">지금은 Claude 화면 안에서 열려 있어서 설치 버튼이 동작하지 않아요. 사이트를 GitHub Pages에 올린 뒤 그 주소를 열면 설치할 수 있어요.</p><ol class="steps small"><li><b>iPhone·iPad</b>: Safari로 주소 열기 → 공유 버튼(□↑) → <b>홈 화면에 추가</b></li><li><b>Android·Galaxy</b>: Chrome/삼성 인터넷 → 메뉴 → <b>앱 설치</b></li><li><b>PC</b>: Chrome·Edge 주소창 오른쪽 설치 아이콘, Mac Safari는 파일 → <b>Dock에 추가</b></li></ol>`;
  else if (deferredInstall) body = `<button class="pri" style="margin-top:12px;width:100%" data-a="install">앱 설치</button>`;
  else if (isIOS()) body = `<ol class="steps small"><li>이 페이지를 <b>Safari</b>로 엽니다 (다른 앱 안의 브라우저에서는 안 돼요).</li><li>${/iPad/.test(navigator.userAgent) || navigator.maxTouchPoints > 1 && !/iPhone/.test(navigator.userAgent) ? '주소창 오른쪽' : '아래쪽'}의 <b>공유 버튼(□↑)</b>을 누릅니다.</li><li>목록에서 <b>홈 화면에 추가</b> → 오른쪽 위 <b>추가</b>.</li></ol>`;
  else body = `<ol class="steps small"><li>Chrome·Edge·삼성 인터넷: 주소창의 설치 아이콘 또는 메뉴 → <b>앱 설치</b></li><li>Mac Safari: 메뉴 막대 <b>파일 → Dock에 추가</b></li></ol>`;
  return `<div class="card">${head}${body}</div>`;
}
function vSet(top) {
  view.innerHTML = top + `<div class="sec"><b>앱 설치</b></div>${installCard()}<div class="sec"><b>계획</b></div><div class="card">
  <label class="f">공부 시작일</label><input type="date" id="st" value="${esc(S.settings.start)}">
  <label class="f">1차 시험일 (예상)</label><input type="date" id="ex" value="${esc(S.settings.exam)}">
  <label class="f">평일 순공부 시간</label><input type="number" id="hr" min="1" max="14" step="0.5" value="${esc(S.settings.hours)}">
  <div class="row" style="margin-top:14px"><button class="pri" data-a="setsave">저장</button></div></div>
  <div class="sec"><b>데이터</b><span>${db ? '계정에 자동 저장' : '이 기기에 저장'}</span></div><div class="list">
  <button class="li" data-a="export"><span class="grow">기록 내보내기 (JSON)<span class="sub">GitHub 사이트로 옮길 때 사용</span></span><span class="chev">›</span></button>
  <label class="li"><span class="grow">기록 가져오기<span class="sub">내보낸 JSON 파일 선택</span></span><input type="file" accept="application/json" data-f="import" hidden><span class="chev">›</span></label></div>
  <p class="mut small" style="padding:0 4px">${db ? '휴대폰·아이패드·PC 어디서 열어도 기록이 이어집니다.' : 'GitHub 등에서 열면 기록은 이 브라우저에만 저장돼요. 정기적으로 내보내기 해 두세요.'}</p></main>`;
}

/* ================= 동작 ================= */
const ACT = {
  go: t => { if (t.dataset.h === 'more' && t.dataset.k) MORE = t.dataset.k; if (location.hash === '#' + t.dataset.h) render(); else location.hash = t.dataset.h; },
  unit: t => { L.unit = t.dataset.u; L.tab = 'note'; if (location.hash !== '#learn') location.hash = 'learn'; else vLearn(); },
  lback: () => { L.unit = null; vLearn(); },
  lsub: t => { L.sub = t.dataset.k; vLearn(); },
  ltab: t => { L.tab = t.dataset.k; vUnit(); },
  round: () => { const u = L.unit; S.units.done[u] = ((S.units.done[u] || 0) + 1) % 6; saveUnits(); vUnit(); },
  round2: t => { const u = t.dataset.u; S.units.done[u] = ((S.units.done[u] || 0) + 1) % 6; saveUnits(); vMore(); },
  openp: (t, e) => { e.preventDefault(); const u = UN[L.unit]; const b = t.dataset.b || (u && u.book); openBook(b, +t.dataset.p); },
  openbp: t => openBook(t.dataset.b, +t.dataset.p),
  qsrc: t => { Q.src = t.dataset.k; vQuiz(); },
  rf: t => { L.rf = t.dataset.k; vUnit(); },
  realgo: t => { Q.list = buildQuiz('ur:' + L.unit + ':' + t.dataset.k); Q.i = 0; Q.res = []; Q.shown = false; Q.phase = Q.list.length ? 'run' : 'setup'; Q.tab = 'quiz'; location.hash = 'quiz'; if (location.hash === '#quiz') vQuiz(); },
  realone: t => { const q = D.problems.find(x => x.id === t.dataset.id) || qById(t.dataset.id); if (!q) return; Q.list = [q]; Q.i = 0; Q.res = []; Q.shown = false; Q.phase = 'run'; Q.tab = 'quiz'; if (location.hash !== '#quiz') location.hash = 'quiz'; else vQuiz(); },
  vargo: () => startQuiz('uv:' + L.unit),
  objox: t => { const was = t.classList.contains('on'); t.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on')); if (!was) t.classList.add('on'); },
  objsub: () => {
    const ox = {}, why = {};
    document.querySelectorAll('#objList [data-a=objox].on').forEach(b => { ox[b.dataset.k] = b.dataset.v; });
    document.querySelectorAll('#objList textarea[data-why]').forEach(x => { why[x.dataset.why] = x.value; });
    const ans = STM.map(k => `${k}: ${ox[k] || '?'} ${why[k] || ''}`.trim()).join('\n');
    Q.res[Q.i] = { qid: Q.list[Q.i].id, ans, ox, why, ok: false, img: 1 }; Q.shown = true; runQuiz();
  },
  aiconv: async t => {
    const q = D.problems.find(x => x.id === t.dataset.id); if (!q || !sample) return;
    t.disabled = true; t.textContent = '서술형으로 바꾸는 중… (30초 정도)';
    try { await aiConvert(q); render(); } catch (e) { toast(e && e.code === 'rate_limited' ? '잠시 후 다시 시도하세요' : '서술형 변환에 실패했어요'); t.disabled = false; t.textContent = 'AI로 서술형 문항 만들기'; }
  },
  imgsub: () => { const ans = $('#ans') ? $('#ans').value : ''; Q.res[Q.i] = { qid: Q.list[Q.i].id, ans, ok: false, img: 1 }; Q.shown = true; runQuiz(); },
  selfg: t => { const r = Q.res[Q.i]; r.g = t.dataset.k; if (r.g !== 'wrong') r.reason = ''; else r.reason = r.reason || 'none'; runQuiz(); },
  aiexpl: async t => {
    const q = D.problems.find(x => x.id === t.dataset.id); if (!q || !sample) return;
    t.disabled = true; t.textContent = '해설 만드는 중… (30초 정도)';
    try { await aiExplain(q); render(); } catch (e) { toast(e && e.code === 'rate_limited' ? '잠시 후 다시 시도하세요' : 'AI 해설을 만들지 못했어요'); t.disabled = false; t.textContent = 'AI 해설 만들기'; }
  },
  probopen: t => { const q = D.problems.find(x => x.id === t.dataset.id); if (!q) return; const b = BK[q.book]; Viewer.open({ key: 'b-' + q.book, title: b ? b.title : '문제편', parts: b ? b.parts : [{ file: q.file, from: 1, to: 999 }], pages: b ? b.pages : 999, page: q.segs[0].p, tool: 'pen' }); },
  ckm: t => { const u = L.unit, it = (D.check[u] || [])[+t.dataset.i]; if (!it) return; const k = u + ':' + it.t; S.check[k] = S.check[k] === t.dataset.k ? '' : t.dataset.k; save('check', { marks: S.check }); vUnit(); },
  ckx: () => { const u = L.unit; const list = (D.check[u] || []).filter(it => ['△', 'X', ''].includes(S.check[u + ':' + it.t] || '')); printDoc(`<h1>${esc(UN[u].title)} · 다시 볼 항목</h1><table><tr><th>항목</th><th>상태</th><th>쪽</th></tr>${list.map(it => `<tr><td>${esc(it.t)}</td><td>${esc(S.check[u + ':' + it.t] || '미확인')}</td><td>${it.p || ''}</td></tr>`).join('')}</table>`, UN[u].title + ' 다시 볼 항목'); },
  ckprint: () => { const u = L.unit; printDoc(`<h1>${esc(UN[u].title)} 체크리스트</h1><table><tr><th>항목</th><th>기출</th><th>쪽</th><th>1회</th><th>2회</th><th>3회</th></tr>${(D.check[u] || []).map(it => `<tr><td>${esc(it.t)}</td><td>${esc((it.g || []).join(', '))}</td><td>${it.p || ''}</td><td style="width:12mm">${esc(S.check[u + ':' + it.t] || '')}</td><td style="width:12mm"></td><td style="width:12mm"></td></tr>`).join('')}</table>`, UN[u].title + ' 체크리스트'); },
  realprint: async t => {
    const u = L.unit, f = t.dataset.k, list = D.problems.filter(q => q.u === u && (f === 'all' || (f === 'im' ? q.kind === '임용' : q.kind !== '임용'))).sort((x, y) => (y.real || 0) - (x.real || 0)).slice(0, 40);
    toast('문항 그림을 준비하는 중…');
    const imgs = [];
    for (const q of list) { const b = await probBlob(q); if (b) imgs.push([q, await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); })]); }
    printDoc(`<h1>${esc(UN[u].title)} 기출</h1>` + imgs.map(([q, d]) => `<div class="q"><p class="mut">${esc(KIND_LABEL(q))}</p><img src="${d}" style="width:100%"></div>`).join(''), UN[u].title + ' 기출');
  },
  figopen: t => { const f = D.figures[+t.dataset.i]; openBook(f.book, f.page); },
  printnote: () => { const u = UN[L.unit]; printDoc(`<h1>${esc(u.title)}</h1><p class="mut">${esc(BK[u.book]?.title || '')} p.${u.start}–${u.end}</p>` + md(D.notes[u.id]).replace(/<a [^>]*>(p\.\d+)<\/a>/g, '$1'), u.title + ' 노트'); },
  unitquiz: () => startQuiz('u:' + L.unit),
  printquiz: () => { const u = UN[L.unit]; printDoc(quizPrintHtml(shuffle(allQ().filter(q => q.u === u.id)), u.title + ' 문제지'), u.title + ' 문제지'); },
  tsub: t => { if (T.start || T.acc) { toast('먼저 기록을 저장하거나 초기화하세요'); return; } T.s = t.dataset.s; keepT(); vToday(); },
  ttoggle: () => { if (T.start) { T.acc += Date.now() - T.start; T.start = null; } else { T.start = Date.now(); T.rang = 0; } keepT(); vToday(); },
  tsave: () => { const m = elapsed() / 60e3; if (m < 1) return; addLog(T.s, m); toast(SUBJ[T.s] + ' ' + Math.round(m) + '분 기록했어요'); T.start = null; T.acc = 0; keepT(); vToday(); },
  treset: () => { T.start = null; T.acc = 0; keepT(); vToday(); },
  tpomo: t => { T.pomo = t.checked; keepT(); },
  daily: () => { Q.sub = 'today'; Q.n = 10; startQuiz(); },
  resume: t => { const k = t.dataset.k, id = k.slice(2); openBook(id, S.pos[k].p, true); },
  printweek: () => { const t = today(); printDoc(`<h1>주간 계획 ${weekDays(t)[0]} ~ ${weekDays(t)[6]}</h1><table><tr><th>요일</th><th>유형</th><th>범위</th><th>시간</th><th>체크</th></tr>${weekDays(t).map(d => { const p = planFor(d); return `<tr><td>${d.slice(5)} (${DOW[P(d).getDay()]})</td><td>${TYPE[p.type]}</td><td>${p.blocks.map(b => SUBJ[b.s] + ': ' + esc(UN[b.u]?.title || '') + (b.pf ? ' (p.' + b.pf + '–' + b.pt + ')' : '') + ' ' + b.min + '분').join('<br>')}</td><td>${S.settings.hours}시간</td><td style="width:20mm"></td></tr>`; }).join('')}</table>`, '주간 계획표'); },
  mockhome: () => { MORE = 'mock'; location.hash = 'more'; },
  qtab: t => { Q.tab = t.dataset.k; Q.phase = 'setup'; if (location.hash !== '#quiz') location.hash = 'quiz'; else vQuiz(); },
  qsub: t => { Q.sub = t.dataset.k; vQuiz(); },
  qn: t => { Q.n = +t.dataset.k; vQuiz(); },
  qgo: () => startQuiz(),
  qprint: () => { const list = buildQuiz(); if (!list.length) { toast('문항이 없어요'); return; } printDoc(quizPrintHtml(list, '퀴즈 ' + today()), '퀴즈 ' + today()); },
  qdue: () => startQuiz('due'),
  qwrong: () => startQuiz('wrong'),
  qunit: () => startQuiz('u:' + $('#qunit').value),
  qquit: () => { commitCurrent(); Q.phase = 'done'; vQuiz(); },
  qagain: () => { Q.phase = 'setup'; vQuiz(); },
  pick: t => { const q = Q.list[Q.i], v = q.t === 'mc' ? +t.dataset.i : t.dataset.i; finishAnswer({ pick: v, ok: v === q.a }); },
  sub: () => { const q = Q.list[Q.i], ans = $('#ans').value; if (q.t === 'short') finishAnswer(Object.assign({ ans }, checkShort(q, ans))); else finishAnswer({ ans, ok: false, rub: [] }); },
  skip: () => finishAnswer({ ans: '', ok: false, part: 0 }),
  override: () => { const r = Q.res[Q.i]; r.ok = true; r.reason = ''; r.conf = 'unsure'; runQuiz(); },
  rub: t => { const q = Q.list[Q.i], r = Q.res[Q.i]; r.rub = r.rub || []; r.rub[+t.dataset.i] = t.checked; const got = q.rubric.reduce((a, c, i) => a + (r.rub[i] ? c.p : 0), 0), max = q.rubric.reduce((a, c) => a + c.p, 0); const was = r.ok; r.ok = got >= max * .7; if (was !== r.ok) { r.reason = r.ok ? '' : (r.reason || 'kw'); r.conf = r.ok ? 'unsure' : ''; runQuiz(); } },
  reason: t => { Q.res[Q.i].reason = t.dataset.k; runQuiz(); },
  conf: t => { Q.res[Q.i].conf = t.dataset.k; runQuiz(); },
  next: () => { commitCurrent(); if (Q.i + 1 < Q.list.length) { Q.i++; Q.shown = false; runQuiz(); window.scrollTo(0, 0); } else { Q.phase = 'done'; doneQuiz(); } },
  rvsub: t => { RV.sub = t.dataset.k; vQuiz(); },
  rvr: t => { RV.reason = t.dataset.k; vQuiz(); },
  printwrong: () => { const rows = Object.entries(S.srs.cards).filter(([id, c]) => c.w > 0 && qById(id)).map(([id]) => qById(id)); printDoc(quizPrintHtml(rows, '오답노트 ' + today()), '오답노트 ' + today()); },
  aitip: async t => {
    const q = Q.list[Q.i], r = Q.res[Q.i]; t.disabled = true; t.textContent = '만드는 중…';
    try { const out = await sample(`당신은 중등 생물 임용시험 강사입니다. 학생이 아래 문항을 틀렸습니다. 장기기억에 남도록 한국어로 암기법을 3줄 이내로 만들어 주세요. 두문자·이미지 연상·비슷한 개념과의 대비 중 가장 효과적인 것을 쓰고, 마지막 줄에 채점 핵심 키워드를 적으세요. 마크다운 없이 평문.\n문항: ${q.q}\n정답: ${ansText(q)}\n해설: ${q.ex || ''}\n학생 답: ${r.ans ?? r.pick ?? ''}\n틀린 이유: ${REASON[r.reason] || ''}`, { modelTier: 'default' }); r.ai = out.text.trim(); runQuiz(); }
    catch (e) { toast(e && e.code === 'rate_limited' ? '잠시 후 다시 시도하세요' : 'AI를 쓸 수 없어요'); t.disabled = false; t.textContent = 'AI 암기법'; }
  },
  aiessay: async t => {
    const q = Q.list[Q.i], r = Q.res[Q.i]; t.disabled = true; t.textContent = '채점 중…';
    try {
      const out = await sample.json(`중등 생물 임용시험 채점위원으로서 서술형 답안을 채점하세요. 정확한 용어와 근거가 있을 때만 인정합니다.\n문항: ${q.q}\n채점 기준: ${JSON.stringify(q.rubric)}\n모범답안: ${q.model}\n수험생 답안: ${r.ans}\nJSON으로만: {"met":[각 기준 충족 true/false],"fb":"부족한 점과 고쳐 쓸 문장 2~3문장"}`, { modelTier: 'default' });
      r.rub = (out.met || []).map(Boolean); const got = q.rubric.reduce((a, c, i) => a + (r.rub[i] ? c.p : 0), 0), max = q.rubric.reduce((a, c) => a + c.p, 0); r.ok = got >= max * .7; if (!r.ok) r.reason = r.reason || 'kw'; r.ai = '채점 ' + got + '/' + max + '점. ' + (out.fb || ''); runQuiz();
    } catch (e) { toast('AI 채점을 하지 못했어요'); t.disabled = false; t.textContent = 'AI 채점'; }
  },
  aigen: t => aiGen(L.unit, t),
  aigenq: t => aiGen($('#qunit').value, t),
  book: t => { const b = BK[t.dataset.b]; const ps = S.pos['b-' + b.id]; openBook(b.id, ps ? ps.p : 1, true); },
  hit: t => { openBook(t.dataset.b, +t.dataset.p, true); },
  myfile: t => openMyFile(+t.dataset.i),
  newnb: () => { const n = { id: 'n' + Date.now().toString(36), name: '노트 ' + (S.lib.nbs.length + 1) + ' · ' + today().slice(5), pages: 60 }; S.lib.nbs.unshift(n); saveLib(); vLib(); },
  nb: t => { const n = S.lib.nbs[+t.dataset.i]; const key = 'nb-' + n.id; Viewer.open({ key, title: n.name, notebook: true, pages: n.pages, page: S.pos[key]?.p || 1, tool: 'pen' }); },
  more: t => { MORE = t.dataset.k; vMore(); },
  exampdf: (t, e) => { if (e) e.preventDefault(); const k = t.dataset.k; Viewer.open({ key: 'x-' + k, title: k.replace('-edu', ' 교육학').replace(/-([AB])$/, ' 전공 $1') + ' (실제 기출)', src: 'exams/' + k + '.pdf', page: S.pos['x-' + k]?.p || 1 }); },
  examrun: t => { const p = (D.exams?.papers || []).find(x => x.key === t.dataset.k); if (!p) return; Q.list = p.items.map(it => D.problems.find(q => q.id === it.id)).filter(Boolean); Q.i = 0; Q.res = []; Q.shown = false; Q.phase = 'run'; Q.tab = 'quiz'; toast(`${p.year} 전공 ${p.paper}: ${Q.list.length}문항 · 90분 기준`); if (location.hash !== '#quiz') location.hash = 'quiz'; else vQuiz(); },
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) {} deferredInstall = null; render(); },
  qset: t => { const ids = (t.dataset.ids || '').split(',').filter(Boolean); Q.list = ids.map(qById).filter(Boolean); if (!Q.list.length) return; Q.i = 0; Q.res = []; Q.shown = false; Q.phase = 'run'; Q.tab = 'quiz'; if (location.hash !== '#quiz') location.hash = 'quiz'; else vQuiz(); },
  trendprint: () => { const T = D.trend; if (!T) return; printDoc(`<h1>2028학년도 생물 임용 출제 예측</h1><p>${esc(T.note)}</p><h2>예측 주제</h2>${T.pred.map((p, i) => `<h3>${i + 1}. ${esc(p.t)} (${esc(p.p)})</h3><p><b>근거</b> ${esc(p.why)}</p><p><b>대비</b> ${esc(p.study)}</p>`).join('')}<h2>출제 경향</h2>${T.insights.map(it => `<h3>${esc(it.t)}</h3><p>${esc(it.d)}</p>`).join('')}<h2>연도별 문항</h2>${YRS.map(y => `<h3>${y}학년도</h3><table><tr><th>단원</th><th>주제</th><th>형식</th></tr>${(T.years[y] || []).map(it => `<tr><td>${esc(UN[it.u]?.title || '')}</td><td>${esc(it.topic)}</td><td>${esc(it.form)}</td></tr>`).join('')}</table>`).join('')}`, '2028 출제 예측'); },
  mprint: t => { const k = t.dataset.k, qs = buildMock(k); if (!qs.length) { toast('문항이 아직 없어요'); return; } const items = qs.map(q => ({ qid: q.id, max: q.s === 'edu' && q.t === 'essay' ? 20 : q.t === 'short' ? 2 : (q.pts || 4) })); printDoc(mockPaperHtml(items, k) + `<h2 class="pb">모범 답안</h2>` + items.map((it, i) => `<p><b>${i + 1}.</b> ${esc(ansText(qById(it.qid))).replace(/\n/g, '<br>')}</p>`).join(''), KIND[k].n + ' ' + today()); },
  mstart: t => {
    const k = t.dataset.k, qs = buildMock(k); if (!qs.length) { toast('모의고사용 문항이 아직 없어요'); return; }
    M = { phase: 'run', k, end: Date.now() + KIND[k].min * 60e3, items: qs.map(q => ({ qid: q.id, max: q.s === 'edu' && q.t === 'essay' ? 20 : q.t === 'short' ? 2 : (q.pts || 4), ans: '' })) };
    const need = k === 'edu' ? 1 : KIND[k].sh + KIND[k].es; if (qs.length < need) toast(`문항이 ${qs.length}/${need}개라 일부만 출제돼요`); vMore(); window.scrollTo(0, 0);
  },
  msubmit: t => { if (!t.dataset.sure) { t.dataset.sure = 1; t.textContent = '정말 제출'; return; } collectMock(); M.phase = 'grade'; autoScoreMock(); vMore(); window.scrollTo(0, 0); },
  maigrade: async t => {
    t.disabled = true; t.textContent = '채점 중… (1분 정도)';
    const items = M.items.map((it, i) => { const q = qById(it.qid) || {}; return { i, 배점: it.max, 문항: q.t === 'img' ? '[첨부 그림 문항] ' + (q.txt || '') : q.q, 채점기준: q.rubric || q.kw || [], 모범답안: ansText(q), 답안: it.ans || '' }; });
    let imgs = [];
    try { const lim = sample.limits ? await sample.limits() : {}; if (lim && lim.images) for (const it of M.items) { const q = qById(it.qid); if (q && q.t === 'img' && imgs.length < 4) { const b = await probBlob(q); if (b) imgs.push(b); } } } catch (e) { imgs = []; }
    try {
      const out = await sample.json(`당신은 중등교사 임용시험(생물) 1차 채점위원입니다. 아래 답안을 실제 채점 기준처럼 엄격하게 채점하세요. 기준 항목별로 정확한 용어와 근거가 있을 때만 점수를 주고 0.5점 단위 부분 점수 가능.${M.k === 'edu' ? ' 교육학 논술은 내용 15점과 구성·표현 5점(연계·논리 3점, 표현 2점)을 함께 평가하세요.' : ''}\n${JSON.stringify(items)}\n${imgs.length ? '\n그림 문항은 첨부 이미지 순서대로 [첨부 그림 문항] 항목에 대응합니다. 그림을 보고 정답을 스스로 판단한 뒤 채점하세요.' : ''}\nJSON으로만: {"items":[{"i":번호,"score":점수,"fb":"감점 이유와 고쳐 쓸 문장 2~3문장"}],"overall":"총평과 다음 주 공부 우선순위 3가지"}`, Object.assign({ modelTier: 'complex' }, imgs.length ? { images: imgs } : {}));
      (out.items || []).forEach(o => { const it = M.items[o.i]; if (it) { it.score = Math.max(0, Math.min(it.max, +o.score || 0)); it.fb = String(o.fb || ''); } }); M.overall = String(out.overall || ''); vMore();
    } catch (e) { toast('AI 채점을 하지 못했어요. 직접 점수를 넣어 주세요'); t.disabled = false; t.textContent = 'AI 채점위원에게 맡기기'; }
  },
  msave: () => {
    const tot = M.items.reduce((a, i) => a + (+i.score || 0), 0), max = M.items.reduce((a, i) => a + i.max, 0), id = 'mock-' + Date.now();
    const rec = { d: today(), at: Date.now(), k: M.k, total: tot, max, overall: M.overall || '', items: M.items.map(i => ({ qid: i.qid, ans: (i.ans || '').slice(0, 6000), score: +i.score || 0, max: i.max, fb: i.fb || '' })) };
    S.mocks.push(rec); save(id, rec); M.items.forEach(i => { const q = qById(i.qid); if (q) { const ok = (+i.score || 0) >= i.max * .7; grade(q.id, ok ? 'unsure' : 'wrong', ok ? '' : 'kw'); addAtt(q.id, ok, ok ? '' : 'kw'); } });
    toast('저장했어요. 감점 문항은 오답노트로 갔어요'); M = { phase: 'setup' }; vMore();
  },
  setsave: () => { const st = $('#st').value, ex = $('#ex').value, hr = +$('#hr').value; if (!st || !ex || ex <= st || !(hr > 0)) { toast('날짜와 시간을 확인해 주세요'); return; } S.settings = { start: st, exam: ex, hours: hr }; save('settings', S.settings); toast('저장했어요'); },
  export: async () => {
    const data = JSON.stringify({ v: 2, settings: S.settings, srs: S.srs, units: S.units, logs: S.logs, att: S.att, mocks: S.mocks, aiq: S.aiq, pos: S.pos });
    if (downloads) { try { await downloads.save({ filename: '생명임용-기록-' + today() + '.json', data }); return; } catch (e) { if (e && e.code === 'declined') return; } }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = '생명임용-기록-' + today() + '.json'; a.click(); } catch (e) { toast('내보내지 못했어요'); }
  },
};
async function aiGen(u, t) {
  if (!u || !UN[u]) return; const s = UN[u].s; t.disabled = true; t.textContent = '만드는 중…';
  try {
    const out = await sample.json(`중등 생물교사 임용시험(${SUBJ[s]}) '${UN[u].title}' 단원 연습 문항 5개를 만드세요. 대학 교재 수준으로 정확해야 하며 확실하지 않은 내용은 쓰지 마세요. 객관식(mc) 2, OX(ox) 1, 기입형(short) 2. 한국어.\nJSON으로만: {"items":[{"t":"mc|ox|short","q":"문항","ch":["보기1","보기2","보기3","보기4"](mc만),"a":mc는 정답 인덱스(0부터), ox는 "O"/"X", short는 정답(동의어 |로 구분),"kw":["채점 키워드"](short만),"ex":"해설 2문장","tip":"암기 팁 1문장"}]}`, { modelTier: 'complex' });
    const items = (out.items || []).filter(x => x && typeof x.q === 'string' && ['mc', 'ox', 'short'].includes(x.t) && (x.t !== 'mc' || (Array.isArray(x.ch) && Number.isInteger(x.a) && x.a < x.ch.length))).map((x, i) => ({ id: 'ai-' + Date.now().toString(36) + i, s, u, t: x.t, q: x.q, ch: x.ch, a: x.t === 'mc' ? x.a : String(x.a), kw: Array.isArray(x.kw) ? x.kw.map(String) : undefined, ex: String(x.ex || ''), tip: String(x.tip || ''), src: 'AI 생성' }));
    S.aiq.list.push(...items); save('aiq', S.aiq); toast(items.length + '문항을 추가했어요'); render();
  } catch (e) { toast('AI 문항을 만들지 못했어요'); t.disabled = false; t.textContent = 'AI로 5문항 만들기'; }
}
view.addEventListener('click', e => {
  const t = e.target.closest('[data-a]');
  if (!t || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'checkbox')) return;
  const f = ACT[t.dataset.a]; if (f) f(t, e);
});
view.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.a === 'mscore') { const it = M.items[+t.dataset.i]; it.score = Math.max(0, Math.min(it.max, +t.value || 0)); }
  if (t.dataset.f === 'upload') uploadPdf(t.files[0]);
  if (t.dataset.f === 'import') importJson(t.files[0]);
});
view.addEventListener('submit', e => { e.preventDefault(); if (e.target.dataset.f === 'search') doSearch($('#sq').value); });
view.addEventListener('input', e => { if (e.target.dataset.a === 'cnt') { const c = $('#cnt'); if (c) c.textContent = e.target.value.length + '자'; } });
view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ans' && e.target.tagName === 'INPUT') ACT.sub(); });
async function importJson(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (d.settings) { S.settings = d.settings; save('settings', S.settings); }
    if (d.srs) { S.srs = d.srs; saveSrs(); }
    if (d.units) { S.units = d.units; saveUnits(); }
    if (d.aiq) { S.aiq = d.aiq; save('aiq', S.aiq); }
    if (d.pos) { S.pos = d.pos; save('pos', { map: S.pos }); }
    if (d.logs) for (const k in d.logs) { S.logs[k] = d.logs[k]; save(k, { sessions: d.logs[k] }); }
    if (d.att) for (const k in d.att) { S.att[k] = d.att[k]; save(k, { list: d.att[k] }); }
    if (Array.isArray(d.mocks)) d.mocks.forEach(m => { if (!S.mocks.some(x => x.at === m.at)) { S.mocks.push(m); save('mock-' + m.at, m); } });
    toast('가져왔어요');
  } catch (e) { toast('파일을 읽지 못했어요'); }
}

/* ================= 라우팅 ================= */
const TABS = [['today', '오늘', ICO.today], ['learn', '학습', ICO.learn], ['quiz', '퀴즈', ICO.quiz], ['lib', '서재', ICO.lib], ['more', '더보기', ICO.more]];
const nav = $('.tabs');
nav.innerHTML = TABS.map(([k, l, i]) => `<button data-v="${k}" aria-label="${l}">${i}<span>${l}</span></button>`).join('');
nav.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (M.phase === 'run' && b.dataset.v !== 'more') { toast('모의고사 중에는 이동할 수 없어요'); return; }
  if (b.dataset.v === location.hash.slice(1)) { if (b.dataset.v === 'learn') L.unit = null; if (b.dataset.v === 'quiz' && Q.phase !== 'run') Q.phase = 'setup'; render(); }
  else location.hash = b.dataset.v;
});
function render() {
  const v = location.hash.slice(1) || 'today';
  nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  ({ today: vToday, learn: vLearn, quiz: vQuiz, lib: vLib, more: vMore }[v] || vToday)();
}
addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ================= 시작 ================= */
(async () => {
  if ('serviceWorker' in navigator && !inFrame && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  view.innerHTML = '<main><p class="mut" style="padding:40px 0;text-align:center">불러오는 중…</p></main>';
  await loadData();
  Viewer.init({
    worker: 'js/vendor/pdf.worker.min.js', toast, savePos, print: printDoc,
    loadInk: (key, c) => Store.get('ink/' + safeKey(key) + '-' + c),
    saveInk: (key, c, obj) => save('ink/' + safeKey(key) + '-' + c, obj),
  });
  try { db = await use('db'); } catch (e) { db = null; }
  if (db) { try { const rows = await Store.listMe(); rows.forEach(([id, d]) => loadDoc(id, d)); } catch (e) { db = null; toast('계정 저장소에 연결하지 못해 이 기기에 저장해요'); } }
  if (!db) { await idbOpen(); try { (await Store.listMe()).forEach(([id, d]) => loadDoc(id, d)); } catch (e) {} }
  render();
  [sample, assets, downloads] = await Promise.all([use('sample'), use('assets'), use('downloads')]);
  render();
})();
if (/[?&]test\b/.test(location.search)) window.__test = ids => { Q.list = ids.map(qById).filter(Boolean); Q.i = 0; Q.res = []; Q.shown = false; Q.phase = 'run'; Q.tab = 'quiz'; if (location.hash !== '#quiz') location.hash = 'quiz'; else vQuiz(); };
}
