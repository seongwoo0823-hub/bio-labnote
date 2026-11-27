# 생명 임용 랩노트

2028학년도 중등 생물 임용 1차 대비 개인 학습 사이트입니다. 빌드 도구 없이 정적 파일만으로 동작합니다.

## 구성

```
index.html          진입점
css/app.css         iOS 스타일 화면
js/app.js           앱 본체 (계획·퀴즈·모의고사·오답·기록·서재·인쇄)
js/pdfview.js       PDF 뷰어 + 애플펜슬 필기 + 그림 영역 렌더러
js/vendor/          pdf.js 3.11.174 (pdf.min.js, pdf.worker.min.js)
data/books.json     교재 목록 (offset: PDF 쪽 = 책 쪽 + offset)
data/units.json     단원(장)·절·소단원과 쪽수
data/notes.json     단원별 개념 노트 (간단 마크다운)
data/questions.json 문항 은행 (mc · ox · short · essay)
data/figures.json   교재 그림 위치 (쪽 + 영역 비율)
data/text/*.json    교재 OCR 텍스트 (전체 검색용)
books/*.pdf         교재 스캔본  ← 저작권 자료: 공개 저장소에 올리지 마세요
```

## GitHub Pages로 띄우기

1. 이 폴더를 **비공개(private)** 저장소에 올립니다. 교재 PDF와 `data/text/`는 출판사 저작물이므로
   공개 저장소에는 넣지 마세요. 공개로 운영하려면 `.gitignore`의 주석을 풀어 두 폴더를 빼고 올리면
   서재·그림·검색을 뺀 나머지 기능은 그대로 동작합니다.
2. GitHub Pages는 비공개 저장소를 유료 플랜에서만 지원합니다. 무료로 쓰려면 Cloudflare Pages나
   Netlify에 비공개 저장소를 연결하고 접근 제한(비밀번호)을 거는 방법을 권합니다.
3. 파일 하나가 100MB를 넘지 않으므로 Git LFS 없이 올라갑니다(가장 큰 파일 약 32MB).

## 저장

- claude.ai 아티팩트에서 열면 계정 DB에 저장되어 기기 간에 이어집니다.
- 그 밖의 주소에서는 브라우저 IndexedDB에 저장됩니다. 더보기 → 설정 → 기록 내보내기/가져오기로 옮기세요.

## 문항 형식 (questions.json)

```json
{"id":"고유값","s":"edu|ped|maj","u":"단원 id","t":"mc|ox|short|essay",
 "q":"문항","ch":["보기"],"a":0,"kw":["채점 키워드(동의어는 |)"],
 "ex":"해설","tip":"암기 팁","ref":책쪽수,"pts":배점,"model":"모범답안","rubric":[{"c":"기준","p":점수}]}
```

## 앱으로 설치하기 (PWA)
GitHub Pages에 올리면 `manifest.webmanifest`와 `sw.js`가 함께 동작해 앱처럼 설치됩니다(HTTPS 필요).
1. 저장소 Settings → Pages → Branch `main` / 폴더 `/ (root)` 선택 → 주소 확인
2. **iPhone·iPad**: Safari로 주소 열기 → 공유(□↑) → 홈 화면에 추가
3. **Android·Galaxy**: Chrome·삼성 인터넷 → 메뉴 → 앱 설치 (앱 안 '더보기 → 설정 → 앱 설치' 버튼도 가능)
4. **PC**: Chrome·Edge 주소창의 설치 아이콘 / Mac Safari 파일 → Dock에 추가
- 오프라인: 화면·노트·문항 데이터는 처음 열 때 저장되고, 교재 PDF는 한 번 연 쪽만 저장됩니다.
- 업데이트 후 바로 반영하려면 `sw.js`의 `V = 'labnote-v1'` 숫자를 올려 주세요.

## 비공개 저장소로 올리기 (교재·기출 PDF 포함)
- 이 묶음에는 교재 PDF(books/), 실제 기출 시험지(exams/), 교재 검색용 텍스트(data/text/)가 모두 들어 있습니다. **저작물이므로 반드시 Private 저장소**로 만드세요.
- PDF는 모두 20MB 이하라 GitHub 파일 한도(100MB) 안입니다. 웹 화면 끌어다 놓기는 한 번에 100개 파일까지이므로, 파일이 많으면 **GitHub Desktop** 또는 아래 명령을 쓰세요.
```
git init && git add . && git commit -m "생명 임용 랩노트"
git branch -M main
git remote add origin https://github.com/<아이디>/<저장소>.git
git push -u origin main
```
- 비공개 저장소의 GitHub Pages(앱 설치용 주소)는 **GitHub Pro 이상 유료 요금제**에서만 켤 수 있습니다. 무료 계정이면 Pages 대신 Cloudflare Pages·Netlify(비공개 저장소 연결 가능)에 연결해 배포하세요. 이때 사이트 주소를 아는 사람은 누구나 PDF를 볼 수 있으니 주소를 공유하지 마세요.
