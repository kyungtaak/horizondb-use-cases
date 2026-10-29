import { ArrowRight, Database } from 'lucide-react'
import { USE_CASES } from '../useCases'
import type { UseCaseId } from '../useCases'

export function UseCaseOverview({ onSelect }: { onSelect: (id: UseCaseId) => void }) {
  return (
    <main className="use-case-overview">
      <div className="use-case-content">
        <div className="use-case-eyebrow">HorizonDB · Extensions · AI</div>
        <h1>업무 질문으로 살펴보는 HorizonDB 활용 사례</h1>
        <p className="use-case-lead">
          관계형 데이터와 PostgreSQL 확장, AI 기능을 함께 사용하는 방법을 살펴봅니다.
          사례를 선택해 업무 질문부터 SQL·모델 처리 과정과 결과까지 확인합니다.
        </p>

        <section aria-labelledby="use-cases-heading">
          <div className="use-case-section-heading">
            <h2 id="use-cases-heading">활용 사례</h2>
            <span>업무별 화면에서 기능과 처리 결과를 확인합니다.</span>
          </div>
          <div className="use-case-grid">
            {USE_CASES.map(useCase => (
              <article className="use-case-card" key={useCase.id}>
                <div className="use-case-eyebrow">{useCase.category}</div>
                <h3>{useCase.title}</h3>
                <p className="use-case-subtitle">{useCase.subtitle}</p>
                <p className="use-case-question">“{useCase.question}”</p>
                <p className="use-case-description">{useCase.description}</p>
                <ul className="use-case-tags" aria-label={`${useCase.title} 활용 기능`}>
                  {useCase.capabilities.map(capability => <li key={capability}>{capability}</li>)}
                </ul>
                <button type="button" onClick={() => onSelect(useCase.id)} aria-label={`${useCase.title} 사례 열기`}>
                  사례 열기 <ArrowRight size={16} aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <aside className="use-case-boundary" aria-label="데이터베이스와 AI 모델의 역할">
          <Database size={20} aria-hidden="true" />
          <div>
            <strong>HorizonDB가 맡는 일과 외부 모델이 맡는 일을 구분합니다.</strong>
            <p>
              데이터 저장·SQL 처리·확장 함수와 pipeline은 DB에서 연결합니다.
              실제 모델 추론은 연결된 외부 endpoint에서 실행됩니다.
              PostgreSQL 확장 생태계의 기능과 HorizonDB의 AI 연계 기능을 함께 활용하는 데모입니다.
            </p>
          </div>
        </aside>
        <p className="use-case-footnote">
          사례 소개의 기능 목록은 실시간 연결 상태를 뜻하지 않습니다.
          각 데모는 실제 HorizonDB·모델 설정이 필요하며, 홈쇼핑 사례는 별도로 활성화합니다.
          데이터와 모델 결과, 대기·실패 상태는 해당 사례 화면에서 확인합니다.
        </p>
      </div>
    </main>
  )
}
