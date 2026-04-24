# API Concept Simplifier

An AI-powered tool that translates API documentation, technical specs, and engineering architecture notes into plain business English — surfacing product opportunities and the right questions for your engineering team.

Built as a portfolio artifact to demonstrate product thinking, AI tool development, and the PM-engineering collaboration layer.

---

## What It Does

Most product managers, designers, and business stakeholders encounter API documentation they cannot fully interpret. This tool closes that gap in three structured steps:

| Section | What it gives you |
|---|---|
| **Plain English** | What this API or system actually does, with no jargon |
| **Product Opportunities** | What this capability enables from a product perspective |
| **Questions to Ask Engineering** | The specific questions a PM should bring to the eng team |

---

## Who It Is For

- Product Managers who need to understand a technical spec before a discovery or planning meeting
- Designers who want to understand what an API can and cannot do before wireframing
- Business stakeholders reviewing engineering proposals
- PM interview candidates preparing to demonstrate technical fluency

---

## Guardrails

This tool was built with explicit guardrails to ensure output quality and prevent AI hallucination:

| Guardrail | What it protects against |
|---|---|
| **Content type validation** | Non-technical input is detected and rejected with a specific explanation — no analysis runs on a general question or unrelated text |
| **Zero hallucination rule** | The AI is explicitly instructed never to invent, assume, or extrapolate any API behavior not stated in the provided content |
| **No business context assumptions** | The tool does not assume your industry, company type, or product category. Opportunities are grounded only in the provided documentation |
| **Incomplete spec handling** | If the input is partial or cut off, the tool acknowledges the gap explicitly rather than filling it in silently |
| **Specific PM questions** | Questions generated are specific to the content provided, not generic API questions that could apply to anything |

---

## What It Accepts

- REST API endpoint documentation
- GraphQL schemas and mutations
- Engineering architecture notes
- Webhook and event payload specifications
- Any technical spec describing a system's capabilities

---

## How to Use

1. Paste your API documentation or technical spec into the text area
2. Click **Simplify and Analyze**
3. Review the three output sections
4. Use the **Copy** button on any section to paste into a doc, Notion, or Slack

---

## Running the Tool

There are three ways to run this tool depending on your setup.

---

### Option A — Run as a Claude Artifact (Easiest, No Setup Required)

This is the fastest way to try the tool. You only need a Claude.ai account.

1. Go to [claude.ai](https://claude.ai) and sign in
2. Start a new conversation
3. Download `api-simplifier.jsx` from this repo
4. Drag and drop the file into the Claude chat window
5. Type: `Please run this as an artifact`
6. Claude will render the full interactive UI directly in the chat

No API key, no installations, no configuration needed. The tool runs immediately.

> **Note:** Sample inputs to test with are available in `api-simplifier-test-data.md` in this repo.

---

### Option B — Run Locally

**Requirements:**
- A React environment (Create React App, Vite, or equivalent)
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

**Steps:**
1. Clone this repo
2. Place `api-simplifier.jsx` in your React project's `src` folder
3. Import and render the component in your `App.jsx`
4. Add your Anthropic API key as an environment variable

---

### Option C — Deploy as a Live Web App

The component can be deployed as a standalone public URL on Vercel or Netlify. Requires an Anthropic API key configured as an environment variable in your deployment settings.

---

## Testing

A full set of test cases is included in `api-simplifier-test-data.md`. Each test case covers a specific scenario:

| Test | Scenario |
|---|---|
| Test 1 | REST API endpoint with full documentation |
| Test 2 | Engineering architecture note |
| Test 3 | GraphQL schema and mutation |
| Test 4 | Partial or incomplete spec |
| Test 5 | Parameters only, no description |
| Test 6 | Non-technical input (guardrail test) |
| Test 7 | Webhook payload specification |

---

## Tech Stack

- **React** — UI and state management
- **Anthropic API** — Claude Sonnet 4 for analysis
- **CSS custom properties** — theming and design tokens
- **No external UI libraries** — fully self-contained single file

---

## Design Decisions

- **Single-file architecture** — the entire tool lives in one `.jsx` file for portability and simplicity
- **State machine pattern** — UI state is managed as a single status enum (`idle | loading | invalid | result | error`) to prevent impossible state combinations
- **Strict JSON output** — the AI is always instructed to return structured JSON, parsed client-side, so the UI renders predictably
- **Accessibility** — all interactive elements have `aria-label` attributes; loading states use `aria-live` regions; color is never the only status differentiator

---

## About This Project

This tool is part of a broader portfolio of AI-powered product thinking artifacts. It was built to demonstrate:

- Understanding of the PM-engineering collaboration layer
- Ability to translate technical capabilities into product language
- Practical AI product development using the Anthropic API
- Attention to guardrails, edge cases, and output quality — not just the happy path

---

## Author

**Swapneel** — Senior Product Owner working toward Product Manager elevation.
Building in public at [github.com/swapneelrkPM](https://github.com/swapneelrkPM)
