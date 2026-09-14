# SJ-ARC Supabase 설정 · 1단계

운영진·명단·갤러리·게시판·승급자료 관리는 추가된 [2단계 설정 안내](community-setup.md)를 사용합니다. 아래는 최초 로그인과 대표 사진 연결을 위한 안내입니다.

현재 구현 범위: Google 로그인, 운영진 권한 확인, 대표 사진 업로드·공개 표시.
실제 서버의 초기 SQL 실행, Google OAuth 설정, 첫 운영진 지정이 완료되어야 사용할 수 있습니다.
레벨·갤러리·게시판은 2단계 SQL 실행과 코드 배포를 마치면 홈페이지에서 관리할 수 있습니다.

## 1. 초기 테이블과 파일 저장소

Supabase 프로젝트 `sj-arc` → **SQL Editor → New query**에서
[`supabase/001-site-foundation.sql`](supabase/001-site-foundation.sql)의 전체 내용을 실행합니다.

생성되는 항목:

- `profiles`: 로그인 사용자 이름과 역할. 이메일은 Auth에 보관하고 이 테이블에 복제하지 않습니다.
- `site_settings`: 공개 대표 사진 경로·설명·변경 버전.
- `sjarc-public`: 공개 대표 사진용 버킷, 파일당 5MB, WebP/JPEG/PNG.
- 로그인 가입자는 `pending`. 브라우저에서 역할을 직접 바꿀 수 없습니다.
- 사진은 운영진만 업로드할 수 있고, 게시 요청에서 권한·파일 존재·변경 버전을 확인합니다.

이 SQL은 재실행해도 기존 대표 사진과 운영진 권한을 유지합니다. 대표 사진 버킷에 내부 승급자료나 비공개 문서를 넣지 마세요.

## 2. Google 로그인 연결

Google Cloud / Google Auth Platform에서 프로젝트를 만들고 OAuth를 설정합니다.

1. 앱 이름: `SJ-ARC`. 실제 운영자가 받을 지원·연락 이메일을 입력합니다.
2. 사용 대상을 지정합니다. 학교 조직 외 Google 계정도 허용할 계획이면 External을 사용합니다.
3. 기본 로그인 권한 `openid`, `email`, `profile`만 사용합니다.
4. OAuth Client를 **Web application** 유형으로 만듭니다.
5. Authorized JavaScript origins:

   ```text
   https://sj-arc.org
   ```

6. Authorized redirect URIs에는 **Supabase 콜백 주소**를 등록합니다.

   ```text
   https://agbqlqgybbnzwfjyvkyi.supabase.co/auth/v1/callback
   ```

7. 발급된 Client ID와 Client Secret을 Supabase의 **Authentication → Sign In / Providers → Google**에 입력하고 활성화합니다. Secret은 이 설정 화면에만 입력합니다.
8. Google 앱이 Testing 상태라면 첫 운영진 Google 계정을 테스트 사용자로 추가합니다. 동아리 전체에 공개할 때 Google 앱의 게시 상태도 확인합니다.

Supabase **Authentication → URL Configuration**:

```text
Site URL: https://sj-arc.org
Redirect URLs: https://sj-arc.org/admin.html
```

로컬에서 먼저 검증할 때만 아래를 추가합니다.

```text
Google Authorized JavaScript origins: http://localhost:8741
Supabase Redirect URLs: http://localhost:8741/admin.html
```

Google의 redirect URI는 Supabase의 `/auth/v1/callback`, Supabase의 redirect URL은 홈페이지의 `/admin.html`입니다. 서로 다른 두 주소가 모두 필요합니다.

실제 운영 도메인은 위 값으로 통일했습니다. `www`나 GitHub Pages 원본 도메인에서도 로그인할 계획이면 해당 origin과 `/admin.html`을 각각 추가합니다.

## 3. 홈페이지 코드

`supabase-config.js`에는 제공받은 프로젝트 URL과 공개 publishable key가 설정되어 있습니다. DB 비밀번호나 secret/service_role 키를 넣지 않습니다.

- `admin.html`: Google 로그인·운영진용 사진 관리.
- `hero-photo.js`: 홈페이지의 저장된 대표 사진 표시.
- `site-api.js`: DB 조회와 사진 업로드·게시.
- `vendor/supabase.js`: Supabase JS 2.116.0을 브라우저용으로 번들한 파일.

필요한 파일을 포함해 GitHub Pages에 배포한 뒤 `https://sj-arc.org/admin.html`을 엽니다.
로컬 확인은 `npm ci` 후 `npm run dev`, `http://localhost:8741/admin.html`에서 할 수 있습니다.

## 4. 첫 운영진 지정

1. 원하는 운영진 Google 계정으로 관리자 페이지에 한 번 로그인합니다. 처음에는 권한 대기로 표시되는 것이 정상입니다.
2. [`supabase/002-bootstrap-admin.example.sql`](supabase/002-bootstrap-admin.example.sql)의 `YOUR_GOOGLE_EMAIL`을 그 이메일로 바꾸고 SQL Editor에서 실행합니다.
3. 이 SQL은 이메일이 확인된 Google 로그인 계정을 찾아 `admin` 역할을 부여합니다. 이메일 문자열만 입력해 웹에서 운영진이 될 수는 없습니다.
4. 관리자 페이지에서 **권한·사진 새로고침**을 누릅니다.

첫 운영진 이메일이 포함된 실제 실행본은 공개 저장소에 올리지 않고 별도로 관리할 수 있습니다.

## 5. 동작 확인

1. 운영진 로그인 → 사진 선택 → 설명 입력 → 대표 사진으로 저장.
2. 로그아웃한 별도 브라우저에서 홈을 새로고침해 같은 사진이 보이는지 확인.
3. 일반 Google 계정은 사진 관리 화면이 열리지 않는지 확인.
4. 두 관리자 탭에서 동시에 편집할 경우 오래된 탭의 저장이 충돌 안내로 끝나는지 확인.
5. 새 사진은 고유 경로에 올리므로 이전 캐시가 새 사진을 가리지 않습니다.

교체 전 파일과 게시 연결에 실패한 업로드는 자동 삭제하지 않습니다. 통신 오류 뒤 이미 공개된 파일을 잘못 삭제하지 않기 위한 선택입니다. 이후 자료 관리 단계에서 참조되지 않는 파일을 정리하는 기능을 추가할 수 있습니다.

## 개발 검증

```sh
npm ci
npm run build:vendor
npm test
```

권한 테스트는 PGlite의 PostgreSQL에서 실행합니다. Supabase Auth/Storage 기본 테이블·역할을 최소한으로 재현하므로, 실제 Supabase Storage API와 Google OAuth 검증은 위 5단계에서 별도로 수행해야 합니다.
승급자료·레벨 관리 단계에서는 별도의 비공개 저장소, 신청·심사 이력과 승인 시 레벨 갱신을 함께 처리하는 서버 로직을 추가합니다.

백업은 DB와 Storage 실제 파일을 각각 보관하고 복구를 검증해야 합니다. 이번 단계에는 자동 백업 작업을 설정하지 않았습니다.

공식 문서: [Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [공개키·비밀키](https://supabase.com/docs/guides/getting-started/api-keys), [Storage 권한](https://supabase.com/docs/guides/storage/security/access-control).
