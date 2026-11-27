/* 생명 임용 랩노트 — 오프라인용 서비스 워커
   앱 화면·데이터는 미리 저장, 교재 PDF는 한 번 연 것만 저장(범위 요청은 그대로 통과) */
const V = 'labnote-v2';
const SHELL = ['./', './index.html', './css/app.css', './js/app.js', './js/pdfview.js', './js/vendor/pdf.min.js', './js/vendor/pdf.worker.min.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './data/books.json', './data/units.json', './data/notes.json', './data/questions.json', './data/figures.json', './data/problems.json', './data/checklist.json', './data/trend.json', './data/exams.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range') || new URL(r.url).origin !== location.origin) return;
  const isData = /\/(data|js|css)\//.test(r.url) || r.mode === 'navigate';
  if (isData) {
    // 최신 우선, 오프라인이면 저장본
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok && res.status === 200) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })));
  }
});
