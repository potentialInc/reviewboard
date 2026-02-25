# Harness Process Issues

> 이번 빌드에서 하네스가 자동 처리하지 못했거나 수동 개입이 필요했던 사항들.
> 하네스 개선 시 참고.

---

## HARNESS-001: Supabase 프로젝트 자동 생성 불가
- **증상**: Supabase CLI 미인증 상태에서 `supabase projects list` 실패. 로컬 Supabase 시작 시 Docker Desktop이 꺼져있어 수동 실행 필요.
- **원인**: `supabase login` 미완료, Docker 데몬 미실행
- **해결**: Docker Desktop 수동 시작 후 `supabase start`로 로컬 인스턴스 사용
- **하네스 개선안**:
  - `fullstack` 파이프라인에 "인프라 준비" 단계 추가 (Docker 상태 체크 → 자동 시작)
  - Supabase access token을 `.env`에 미리 설정하는 가이드 또는 자동화

## HARNESS-002: 런타임 테스트가 빌드 후 자동 실행되지 않음
- **증상**: `npm run build` 성공 후 API 스모크 테스트를 수동으로 실행해야 했음
- **원인**: 파이프라인에 "런타임 검증" 단계가 없음
- **하네스 개선안**:
  - `phase-validator.sh`에 "runtime-smoke" 검증 타입 추가
  - dev 서버 시작 → curl 기반 E2E 테스트 → 결과 검증 → 서버 종료 자동화
  - 이 프로젝트의 스모크 테스트 스크립트를 `tests/smoke/` 템플릿으로 추출

## HARNESS-003: 리뷰 결과 자동 수정 파이프라인 부재
- **증상**: 리뷰 에이전트 3개가 80+ 이슈를 찾았지만, 수정은 수동으로 우선순위별 분류 후 하나씩 진행
- **원인**: 리뷰 → 수정 자동 연결 없음
- **하네스 개선안**:
  - 리뷰 에이전트 출력을 구조화된 JSON으로 (파일, 라인, 심각도, 수정코드)
  - `auto-fix-loop.sh`가 리뷰 결과 JSON을 입력받아 자동 수정 + 빌드 검증 루프
  - P0은 즉시 수정, P1/P2는 issues/ 폴더에 자동 기록

## HARNESS-004: Supabase Nested Select FK 모호성 사전 감지 불가
- **증상**: `client_accounts(login_id)` 쿼리가 ambiguous FK로 실패하지만 빌드 타임에 감지 불가. 런타임 404로만 나타남.
- **원인**: PostgREST의 FK 모호성은 타입 체크로 잡을 수 없음
- **하네스 개선안**:
  - Supabase 사용 프로젝트에서 `schema.sql` 기반 FK 관계 분석 도구 추가
  - 2개 이상 경로가 있는 테이블 join 사용 시 경고 생성

## HARNESS-005: 환경별 설정 자동화 부족
- **증상**: `.env.local` 수동 생성. Slack 토큰은 다른 프로젝트에서 수동 복사.
- **원인**: 하네스에 "시크릿 관리" 또는 "환경 설정" 단계 없음
- **하네스 개선안**:
  - PRD에 외부 서비스 목록 정의 → `.env.local.example` 자동 생성
  - 로컬 개발 시 필요한 시크릿을 기존 프로젝트에서 자동 탐색/복사
  - `harness.config.json`에 `shared_secrets` 경로 설정 지원

## HARNESS-006: 생성 파일 위치 규칙 미적용
- **증상**: `SCREEN_STATUS.md`가 프로젝트 루트에 생성됨. `docs/` 또는 적절한 하위 폴더에 위치해야 함.
- **원인**: 파일 생성 시 디렉토리 규칙이 없음. 에이전트가 편의상 루트에 생성.
- **해결**: 수동으로 `docs/SCREEN_STATUS.md`로 이동
- **하네스 개선안**:
  - `architecture/rules.json`에 파일 배치 규칙 추가 (status → `docs/`, reports → `docs/`, issues → `issues/`)
  - post-write 훅에서 루트 디렉토리에 `.md` 파일 생성 시 경고 + 적절한 폴더 제안
  - 템플릿 파일(`templates/status/`)에 output 경로 메타데이터 포함

