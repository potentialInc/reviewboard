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
