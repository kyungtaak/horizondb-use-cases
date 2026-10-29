# HorizonDB Use Cases 문서

HorizonDB의 PostgreSQL 확장과 AI 기능을 업무별로 살펴보는 발표·시연 자료입니다.
공통 이름은 **HorizonDB Use Cases**이며, **Fleet Intelligence**와 **Home Shopping Intelligence**는 개별 사례의 이름입니다.
앱 첫 화면에서 사례를 선택하고, 각 사례에서 업무 질문·기능·처리 과정·결과를 확인합니다.

시연 결과와 측정값은 각 문서에 기록한 검증일 기준입니다. 기존 사례 발표자료의 제목과 캡처는 해당 사례를 설명하는 자료로 유지합니다.
본문과 설명 제목은 한국어로 작성하고 SQL·API·제품 이름은 코드와 같은 표기를 사용합니다.
DB에서 처리하는 SQL·함수·pipeline과 외부 endpoint에서 실행하는 모델 추론을 구분합니다.

[GitHub Pages](https://kyungtaak.github.io/horizondb-use-cases/)는 소개와 정적 문서를 공개하는 사이트입니다.
진입 페이지는 [index.html](index.html)입니다. 실제 DB·AI 시연은 설치 안내에 따라 각자의 Azure 환경에 구성합니다.
기존 검증 환경의 접속 주소는 공유하지 않습니다.

## 공통 안내

| 문서 | 용도 |
| --- | --- |
| [프로젝트 가이드](../README.md) | 프로젝트 목적, 사례 비교, 기능별 역할, 공통 실행·개발 안내 |
| [인프라 가이드](../infra/README.md) | PowerShell·Bicep 사전 조회·배포와 azd Container Apps 배포 |
| [출처와 라이선스](THIRD-PARTY-NOTICES.md) | 참고 프로젝트·고정 커밋·원본 MIT 라이선스 |

현재 두 사례는 같은 앱·백엔드·배포 기반을 사용합니다. 공통 실행 환경에는 Fleet의 설정이 필요하고,
홈쇼핑은 별도 활성화·모델·pipeline 설정이 필요합니다. 사례 선택 기능을 독립 배포나 기능별 연결 검증으로 소개하지 않습니다.

## Fleet Intelligence

공간·정형·의미 조건을 조합하는 배송 검색 사례입니다. **Search Workbench**와 **Agent with Tools**의 두 경로,
PostGIS·pgvector·DiskANN, 임베딩 변경 pipeline과 도구 기반 답변을 설명합니다.

| 문서 | 용도 |
| --- | --- |
| [발표자료 HTML](fleet-intelligence-slides.html) | 본문 13장 + 엔딩 1장 + 참고 4장 |
| [기술 설명 HTML](blog-post.html) | 검색 구조·규칙·모델·DB 설정·API·시연 절차를 포함한 한국어 기술 설명 |
| [기술 설명 Markdown](blog-post.md) | 기술 설명의 원고와 사례별 설정·구현 상세 |
| [슬라이드 Markdown](fleet-intelligence-slides.md) | 발표자료 HTML의 원고 |

## Home Shopping Intelligence

SQL 주문 집계와 AI 댓글 분류·브리핑을 결합하는 사례입니다. 합성 주문·댓글 입력과 실제 모델 결과를 구분하며,
지표 계산은 SQL이, 댓글 분류와 상황 설명은 모델이 맡습니다. 탐지·추천 등 추가 활용 아이디어는 현재 구현과 구분합니다.

| 문서 | 용도 |
| --- | --- |
| [구성·실행·검증 HTML](home-shopping.html) | 브라우저에서 읽는 기존 홈쇼핑 문서 |
| [구성·실행·검증 원고](home-shopping.md) | 활성화·모델·pipeline 설정, 시뮬레이터, SQL 집계, 요구사항별 검증과 남은 작업 |
| [발표자료 HTML](home-shopping-slides.html) | 본문 10장 + 엔딩 1장 + 참고 5장. 고객 니즈, 현재 데모, 처리 구조와 추가 AI 활용 아이디어 |

홈쇼핑 발표자료는 Fleet와 동일한 네이비 표지·Pretendard·밝은 격자 배경·코드 패널·우측 하단 탐색바를 사용합니다. 화면 이미지는 HTML에 포함되어 별도 `media` 폴더 없이 파일 하나로 공유할 수 있습니다. Pretendard는 Fleet와 같은 버전 고정 CDN에서 불러오며, 연결되지 않으면 설치된 한글 폰트로 표시합니다. 별도 테마 전환·인쇄 버튼은 제거했고, 전체 인쇄는 브라우저의 인쇄 기능(Ctrl+P)을 사용합니다. 탐색바 높이를 실제로 측정해 슬라이드 영역에서 제외하며, 좁은 화면에서도 이전·다음·선택·페이지 번호가 잘리지 않게 구성했습니다. 로컬 근거 링크는 저장소 안에서 열 때 유효합니다. 실제 앱 캡처는 2026-10-29, 성능 수치는 2026-10-28의 단일 검증값입니다. Fleet 자료의 기존 파일·배포에는 변경이 없습니다.

## 발표자료 열기와 공유

HTML은 별도 서버 없이 열 수 있습니다. 발표자료는 1920×1080(16:9) 구성으로 화면 크기에 맞춰 전체를 축소합니다. 이전·다음 버튼, 슬라이드 선택, 방향키·Page Up/Down·Home/End로 이동합니다. 작은 화면에서는 가로 보기를 권장하며, 캡처 이미지를 누르면 원본 크기로 열 수 있습니다. 브라우저 인쇄에서는 각 자료의 전체 슬라이드를 장별로 출력합니다.

현재 저장소에는 PDF 파일이 없습니다. PDF가 필요하면 해당 HTML을 연 뒤 브라우저 인쇄에서 PDF로 저장합니다.
고객에게 공유할 때는 [출처와 라이선스 고지](THIRD-PARTY-NOTICES.md)도 함께 전달합니다.

레퍼런스의 네이비 표지, 옅은 격자 배경, 블루·그린·앰버 강조색과 아키텍처·화면·코드 레이아웃을 유지합니다. 한국어 본문은 Pretendard를 사용합니다. 기술 설명 HTML은 기존 스크롤 문서 형식을 유지합니다.

CSS와 JavaScript는 HTML 안에 포함됩니다. 화면 이미지는 `media`의 상대 경로를 사용하므로 공유할 때 함께 전달합니다. [출처와 라이선스 고지](THIRD-PARTY-NOTICES.md)도 함께 전달합니다. Pretendard 폰트는 버전을 고정한 CDN에서 불러오며, 연결할 수 없으면 설치된 한글 폰트를 사용합니다. 앱 캡처에는 OpenStreetMap 지도가 포함되며 원래의 저작자 표시를 유지했습니다.

## 사례 추가 기준

새 사례는 기존 Fleet·홈쇼핑 화면을 변형하기보다 별도 업무 화면으로 추가합니다.
[사례 목록](../frontend/src/useCases.ts)에 ID·이름·업무 질문·기능을 등록하고,
[앱 진입](../frontend/src/App.tsx)에 해당 화면의 이동·상태 유지 동작을 연결합니다. 현재 구조는 런타임 플러그인 프레임워크가 아닙니다.

사례 문서에는 업무 질문, 데이터 입력과 합성 여부, SQL·확장·AI 각각의 역할, 실행·비활성화 방법,
확인 가능한 결과와 근거, 대기·실패 처리, 검증일·검증 범위·미구현 항목을 기록합니다.
각 사례가 모든 확장이나 AI 기능을 사용할 필요는 없습니다. 화면을 추가할 때 기존 사례의 상태 유지와 오류 표시도 확인합니다.

## Fleet 발표자료의 구현·검증 기준

도입부 2장은 하나의 HorizonDB에서 정형·공간·벡터 데이터를 함께 저장하고 조회하는 샘플의 목적을 설명합니다. PostGIS·pgvector·DiskANN과 임베딩 갱신 pipeline의 역할을 표시하고 외부 Foundry는 데이터베이스 경계 밖에 배치했습니다. 3장은 상태·ETA·권역·화물 의미 또는 거리 정렬을 결합하는 세 가지 업무 질문으로 이어집니다. 질문별 조건과 확인 결과는 7~9장에서 설명합니다.

4장의 두 검색 경로 설명 다음에는 5장의 실제 앱 화면이 이어집니다. 6장은 검색에 필요한 정형·PostGIS·vector 컬럼과 테이블 연결만 보여줍니다. 12장의 pipeline 설명 다음에는 13장 ‘고객 데이터로 적용하는 방법’으로 본문 설명을 마칩니다. 검색 대상과 조건, 위치·설명 필드와 정렬, 변경 후 갱신을 고객 업무에 맞추고 대표 질문과 샘플 데이터로 결과를 확인하는 방법을 제시합니다. 14장은 `end`만 표시하는 엔딩이며, 15~18장은 검증·운영 주의사항, 예상 계획, 전체 테이블 구조, Workbench 조작의 참고 자료입니다.

현재 API 경로와 상태 필터 우선순위, ETA 기간, PostGIS 권역·반경 검사, 목적지 거리 정렬, 의미 72%·근접도 28% 정렬을 설명합니다. 원본과 달리 배송과 임베딩은 별도 테이블로 관리하고 기존 `on_change` pipeline을 유지합니다. 모델은 직접 API 또는 DB 함수로 호출하지만 실제 추론은 외부 Foundry에서 실행됩니다.

실행 내역은 요청별 SQL·바인딩 값·임베딩 입력을 표시합니다. 실행 계획은 선택적 `EXPLAIN (FORMAT JSON)` 예상 계획입니다. CodeMirror의 SQL 보기, 노드 선택에 따른 SQL 범위 강조, 6:4 가변 분할도 포함했습니다. 실제 실행 시간·buffer·WAL 통계로 소개하지 않습니다.

7~9장은 독립적인 복합 질의 세 가지를 질문 → 조건 → SQL 발췌 → 확인 결과 순서로 설명합니다. 리튬 배터리·상태·ETA·Asia 출발 검색, 반도체·Singapore 반경·가중 정렬, Asia 출발 지연 배송의 목적지 거리순 상위 2건입니다. SQL은 현재 Repository에서 핵심 조건·계산·정렬을 발췌한 것으로 전체 실행문이 아니며, 결과는 2026-09-15의 이전 실제 검증 기록입니다. 이번 문서 재구성에서 모델을 다시 호출하지 않았습니다.

10장은 model registry와 `azure_ai.generate`, `azure_openai.create_embeddings`, pipeline의 `ai.embed` 역할 및 외부 Foundry 경계를 설명합니다. 11장은 8장의 반도체 질문을 조건 해석 → Python 검색 도구 → 답변 생성으로 연결합니다. 12장은 검색 요청과 별개인 데이터 변경 흐름을 설명합니다. shipments trigger가 의미 필드 변경을 골라 job을 upsert하고, job의 on_change pipeline이 임베딩을 갱신합니다. 현재 청킹 단계는 없고 배송별 벡터 하나를 만듭니다. 좌표·ETA만 변경하면 새 임베딩을 요청하지 않으며 content version이 맞는 벡터만 의미 검색에 사용합니다.

`media/fleet-overview.png`, `media/fleet-eta-result.png`, `media/fleet-query-plan.png`는 현재 앱에서 캡처한 실제 화면입니다. 질의 설명용으로 추가한 `media/fleet-eta-sql.png`와 `media/fleet-weighted-sql.png`는 각각 해당 질의를 실제로 실행한 뒤 SQL·바인딩 패널 또는 SQL 영역을 잘라 캡처했습니다. 합성 결과나 원본 저장소의 캡처를 현재 화면으로 사용하지 않았습니다. 기존 기술 설명 문서의 이미지는 변경하지 않았습니다.

기본 ETA 질의의 [결과 화면](media/fleet-eta-result.png), [SQL·바인딩 패널](media/fleet-eta-sql.png), [조건 확대 캡처](media/fleet-eta-conditions.png)를 보존했습니다. 조건 확대 캡처는 SQL·바인딩 패널의 조건 부분만 잘라 확대한 이미지입니다. 해당 질의는 리튬 배터리·Asia 조건을 포함하지 않으므로 7장의 복합 질의 결과나 바인딩 값으로 소개하지 않습니다. 8장 반도체 질의의 [실제 SQL 캡처](media/fleet-weighted-sql.png)도 확인할 수 있습니다.

## 출처와 라이선스

[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)에 출처, 참고한 커밋과 원본 MIT 라이선스를 보존했습니다. 원본 문서·이미지의 중복 보관본은 제거했으며, 발표자료에 사용하는 CSS는 [slides-base.css](slides-base.css)에 내용 변경 없이 분리했습니다. 원문과 원본 이미지는 고지 문서의 고정 커밋 링크에서 확인합니다. 현재 앱의 실제 화면 캡처는 `media`에 유지합니다.

참고본의 `/api/search`, `default-chat`, 단일 테이블 임베딩, `EXPLAIN ANALYZE` 설명은 현재 앱의 검색 흐름과 다릅니다. 이 저장소도 `azd up`·Container Apps 배포를 지원하지만 기존/신규 HorizonDB 선택과 외부 모델 endpoint 사용 등 세부 구성은 [현재 배포 안내](../infra/README.md#azure-container-apps-배포)를 따릅니다. 고객 공유에는 이 폴더의 개정본을 사용합니다.

## 문서 갱신과 검사

저장소 최상위 폴더에서 실행합니다. HTML 생성기는 frontend에 이미 설치된 React·Markdown 도구만 사용하며 앱 번들에 포함되지 않습니다.

```powershell
npm --prefix frontend ci
node docs/build-docs.mjs
node docs/build-docs.mjs --check
```

Markdown 원고를 수정한 뒤 HTML을 다시 생성합니다. 발표자료는 [slides-template.mjs](slides-template.mjs)에서 슬라이드 유형별로 배치하며, [slides-base.css](slides-base.css)를 읽어 결과 HTML에 포함합니다. 원본 HTML이나 보관 폴더 없이 문서를 생성할 수 있습니다. `--check`는 루트·인프라 README와 이 폴더의 문서에 있는 로컬 링크·이미지 존재, 발표자료 18장 구성, 생성 HTML의 최신 상태를 검사합니다. 출처와 라이선스 고지의 로컬 링크도 검사합니다. 코드와 설명의 의미가 일치하는지, 외부 URL이나 페이지 내부 앵커가 유효한지는 자동으로 검사하지 않습니다.

공통 실행은 [프로젝트 README](../README.md), 사례별 설정·시연은 위의 기존 문서를 따릅니다.
Fleet 시연 전에는 대화와 검색 조건을 초기화하고 상태를 `All statuses`로 선택합니다. 채팅에는 화면의 상태 조건이 우선 적용됩니다. 데이터는 2026년 9월의 고정 샘플이므로 슬라이드의 절대 날짜를 사용하며, 모델이 해석한 실제 조건은 실행 내역에서 확인합니다.

## GitHub Pages 생성과 게시

Pages는 앱과 같은 [사례 목록](../frontend/src/useCases.ts)을 사용합니다.
소개 HTML과 기존 홈쇼핑·라이선스 문서의 HTML을 생성하며, 새 가이드 원고를 추가하지 않습니다.
사이트는 기술 설명·발표자료와 독자 환경의 설치·실행 안내를 제공합니다. 공유 데모 접속 링크는 두지 않습니다.
Pages 빌드는 DB·모델 접속 정보가 필요하지 않습니다.

Node.js 24에서 저장소 최상위 폴더를 기준으로 실행합니다. 의존성은 프론트엔드의 기존 패키지를 사용합니다.

```powershell
node docs/build-pages.mjs
node docs/build-pages.mjs --check
node --test docs/build-pages.test.mjs
```

생성된 진입 파일은 [index.html](index.html)입니다. 게시용 `_site`에는 소개·사례 문서·발표자료·라이선스 HTML과 PNG 이미지만 복사합니다.
문서의 상대 경로 중 게시하지 않는 코드·Markdown은 GitHub 소스 링크로 변환합니다.
소스 코드·환경 파일·비밀 값·개인용 skill은 게시 artifact에 포함하지 않습니다.
`_site`는 빌드 산출물이므로 Git에서 제외합니다.

[Pages workflow](../.github/workflows/pages.yml)는 `main`의 문서·사례 목록 등 관련 변경과 수동 실행을 지원합니다.
저장소의 **Settings → Pages → Source**는 **GitHub Actions**를 사용합니다.
소개·문서 공개는 기존 Container Apps 앱이나 HorizonDB를 재배포하지 않습니다.