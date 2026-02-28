import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CipherGate — 고객 센터를 위한 제로 지식 정책 집행 엔진",
  description:
    "고객 지원 상담원을 욕설·위협·성희롱으로부터 보호합니다. SaaS 제공자는 고객 대화를 단 한 마디도 읽지 않습니다. Google Gemini 임베딩과 동형 암호 기술 기반.",
};

export default function AboutKrPage() {
  return (
    <div className="about-shell">
      {/* ── Nav ── */}
      <nav className="about-nav">
        <div className="about-nav-logo">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
              stroke="#00d4aa"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="#00d4aa"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          CipherGate
        </div>
        <div className="about-nav-links">
          <a className="nav-link" href="#how-it-works">
            작동 원리
          </a>
          <a className="nav-link" href="#why-he">
            암호화 기술
          </a>
          <a className="nav-link" href="#gemini">
            Gemini
          </a>
          <Link className="nav-cta" href="/">
            라이브 데모 →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="about-hero">
        <div className="hero-eyebrow">
          <span className="gem-dot" aria-hidden="true" />
          Google DeepMind 해커톤 &mdash; Gemini API 활용 프로젝트
        </div>

        <h1>
          상담원을 보호하는 SOC,{" "}
          <span className="hl">대화를 읽지 않고.</span>
        </h1>

        <p className="hero-sub">
          고객 지원 상담원은 매일 욕설·위협·성희롱에 노출됩니다.
          이는 감정 노동과 법적 리스크로 이어집니다.
          CipherGate는{" "}
          <strong>보안 운영 센터(SOC, Security Operations Center)</strong>{" "}
          SaaS로, Google Gemini 임베딩과 동형 암호화를 활용해{" "}
          <em>SaaS 측 제공자가 평문을 단 한 마디도 보지 못하도록</em>{" "}
          메시지를 선별합니다.
        </p>

        <div className="hero-actions">
          <Link className="btn-primary" href="/">
            ▶&nbsp; 라이브 데모 체험
          </Link>
          <Link className="btn-ghost" href="/monitor">
            SOC 대시보드 →
          </Link>
        </div>

        <div className="hero-trust">
          <span className="trust-item">
            <span className="dot" />
            SaaS에 평문 전송 없음
          </span>
          <span className="trust-item">
            <span className="dot" />
            CKKS 동형 암호화
          </span>
          <span className="trust-item">
            <span className="dot" />
            Gemini 768차원 임베딩
          </span>
          <span className="trust-item">
            <span className="dot" />
            서버에 비밀 키 없음
          </span>
        </div>
      </section>

      <div className="about-divider" />

      {/* ── Problem ── */}
      <section className="about-section" id="problem">
        <p className="section-label">문제 정의</p>
        <h2 className="section-title">
          고객센터 상담원은 지금 무방비 상태입니다
        </h2>
        <p className="section-body">
          콜센터 상담원들은 매일 욕설·위협·성희롱 메시지에 노출됩니다.
          이는 심각한 감정 노동과 높은 이직률, 법적 분쟁을 초래합니다.
          <strong>GeminiMart</strong>와 같은 기업은 메시지가 상담원에게
          전달되기 전에 선별할 수 단이 필요하지만, 현재 SaaS 필터링 툴은
          대화 원문을 제공사 서버로 전송해야 합니다.
        </p>

        <div className="problem-grid">
          <div className="problem-card bad">
            <p className="problem-card-tag">현재 방식</p>
            <h3>상담원이 모든 욕설 메시지를 직접 접합니다</h3>
            <p>
              모든 위협·욕설·성적 표현이 거르지 않고 상담원에게 전달되거나,
              SaaS 벤더가 모든 내용을 읽을 수 있는 채널을 통해 필터링됩니다.
              단 한 번의 침해나 내부자 사고만으로 민감한 대화 전체가
              유출됩니다.
            </p>
          </div>
          <div className="problem-card good">
            <p className="problem-card-tag">CipherGate 방식</p>
            <h3>암호문으로 선별, 상담원 보호</h3>
            <p>
              메시지는 Gemini로 로컬에서 임베딩된 후 CKKS 동형 암호화로
              암호화되어 CipherGate에 전송됩니다. 서버는 암호문 상태로 점수를
              계산합니다. 상담원은 클린한 메시지만 받습니다. CipherGate는
              평문을 읽지 못합니다.
            </p>
          </div>
        </div>
      </section>

      <div className="about-divider" />

      {/* ── How it works ── */}
      <section className="about-section" id="how-it-works">
        <p className="section-label">아키텍처</p>
        <h2 className="section-title">5단계. 제로 지식.</h2>
        <p className="section-body">
          고객 메시지가 ALLOW / BLOCK 판단으로 이어지는 전체 파이프라인.
          평문은 전 구간에서 고객 브라우저 안에만 머뭅니다.
        </p>

        <div className="flow-steps">
          <div className="flow-step">
            <div className="flow-step-num">1</div>
            <span className="flow-step-icon">💬</span>
            <h4>고객 메시지</h4>
            <p>사용자가 브라우저에서 지원 요청을 입력하거나 음성으로 말합니다.</p>
          </div>

          <div className="flow-connector">→</div>

          <div className="flow-step">
            <div className="flow-step-num">2</div>
            <span className="flow-step-icon">🧠</span>
            <h4>Gemini 임베딩</h4>
            <p>
              Gemini Embedding API가 메시지를 768차원 시맨틱 벡터로 변환합니다
              — 클라이언트 전용.
            </p>
          </div>

          <div className="flow-connector">→</div>

          <div className="flow-step">
            <div className="flow-step-num">3</div>
            <span className="flow-step-icon">🔒</span>
            <h4>CKKS 암호화</h4>
            <p>
              벡터는 클라이언트에만 저장된 CKKS 키로 암호화되어 SaaS 정책
              서버로 전송됩니다.
            </p>
            <span className="step-zk-badge">ZK 경계</span>
          </div>

          <div className="flow-connector">→</div>

          <div className="flow-step">
            <div className="flow-step-num">4</div>
            <span className="flow-step-icon">⚙️</span>
            <h4>암호문 스코어링</h4>
            <p>
              서버는 정책 프로파일에 대한 내적(dot-product)을 암호문 상태로 계산합니다.
              복호화 없음, 평문 접근 없음.
            </p>
            <span className="step-zk-badge">SaaS 경계</span>
          </div>

          <div className="flow-connector">→</div>

          <div className="flow-step">
            <div className="flow-step-num">5</div>
            <span className="flow-step-icon">⚖️</span>
            <h4>클라이언트 판단</h4>
            <p>
              암호화된 점수가 반환되면 로컬에서 복호화 후 임계값을 적용합니다.
              ALLOW → Gemini 채팅 호출, BLOCK → 세션 종료.
            </p>
          </div>
        </div>
      </section>

      {/* ── Gemini section ── */}
      <section className="gemini-section" id="gemini">
        <div className="gemini-inner">
          <div className="gemini-copy">
            <p className="section-label">Google Gemini 탑재</p>
            <h2 className="section-title">
              Gemini가 두뇌, 암호화가 방어막.
            </h2>
            <p className="section-body">
              CipherGate는 Gemini의 최첨단 임베딩 모델 없이는 존재할 수 없습니다.
              고차원 시맨틱 벡터는 욕설 의도와 어조를 CKKS 노이즈를 견딜 만큼
              충실하게 포착합니다. 품질 낮은 임베딩은 암호화 도메인에서 작동하지
              않습니다. Gemini가 수학적 실현 가능성을 만들어줍니다.
            </p>
          </div>

          <div className="gemini-cards">
            <div className="gemini-card">
              <div className="gemini-card-icon">🔢</div>
              <div>
                <h4>Gemini Embedding API</h4>
                <p>
                  원문 텍스트를 768차원 시맨틱 벡터로 변환합니다. 욕설 의도,
                  어조, 맥락을 최전선 모델 수준의 정확도로 포착합니다.
                  이 벡터가 제로 지식 파이프라인 전체의 핵심입니다.
                </p>
                <span className="mono-tag">gemini-embedding-001</span>
              </div>
            </div>

            <div className="gemini-card">
              <div className="gemini-card-icon">💬</div>
              <div>
                <h4>Gemini Chat API</h4>
                <p>
                  정책 엔진이 ALLOW를 반환할 때만 Gemini가 실제 고객 지원
                  응답을 생성합니다. 차단된 세션에서는 Chat API가 호출되지
                  않습니다 — 정책이 접근을 제어합니다.
                </p>
                <span className="mono-tag">gemini-2.5-pro</span>
              </div>
            </div>

            <div className="gemini-card">
              <div className="gemini-card-icon">🏗️</div>
              <div>
                <h4>시맨틱 정책 프로파일</h4>
                <p>
                  욕설·위협·성희롱 카테고리를 Gemini 임베딩 공간의 시드 벡터로
                  정의하고 768차원으로 확장합니다. 스코어링은 내적 연산
                  — 동형 암호로 계산 가능합니다.
                </p>
                <span className="mono-tag">CKKS dot-product</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Crypto comparison ── */}
      <section className="about-section" id="why-he">
        <p className="section-label">왜 동형 암호인가?</p>
        <h2 className="section-title">
          다른 프라이버시 기술로는 이 문제를 풀 수 없습니다
        </h2>
        <p className="section-body">
          각 프라이버시 기술은 서로 다른 트레이드오프를 가집니다. 제3자가 데이터를
          읽지 않고 연산할 수 있는 유일한 방법이 동형 암호화입니다 — 정책 집행에
          정확히 필요한 속성입니다.
        </p>

        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>기술</th>
                <th>SaaS에 평문 숨김?</th>
                <th>SaaS가 연산 가능?</th>
                <th>신뢰 설정 불필요?</th>
                <th>ML 벡터에 적용?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>TLS / 전송 암호화</td>
                <td><span className="cross">✗</span></td>
                <td><span className="tick">✓</span></td>
                <td><span className="tick">✓</span></td>
                <td><span className="tick">✓</span></td>
              </tr>
              <tr>
                <td>AES 저장 암호화</td>
                <td><span className="cross">✗</span></td>
                <td><span className="cross">✗</span></td>
                <td><span className="tick">✓</span></td>
                <td><span className="cross">✗</span></td>
              </tr>
              <tr>
                <td>차분 프라이버시</td>
                <td><span className="partial">~</span></td>
                <td><span className="tick">✓</span></td>
                <td><span className="tick">✓</span></td>
                <td><span className="partial">~</span></td>
              </tr>
              <tr>
                <td>다자간 연산 (MPC)</td>
                <td><span className="tick">✓</span></td>
                <td><span className="tick">✓</span></td>
                <td><span className="cross">✗</span></td>
                <td><span className="partial">~</span></td>
              </tr>
              <tr>
                <td>영지식 증명 (ZKP)</td>
                <td><span className="tick">✓</span></td>
                <td><span className="partial">~</span></td>
                <td><span className="cross">✗</span></td>
                <td><span className="cross">✗</span></td>
              </tr>
              <tr className="hl-row">
                <td>✦ CipherGate (CKKS HE)</td>
                <td><span className="tick">✓</span></td>
                <td><span className="tick">✓</span></td>
                <td><span className="tick">✓</span></td>
                <td><span className="tick">✓</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.8rem",
            color: "var(--text-tertiary)",
          }}
        >
          CKKS (Cheon-Kim-Kim-Song)는 실수 벡터의 근사 산술에 최적화된 레벨드
          동형 암호 기법으로, 시맨틱 유사도 스코어링에 완벽히 적합합니다.
          TenSEAL 라이브러리로 구현되었습니다.
        </p>
      </section>

      <div className="about-divider" />

      {/* ── Impact stats ── */}
      <section className="about-section" id="impact">
        <p className="section-label">임팩트</p>
        <h2 className="section-title">상담원과 프라이버시, 모두를 위해</h2>
        <p className="section-body">
          전 세계 콜센터에는 수백만 명의 상담원이 근무합니다.
          온라인 부제로부터 상담원을 보호하면서도,
          GDPR·CCPA·개인정보보호법 등 규제를 충족하고
          SaaS 벤더에 평문이 유출되지 않아야 합니다.
          CipherGate는 두 가지를 동시에 해결합니다.
        </p>

        <div className="impact-grid">
          <div className="impact-stat">
            <span className="stat-value">0</span>
            <span className="stat-label">
              SaaS에 저장·전송되는 고객 평문 바이트
            </span>
          </div>
          <div className="impact-stat">
            <span className="stat-value">3</span>
            <span className="stat-label">
              암호문 상태로 집행되는 정책 카테고리:
              욕설·위협·성희롱
            </span>
          </div>
          <div className="impact-stat">
            <span className="stat-value">768</span>
            <span className="stat-label">
              Gemini 임베딩의 시맨틱 차원 수 — 암호화된 정책 스코어링의
              정확도를 보장
            </span>
          </div>
        </div>
      </section>

      <div className="about-divider" />

      {/* ── CTA ── */}
      <section className="about-cta-section">
        <h2>실시간으로 직접 확인하세요</h2>
        <p>
          메시지를 보내세요. 정책 엔진이 분류하고, 암호문으로 연산하고,
          판단을 내립니다 — 비밀 키는 전 과정에서 브라우저를 떠나지 않습니다.
        </p>
        <div className="hero-actions">
          <Link className="btn-primary" href="/">
            ▶&nbsp; 라이브 데모 열기
          </Link>
          <Link className="btn-ghost" href="/monitor">
            SOC 대시보드 →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="about-footer">
        <span>CipherGate &mdash; Google DeepMind 해커톤 데모 &mdash; 2026</span>
        <span>
          <a href="/">채팅 데모</a>
          &nbsp;&middot;&nbsp;
          <a href="/monitor">SOC 대시보드</a>
          &nbsp;&middot;&nbsp;
          <a href="/about">English</a>
          &nbsp;&middot;&nbsp;
          Powered by{" "}
          <a
            href="https://ai.google.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Gemini
          </a>{" "}
          &amp; TenSEAL
        </span>
      </footer>
    </div>
  );
}
