import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CipherGate — 제로 지식 AI 정책 적용 엔진",
  description:
    "AI 고객 지원 시스템에서 대화 내용을 SaaS 제공자에게 노출하지 않고 욕설·위협·성희롱을 탐지합니다. Google Gemini와 동형 암호 기술 기반.",
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
          Google Gemini 해커톤 &mdash; Gemini API 활용 프로젝트
        </div>

        <h1>
          대화 내용을 보지 않고도{" "}
          <span className="hl">정책을 집행하는 AI 고객 지원.</span>
        </h1>

        <p className="hero-sub">
          CipherGate는 Google Gemini 임베딩과 동형 암호화를 결합해,
          정책 서버가 욕설·위협·성희롱을 탐지할 수 있습니다.
          고객의 대화 원문은{" "}
          <em>디바이스 밖으로 절대 전송되지 않습니다.</em>
        </p>

        <div className="hero-actions">
          <Link className="btn-primary" href="/">
            ▶&nbsp; 라이브 데모 체험
          </Link>
          <Link className="btn-ghost" href="/monitor">
            SOC 모니터 →
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
          현재의 AI 고객 지원은 개인정보 리스크 덩어리
        </h2>
        <p className="section-body">
          AI 고객 지원을 도입한 모든 기업은 같은 딜레마에 놓입니다. SaaS 벤더가
          정책을 집행하려면 고객 대화를 처리해야 하고, 그 순간 벤더는 모든 내용을
          읽을 수 있게 됩니다. 규제 기관, 고객, 그리고 대형 구매자들은 이 타협을
          더 이상 수용하지 않습니다.
        </p>

        <div className="problem-grid">
          <div className="problem-card bad">
            <p className="problem-card-tag">현재 방식</p>
            <h3>모든 벤더에 평문이 흘러들어간다</h3>
            <p>
              AI 모더레이션, 독성 필터, 지원 플랫폼 모두 고객 메시지 원문을
              수신합니다. 단 한 번의 침해 또는 내부자 사고만으로 민감한 대화
              전체가 유출됩니다. 컴플라이언스 감사는 악몽이 되고, 신뢰는
              무너집니다.
            </p>
          </div>
          <div className="problem-card good">
            <p className="problem-card-tag">CipherGate 방식</p>
            <h3>암호문 상태로 정책을 집행한다</h3>
            <p>
              고객 메시지는 Gemini를 통해 로컬에서 시맨틱 임베딩으로 변환된 후
              CKKS 동형 암호화로 암호화됩니다. 암호문만 정책 서버로 전송되고,
              서버가 스코어를 계산하면 클라이언트가 판단합니다. 평문은 그 자리에
              그대로 있습니다.
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
              고차원 시맨틱 벡터가 있어야 암호화된 도메인에서 정책 탐지가 작동합니다.
              품질 낮은 임베딩은 CKKS 노이즈에 파묻힙니다. Gemini가 수학적
              실현 가능성을 만들어줍니다.
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
        <h2 className="section-title">프라이버시 우선 엔터프라이즈를 위해</h2>
        <p className="section-body">
          AI 고객 지원은 수십억 달러 규모의 시장입니다. GDPR·CCPA·개인정보보호법
          등 규제 강화는 제로 지식 SaaS에 대한 구조적 수요를 만들고 있습니다.
          CipherGate는 새로운 카테고리를 정의하는 솔루션입니다.
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
            SOC 모니터 →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="about-footer">
        <span>CipherGate &mdash; Google Gemini 해커톤 데모 &mdash; 2025</span>
        <span>
          <a href="/">채팅 데모</a>
          &nbsp;&middot;&nbsp;
          <a href="/monitor">SOC 모니터</a>
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
