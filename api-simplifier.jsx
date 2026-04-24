/**
 * ============================================================
 * API CONCEPT SIMPLIFIER
 * ============================================================
 * An AI-powered tool that translates API documentation, technical
 * specs, and engineering architecture notes into plain business
 * English — surfacing product opportunities and the PM questions
 * worth asking the engineering team.
 *
 * Architecture overview:
 *  - State machine with 5 states: idle | loading | result | error | invalid
 *  - Single-step AI pipeline with strict JSON output
 *  - Guardrail: content-type validation built into the system prompt
 *    (model returns a structured refusal for non-technical input)
 *  - All AI instructions live in named constant strings (not inline)
 *  - Zero-assumption policy enforced via system prompt
 *
 * Design: Clean, precise, light-theme editorial.
 * Distinct from Metrics Narrator's dark aesthetic — per design
 * skill guidance to never converge on the same aesthetic across tools.
 *
 * Author: Built with Claude (Anthropic)
 * ============================================================
 */

import { useState, useRef } from "react";

// ============================================================
// SECTION 1: CONSTANTS
// All configuration, labels, prompts, and limits are defined here
// as named constants. Nothing is hardcoded inline in logic or JSX.
// ============================================================

// --- Input constraints ---

/**
 * Minimum character count before the Analyze button activates.
 * 80 chars is roughly one minimal endpoint definition:
 * "GET /users/{id} — returns a user object by ID"
 * Below this, there is not enough content to analyze meaningfully.
 */
const MIN_INPUT_LENGTH = 80;

/**
 * Maximum character count for the input textarea.
 * 4000 chars covers large API reference sections without
 * pushing context window usage to uncomfortable levels.
 */
const MAX_INPUT_LENGTH = 4000;

// --- UI copy ---
const TOOL_NAME         = "API Simplifier";
const TOOL_EYEBROW      = "Portfolio Tool · Working Name";
const TOOL_TAGLINE      = "Paste any API doc or engineering spec. Get plain business English, product opportunities, and the right questions to ask your engineering team.";

const INPUT_PLACEHOLDER = `Paste API documentation, an endpoint description, a technical spec, or an engineering architecture note.

Examples of what works well:
• A REST API endpoint with methods, parameters, and responses
• A GraphQL schema or mutation definition
• An engineering architecture note describing a new service
• A webhook payload specification

Tip: The more complete your paste, the more precise the output.`;

/**
 * Disclaimer shown above the textarea.
 * Asks users not to paste internal credentials or PII.
 * UX safeguard only — not a technical content filter.
 */
const DATA_DISCLAIMER = "Do not paste data containing API keys, credentials, personally identifiable information, or confidential internal data.";

// --- Button and action labels ---
const LABELS = {
  analyze:    "Simplify & Analyze",
  analyzing:  "Analyzing...",
  reset:      "Start over",
  copy:       "Copy",
  copied:     "✓ Copied",
  tryAgain:   "Try again",
};

// --- Output section definitions ---
// Each item maps to a key returned in the JSON from the AI.
// Rendered in this order as three side-by-side or stacked cards.
const OUTPUT_SECTIONS = [
  {
    key:         "plainEnglish",
    number:      "01",
    title:       "Plain English",
    description: "What this API or system actually does — no jargon.",
  },
  {
    key:         "productOpportunities",
    number:      "02",
    title:       "Product Opportunities",
    description: "What this enables from a product perspective.",
  },
  {
    key:         "pmQuestions",
    number:      "03",
    title:       "Questions to Ask Engineering",
    description: "The questions a PM should bring to the eng team.",
  },
];

// ============================================================
// SECTION 2: AI SYSTEM PROMPT
// ============================================================

/**
 * SINGLE-STEP PROMPT: API Analysis
 *
 * PURPOSE: Validate input type, then produce a structured
 * three-section analysis of the API or technical content.
 *
 * GUARDRAILS IMPLEMENTED:
 * 1. Input-type enforcement — model must detect and refuse non-technical input
 * 2. No hallucination of endpoints — model must not invent behavior not in input
 * 3. No hallucination of business context — model must not assume industry or company type
 * 4. Partial/incomplete spec handling — model must acknowledge gaps, not fill them in
 * 5. Product opportunities must be directly inferable from the provided content only
 * 6. PM questions must address the specific content, not be generic API questions
 *
 * OUTPUT FORMAT: Strict JSON only. Parsed client-side.
 * The "valid" field is checked first to detect content-type refusals.
 */