## HARNESS-008: 배포 파이프라인 및 라이브 링크 부재
- **증상**: 코드가 GitHub 레포(`PotentialJayden/jayden-reviewboard`)에 푸시되었으나 라이브 URL이 없음. 빌드 성공해도 접근 가능한 환경이 존재하지 않음.
- **원인**: 배포 설정(Dockerfile, docker-compose, Dokploy 설정, CI/CD 워크플로우)이 프로젝트에 전혀 없음. `claude-base`의 deployment.md 스킬(Phase 9: ship)이 실행되지 않았음.
- **현재 상태** (해결 중):
  - ✅ `app/Dockerfile` — Node 20 Alpine, 3-stage multi-stage build (deps → build → runner), standalone output
  - ✅ `docker-compose.yml` — production용 (환경변수 주입)
  - ✅ `docker-compose.dev.yml` — development용 (Supabase 로컬 연동)
  - ✅ `.github/workflows/deploy.yml` — Build + Deploy (dev/staging/production 3환경)
  - ✅ `app/src/app/api/health/route.ts` — DB 연결 체크 포함 헬스체크 엔드포인트
  - ✅ `app/.env.local.example` — 환경변수 템플릿 (기존)
  - ⏳ Dokploy/AWS ECS 실제 연결 — 인프라 설정 후 워크플로우 주석 해제 필요
- **하네스 개선안**:
  - `fullstack` 파이프라인의 Phase 9(ship)가 빌드 성공 후 자동 트리거되도록 연결
  - `deployment.md` 스킬이 프로젝트 타입(Next.js/NestJS/Django) 감지 후 적절한 Dockerfile 자동 생성
  - 배포 전 체크리스트 자동 검증: Dockerfile 존재, 환경변수 설정, 헬스체크 엔드포인트 확인

## HARNESS-009: 에이전트가 스스로 확인 가능한 것을 사용자에게 질문
- **증상**: 배포 인프라 설정 후 "Dokploy나 AWS 어떤 방식으로 진행할까요?"라고 질문. 에이전트가 직접 `which dokploy`, `which aws`, `vercel whoami` 등으로 사용 가능한 도구를 확인할 수 있었음에도 불구하고 사용자에게 선택을 떠넘김.
- **원인**: 에이전트의 기본 행동이 "선택지 제시 → 사용자 확인 대기" 패턴. 환경 탐색 후 가능한 경로를 자동으로 판단하는 로직 없음.
- **하네스 개선안**:
  - **원칙**: 에이전트가 환경에서 확인 가능한 것(CLI 설치 여부, 로그인 상태, 설정 파일 존재 여부)은 반드시 먼저 확인한 후 진행
  - 질문 전 체크리스트: (1) 로컬 환경 탐색 완료? (2) 가능한 경로가 1개뿐인가? → 그렇다면 질문 없이 진행
  - `agents/` 공통 규칙에 "ask-last" 원칙 추가: 환경 탐색 → 가능 경로 판단 → 1개면 바로 실행, 2개 이상이면 추천과 함께 진행
  - 파괴적이지 않은 작업(빌드, 테스트, 탐색)은 절대 질문하지 않고 실행

## HARNESS-007: 변경 규모와 관계없이 한번에 실행 원칙
- **증상**: Design QA 결과 11개 화면의 이슈를 발견했지만, 분석만 수행하고 수정을 별도 단계로 분리함. 사용자가 "왜 한번에 안 하냐"고 지적.
- **원인**: 에이전트가 "분석 → 보고 → 승인 대기 → 수정" 순차 워크플로우를 따름. 대규모 변경에 대한 자동 실행 정책 부재.
- **하네스 개선안**:
  - **원칙**: 아무리 변경이 커도 QA/분석과 수정을 분리하지 않고, 발견된 이슈를 즉시 수정 진행
  - `agents/design-qa.md`에 `auto_fix: true` 플래그 추가 — QA 완료 후 자동으로 수정 에이전트 트리거
  - 병렬 에이전트 파이프라인: QA 결과 JSON → 자동 분류 → 병렬 수정 에이전트 실행 → 빌드 검증
  - `harness.config.json`에 `max_parallel_fix_agents` 설정 (기본값: 화면 수)
  - 사용자 확인이 필요한 경우는 파괴적 변경(삭제, 구조 변경)에만 한정
