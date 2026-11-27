/* PDF 뷰어 + 애플펜슬 필기 + 그림 영역 렌더러
   app.js가 Viewer.init({...})로 저장 함수들을 넘겨줍니다. */
window.Viewer = (() => {
  const $ = s => document.querySelector(s);
  let cfg = null, cur = null, renderTask = null;
  const pdfCache = {};
  const ink = {};          // ink[key][page] = [stroke]
  const loaded = {};       // loaded[key+'|'+chunk] = true
  const dirty = new Set(); // key|chunk
  const undoStack = [];
  let tool = 'none', color = '#1c1c1e', penOnly = true, saveTimer = null;
  const COLORS = ['#1c1c1e', '#ff3b30', '#007aff', '#34c759', '#af52de'];
  const HL = ['#ffd60a', '#7ae582', '#5ac8fa', '#ff8fab'];
  const CH = 10; // 페이지 10장씩 한 문서로 저장

  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-1V4.5a1.5 1.5 0 013 0V12m0-6.5a1.5 1.5 0 013 0V13m0-4.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L5 14.5a1.5 1.5 0 012.5-1.6L8 13.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/></svg>',
    hl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15l-4 4h5l2-2"/><path d="M9 15l7-11 4 3-7 11-4-3z"/></svg>',
    er: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h12"/><path d="M5 15l9-9 5 5-8 8H8l-3-3z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    zin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-4-4"/></svg>',
    zout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  };

  function build() {
    const v = document.createElement('div');
    v.id = 'viewer';
    v.innerHTML = `
      <div class="vbar">
        <button data-v="close" aria-label="닫기">${ICON.back}</button>
        <span class="vt" id="vtitle"></span>
        <button data-v="zout" aria-label="축소">${ICON.zout}</button>
        <button data-v="zin" aria-label="확대">${ICON.zin}</button>
        <button data-v="print" aria-label="이 페이지 인쇄">${ICON.print}</button>
      </div>
      <div class="vbar vtools">
        <button data-v="tool" data-t="none" aria-label="보기">${ICON.hand}</button>
        <button data-v="tool" data-t="pen" aria-label="펜">${ICON.pen}</button>
        <button data-v="tool" data-t="hl" aria-label="형광펜">${ICON.hl}</button>
        <button data-v="tool" data-t="er" aria-label="지우개">${ICON.er}</button>
        <span id="vcolors" class="vcolors"></span>
        <button data-v="undo" aria-label="되돌리기">${ICON.undo}</button>
        <button data-v="penonly" aria-label="펜으로만 필기" id="vpenonly" class="wide">${ICON.pencil}<span>펜만</span></button>
        <button data-v="clear" aria-label="이 페이지 필기 지우기" class="wide" style="color:var(--red)">지우기</button>
      </div>
      <div id="vscroll"><div id="vstage"><canvas id="vpdf"></canvas><canvas id="vink"></canvas></div></div>
      <div class="vfoot">
        <button class="sm" data-v="prev" aria-label="이전 쪽">‹</button>
        <input type="range" id="vrange" min="1" max="1" value="1" aria-label="쪽 이동">
        <input class="vpage" id="vpage" inputmode="numeric" aria-label="쪽 번호">
        <span class="mut small" id="vtotal"></span>
        <button class="sm" data-v="prev2" aria-hidden="true" style="display:none"></button>
        <button class="sm" data-v="next" aria-label="다음 쪽">›</button>
      </div>`;
    document.body.appendChild(v);
    v.addEventListener('click', onBar);
    $('#vrange').addEventListener('change', e => go(+e.target.value));
    $('#vpage').addEventListener('change', e => go(+e.target.value));
    document.addEventListener('keydown', e => {
      if (!cur || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(cur.page + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(cur.page - 1);
      if (e.key === 'Escape') close();
    });
    const ic = $('#vink');
    ic.addEventListener('pointerdown', down);
    ic.addEventListener('pointermove', move);
    ic.addEventListener('pointerup', up);
    ic.addEventListener('pointercancel', up);
    const stopIfDrawing = e => {
      if (tool === 'none') return;
      const stylus = [...e.touches].some(t => t.touchType === 'stylus');
      if (!penOnly || stylus) e.preventDefault();
    };
    $('#vstage').addEventListener('touchstart', stopIfDrawing, { passive: false });
    $('#vstage').addEventListener('touchmove', stopIfDrawing, { passive: false });
    addEventListener('resize', () => { if (cur) render(); });
    colors();
  }

  function colors() {
    const box = $('#vcolors'); if (!box) return;
    const list = tool === 'hl' ? HL : COLORS;
    if (!list.includes(color)) color = list[0];
    box.innerHTML = tool === 'pen' || tool === 'hl'
      ? list.map(c => `<button class="dot${c === color ? ' on' : ''}" data-v="color" data-c="${c}" style="--c:${c}" aria-label="색"></button>`).join('')
      : '';
    document.querySelectorAll('#viewer [data-v=tool]').forEach(b => b.classList.toggle('on', b.dataset.t === tool));
    $('#vpenonly').classList.toggle('on', penOnly);
    $('#vstage').classList.toggle('drawing', tool !== 'none' && !penOnly);
  }

  function onBar(e) {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const a = b.dataset.v;
    if (a === 'close') close();
    else if (a === 'tool') { tool = b.dataset.t; colors(); }
    else if (a === 'color') { color = b.dataset.c; colors(); }
    else if (a === 'penonly') { penOnly = !penOnly; colors(); cfg.toast(penOnly ? '펜(애플펜슬)으로만 필기 · 손가락은 스크롤' : '손가락으로도 필기'); }
    else if (a === 'undo') undo();
    else if (a === 'zin') { cur.zoom = Math.min(3, cur.zoom + .25); render(); }
    else if (a === 'zout') { cur.zoom = Math.max(.5, cur.zoom - .25); render(); }
    else if (a === 'prev') go(cur.page - 1);
    else if (a === 'next') go(cur.page + 1);
    else if (a === 'print') printPage();
    else if (a === 'clear') {
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '정말?'; setTimeout(() => { b.dataset.sure = ''; b.textContent = '지우기'; }, 2500); return; }
      const arr = pageInk(); if (arr.length) { undoStack.push({ p: cur.page, prev: arr.slice() }); arr.length = 0; markDirty(); drawInk(); }
      b.dataset.sure = ''; b.textContent = '지우기';
    }
  }

  /* ---------- 문서 열기 ---------- */
  async function open(o) {
    // o: {key, title, src | data | notebook:true, pages?, page}
    if (!document.getElementById('viewer')) build();
    cur = { key: o.key, title: o.title, parts: o.parts || null, src: o.src || null, data: o.data || null, notebook: !!o.notebook, page: o.page || 1, pages: o.pages || 1, zoom: 1, pdf: null };
    $('#vtitle').textContent = o.title || '';
    $('#viewer').classList.add('open');
    document.body.style.overflow = 'hidden';
    tool = o.tool || 'none'; colors();
    if (!cur.notebook && !cur.parts) {
      try {
        cur.pdf = await getPdf(cur.src || cur.data, cur.key);
        cur.pages = cur.pdf.numPages;
      } catch (e) { cfg.toast('PDF를 열지 못했어요'); close(); return; }
    }
    $('#vrange').max = cur.pages; $('#vtotal').textContent = '/ ' + cur.pages;
    go(cur.page, true);
  }
  function close() {
    flush();
    if (cur && cfg.savePos) cfg.savePos(cur.key, cur.page);
    cur = null;
    const v = $('#viewer'); if (v) v.classList.remove('open');
    document.body.style.overflow = '';
    if (cfg.onClose) cfg.onClose();
  }
  function getPdf(src, key) {
    const k = typeof src === 'string' ? src : key;
    if (!pdfCache[k]) {
      const args = typeof src === 'string' ? { url: src } : { data: src };
      pdfCache[k] = pdfjsLib.getDocument(Object.assign(args, { isEvalSupported: false, disableAutoFetch: true, disableStream: false })).promise;
      pdfCache[k].catch(() => { delete pdfCache[k]; });
    }
    return pdfCache[k];
  }
  async function go(p, first) {
    if (!cur) return;
    p = Math.max(1, Math.min(cur.pages, p | 0));
    if (p === cur.page && !first) return;
    cur.page = p;
    $('#vrange').value = p; $('#vpage').value = p;
    await ensureInk(cur.key, p);
    render();
    $('#vscroll').scrollTop = 0;
    if (cfg.savePos) cfg.savePos(cur.key, p);
  }
  async function render() {
    if (!cur) return;
    const sc = $('#vscroll'), stage = $('#vstage'), pc = $('#vpdf');
    const avail = Math.max(280, sc.clientWidth - 24);
    let w = avail * cur.zoom, h;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cur.notebook) {
      h = w * 1.414;
      stage.className = 'paper-grid' + (tool !== 'none' && !penOnly ? ' drawing' : '');
      pc.width = 1; pc.height = 1;
    } else {
      stage.className = (tool !== 'none' && !penOnly ? 'drawing' : '');
      let page;
      try { page = await getPage(cur.page); } catch (e) { cfg.toast('쪽을 불러오지 못했어요'); return; }
      if (!cur) return;
      const vp1 = page.getViewport({ scale: 1 });
      const scale = w / vp1.width;
      const vp = page.getViewport({ scale: scale * dpr });
      h = vp1.height * scale;
      pc.width = vp.width; pc.height = vp.height;
      if (renderTask) { try { renderTask.cancel(); } catch (e) {} }
      renderTask = page.render({ canvasContext: pc.getContext('2d'), viewport: vp });
      try { await renderTask.promise; } catch (e) { return; }
    }
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    const ic = $('#vink'); ic.width = Math.round(w * dpr); ic.height = Math.round(h * dpr);
    drawInk();
  }

  async function getPage(p) {
    if (cur.parts) {
      const part = cur.parts.find(x => p >= x.from && p <= x.to) || cur.parts[0];
      const pdf = await getPdf(part.file, part.file);
      return pdf.getPage(p - part.from + 1);
    }
    return cur.pdf.getPage(p);
  }

  /* ---------- 필기 ---------- */
  const chunkOf = p => Math.floor((p - 1) / CH);
  async function ensureInk(key, p) {
    const c = chunkOf(p), id = key + '|' + c;
    if (loaded[id]) return;
    loaded[id] = true;
    ink[key] = ink[key] || {};
    try {
      const d = await cfg.loadInk(key, c);
      if (d && d.pages) for (const k in d.pages) ink[key][k] = d.pages[k];
    } catch (e) {}
  }
  function pageInk() { ink[cur.key] = ink[cur.key] || {}; return (ink[cur.key][cur.page] = ink[cur.key][cur.page] || []); }
  function markDirty() { dirty.add(cur.key + '|' + chunkOf(cur.page)); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 1500); }
  function flush() {
    clearTimeout(saveTimer);
    for (const id of dirty) {
      const [key, c] = id.split('|'); const pages = {};
      for (let p = c * CH + 1; p <= c * CH + CH; p++) if (ink[key] && ink[key][p] && ink[key][p].length) pages[p] = ink[key][p];
      cfg.saveInk(key, +c, { pages });
    }
    dirty.clear();
  }
  let stroke = null;
  function pt(e) {
    const r = e.target.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) / r.width * 10000), Math.round((e.clientY - r.top) / r.height * 10000)];
  }
  function down(e) {
    if (!cur || tool === 'none') return;
    if (penOnly && e.pointerType === 'touch') return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    if (tool === 'er') { stroke = { er: true }; erase(pt(e)); return; }
    stroke = { t: tool === 'hl' ? 'h' : 'p', c: color, w: tool === 'hl' ? 28 : (e.pointerType === 'pen' ? 3 : 4), pts: pt(e) };
  }
  function move(e) {
    if (!stroke) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (stroke.er) { for (const ev of evs) erase(pt(ev)); return; }
    for (const ev of evs) { const p = pt(ev); stroke.pts.push(p[0], p[1]); }
    drawInk(stroke);
  }
  function up() {
    if (!stroke) return;
    if (!stroke.er && stroke.pts.length >= 2) {
      const arr = pageInk(); arr.push(simplify(stroke)); undoStack.push({ p: cur.page, add: true }); markDirty();
    }
    stroke = null; drawInk();
  }
  function simplify(s) {
    const p = s.pts, out = [p[0], p[1]];
    for (let i = 2; i < p.length; i += 2) {
      const dx = p[i] - out[out.length - 2], dy = p[i + 1] - out[out.length - 1];
      if (dx * dx + dy * dy > 400 || i === p.length - 2) out.push(p[i], p[i + 1]);
    }
    return { t: s.t, c: s.c, w: s.w, pts: out };
  }
  function erase([x, y]) {
    const arr = pageInk(); const R = 180;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i].pts;
      for (let j = 0; j < p.length; j += 2) {
        if (Math.abs(p[j] - x) < R && Math.abs(p[j + 1] - y) < R) { undoStack.push({ p: cur.page, removed: arr[i], at: i }); arr.splice(i, 1); markDirty(); drawInk(); break; }
      }
    }
  }
  function undo() {
    const u = undoStack.pop(); if (!u || !cur) return;
    if (u.p !== cur.page) { go(u.p); }
    const arr = pageInk();
    if (u.add) arr.pop();
    else if (u.removed) arr.splice(u.at, 0, u.removed);
    else if (u.prev) { arr.length = 0; arr.push(...u.prev); }
    markDirty(); drawInk();
  }
  function paint(ctx, s, W, H) {
    const p = s.pts; if (!p || p.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w * W / 1000;
    if (s.t === 'h') { ctx.globalAlpha = .38; ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'butt'; }
    ctx.beginPath();
    ctx.moveTo(p[0] / 10000 * W, p[1] / 10000 * H);
    if (p.length === 2) ctx.lineTo(p[0] / 10000 * W + .5, p[1] / 10000 * H + .5);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] / 10000 * W, p[i + 1] / 10000 * H);
    ctx.stroke(); ctx.restore();
  }
  function drawInk(live) {
    const ic = $('#vink'); if (!ic || !cur) return;
    const ctx = ic.getContext('2d'); const W = ic.width, H = ic.height;
    ctx.clearRect(0, 0, W, H);
    for (const s of pageInk()) paint(ctx, s, W, H);
    if (live && live.pts) paint(ctx, live, W, H);
  }

  /* ---------- 인쇄 ---------- */
  async function printPage() {
    if (!cur) return;
    const c = document.createElement('canvas');
    const W = 1240; let H = Math.round(W * 1.414);
    if (!cur.notebook) {
      const page = await getPage(cur.page);
      const vp1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: W / vp1.width });
      H = Math.round(vp.height); c.width = W; c.height = H;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    } else { c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); }
    const ctx = c.getContext('2d');
    for (const s of pageInk()) paint(ctx, s, W, H);
    const url = c.toDataURL('image/jpeg', .9);
    cfg.print(`<h3 style="font:600 12pt sans-serif;margin:0 0 6px">${esc(cur.title)} · ${cur.page}쪽</h3><img src="${url}" style="width:100%">`, `${cur.title}-${cur.page}쪽`);
  }
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- 그림 영역 ---------- */
  const q = []; let busy = false;
  function region(src, page, box, canvas, target, done) {
    q.push({ src, page, box, canvas, target, done }); pump();
  }
  async function pump() {
    if (busy || !q.length) return; busy = true;
    const job = q.shift();
    try {
      const pdf = await getPdf(job.src, job.src);
      const page = await pdf.getPage(job.page);
      const vp1 = page.getViewport({ scale: 1 });
      const [x0, y0, x1, y1] = job.box || [0, 0, 1, 1];
      const target = job.target || 520;
      const scale = target / ((x1 - x0) * vp1.width);
      const vp = page.getViewport({ scale });
      const off = document.createElement('canvas'); off.width = Math.ceil(vp.width); off.height = Math.ceil(vp.height);
      await page.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise;
      const sx = x0 * off.width, sy = y0 * off.height, sw = (x1 - x0) * off.width, sh = (y1 - y0) * off.height;
      job.canvas.width = Math.round(sw); job.canvas.height = Math.round(sh);
      job.canvas.getContext('2d').drawImage(off, sx, sy, sw, sh, 0, 0, Math.round(sw), Math.round(sh));
      if (job.done) job.done(job.canvas);
    } catch (e) { if (job.done) job.done(null); }
    busy = false; pump();
  }

  return {
    init(c) { cfg = c; if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = c.worker; },
    open, close, region, flush,
    isOpen: () => !!cur,
  };
})();