const ANALYSIS_SYSTEM_PROMPT = `You are a senior product manager who specializes in translating technical API documentation into clear business language for non-technical stakeholders.

Your job is to analyze API documentation, technical specs, or engineering architecture notes provided by the user.

CRITICAL RULES — follow all without exception:

1. Return ONLY valid JSON. No preamble, no markdown, no backticks, no text outside the JSON object.

2. CONTENT TYPE VALIDATION:
   First, determine whether the input is API documentation, a technical spec, an engineering architecture note, or similar technical content.
   - If it is NOT technical content (e.g., a general question, a personal message, a news article, a creative writing piece):
     Set "valid" to false and set "invalidReason" to a single, specific sentence explaining what was pasted and what the user should provide instead.
   - If it IS technical content:
     Set "valid" to true and "invalidReason" to null.

3. ZERO HALLUCINATION RULE:
   NEVER invent, assume, or extrapolate any API behavior, endpoint, parameter, or response not explicitly stated in the provided content.
   If something is ambiguous or unstated, say so explicitly in the relevant section rather than filling in the gap.

4. NO BUSINESS CONTEXT ASSUMPTIONS:
   Do NOT assume the user's industry, company type, product category, or target user.
   Product opportunities must be based ONLY on what is directly inferable from the provided technical content itself.

5. INCOMPLETE SPEC HANDLING:
   If the input appears to be a partial or incomplete spec (e.g., a mid-sentence cut-off, only parameters with no description):
   - Proceed with what is available
   - Add a note in plainEnglish acknowledging the incompleteness and noting that analysis is based on partial content only

6. PM QUESTIONS must be:
   - Specific to the content provided (not generic questions like "what are the rate limits?")
   - Phrased as things a PM would genuinely ask when deciding whether and how to build a product feature using this API
   - Minimum 3, maximum 6 questions

7. PRODUCT OPPORTUNITIES must be:
   - Concrete and actionable, not vague
   - Directly grounded in the specific capabilities described
   - Minimum 2, maximum 5 opportunities

Return this exact JSON structure and nothing else:
{
  "valid": true,
  "invalidReason": null,
  "plainEnglish": "A clear, jargon-free explanation of what this API or system does. Write for a non-technical product stakeholder. Cover: what it does, how it works at a high level, and any meaningful constraints or requirements called out in the documentation.",
  "productOpportunities": "2 to 5 specific product opportunities this API or system enables, based only on the provided content. Each opportunity on its own line. Do not number them — use a bullet dash.",
  "pmQuestions": "3 to 6 specific questions a PM should ask the engineering team about this API or system. Each question on its own line. Do not number them — use a bullet dash."
}`;

// --- User-facing error messages ---
const ERROR_MESSAGES = {
  /**
   * Shown on network failures or non-OK API responses.
   * Input is always preserved so the user does not lose their work.
   */
  network:
    "Something went wrong connecting to the AI. Your input has been preserved. Please try again.",

  /**
   * Shown if the API returns a response that cannot be parsed as JSON.
   * Rare given the strict JSON instructions, but handled defensively.
   */
  parse:
    "The AI returned an unexpected response format. Please try again.",

  /** Catch-all fallback for unexpected runtime errors */
  generic:
    "An unexpected error occurred. Please try again.",
};

