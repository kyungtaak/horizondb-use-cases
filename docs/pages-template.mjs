export function createPagesDocument({ cases, renderDocument, escape, repositoryUrl, installationUrl }) {
  const css = `
body{background:var(--cp-bg);font-family:"Segoe UI",Aptos,Calibri,-apple-system,BlinkMacSystemFont,sans-serif}
.site-header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px 32px}
.site-brand{display:flex;align-items:center;gap:12px;color:var(--cp-text);text-decoration:none}
.site-mark{display:grid;place-items:center;flex:0 0 40px;height:40px;border-radius:10px;background:var(--cp-accent-soft);color:var(--cp-accent);font-weight:750}
.site-brand strong{display:block;font-size:19px;line-height:1.4}.site-brand small{display:block;color:var(--cp-text-muted);font-size:11px;letter-spacing:.04em}
.site-navigation{display:flex;align-items:center;gap:20px;flex-wrap:wrap;font-size:14px}.site-navigation a{white-space:nowrap}
.site-content{max-width:1184px;margin:auto;padding:52px 32px 32px}
.site-content h1{max-width:800px;margin:12px 0 20px;font-size:clamp(30px,3.4vw,44px);text-wrap:balance;letter-spacing:-.03em}
.site-lead{max-width:780px;color:var(--cp-text-muted);font-size:17px}
.site-section-heading{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin:36px 0 16px}
.site-section-heading h2{margin:0;font-size:22px}.site-section-heading p{margin:0;color:var(--cp-text-soft);font-size:13px}
.case-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.case-card{min-width:0;display:flex;flex-direction:column;align-items:flex-start;padding:28px;border:1px solid var(--cp-border);border-radius:16px;background:var(--cp-surface)}
.case-category{color:var(--cp-accent);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.case-card h3{margin:12px 0 8px;font-size:25px;letter-spacing:-.025em}.case-subtitle{color:var(--cp-accent);font-size:14px}
.case-question{font-size:19px;line-height:1.65}.case-description{color:var(--cp-text-muted);font-size:14px}
.case-tags{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:auto 0 24px}
.case-tags li{padding:4px 10px;border:1px solid var(--cp-border);border-radius:10px;background:var(--cp-surface-soft);color:var(--cp-text-muted);font-size:12px}
.case-links{display:flex;flex-wrap:wrap;gap:12px}.site-button{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 16px;border:1px solid var(--cp-border);border-radius:10px;background:var(--cp-surface);color:var(--cp-text);font-size:14px;font-weight:600;text-decoration:none}
.site-button.primary{background:var(--cp-accent);border-color:var(--cp-accent);color:var(--cp-accent-fg)}.site-button.primary:hover{background:var(--cp-accent-hover)}
.site-boundary{margin:28px 0;padding:20px 24px;border-left:3px solid var(--cp-accent);border-radius:0 10px 10px 0;background:var(--cp-accent-soft);font-size:14px}
.site-boundary h2{font-size:17px;margin:0 0 8px}.site-boundary p{margin:0;color:var(--cp-text-muted)}
.site-live{padding:24px;border:1px solid var(--cp-border);border-radius:16px;background:var(--cp-surface)}
.site-live h2{font-size:22px;margin:0 0 12px}.site-live p{color:var(--cp-text-muted);font-size:14px}
.site-footnote{font-size:12px;color:var(--cp-text-soft)}.site-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-top:32px;padding-top:20px;border-top:1px solid var(--cp-border);font-size:13px;color:var(--cp-text-muted)}
@media(max-width:760px){.site-header{padding:16px 20px;align-items:flex-start;flex-direction:column;gap:16px}.site-navigation{gap:16px}.site-content{padding:32px 20px 24px}.case-grid{grid-template-columns:minmax(0,1fr)}.case-card{padding:24px}.site-section-heading{align-items:flex-start;flex-direction:column;gap:8px}}
`
  const cards = cases.map(useCase => `
<article class="case-card" aria-labelledby="${escape(useCase.id)}-title">
  <div class="case-category">${escape(useCase.category)}</div>
  <h3 id="${escape(useCase.id)}-title">${escape(useCase.title)}</h3>
  <p class="case-subtitle">${escape(useCase.subtitle)}</p>
  <p class="case-question">“${escape(useCase.question)}”</p>
  <p class="case-description">${escape(useCase.description)}</p>
  <ul class="case-tags" aria-label="${escape(useCase.title)} 활용 기능">${useCase.capabilities.map(capability => `<li>${escape(capability)}</li>`).join('')}</ul>
  <div class="case-links">
    <a class="site-button primary" href="${escape(useCase.presentation)}" aria-label="${escape(useCase.title)} Presentation">Presentation</a>
  </div>
</article>`).join('')

  return renderDocument('HorizonDB Use Cases', css, `
<header class="site-header">
  <a class="site-brand" href="index.html"><span class="site-mark" aria-hidden="true">H</span><span><strong>HorizonDB Use Cases</strong><small>PostgreSQL extensions &amp; AI in practice</small></span></a>
  <nav class="site-navigation" aria-label="사이트 메뉴">
    <a href="#use-cases">활용 사례</a>
    <a href="${escape(repositoryUrl)}">GitHub</a>
    <a class="site-button" href="${escape(installationUrl)}">직접 설치하기</a>
  </nav>
</header>
<main class="site-content">
  <div class="eyebrow">HorizonDB · Extensions · AI</div>
  <h1>업무 질문으로 살펴보는 HorizonDB 활용 사례</h1>
  <p class="site-lead">관계형 데이터와 PostgreSQL 확장, AI 기능을 함께 사용하는 방법을 살펴봅니다. 사례를 선택해 업무 질문부터 SQL·모델 처리 과정과 확인 결과까지 읽어볼 수 있습니다.</p>
  <section id="use-cases" aria-labelledby="use-cases-heading">
    <div class="site-section-heading"><h2 id="use-cases-heading">활용 사례</h2><p>각 사례의 Presentation에서 활용 흐름과 구성을 확인합니다.</p></div>
    <div class="case-grid">${cards}</div>
  </section>
  <aside class="site-boundary" aria-labelledby="boundary-heading">
    <h2 id="boundary-heading">HorizonDB가 맡는 일과 외부 모델이 맡는 일을 구분합니다.</h2>
    <p>데이터 저장·SQL 처리·확장 함수와 pipeline은 DB에서 연결합니다. 실제 모델 추론은 연결된 외부 endpoint에서 실행됩니다. PostgreSQL 확장 생태계의 기능과 HorizonDB의 AI 연계 기능을 함께 활용하는 데모입니다.</p>
  </aside>
  <section class="site-live" aria-labelledby="live-heading">
    <h2 id="live-heading">내 환경에서 데모 실행</h2>
    <p>이 Pages 사이트는 소개와 문서만 제공합니다. 실제 시연은 설치·배포 안내에 따라 각자의 Azure 환경에 HorizonDB·모델·앱을 구성해 실행합니다. 공유 데모 접속 주소는 제공하지 않습니다. 클라우드 리소스와 모델 호출에는 비용이 발생할 수 있습니다.</p>
    <a class="site-button primary" href="${escape(installationUrl)}">설치·실행 안내 →</a>
  </section>
  <p class="site-footnote">기능 목록은 실시간 서비스 상태나 성능 보장을 뜻하지 않습니다. 합성 입력과 모델 결과, 검증일·검증 범위·미구현 항목은 각 사례 문서에서 구분합니다. Pages를 여는 것만으로 업무 API나 AI 모델을 호출하지 않습니다.</p>
  <footer class="site-footer"><span>HorizonDB Use Cases</span><span><a href="THIRD-PARTY-NOTICES.html">출처와 라이선스</a> · <a href="${escape(repositoryUrl)}/blob/main/README.md">실행·개발 안내</a></span></footer>
</main>`)
}
