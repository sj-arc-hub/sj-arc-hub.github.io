# SJ-ARC × Notion 연동 가이드 (방식 ②: Notion API + Cloudflare Worker)

Notion에서 학생을 추가·수정하면 사이트 「레벨 현황」이 자동으로 따라옵니다.
비용 0원, 소요 시간 약 30분. 필요한 것: Notion 워크스페이스 관리자 권한, Cloudflare 무료 계정.

구조: 사이트(GitHub Pages) → Cloudflare Worker(무료, `notion-proxy/worker.js`) → Notion API → 학생 DB

---

## 1. Notion DB 속성 맞추기

「학생 레벨 관리」 DB에 아래 속성이 있으면 됩니다 (이름이 조금 달라도 괄호 안 이름은 자동 인식).

| 속성 이름 | 유형 | 값 예시 | 인식되는 다른 이름 |
| --- | --- | --- | --- |
| 이름 | 제목(Title) | 이충현 | 학생 이름, Name |
| 트랙 | 선택(Select) | 운영 / 개발 | 파트, Track, 분야 |
| 레벨 | 선택 또는 숫자 | LV1 · LV2 · LV3 · LV4 (또는 1~4) | 현재 레벨, Level |
| 누적 점수 | 숫자 | 100 | 점수, Score |
| 최근 승단 | 날짜 | 2025-12-24 | 최근 승단 날짜, 승단일, Promoted |
| 비고 | 텍스트 | ROS2-PX4 연동 실습 | 비고 / 과제, 과제, Note, 메모 |

- 레벨에 "Core", "Master" 같은 이름을 쓰면 그것도 인식합니다 (Beginner/Intro=1, Expert/Middle=2, Master/Advanced=3, Core=4).
- 트랙이 비어 있으면 운영으로 간주 (LV4만 개발로).

## 2. Notion 통합(Integration) 만들기

1. https://www.notion.so/my-integrations → **새 API 통합** (New integration)
2. 이름 `SJ-ARC Site`, 연결 워크스페이스 선택, 유형 **내부(Internal)** → 저장
3. **내부 통합 시크릿**(`ntn_…`) 복사 → 잠시 메모장에 보관 (외부에 공개 금지)
4. 기능(Capabilities)은 **콘텐츠 읽기**만 켜두면 충분

## 3. DB에 통합 연결 + DB ID 확인

1. 학생 레벨 관리 DB를 **페이지로 열기** (표가 다른 페이지 안에 있으면 표 제목 옆 ⋮⋮ → "페이지로 열기")
2. 우상단 `···` → **연결(Connections)** → `SJ-ARC Site` 추가
3. 주소창을 보면 `notion.so/워크스페이스/32자리ID?v=…` — 이 **32자리**가 DB ID
   - 주의: 공개 링크 `…notion.site/SJ-ON-2d38ca9f…`의 ID는 "페이지" ID일 수 있습니다. 표 자체를 페이지로 열어서 나온 ID를 쓰세요.
   - 하이픈이 섞여 있어도 되고, URL 전체를 붙여넣어도 Worker가 32자리를 알아서 뽑습니다.

## 4. Cloudflare Worker 만들기

1. https://dash.cloudflare.com 가입(무료) → 왼쪽 **Compute (Workers & Pages)** → **Create**
2. **Start with Hello World** → 이름 `sjarc-notion` → **Deploy**
3. **Edit code** → 기존 내용 전부 삭제 → `notion-proxy/worker.js` 내용 붙여넣기 → **Deploy**
4. Worker 페이지 → **Settings → Variables and Secrets → Add**
   - `NOTION_TOKEN` — Type **Secret** — 2단계의 시크릿
   - `NOTION_DB_STUDENTS` — Type Text — 3단계의 DB ID
   - (선택) `CACHE_SECONDS` = `120` (Notion 변경이 사이트에 반영되는 최대 지연)
   - (선택) `ALLOWED_ORIGINS` = `https://sj-arc.org,https://sj-arc-hub.github.io` — 처음엔 비워두고(모두 허용), 연결 확인 후 넣기
5. 저장 후 **Deploy** 한 번 더

## 5. 동작 확인

- `https://sjarc-notion.<계정이름>.workers.dev/` → `{"ok":true,"endpoints":["/students"]…}`
- `https://sjarc-notion.<계정이름>.workers.dev/students` → `rows` 안에 학생이 보이면 성공

| 오류 | 원인 |
| --- | --- |
| `401 Unauthorized` | 시크릿 오타 / Secret 타입 아님 |
| `404 object_not_found` | 3-2 연결 안 됨 또는 DB ID 틀림 (페이지 ID를 넣은 경우) |
| `NOTION_TOKEN 환경 변수가 없습니다` | 4-4 변수 저장 후 Deploy 안 함 |
| 값이 빈 칸으로 나옴 | 1단계 속성 이름 확인 |

## 6. 사이트 연결

`SJ-ARC-Levels.dc.html`의 스크립트 맨 위 한 줄에 Worker 주소를 넣습니다 (끝에 `/` 없이):

```js
const NOTION_API = 'https://sjarc-notion.<계정이름>.workers.dev';
```

(또는 미리보기의 Tweaks 패널 → `apiUrl`에 입력해 먼저 테스트해도 됩니다.)

새로고침하면 표 하단에 **"Notion 동기화 완료 · 시각"**이 뜨고, 「학생 추가」 버튼은 「Notion에서 학생 추가 ↗」로, 각 행의 수정 버튼은 「Notion에서 수정 ↗」로 바뀝니다. 연결 실패 시 빨간 안내와 함께 브라우저 저장 데이터를 대신 보여줍니다.

## 7. 이후 운영

- Notion에서 학생 추가 / 레벨·점수 변경 → 사이트는 최대 `CACHE_SECONDS`(기본 2분) 뒤 반영, 「새로고침」 버튼은 즉시
- 통합 시크릿은 Worker Secret에만 있고 사이트 코드엔 없으므로 공개 저장소에 올려도 안전
- 새 DB를 추가하려면 Worker 변수만 추가: `NOTION_DB_ALBUMS`(앨범), `NOTION_DB_PHOTOS`(사진), `NOTION_DB_POSTS`(게시판) → `/albums`, `/photos`, `/posts` 자동 생성. 사진은 `/file/{pageId}/{속성이름}/{번호}`로 표시 (Notion 파일 URL 1시간 만료 문제 해결)

### 갤러리·게시판 DB 속성 제안 (다음 단계에서 연결)

- **앨범**: 제목 · 날짜(날짜) · 분류(선택: 정기모임/기체 제작/비행 실습/대회/세미나/기타) · 설명(텍스트) · 표지(파일)
- **사진**: 제목 · 앨범(관계 → 앨범 DB) · 사진(파일) · 촬영일(날짜)
- **게시판**: 제목 · 카테고리(선택: 공지/정보 공유/질문 답변/대회 소식/자료/자유) · 작성자(사람 또는 텍스트) · 내용(텍스트) · 링크(URL) · 고정(체크박스) · 작성일(생성 시간)