// ============================================================
// SECTION 3: STYLES
// CSS defined as a template literal injected via <style>.
// Uses CSS custom properties for theming consistency.
//
// AESTHETIC DIRECTION: Light, precise, editorial.
// Intentionally distinct from Metrics Narrator's dark amber theme.
// Inspired by well-designed technical documentation — Stripe, Linear.
// Font pairing: Playfair Display (display) + IBM Plex Sans (body).
// Accent: deep ink blue with a warm paper background.
// ============================================================

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400&display=swap');

  /* ---- Design tokens ---- */
  :root {
    --bg:              #F5F2ED;
    --surface:         #FFFFFF;
    --surface-tinted:  #F9F7F4;
    --border:          #DDD9D2;
    --border-strong:   #B8B3AC;
    --accent:          #1A2B4A;
    --accent-mid:      #2E4A7A;
    --accent-light:    #EEF2F8;
    --accent-hover:    #253D66;
    --text-primary:    #1A1714;
    --text-secondary:  #5C5751;
    --text-muted:      #9E9890;
    --text-on-accent:  #FFFFFF;
    --error:           #B03A2E;
    --error-bg:        #FDF3F2;
    --error-border:    #E8B4AF;
    --success:         #1E6B4A;
    --invalid:         #7A4A1A;
    --invalid-bg:      #FDF6EE;
    --invalid-border:  #E8D0A8;
    --radius-sm:       5px;
    --radius:          8px;
    --radius-lg:       12px;
    --font-display:    'Playfair Display', Georgia, serif;
    --font-body:       'IBM Plex Sans', system-ui, sans-serif;
    --font-mono:       'IBM Plex Mono', 'Courier New', monospace;
    --transition:      0.18s ease;
    --shadow-card:     0 1px 3px rgba(26,23,20,0.06), 0 4px 12px rgba(26,23,20,0.04);
    --shadow-focus:    0 0 0 3px rgba(46,74,122,0.15);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body, #root {
    background: var(--bg);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.6;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  /* ---- App shell ---- */
  .app {
    max-width: 760px;
    margin: 0 auto;
    padding: 56px 24px 120px;
  }

  /* ---- Header ---- */
  .header { margin-bottom: 48px; }

  /* Horizontal rule above the eyebrow text */
  .header-rule {
    width: 100%;
    height: 1px;
    background: var(--border);
    margin-bottom: 18px;
  }

  /* Small rule specifically at 32px wide for accent */
  .header-accent-rule {
    width: 32px;
    height: 2px;
    background: var(--accent);
    margin-bottom: 18px;
  }

  .header-eyebrow {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 18px;
  }

  .header-title {
    font-family: var(--font-display);
    font-size: clamp(38px, 6vw, 54px);
    font-weight: 700;
    line-height: 1.05;
    color: var(--accent);
    margin-bottom: 18px;
    letter-spacing: -0.02em;
  }

  /* Italic word in title for typographic character */
  .header-title em {
    font-style: italic;
    font-weight: 400;
    color: var(--accent-mid);
  }

  .header-tagline {
    font-size: 14px;
    font-weight: 300;
    color: var(--text-secondary);
    line-height: 1.75;
    max-width: 520px;
    border-left: 2px solid var(--border-strong);
    padding-left: 16px;
  }

  /* ---- Disclaimer banner ---- */
  .disclaimer {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 11px 16px;
    background: var(--accent-light);
    border: 1px solid rgba(46,74,122,0.15);
    border-radius: var(--radius-sm);
    margin-bottom: 20px;
  }
  .disclaimer-icon { font-size: 11px; color: var(--accent-mid); margin-top: 2px; flex-shrink: 0; }
  .disclaimer-text {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent-mid);
    line-height: 1.55;
  }

  /* ---- Input section ---- */
  .input-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .textarea {
    width: 100%;
    min-height: 220px;
    padding: 18px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 300;
    line-height: 1.8;
    resize: vertical;
    outline: none;
    box-shadow: var(--shadow-card);
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .textarea:focus {
    border-color: var(--accent-mid);
    box-shadow: var(--shadow-focus);
  }
  .textarea::placeholder { color: var(--text-muted); font-size: 13px; line-height: 1.7; }
  .textarea:disabled { background: var(--surface-tinted); cursor: not-allowed; }

  .textarea-meta {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  }
  .char-count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
  }
  .char-count.warn { color: var(--error); }

  /* ---- Loading indicator ---- */
  .loading-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 0 4px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 300;
  }
  .spinner {
    width: 15px;
    height: 15px;
    border: 1.5px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ---- Error block ---- */
  .error-block {
    margin-top: 18px;
    padding: 14px 18px;
    background: var(--error-bg);
    border: 1px solid var(--error-border);
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 300;
    line-height: 1.65;
    color: var(--error);
    animation: fade-in 0.2s ease;
  }
  .error-block strong {
    display: block;
    font-weight: 500;
    margin-bottom: 4px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ---- Invalid content block ---- */
  /* Shown when AI detects input is not API/technical content.
     Visually distinct from the error block (amber vs red). */
  .invalid-block {
    margin-top: 18px;
    padding: 18px 20px;
    background: var(--invalid-bg);
    border: 1px solid var(--invalid-border);
    border-radius: var(--radius);
    animation: fade-in 0.25s ease;
  }
  .invalid-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--invalid);
    margin-bottom: 8px;
  }
  .invalid-message {
    font-size: 14px;
    font-weight: 300;
    color: var(--text-primary);
    line-height: 1.65;
  }

  /* ---- Action row ---- */
  .action-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 20px;
    gap: 0;
  }

  /* Primary button */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: var(--accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: background var(--transition), transform 0.1s ease;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

  /* Ghost reset — text-link style, not a button */
  .btn-reset {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 12px 20px;
    transition: color var(--transition);
  }
  .btn-reset:hover { color: var(--text-secondary); }

  /* ---- Results section ---- */
  .results {
    margin-top: 52px;
    animation: fade-in 0.3s ease;
  }

  /* Eyebrow row above results */
  .results-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 28px;
  }
  .results-eyebrow {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .results-rule {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* Individual result card */
  .result-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 28px 32px 22px;
    margin-bottom: 12px;
    box-shadow: var(--shadow-card);
    transition: border-color var(--transition), box-shadow var(--transition);
    animation: slide-up 0.35s ease both;
  }
  .result-card:nth-child(1) { animation-delay: 0.00s; }
  .result-card:nth-child(2) { animation-delay: 0.07s; }
  .result-card:nth-child(3) { animation-delay: 0.14s; }
  .result-card:hover {
    border-color: var(--border-strong);
    box-shadow: 0 2px 8px rgba(26,23,20,0.08), 0 6px 20px rgba(26,23,20,0.05);
  }

  /* Card top row: number badge + title */
  .card-top {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 14px;
  }

  /* Monospace number badge */
  .card-number {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    color: var(--text-on-accent);
    background: var(--accent);
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.08em;
    flex-shrink: 0;
    margin-top: 3px; /* Optical alignment with title text */
  }

  .card-title-group { flex: 1; }
  .card-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
    margin-bottom: 4px;
  }
  .card-description {
    font-size: 12px;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* Card content area */
  .card-divider {
    height: 1px;
    background: var(--border);
    margin-bottom: 18px;
  }
  .card-body {
    font-size: 14px;
    font-weight: 300;
    color: var(--text-secondary);
    line-height: 1.85;
    white-space: pre-wrap; /* Preserves line breaks from AI output */
  }

  /* Copy button inside each card */
  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 18px;
    padding: 5px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: color var(--transition), border-color var(--transition),
                background var(--transition);
  }
  .copy-btn:hover {
    background: var(--surface-tinted);
    border-color: var(--border-strong);
    color: var(--text-secondary);
  }
  .copy-btn.copied {
    color: var(--success);
    border-color: var(--success);
    background: rgba(30, 107, 74, 0.04);
  }

  /* Results footer */
  .results-footer {
    margin-top: 36px;
    padding-top: 22px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .results-footer-note {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.1em;
  }

  /* ---- Animations ---- */
  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
`;

// ============================================================
// SECTION 4: UTILITY FUNCTIONS
// ============================================================

/**
 * Calls the Anthropic API with a system prompt and user message.
 * Returns a parsed JSON object from the model's response.
 *
 * Any accidental markdown code fences are stripped before JSON.parse()
 * to defend against minor model formatting quirks.
 *
 * @param {string} systemPrompt - The system instruction string
 * @param {string} userMessage  - The content to analyze
 * @returns {Promise<Object>}   - Parsed JSON from the model
 * @throws {Error}              - On network failure, HTTP error, or parse failure
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

  if (!response.ok) {
    throw new Error(`API error: HTTP ${response.status}`);
  }

  const data = await response.json();

  // Concatenate all text blocks from the content array
  const rawText = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Strip markdown code fences that may appear despite JSON-only instructions
  const cleaned = rawText.replace(/```json|```/gi, "").trim();

  return JSON.parse(cleaned);
}

// ============================================================
// SECTION 5: RESULT CARD COMPONENT
// Isolated into its own component so copy-to-clipboard state
// is managed independently per card, not in the parent.
// ============================================================

/**
 * Renders a single analysis output card with a copy button.
 *
 * @param {Object} props
 * @param {string} props.number      - Monospace label e.g. "01"
 * @param {string} props.title       - Card section heading
 * @param {string} props.description - Short descriptor under the heading
 * @param {string} props.content     - AI-generated text to display
 */
function ResultCard({ number, title, description, content }) {
  // Each card manages its own copied state independently
  const [copied, setCopied] = useState(false);

  /**
   * Copies the card's content to the clipboard.
   * Shows "Copied" confirmation for 2 seconds, then resets.
   * Fails silently if the Clipboard API is unavailable.
   */
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail — Clipboard API may not be available in all envs
    }
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
      <button
        className={`copy-btn ${copied ? "copied" : ""}`}
        onClick={handleCopy}
        aria-label={`Copy ${title} to clipboard`}
      >
        {copied ? LABELS.copied : LABELS.copy}
      </button>
    </div>
  );
}

// ============================================================
// SECTION 6: MAIN COMPONENT
// ============================================================

export default function APISimplifier() {

  // ----------------------------------------------------------
  // STATE — single status string as a state machine.
  //
  // Valid states:
  //   idle     — initial state, input form visible
  //   loading  — API call in flight
  //   invalid  — input passed but AI detected non-technical content
  //   result   — analysis complete, output cards rendered
  //   error    — network or parse failure
  //
  // Using a single status enum prevents impossible combinations
  // like status === "loading" AND status === "error" both being true.
  // ----------------------------------------------------------
  const [status, setStatus]       = useState("idle");
  const [inputText, setInputText] = useState("");
  const [outputData, setOutputData] = useState(null);

  // The AI-provided reason when input fails the content-type check
  const [invalidReason, setInvalidReason] = useState("");

  // Error message for network/parse failures
  const [errorMessage, setErrorMessage] = useState("");

  // Ref to scroll the results section into view after render
  const resultsRef = useRef(null);

  // ----------------------------------------------------------
  // CORE ANALYSIS FUNCTION
  // ----------------------------------------------------------

  /**
   * Calls the API with the ANALYSIS_SYSTEM_PROMPT and the user's input.
   * Checks the "valid" field in the response BEFORE rendering output
   * to implement the content-type validation guardrail.
   *
   * Flow:
   *   1. Set status to "loading"
   *   2. Call AI with system prompt + user input
   *   3. If valid === false → set status to "invalid", show reason
   *   4. If valid === true  → set status to "result", render cards
   *   5. On error           → set status to "error", show message
   */
  async function handleSubmit() {
    setStatus("loading");
    setErrorMessage("");
    setInvalidReason("");
    setOutputData(null);

    try {
      const result = await callAnthropicAPI(ANALYSIS_SYSTEM_PROMPT, inputText);

      if (!result.valid) {
        // GUARDRAIL: Input is not API/technical content.
        // Show the model's specific reason rather than a generic message.
        setInvalidReason(
          result.invalidReason ||
          "This does not appear to be API or technical documentation. Please paste an API spec, endpoint description, or engineering architecture note."
        );
        setStatus("invalid");
        return;
      }

      // Valid technical content — render the three output cards
      setOutputData(result);
      setStatus("result");

      // Scroll results into view after React updates the DOM.
      // 120ms gives React time to commit the new render.
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);

    } catch (err) {
      // Distinguish JSON parse errors from network errors for clearer messaging
      const isParseError = err instanceof SyntaxError;
      setErrorMessage(isParseError ? ERROR_MESSAGES.parse : ERROR_MESSAGES.network);
      setStatus("error");
    }
  }

  /**
   * Resets all state to initial idle configuration.
   * Clears input, output, error, and invalid states.
   */
  function handleReset() {
    setStatus("idle");
    setInputText("");
    setOutputData(null);
    setInvalidReason("");
    setErrorMessage("");
  }

  // ----------------------------------------------------------
  // DERIVED STATE
  // ----------------------------------------------------------

  /** True while API call is in flight */
  const isProcessing = status === "loading";

  /**
   * Primary button disabled when:
   * - Input is shorter than the minimum meaningful length, OR
   * - An API call is already in flight
   */
  const isPrimaryDisabled =
    inputText.trim().length < MIN_INPUT_LENGTH || isProcessing;

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <>
      <style>{STYLES}</style>

      <div className="app">

        {/* ---- HEADER ---- */}
        <header className="header">
          {/* Full-width rule above header for visual grounding */}
          <div className="header-rule" aria-hidden="true" />
          <p className="header-eyebrow">{TOOL_EYEBROW}</p>
          <h1 className="header-title">
            API <em>Simplifier</em>
          </h1>
          <p className="header-tagline">{TOOL_TAGLINE}</p>
        </header>

        {/* ============================================================
            INPUT SECTION
            Always visible unless results are showing.
            Stays visible on "invalid" and "error" states so user
            can see their input and make corrections.
        ============================================================ */}
        {status !== "result" && (
          <section aria-label="API documentation input area">

            {/* Data privacy disclaimer */}
            <div className="disclaimer" role="note" aria-label="Data privacy notice">
              <span className="disclaimer-icon" aria-hidden="true">⚠</span>
              <span className="disclaimer-text">{DATA_DISCLAIMER}</span>
            </div>

            {/* Input label + textarea */}
            <label className="input-label" htmlFor="api-input">
              API Documentation or Technical Spec
            </label>
            <textarea
              id="api-input"
              className="textarea"
              value={inputText}
              onChange={(e) =>
                setInputText(e.target.value.slice(0, MAX_INPUT_LENGTH))
              }
              placeholder={INPUT_PLACEHOLDER}
              disabled={isProcessing}
              aria-label="Paste your API documentation or technical specification here"
              aria-describedby="api-char-count"
            />

            {/* Character counter */}
            <div className="textarea-meta">
              <span
                id="api-char-count"
                className={`char-count ${
                  inputText.length > MAX_INPUT_LENGTH * 0.9 ? "warn" : ""
                }`}
              >
                {inputText.length} / {MAX_INPUT_LENGTH}
              </span>
            </div>

            {/* Loading spinner */}
            {isProcessing && (
              <div
                className="loading-row"
                aria-live="polite"
                aria-label="Analyzing your API documentation"
              >
                <div className="spinner" aria-hidden="true" />
                <span>Analyzing documentation...</span>
              </div>
            )}

            {/* GUARDRAIL FEEDBACK: Non-technical content detected */}
            {status === "invalid" && invalidReason && (
              <div className="invalid-block" role="alert">
                <p className="invalid-label">Content type not recognized</p>
                <p className="invalid-message">{invalidReason}</p>
              </div>
            )}

            {/* Error block: network or parse failure */}
            {status === "error" && errorMessage && (
              <div className="error-block" role="alert">
                <strong>Unable to process</strong>
                {errorMessage}
              </div>
            )}

            {/* Action row — hidden during loading */}
            {!isProcessing && (
              <div className="action-row">
                <button
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={isPrimaryDisabled}
                  aria-label="Simplify and analyze the provided API documentation"
                >
                  {LABELS.analyze}
                </button>

                {/* Show reset only when there is something to clear */}
                {(inputText.length > 0 ||
                  status === "invalid" ||
                  status === "error") && (
                  <button
                    className="btn-reset"
                    onClick={handleReset}
                    aria-label="Clear input and start over"
                  >
                    {LABELS.reset}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ============================================================
            RESULTS SECTION
            Shown when status === "result" and outputData is available.
            Three cards animate in with staggered delay.
        ============================================================ */}
        {status === "result" && outputData && (
          <section
            ref={resultsRef}
            className="results"
            aria-label="API analysis results"
          >
            {/* Results eyebrow header */}
            <div className="results-header">
              <span className="results-eyebrow">Analysis complete</span>
              <div className="results-rule" aria-hidden="true" />
            </div>

            {/* Render one card per output section */}
            {OUTPUT_SECTIONS.map((section) => (
              <ResultCard
                key={section.key}
                number={section.number}
                title={section.title}
                description={section.description}
                content={
                  outputData[section.key] ||
                  "No output returned for this section."
                }
              />
            ))}

            {/* Footer: note + reset link */}
            <div className="results-footer">
              <span className="results-footer-note">
                Based solely on provided documentation
              </span>
              <button
                className="btn-reset"
                onClick={handleReset}
                aria-label="Analyze a different API document"
              >
                ← {LABELS.reset}
              </button>
            </div>
          </section>
        )}

      </div>
    </>
  );
}
