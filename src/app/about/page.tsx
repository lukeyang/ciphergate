import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CipherGate — Zero-Knowledge Policy Enforcement for Customer Centers",
  description:
    "Protect human customer support agents from harassment, threats, and sexual misconduct — without the SaaS provider ever reading a single message. Powered by Google Gemini embeddings and homomorphic encryption.",
};

export default function AboutPage() {
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
            How It Works
          </a>
          <a className="nav-link" href="#why-he">
            Encryption
          </a>
          <a className="nav-link" href="#gemini">
            Gemini
          </a>
          <Link className="nav-cta" href="/">
            Live Demo →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="about-hero">
        <div className="hero-eyebrow">
          <span className="gem-dot" aria-hidden="true" />
          Google DeepMind Hackathon &mdash; Built with Gemini API
        </div>

        <h1>
          The SOC That Protects Your Agents,{" "}
          <span className="hl">Without Reading Their Conversations.</span>
        </h1>

        <p className="hero-sub">
          Human customer support agents face harassment, threats, and sexual
          misconduct every day &mdash; causing burnout and legal risk.
          CipherGate is a{" "}
          <strong>Security Operations Center (SOC)</strong> that screens
          customer messages using Google Gemini embeddings and homomorphic
          encryption, so the{" "}
          <em>SaaS provider never reads a single word of plaintext</em>.
        </p>

        <div className="hero-actions">
          <Link className="btn-primary" href="/">
            ▶&nbsp; Try Live Demo
          </Link>
          <Link className="btn-ghost" href="/monitor">
            SOC Dashboard →
          </Link>
        </div>

        <div className="hero-trust">
          <span className="trust-item">
            <span className="dot" />
            Zero plaintext to SaaS
          </span>
          <span className="trust-item">
            <span className="dot" />
            CKKS homomorphic encryption
          </span>
          <span className="trust-item">
            <span className="dot" />
            Gemini 768-dim embeddings
          </span>
          <span className="trust-item">
            <span className="dot" />
            No secret key on server
          </span>
        </div>
      </section>

      <div className="about-divider" />

      {/* ── Problem ── */}
      <section className="about-section" id="problem">
        <p className="section-label">The Problem</p>
        <h2 className="section-title">
          Human Support Agents Are Unprotected
        </h2>
        <p className="section-body">
          Contact center agents face abusive customers every day &mdash;
          repeated harassment, physical threats, and sexual misconduct. This
          emotional labor causes burnout, high turnover, and serious legal
          exposure. Companies like <strong>GeminiMart</strong> need a way to
          screen messages before they reach an agent &mdash; but current SaaS
          screening tools require sending raw conversations to a third party.
        </p>

        <div className="problem-grid">
          <div className="problem-card bad">
            <p className="problem-card-tag">Status Quo</p>
            <h3>Agents see every abusive message</h3>
            <p>
              Every threat, insult, and sexual remark reaches the agent
              unscreened &mdash; or must be routed through a SaaS vendor who
              can read every word. One breach or rogue employee exposes
              all customer conversations. Compliance becomes a nightmare.
            </p>
          </div>
          <div className="problem-card good">
            <p className="problem-card-tag">CipherGate Approach</p>
            <h3>Screen in ciphertext, protect the agent</h3>
            <p>
              Messages are embedded locally by Gemini, encrypted with CKKS
              homomorphic encryption, and scored by CipherGate in ciphertext.
              The agent only sees clean messages. CipherGate never reads
              plaintext.
            </p>
          </div>
        </div>
      </section>

      <div className="about-divider" />

      {/* ── How it works ── */}
      <section className="about-section" id="how-it-works">
        <p className="section-label">Architecture</p>
        <h2 className="section-title">Five Steps. Zero Knowledge.</h2>
        <p className="section-body">
          The full pipeline from customer message to ALLOW / BLOCK decision,
          with plaintext confined entirely to the customer&apos;s browser.
        </p>

        <div className="flow-steps">
          <div className="flow-step">
            <div className="flow-step-num">1</div>
            <span className="flow-step-icon">💬</span>
            <h4>Customer Message</h4>
            <p>User types or speaks a support request in their browser.</p>
          </div>

          <div className="flow-connector">→</div>

          <div className="flow-step">
            <div className="flow-step-num">2</div>
            <span className="flow-step-icon">🧠</span>
            <h4>Gemini Embedding</h4>
            <p>
              The message is converted to a 768-dimensional semantic vector
              using the Gemini Embedding API &mdash; client-side only.
            </p>
          </div>

          <div className="flow-connector">→</div>

          <div className="flow-step">
            <div className="flow-step-num">3</div>
            <span className="flow-step-icon">🔒</span>
            <h4>CKKS Encryption</h4>
            <p>
              The vector is encrypted with a CKKS homomorphic key stored only
              on the client. Ciphertext is sent to the SaaS policy server.
            </p>
            <span className="step-zk-badge">ZK boundary</span>
          </div>

          <div className="flow-connector">→</div>

          <div className="flow-step">
            <div className="flow-step-num">4</div>
            <span className="flow-step-icon">⚙️</span>
            <h4>Encrypted Scoring</h4>
            <p>
              The server computes dot-product scores against policy profiles
              entirely in ciphertext. No decryption, no plaintext access.
            </p>
            <span className="step-zk-badge">SaaS boundary</span>
          </div>

          <div className="flow-connector">→</div>

          <div className="flow-step">
            <div className="flow-step-num">5</div>
            <span className="flow-step-icon">⚖️</span>
            <h4>Client Decision</h4>
            <p>
              Encrypted scores are returned, decrypted locally, and thresholds
              applied. ALLOW calls Gemini Chat; BLOCK terminates the session.
            </p>
          </div>
        </div>
      </section>

      {/* ── Gemini section ── */}
      <section className="gemini-section" id="gemini">
        <div className="gemini-inner">
          <div className="gemini-copy">
            <p className="section-label">Powered by Google Gemini</p>
            <h2 className="section-title">
              Gemini is the Brain. Encryption is the Shield.
            </h2>
            <p className="section-body">
              CipherGate would not be possible without Gemini&apos;s
              state-of-the-art embedding model. High-dimensional semantic
              vectors capture abuse intent, tone, and context with enough
              fidelity to survive CKKS encryption noise &mdash; low-quality
              embeddings would collapse under it. Gemini is what makes
              zero-knowledge policy enforcement mathematically viable.
            </p>
          </div>

          <div className="gemini-cards">
            <div className="gemini-card">
              <div className="gemini-card-icon">🔢</div>
              <div>
                <h4>Gemini Embedding API</h4>
                <p>
                  Converts raw text into a 768-dimensional semantic vector that
                  captures abuse intent, tone, and context with frontier-model
                  accuracy. This vector feeds the entire zero-knowledge
                  pipeline.
                </p>
                <span className="mono-tag">gemini-embedding-001</span>
              </div>
            </div>

            <div className="gemini-card">
              <div className="gemini-card-icon">💬</div>
              <div>
                <h4>Gemini Chat API</h4>
                <p>
                  When the policy engine returns ALLOW, Gemini generates the
                  actual customer support response. The chat API is never
                  called for blocked sessions &mdash; enforcement gates access.
                </p>
                <span className="mono-tag">gemini-2.5-pro</span>
              </div>
            </div>

            <div className="gemini-card">
              <div className="gemini-card-icon">🏗️</div>
              <div>
                <h4>Semantic Policy Profiles</h4>
                <p>
                  Policy categories (harassment, threat, sexual misconduct) are
                  defined as seed vectors in Gemini&apos;s embedding space,
                  then expanded to 768 dimensions. Scoring is a dot-product
                  &mdash; computable homomorphically.
                </p>
                <span className="mono-tag">CKKS dot-product</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Crypto comparison ── */}
      <section className="about-section" id="why-he">
        <p className="section-label">Why Homomorphic Encryption?</p>
        <h2 className="section-title">
          Other Privacy Techniques Don&apos;t Solve This Problem
        </h2>
        <p className="section-body">
          Each privacy technology makes different trade-offs. Only homomorphic
          encryption allows a third party to compute on data it cannot read
          &mdash; which is exactly what policy enforcement requires.
        </p>

        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Technique</th>
                <th>Hides plaintext from SaaS?</th>
                <th>SaaS can still compute?</th>
                <th>No trusted setup?</th>
                <th>Works on ML vectors?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>TLS / Transport encryption</td>
                <td>
                  <span className="cross">✗</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
              </tr>
              <tr>
                <td>AES at-rest encryption</td>
                <td>
                  <span className="cross">✗</span>
                </td>
                <td>
                  <span className="cross">✗</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="cross">✗</span>
                </td>
              </tr>
              <tr>
                <td>Differential Privacy</td>
                <td>
                  <span className="partial">~</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="partial">~</span>
                </td>
              </tr>
              <tr>
                <td>Secure Multi-Party Computation</td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="cross">✗</span>
                </td>
                <td>
                  <span className="partial">~</span>
                </td>
              </tr>
              <tr>
                <td>Zero-Knowledge Proofs</td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="partial">~</span>
                </td>
                <td>
                  <span className="cross">✗</span>
                </td>
                <td>
                  <span className="cross">✗</span>
                </td>
              </tr>
              <tr className="hl-row">
                <td>✦ CipherGate (CKKS HE)</td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
                <td>
                  <span className="tick">✓</span>
                </td>
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
          CKKS (Cheon-Kim-Kim-Song) is a leveled homomorphic encryption scheme
          optimized for approximate arithmetic over real-valued vectors &mdash;
          a perfect fit for semantic similarity scoring. Implemented via
          TenSEAL.
        </p>
      </section>

      <div className="about-divider" />

      {/* ── Impact stats ── */}
      <section className="about-section" id="impact">
        <p className="section-label">Impact</p>
        <h2 className="section-title">
          Built to Protect Agents and Privacy
        </h2>
        <p className="section-body">
          Customer contact centers employ millions of agents worldwide. Protecting
          them from online abuse &mdash; while preserving customer privacy and
          meeting GDPR, CCPA, and data residency requirements &mdash; is a
          structural challenge. CipherGate solves both simultaneously.
        </p>

        <div className="impact-grid">
          <div className="impact-stat">
            <span className="stat-value">0</span>
            <span className="stat-label">
              Bytes of customer plaintext stored or transmitted to SaaS
            </span>
          </div>
          <div className="impact-stat">
            <span className="stat-value">3</span>
            <span className="stat-label">
              Policy categories enforced in ciphertext: Harassment, Threat,
              Sexual Misconduct
            </span>
          </div>
          <div className="impact-stat">
            <span className="stat-value">768</span>
            <span className="stat-label">
              Semantic dimensions per Gemini embedding — enabling high-accuracy
              encrypted policy scoring
            </span>
          </div>
        </div>
      </section>

      <div className="about-divider" />

      {/* ── CTA ── */}
      <section className="about-cta-section">
        <h2>See It Work in Real Time</h2>
        <p>
          Send a message. Watch the policy engine classify it, compute in
          ciphertext, and decide &mdash; all with the secret key never leaving
          your browser.
        </p>
        <div className="hero-actions">
          <Link className="btn-primary" href="/">
            ▶&nbsp; Open Live Demo
          </Link>
          <Link className="btn-ghost" href="/monitor">
            SOC Dashboard →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="about-footer">
        <span>
          CipherGate &mdash; Google DeepMind Hackathon Demo &mdash; 2026
        </span>
        <span>
          <a href="/">Chat Demo</a>
          &nbsp;&middot;&nbsp;
          <a href="/monitor">SOC Dashboard</a>
          &nbsp;&middot;&nbsp;
          <a href="/about/kr">한국어</a>
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
