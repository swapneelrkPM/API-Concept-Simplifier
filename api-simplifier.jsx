/**
 * ============================================================
 * KONTXT
 * ============================================================
 * An AI-powered tool that translates API documentation, technical
 * specs, and engineering architecture notes into plain business
 * English — surfacing product opportunities and the PM questions
 * worth asking the engineering team.
 *
 * UI Version 3:
 *  - Eyebrow: "Working Name" removed, now reads "AI Portfolio Tool"
 *  - Color palette: warm earthy tones extracted from reference image
 *    #1F131D (dark bg) · #D25D21 (burnt orange) · #AD774E (caramel)
 *    #FBFBFB (near white) · #67998D (muted teal) · #90391F (deep rust)
 *  - Fonts: Cormorant Garamond (display) + DM Sans (body)
 *
 * Architecture:
 *  - State machine: idle | loading | result | error | invalid
 *  - Single-step AI pipeline with strict JSON output
 *  - Content-type validation guardrail in system prompt
 *  - Zero-assumption policy enforced via system prompt
 *
 * Author: Built with Claude (Anthropic)
 * ============================================================
 */

import { useState, useRef } from "react";

// ============================================================
// SECTION 1: CONSTANTS
// ============================================================

const MIN_INPUT_LENGTH = 80;
const MAX_INPUT_LENGTH = 4000;

const TOOL_EYEBROW = "AI Portfolio Tool";
const TOOL_TAGLINE = "Paste any API doc or engineering spec. Get plain business English, product opportunities, and the right questions to ask your engineering team.";

const INPUT_PLACEHOLDER = `Paste API documentation, an endpoint description, a technical spec, or an engineering architecture note.

Examples of what works well:
• A REST API endpoint with methods, parameters, and responses
• A GraphQL schema or mutation definition
• An engineering architecture note describing a new service
• A webhook payload specification

Tip: The more complete your paste, the more precise the output.`;

const DATA_DISCLAIMER = "Do not paste data containing API keys, credentials, personally identifiable information, or confidential internal data.";

const LABELS = {
  analyze: "Simplify & Analyze",
  reset:   "Start over",
  copy:    "Copy",
  copied:  "✓ Copied",
};

const OUTPUT_SECTIONS = [
  { key: "plainEnglish",         number: "01", title: "Plain English",               description: "What this API or system actually does — no jargon."       },
  { key: "productOpportunities", number: "02", title: "Product Opportunities",        description: "What this enables from a product perspective."            },
  { key: "pmQuestions",          number: "03", title: "Questions to Ask Engineering", description: "The questions a PM should bring to the eng team."         },
];

// ============================================================
// SECTION 2: AI SYSTEM PROMPT
//
// GUARDRAILS:
//  1. Content-type validation — rejects non-technical input
//  2. Zero hallucination — no invented behavior
//  3. No business context assumptions
//  4. Incomplete spec acknowledgment
//  5. Specific PM questions (not generic)
//  6. Grounded product opportunities only
// ============================================================
const ANALYSIS_SYSTEM_PROMPT = `You are a senior product manager who specializes in translating technical API documentation into clear business language for non-technical stakeholders.

CRITICAL RULES — follow all without exception:

1. Return ONLY valid JSON. No preamble, no markdown, no backticks, no text outside the JSON object.

2. CONTENT TYPE VALIDATION:
   - If input is NOT technical content: set "valid" to false and "invalidReason" to one specific sentence.
   - If it IS technical content: set "valid" to true and "invalidReason" to null.

3. ZERO HALLUCINATION: Never invent API behavior not explicitly stated. Flag ambiguity explicitly.

4. NO ASSUMPTIONS: Do not assume industry, company type, or target user.

5. INCOMPLETE SPECS: Proceed with available content but acknowledge incompleteness in plainEnglish.

6. PM QUESTIONS: Specific to this content. Min 3, max 6.

7. PRODUCT OPPORTUNITIES: Concrete, grounded in stated capabilities only. Min 2, max 5.

Return this exact JSON and nothing else:
{
  "valid": true,
  "invalidReason": null,
  "plainEnglish": "Clear, jargon-free explanation for a non-technical stakeholder.",
  "productOpportunities": "2-5 opportunities, each on its own line with a bullet dash.",
  "pmQuestions": "3-6 specific questions, each on its own line with a bullet dash."
}`;

