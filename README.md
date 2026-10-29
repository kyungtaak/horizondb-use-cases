# HorizonDB Use Cases

HorizonDB Use Cases는 HorizonDB의 PostgreSQL 확장과 AI 기능을 업무 시나리오로 살펴보는 데모 애플리케이션 모음입니다.
데이터 저장, SQL 처리, 확장 기능, 외부 AI 모델이 맡는 역할을 구분하고 각 사례의 처리 과정과 결과를 확인합니다.

앱 첫 화면에서 활용 사례를 선택합니다. 각 사례는 업무에 맞는 화면과 데이터 모델을 유지하며,
상단 메뉴로 다른 사례로 이동하거나 **전체 사례**로 돌아올 수 있습니다.
하나의 범용 업무 화면이나 런타임 플러그인 프레임워크를 제공하는 프로젝트는 아닙니다.

[소개·문서 사이트](https://kyungtaak.github.io/horizondb-use-cases/)에서 사례별 기술 설명과 발표자료를 읽고,
[설치·실행 안내](#로컬-실행)에 따라 각자의 Azure 환경에 데모를 구성합니다.
공유 데모 접속 주소는 제공하지 않으며, Pages 사이트 자체는 업무 API나 AI 모델을 호출하지 않습니다.

## 활용 사례

| 사례 | 업무 질문 | 활용 기능 |
| --- | --- | --- |
| [Fleet Intelligence](docs/blog-post.md) | 위치·배송 조건·화물의 의미를 함께 만족하는 배송은 무엇인가? | PostGIS 공간 검색, pgvector·DiskANN 의미 검색, 임베딩 갱신 pipeline, 도구 기반 AI 검색 |
| [Home Shopping Intelligence](docs/home-shopping.md) | 방송 중 주문 흐름은 어떻고 고객은 무엇 때문에 구매를 망설이는가? | SQL 주문 집계, `azure_ai` 댓글 분류 pipeline, 집계·댓글 근거를 사용한 AI 브리핑 |

사례별 화면·검색 규칙·SQL·API·설정·시연·검증 기록은 위의 기존 문서에 정리했습니다.
발표자료와 기술 설명 HTML은 [문서 안내](docs/README.md)에서 찾을 수 있습니다.
사례를 추가할 때의 기준도 같은 안내를 따릅니다.

## 기능과 역할

| 구분 | 역할 |
| --- | --- |
| HorizonDB와 PostgreSQL 확장 | 업무 데이터 저장, SQL 조회·집계, 공간 처리, 벡터 거리 계산과 인덱스 |
| DB의 AI 연계 기능 | 모델 등록, AI 함수 호출, 데이터 변경 기반 pipeline 연결과 결과 저장 |
| FastAPI 백엔드 | 입력 검사, SQL·도구 실행, 수집·묶음 생성, 모델 결과 검사, 사례별 API |
| 외부 모델 endpoint | 임베딩, 조건 해석, 분류, 답변·브리핑 생성의 실제 추론 |
| React 프론트엔드 | 사례 선택과 업무별 화면, 데이터·모델 결과·대기·오류·실행 근거 표시 |

PostGIS·pgvector 등은 PostgreSQL 확장 생태계의 기능이며 모두 HorizonDB만의 고유 기능은 아닙니다.
DB 함수와 pipeline을 사용하더라도 실제 모델 추론은 연결된 외부 endpoint에서 실행됩니다.
사례마다 사용하는 기능이 다르며, 소개의 기능 목록은 실시간 연결 상태나 성능 보장을 뜻하지 않습니다.

현재 두 사례는 같은 React 앱과 FastAPI 서비스를 사용합니다. 백엔드는 Psycopg 3로 HorizonDB에 연결합니다.
사례 전환 시 방문한 화면의 검색 조건·대화·필터를 보존하고, 새로고침하면 소개 화면으로 돌아옵니다.
홈쇼핑의 실행·분석 데이터는 서버와 DB에서 관리하며, 화면을 벗어나도 서버 실행을 자동으로 초기화하거나 일시정지하지 않습니다.

## 로컬 실행

### 준비 조건

- Python 3.11 이상과 [uv](https://docs.astral.sh/uv/)
- Node.js 20.19 이상과 npm. [Node.js LTS](https://nodejs.org/en/download)를 권장합니다.
- 접근 가능한 HorizonDB, DB 접속 정보, 사례에 맞는 모델 endpoint·deployment·인증

실제 데모는 Azure 서비스에 연결합니다. 설정 오류를 합성 결과로 대체하는 로컬 fallback은 없습니다.
소개 화면은 사례 선택 전 업무 API를 호출하지 않지만, 실제 데모에는 백엔드·DB·모델 설정이 필요합니다.

현재 백엔드 시작에는 Fleet의 DB·모델·임베딩 준비도 필요합니다. 홈쇼핑만 선택하더라도 독립 서비스로 실행되지는 않습니다.
홈쇼핑은 별도 활성화와 모델·pipeline 설정이 필요합니다. 모델 등록·확장 허용·DB 초기화는 사례별 문서의 절차를 먼저 확인합니다.
특히 기존 DB의 전체 setup은 샘플 값·인덱스·pipeline을 갱신하므로 단순한 인증 오류 해결을 위해 반복하지 않습니다.

Azure 리소스를 준비해야 한다면 [인프라 안내](infra/README.md)를 따릅니다.
리소스 배포와 DB 모델 등록은 별도 단계이며, 배포·모델 호출에는 비용이 발생합니다.
저장소의 Foundry 스크립트가 만드는 Entra ID 전용 리소스와 현재 검증한 DB의 BYOM 인증 제약도 함께 확인합니다.

### 도구 설치

Windows에서는 PowerShell에서 uv를 설치합니다. WinGet을 사용할 수 없으면
[uv 공식 설치 안내](https://docs.astral.sh/uv/getting-started/installation/)를 따릅니다.

```powershell
winget install --id=astral-sh.uv -e
```

macOS에서는 터미널에서 설치합니다.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Node.js를 설치한 뒤 VS Code를 다시 열고 새 터미널에서 확인합니다.
이 안내에서는 Python 3.11을 사용합니다.

```bash
uv --version
node --version
npm --version
uv python install 3.11
```

명령을 찾을 수 없으면 VS Code를 재시작하고 설치 상태와 PATH를 확인합니다.

### 백엔드 환경과 설정

VS Code에서 저장소 최상위 폴더를 열고 운영체제에 맞는 명령을 실행합니다.
`uv sync`는 가상환경과 의존성을 준비하며, 기존 `.env`는 덮어쓰지 않습니다.

Windows PowerShell:

```powershell
Set-Location backend
uv sync --python 3.11 --extra dev
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

macOS Terminal:

```bash
cd backend
uv sync --python 3.11 --extra dev
test -f .env || cp .env.example .env
```

[환경 변수 예제](backend/.env.example)를 기준으로 `.env`에 실제 DB 접속 정보와 모델 설정을 입력합니다.
개별 `AZURE_PG_*` 값 대신 `DATABASE_URL`을 사용할 수 있습니다.
인증 방식·endpoint·deployment·DB 준비의 세부 값은 활용할 사례의 기존 문서를 따릅니다.
키·비밀번호는 소스·채팅·로그에 넣지 않고, 비밀 값이 담긴 `.env`와 가상환경은 Git에 추가하지 않습니다.

가상환경을 직접 활성화할 필요는 없습니다. 이후 Python 명령은 `uv run`으로 실행합니다.
[백엔드 패키지 설정](backend/pyproject.toml)은 개발 도구를 `dev` extra로 정의하므로 `--extra dev`를 지정합니다.
처음 동기화할 때 생성되는 lockfile은 팀의 의존성 버전 관리 정책에 맞춰 관리합니다.

### 앱 실행과 종료

사례별 DB·모델 준비를 마친 뒤 `backend` 터미널에서 실행합니다.

```bash
uv run python -m app.server
```

두 번째 터미널은 저장소 최상위 폴더에서 시작합니다.

Windows PowerShell:

```powershell
Set-Location frontend
npm install
npm run dev
```

macOS Terminal:

```bash
cd frontend
npm install
npm run dev
```

`npm install`은 최초 준비 또는 패키지 변경 시 실행합니다.
다음부터는 DB 초기화나 환경 파일 복사 없이 각 폴더에서 서버 실행 명령만 사용하면 됩니다.
`uv run`은 실행 전에 가상환경·의존성을 확인하고 필요한 변경을 반영합니다.

브라우저에서 `http://127.0.0.1:5173`을 열고 사례를 선택합니다.
백엔드 API 문서는 `http://127.0.0.1:8000/docs`에서 확인합니다.
Vite는 `/api`를 8000번 포트로 전달하므로 두 터미널을 모두 유지합니다.
다른 API 주소를 사용할 때만 `VITE_API_URL`을 지정하며 기본 개발 포트에서는 프론트엔드 환경 파일이 필요하지 않습니다.

종료는 각 터미널에서 **Ctrl+C**를 누릅니다. Windows에서 종료 확인을 요청하면 `Y`와 **Enter**를 입력합니다.

### 연결 문제 확인

- 프론트엔드 연결 실패는 백엔드 터미널과 `http://127.0.0.1:8000/docs`부터 확인합니다.
- 설정·인증 오류는 `.env`와 사례별 문서의 인증·모델 등록 절차를 확인하고 백엔드를 재시작합니다.
  앱 시작 성공이나 health 응답만으로 실제 모델 인증 성공을 판단하지 않습니다.
- PowerShell에서 npm 실행이 제한되면 `npm.cmd run dev`처럼 `npm.cmd`를 사용합니다.
- 기본 포트가 사용 중이면 해당 서버를 실행한 터미널에서 **Ctrl+C**로 종료한 뒤 다시 시작합니다.

## 배포

### GitHub Pages

공개 소개·문서는 [Pages workflow](.github/workflows/pages.yml)가 `main`의 관련 파일 변경 시 게시합니다.
실제 앱·DB·모델 배포와는 별개이며, 사이트에는 HTML·이미지만 포함합니다.
Pages 빌드에는 Node.js 24와 프론트엔드의 기존 의존성을 사용합니다.
생성·검사와 게시 대상은 [문서 안내](docs/README.md#github-pages-생성과-게시)를 따릅니다.

### Azure Container Apps

[Azure Container Apps 배포 안내](infra/README.md#azure-container-apps-배포)에 따라 `azd up`을 실행합니다.
ACR·Container Apps Environment·frontend·backend를 배포하고 HorizonDB는 기존 연결 또는 신규 생성을 선택합니다.
이 흐름은 모델 리소스나 deployment를 만들지 않으므로 사용할 모델 endpoint를 먼저 준비해야 합니다.

기존 DB는 기본적으로 초기화하지 않습니다. DB setup을 명시적으로 요청할 때만 기존 데이터를 갱신합니다.
신규 DB는 최초 백엔드 시작 시 초기 설정을 실행합니다. 방화벽·모델 인증·비용·삭제 범위는 인프라 안내에서 확인합니다.

현재 API는 인증 없는 데모용입니다. backend ingress를 내부로 제한해도 public frontend의 `/api` 프록시가
API를 전달하므로 사용자 인증을 대신하지 않습니다. 운영 적용에는 인증·데이터 접근 권한·마스킹·네트워크 정책이 필요합니다.
HorizonDB Preview의 지원 리전·구독·모델 가용성도 대상 환경에서 다시 확인합니다.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| [frontend](frontend) | 공통 진입과 사례별 업무 화면. 개발 안내는 프론트엔드 README에 정리 |
| [backend/app](backend/app) | FastAPI, DB 연결, 사례별 도구·수집·분석 처리 |
| [database](database) | 사례별 스키마와 번들 데이터 |
| [docs](docs) | 기존 사례 설명·발표자료·검증 기록과 문서 생성기 |
| [infra](infra) | Bicep·PowerShell 인프라 조회·배포 |
| [azd-hooks](azd-hooks), [azure.yaml](azure.yaml) | azd 설정·배포 전후 검사 |

GitHub 저장소는 `kyungtaak/horizondb-use-cases`, 앱의 공통 이름은 HorizonDB Use Cases입니다.
기존 로컬 작업 폴더 `horizon-ship`, API의 `HorizonShip`,
`horizonship-*` 모델 alias, 클라우드 리소스 이름과 API 경로는 호환성을 위해 유지합니다.

## 개발과 문서 검사

백엔드는 `backend`에서 실행합니다.

```bash
uv run --extra dev python -m pytest -q
uv run --extra dev python -m ruff check app tests
```

프론트엔드는 `frontend`에서 실행합니다.

```bash
npm run build
npm run lint
npm run test:commerce
```

문서는 저장소 최상위에서 생성·검사합니다.

```powershell
node docs/build-docs.mjs
node docs/build-docs.mjs --check
```

실행 방법과 테스트 범위는 [프론트엔드 안내](frontend/README.md)와 [문서 안내](docs/README.md)를 참고합니다.
자동 검사와 실제 DB·모델 통합 검증은 구분합니다. 과거 시연 결과를 현재 환경의 성능 보장으로 해석하지 않습니다.

## 문서와 라이선스

발표자료·기술 설명·시연·검증 기록은 [문서 안내](docs/README.md)에서 사례별로 확인합니다.
이 저장소는 [MIT 라이선스](LICENSE)를 따릅니다. 참고 프로젝트의 고정 커밋과 원본 라이선스는
[출처와 라이선스 고지](docs/THIRD-PARTY-NOTICES.md)에 보존했습니다. 고객에게 자료를 공유할 때도 해당 고지를 함께 전달합니다.
