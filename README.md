# sj-arc-hub.github.io

SJ-ARC 동아리 공식 사이트 (GitHub Pages · sj-arc.org)

- `index.html` → `SJ-ARC-Home.dc.html`로 이동
- 페이지: Home · Team(운영진) · Levels(레벨 현황) · Gallery · Board
- `support.js`, `image-slot.js`는 페이지 런타임 — 지우지 마세요
- `assets/` 로고 · 사진
- 이전 Notion 연동 자료: `notion-setup.md`, `notion-proxy/worker.js` (새 화면은 사용하지 않음)

## 밝은 디자인 · 홈페이지 문구 편집

- 홈과 커뮤니티 화면에 따뜻한 흰색·초록색 디자인 및 새 A·비행 궤적 로고를 적용했습니다.
- `edit-home.html`: 운영진이 홈페이지 문구·가입 링크를 미리보고 저장합니다. HTML 수정·재배포 없이 반영됩니다.
- 최초 서버 연결: `supabase/005-site-copy.sql`. 사용 방법: [`home-editing.md`](home-editing.md).
- 홈페이지 스타일 수정 후 `npm run build:styles`; 일반 문구 편집에는 빌드가 필요 없습니다.

## Supabase 전환 · 1단계

- 설정 순서: [`supabase-setup.md`](supabase-setup.md)
- `admin.html`에서 Google 로그인 후 운영진이 대표 사진을 업로드합니다.
- 서버 초기 설정 SQL과 첫 운영진 지정이 필요합니다. 공개키만으로 테이블이나 운영진이 자동 생성되지는 않습니다.
- 홈 대표 사진은 Supabase Storage에 저장된 사진을 모든 방문자에게 표시합니다.
- 운영진·명단·갤러리·게시판 전환은 아래 2단계 설정을 사용합니다.
- 로컬 실행: `npm ci` → `npm run dev`; 검증: `npm test`.

## 콘텐츠 관리 · 2단계

- 설정·운영 안내: [`community-setup.md`](community-setup.md)
- 기존 프로젝트에 `supabase/003-community.sql` 실행 후 새 코드를 배포합니다.
- `manage.html`: 운영진 소개, 명단·레벨, Google 회원 승인, 앨범·사진, 게시글·승급 심사 관리.
- 운영진이 명단에 연결해 승인한 회원은 게시판에서 자료를 작성·제출합니다.
- 공개된 승급자료와 첨부파일은 방문자도 읽을 수 있습니다. 작성 중인 자료와 내부 심사 의견은 제한합니다.
- 승급 승인과 레벨 변경, 심사 스냅샷·감사 기록을 서버에서 함께 처리합니다.
- `community-core.js`, `community.js`, `manage.js`, `community.css`를 공통으로 사용하며 추가 번들 빌드는 필요 없습니다.

## 갤러리 동영상

- 기존 프로젝트에서 `supabase/004-gallery-video.sql`을 한 번 실행하고 코드를 배포합니다. 기존 사진은 유지됩니다.
- 앨범에서 MP4·WebM(파일당 50MB) 업로드 또는 YouTube 링크 추가 후 페이지 안에서 재생합니다.
- 상세 설정과 파일 형식 안내는 `community-setup.md`의 갤러리 항목을 참고하세요.