const ERROR_MESSAGES = {
  network: "Something went wrong connecting to the AI. Your input has been preserved. Please try again.",
  parse:   "The AI returned an unexpected response format. Please try again.",
};

// ============================================================
// SECTION 3: STYLES
//
// Palette (extracted from reference image):
//   #1F131D  Very dark purple-black  → bg
//   #D25D21  Burnt orange            → primary accent / CTA
//   #AD774E  Caramel                 → secondary accent
//   #90391F  Deep rust               → hover
//   #FBFBFB  Near white              → primary text
//   #A3A3A3  Mid grey                → secondary text
//   #67998D  Muted teal              → success
//
// Fonts: Cormorant Garamond (display) + DM Sans (body)
// ============================================================

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

  :root {
    --bg:             #170E15;
    --surface:        #1F131D;
    --surface-raised: #2A1A27;
    --border:         #3A2535;
    --border-caramel: rgba(173,119,78,0.3);
    --orange:         #D25D21;
    --orange-hover:   #90391F;
    --orange-glow:    rgba(210,93,33,0.10);
    --caramel:        #AD774E;
    --caramel-subtle: rgba(173,119,78,0.12);
    --near-white:     #FBFBFB;
    --grey:           #A3A3A3;
    --grey-muted:     #5A5C5C;
    --teal:           #67998D;
    --teal-bg:        rgba(103,153,141,0.08);
    --error:          #C0392B;
    --error-bg:       rgba(192,57,43,0.08);
    --error-border:   rgba(192,57,43,0.25);
    --font-display:   'Cormorant Garamond', Georgia, serif;
    --font-body:      'DM Sans', system-ui, sans-serif;
    --radius-sm:      4px;
    --radius:         8px;
    --radius-lg:      12px;
    --transition:     0.18s ease;
    --shadow-card:    0 1px 4px rgba(0,0,0,0.4), 0 6px 20px rgba(0,0,0,0.25);
    --shadow-focus:   0 0 0 3px rgba(210,93,33,0.25);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body, #root {
    background: var(--bg);
    color: var(--near-white);
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.6;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  .app { max-width: 740px; margin: 0 auto; padding: 56px 24px 100px; }

  /* Gradient top border using palette colors */
  .top-border {
    width: 100%;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--caramel) 20%, var(--orange) 60%, transparent);
    margin-bottom: 52px;
    opacity: 0.6;
  }

  /* Header */
  .header { margin-bottom: 48px; }

  .header-eyebrow {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--caramel);
    margin-bottom: 16px;
  }

  .header-title {
    font-family: var(--font-display);
    font-size: clamp(52px, 10vw, 80px);
    font-weight: 600;
    line-height: 1.0;
    color: var(--near-white);
    margin-bottom: 22px;
    letter-spacing: -0.01em;
  }

  /* Italic burnt-orange "x" — the brand signature */
  .brand-x { color: var(--orange); font-style: italic; }

  .header-tagline {
    font-size: 14px;
    font-weight: 300;
    color: var(--grey);
    line-height: 1.8;
    max-width: 500px;
    padding-left: 16px;
    border-left: 2px solid var(--border);
  }

  /* Disclaimer */
  .disclaimer {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 16px;
    background: var(--orange-glow);
    border: 1px solid rgba(210,93,33,0.15);
    border-radius: var(--radius-sm);
    margin-bottom: 22px;
  }
  .disclaimer-icon { font-size: 11px; color: var(--orange); margin-top: 2px; flex-shrink: 0; }
  .disclaimer-text { font-size: 11px; color: var(--grey-muted); line-height: 1.6; }

  /* Input */
  .input-label {
    display: block;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--grey-muted);
    margin-bottom: 10px;
  }

  .textarea {
    width: 100%;
    min-height: 210px;
    padding: 18px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--near-white);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 300;
    line-height: 1.8;
    resize: vertical;
    outline: none;
    box-shadow: var(--shadow-card);
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .textarea:focus { border-color: rgba(210,93,33,0.4); box-shadow: var(--shadow-focus); }
  .textarea::placeholder { color: var(--grey-muted); font-size: 13px; line-height: 1.7; }
  .textarea:disabled { opacity: 0.45; cursor: not-allowed; }

  .textarea-meta { display: flex; justify-content: flex-end; margin-top: 8px; }
  .char-count { font-size: 11px; color: var(--grey-muted); }
  .char-count.warn { color: var(--error); }

  /* Loading */
  .loading-row { display: flex; align-items: center; gap: 12px; padding: 18px 0 4px; color: var(--grey); font-size: 13px; font-weight: 300; }
  .spinner { width: 15px; height: 15px; border: 1.5px solid var(--border); border-top-color: var(--orange); border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Error block */
  .error-block { margin-top: 18px; padding: 14px 18px; background: var(--error-bg); border: 1px solid var(--error-border); border-left: 3px solid var(--error); border-radius: var(--radius); font-size: 13px; font-weight: 300; line-height: 1.65; color: #E88; animation: fade-in 0.2s ease; }
  .error-block strong { display: block; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--error); margin-bottom: 5px; }

  /* Invalid block — caramel, distinct from red error */
  .invalid-block { margin-top: 18px; padding: 16px 20px; background: var(--caramel-subtle); border: 1px solid var(--border-caramel); border-left: 3px solid var(--caramel); border-radius: var(--radius); animation: fade-in 0.25s ease; }
  .invalid-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.18em; color: var(--caramel); margin-bottom: 8px; }
  .invalid-message { font-size: 14px; font-weight: 300; color: var(--grey); line-height: 1.65; }

  /* Buttons */
  .action-row { display: flex; align-items: center; flex-wrap: wrap; margin-top: 20px; }

  .btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 28px; background: var(--orange); color: var(--near-white);
    border: none; border-radius: var(--radius); font-family: var(--font-body);
    font-size: 13px; font-weight: 500; letter-spacing: 0.04em; cursor: pointer;
    transition: background var(--transition), transform 0.1s ease, box-shadow var(--transition);
  }
  .btn-primary:hover:not(:disabled) { background: var(--orange-hover); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(144,57,31,0.4); }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.25; cursor: not-allowed; }

  .btn-reset { background: none; border: none; color: var(--grey-muted); font-family: var(--font-body); font-size: 12px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; padding: 13px 20px; transition: color var(--transition); }
  .btn-reset:hover { color: var(--grey); }

  /* Results */
  .results { margin-top: 52px; animation: fade-in 0.3s ease; }

  .results-header { display: flex; align-items: center; gap: 16px; margin-bottom: 26px; }
  .results-eyebrow { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.22em; color: var(--caramel); white-space: nowrap; }
  .results-rule { flex: 1; height: 1px; background: var(--border); }

  /* Result cards */
  .result-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 26px 30px 22px; margin-bottom: 12px; box-shadow: var(--shadow-card);
    transition: border-color var(--transition), box-shadow var(--transition);
    animation: slide-up 0.35s ease both;
  }
  .result-card:nth-child(1) { animation-delay: 0.00s; }
  .result-card:nth-child(2) { animation-delay: 0.08s; }
  .result-card:nth-child(3) { animation-delay: 0.16s; }
  .result-card:hover { border-color: var(--border-caramel); box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(173,119,78,0.1); }

  .card-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }

  /* Italic serif number badge in caramel */
  .card-number {
    font-family: var(--font-display); font-style: italic; font-size: 13px; font-weight: 600;
    color: var(--caramel); border: 1px solid var(--border-caramel); padding: 3px 9px;
    border-radius: var(--radius-sm); letter-spacing: 0.05em; flex-shrink: 0; margin-top: 3px;
    background: var(--caramel-subtle);
  }

  .card-title-group { flex: 1; }
  .card-title { font-family: var(--font-display); font-size: 22px; font-weight: 600; color: var(--near-white); line-height: 1.15; margin-bottom: 3px; }
  .card-description { font-size: 12px; font-weight: 300; color: var(--grey-muted); line-height: 1.4; }
  .card-divider { height: 1px; background: var(--border); margin-bottom: 16px; }
  .card-body { font-size: 14px; font-weight: 300; color: var(--grey); line-height: 1.85; white-space: pre-wrap; }

  /* Copy button */
  .copy-btn {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 16px;
    padding: 5px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: none; color: var(--grey-muted); font-family: var(--font-body);
    font-size: 11px; font-weight: 400; letter-spacing: 0.05em; cursor: pointer;
    transition: color var(--transition), border-color var(--transition), background var(--transition);
  }
  .copy-btn:hover { background: var(--surface-raised); border-color: var(--border-caramel); color: var(--caramel); }
  .copy-btn.copied { color: var(--teal); border-color: var(--teal); background: var(--teal-bg); }

  /* Results footer */
  .results-footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .results-footer-note { font-size: 11px; color: var(--grey-muted); letter-spacing: 0.08em; }

  @keyframes fade-in  { from { opacity: 0; }                       to { opacity: 1; }             }
  @keyframes slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
