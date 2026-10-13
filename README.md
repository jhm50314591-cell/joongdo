# 중도일보 사우회

중도일보 사우 최대 10명이 계정을 만들고 함께 쓰는 반응형 소셜 웹앱입니다. Node.js 서버와 Render Postgres를 사용하며, 외부 Supabase 계정은 필요하지 않습니다.

## 들어 있는 기능

- 아이디와 비밀번호로 가입/로그인, 최대 10개 계정
- 프로필 이름, 사용자 이름, 소개, 사진 편집
- 사진/텍스트 게시물, 댓글, 좋아요
- 24시간 후 만료되는 스토리와 스토리 답장
- 사우 간 1:1 채팅 및 그룹 채팅
- 댓글·좋아요·스토리 답장·채팅 알림
- 계정별 배경 설정과 모바일/PC 반응형 화면
- 비밀번호 해시 저장, HTTPS 전용 세션 쿠키, 계정 권한이 확인된 API

사진은 브라우저에서 크기를 줄인 뒤 Postgres에 저장됩니다. 별도 파일 저장 서비스는 필요하지 않습니다.

## GitHub와 Render에 배포

1. 이 ZIP을 풀고, **안의 파일과 `public` 폴더**를 GitHub 저장소 최상위에 올립니다. 최상위에 `render.yaml`, `package.json`, `server.js`, `schema.sql`, `public/`이 있어야 합니다.
2. Render에서 **New → Blueprint**를 열고 해당 GitHub 저장소를 연결합니다.
3. Render가 `render.yaml`을 읽어 웹 서버와 Postgres를 구성하도록 진행합니다. `DATABASE_URL`은 Blueprint가 자동으로 연결합니다.
4. 배포가 끝나면 Render가 제공하는 `onrender.com` 링크를 사우들에게 공유합니다. 사우들은 링크를 열어 **계정 만들기**에서 가입하면 됩니다. 최대 10개 계정까지 가입을 받습니다.

환경 변수나 Supabase 프로젝트를 따로 만들 필요는 없습니다. 공개 링크를 가진 누구나 계정을 만들 수 있으므로 링크를 공개 게시판에는 올리지 마세요. 10개 가입이 차면 신규 가입이 자동으로 닫힙니다.

## Render 무료 플랜의 주의점

`render.yaml`은 비용이 청구되지 않는 무료 웹 서비스와 무료 Postgres를 선택합니다. 무료 웹 서비스는 15분 동안 요청이 없으면 잠들며, 다시 접속할 때 깨어나는 데 약 1분 걸릴 수 있습니다. 무료 Postgres는 생성 후 30일이 지나면 만료되므로 장기 사용 전에 Render에서 데이터베이스를 유료 플랜으로 올려야 합니다. 무료 DB를 영구 저장소로 사용하지 마세요. [Render 무료 플랜 제한](https://render.com/docs/free)

## 로컬 실행

Node.js 22 이상과 로컬 Postgres가 필요합니다. 데이터베이스를 만든 뒤 `DATABASE_URL` 환경 변수를 설정하고 실행합니다.

```powershell
npm install
$env:DATABASE_URL="postgresql://사용자:비밀번호@localhost:5432/jungdo_sauhoe"
npm start
```

브라우저에서 `http://localhost:10000`을 엽니다. 첫 실행 때 `schema.sql`이 필요한 테이블을 만듭니다.

## 파일 구성

- `server.js` — 로그인 세션, API, Postgres 연결, 사진 처리
- `schema.sql` — 계정, 게시물, 좋아요, 댓글, 스토리, 대화, 알림 테이블
- `public/` — 웹 화면과 반응형 스타일
- `render.yaml` — Render 웹 서비스와 Postgres 배포 설정

실시간 알림과 메시지는 화면이 열린 동안 약 6초마다 새로고침해 표시합니다. 이메일/비밀번호 찾기 기능은 아직 없으므로 각자 로그인 정보를 안전하게 보관하세요.