`;

// ============================================================
// SECTION 4: API UTILITY
// ============================================================

/**
 * Calls the Anthropic API and returns parsed JSON.
 * Strips markdown fences before parsing as a defensive measure.
 */
async function callAnthropicAPI(systemPrompt, userMessage) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!response.ok) throw new Error(`API error: HTTP ${response.status}`);
  const data = await response.json();
  const raw  = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(raw.replace(/```json|```/gi, "").trim());
}

// ============================================================
// SECTION 5: RESULT CARD COMPONENT
// ============================================================

/**
 * Single analysis output card with independent copy state.
 */
function ResultCard({ number, title, description, content }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="result-card" role="region" aria-label={title}>
      <div className="card-top">
        <span className="card-number" aria-hidden="true">{number}</span>
        <div className="card-title-group">
          <h3 className="card-title">{title}</h3>
          <p className="card-description">{description}</p>
        </div>
      </div>
      <div className="card-divider" aria-hidden="true" />
      <div className="card-body">{content}</div>
      <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy} aria-label={`Copy ${title}`}>
        {copied ? LABELS.copied : LABELS.copy}
      </button>
    </div>
  );
}

// ============================================================
// SECTION 6: MAIN COMPONENT
// ============================================================

export default function Kontxt() {

  // State machine: idle → loading → (result | invalid | error) → idle
  const [status,        setStatus]        = useState("idle");
  const [inputText,     setInputText]     = useState("");
  const [outputData,    setOutputData]    = useState(null);
  const [invalidReason, setInvalidReason] = useState("");
  const [errorMessage,  setErrorMessage]  = useState("");
  const resultsRef = useRef(null);

  async function handleSubmit() {
    setStatus("loading");
    setErrorMessage("");
    setInvalidReason("");
    setOutputData(null);

    try {
      const result = await callAnthropicAPI(ANALYSIS_SYSTEM_PROMPT, inputText);

      if (!result.valid) {
        // GUARDRAIL: content-type check failed
        setInvalidReason(result.invalidReason || "This does not appear to be API or technical documentation. Please paste an API spec, endpoint description, or engineering architecture note.");
        setStatus("invalid");
        return;
      }

      setOutputData(result);
      setStatus("result");
      // 120ms delay lets React commit the DOM update before scrolling
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);

    } catch (err) {
      setErrorMessage(err instanceof SyntaxError ? ERROR_MESSAGES.parse : ERROR_MESSAGES.network);
      setStatus("error");
    }
  }

  function handleReset() {
    setStatus("idle");
    setInputText("");
    setOutputData(null);
    setInvalidReason("");
    setErrorMessage("");
  }

  const isProcessing      = status === "loading";
  const isPrimaryDisabled = inputText.trim().length < MIN_INPUT_LENGTH || isProcessing;

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">

        {/* Gradient top border — brand palette grounding mark */}
        <div className="top-border" aria-hidden="true" />

        {/* Header */}
        <header className="header">
          <p className="header-eyebrow">{TOOL_EYEBROW}</p>
          <h1 className="header-title">
            Kont<span className="brand-x">x</span>t
          </h1>
          <p className="header-tagline">{TOOL_TAGLINE}</p>
        </header>

        {/* Input section — visible in all states except result */}
        {status !== "result" && (
          <section aria-label="API documentation input area">

            <div className="disclaimer" role="note" aria-label="Data privacy notice">
              <span className="disclaimer-icon" aria-hidden="true">⚠</span>
              <span className="disclaimer-text">{DATA_DISCLAIMER}</span>
            </div>

            <label className="input-label" htmlFor="api-input">
              API Documentation or Technical Spec
            </label>
            <textarea
              id="api-input"
              className="textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, MAX_INPUT_LENGTH))}
              placeholder={INPUT_PLACEHOLDER}
              disabled={isProcessing}
              aria-label="Paste your API documentation or technical specification here"
              aria-describedby="api-char-count"
            />

            <div className="textarea-meta">
              <span id="api-char-count" className={`char-count ${inputText.length > MAX_INPUT_LENGTH * 0.9 ? "warn" : ""}`}>
                {inputText.length} / {MAX_INPUT_LENGTH}
              </span>
            </div>

            {isProcessing && (
              <div className="loading-row" aria-live="polite">
                <div className="spinner" aria-hidden="true" />
                <span>Analyzing documentation...</span>
              </div>
            )}

            {/* Guardrail: non-technical content detected */}
            {status === "invalid" && invalidReason && (
              <div className="invalid-block" role="alert">
                <p className="invalid-label">Content type not recognized</p>
                <p className="invalid-message">{invalidReason}</p>
              </div>
            )}

            {/* Network or parse error */}
            {status === "error" && errorMessage && (
              <div className="error-block" role="alert">
                <strong>Unable to process</strong>
                {errorMessage}
              </div>
            )}

            {!isProcessing && (
              <div className="action-row">
                <button className="btn-primary" onClick={handleSubmit} disabled={isPrimaryDisabled} aria-label="Simplify and analyze">
                  {LABELS.analyze}
                </button>
                {(inputText.length > 0 || status === "invalid" || status === "error") && (
                  <button className="btn-reset" onClick={handleReset} aria-label="Clear and start over">
                    {LABELS.reset}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Results section — rendered after successful analysis */}
        {status === "result" && outputData && (
          <section ref={resultsRef} className="results" aria-label="API analysis results">
            <div className="results-header">
              <span className="results-eyebrow">Analysis complete</span>
              <div className="results-rule" aria-hidden="true" />
            </div>
            {OUTPUT_SECTIONS.map((s) => (
              <ResultCard
                key={s.key}
                number={s.number}
                title={s.title}
                description={s.description}
                content={outputData[s.key] || "No output returned for this section."}
              />
            ))}
            <div className="results-footer">
              <span className="results-footer-note">Based solely on provided documentation</span>
              <button className="btn-reset" onClick={handleReset} aria-label="Analyze a different document">
                ← {LABELS.reset}
              </button>
            </div>
          </section>
        )}

      </div>
    </>
  );
}
