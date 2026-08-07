# Cold War Decided

A Cold War strategic-crisis simulator built to teach multi-agent AI architecture by making the complete workflow visible.

## Current build

- **Operations tab:** Director's brief, Chief assessment, six response options, and after-action review
- **Agent Pipeline tab:** four evidence-siloed specialists operating in parallel
- One Chief feedback round and one revision per specialist
- Counterintelligence red-team review before final synthesis
- Human authorization gate, Chief score, and hidden-truth reveal
- Responsive dark command-center interface

## Operating modes

### PDF scenario missions

Select **Load Scenario PDF** (or drop a PDF anywhere on the page), enter the private Live AI access code, and review the extracted scenario before selecting **Use This Scenario**. The server validates and extracts the PDF, then routes facts into isolated Submarine, ELINT, Air, and HUMINT dossiers. Those exact dossiers replace the built-in facts for the next 14-call Live AI mission.

PDFs produced from the included scenario template use deterministic routing. Other text-based PDFs are routed by the configured model. The current limit is 3 MB. Image-only scans are rejected because OCR is not implemented yet. Uploaded bytes are processed transiently and are not stored; the mission ledger records the filename, page count, and SHA-256 fingerprint.

Three ready-to-play PDFs are included under `output/pdf/` and are validated by the test suite.

### Evidence-discipline doctrine

Prompt version `cold-war-pipeline-v4-decisive-chief` requires every report to separate observations, inferences, and assumptions; cite pages or source labels; provide at least two competing hypotheses; and explain the evidence behind confidence changes. It also requires the final Chief to state one primary action, why it is warranted, what to avoid, and the observable triggers for reconsideration. The evaluator measures compliance, decision quality, and scenario-specific benchmark coverage for the three included PDFs. Benchmark expectations are applied only to Counterintelligence and the final Chief, so merely repeating dossier facts does not earn credit.

### Demo — default

Demo mode is deterministic and requires no API key. It presents the complete five-minute teaching pipeline and includes a skip-processing control.

### Live AI — optional and access-protected

Live AI uses the same visible architecture but executes separate model requests for every stage:

1. Four initial specialist reports in parallel
2. Four Chief feedback reports in parallel
3. Four specialist revisions in parallel
4. One Counterintelligence review
5. One final Chief synthesis

That is **14 model requests per complete live run**. Every live call is written to an immutable mission ledger before the UI advances. The interface keeps Live AI locked until OpenAI, access protection, and the database are configured.

Set these Vercel environment variables to enable it:

- `OPENAI_API_KEY` — required; remains server-side
- `LIVE_AI_ACCESS_CODE` — required; use a long random passphrase that only you know
- `OPENAI_MODEL` — optional; defaults to `gpt-5-mini`
- `DATABASE_URL` — required; a server-only Neon Postgres connection string

Never expose the API key, access code, or database URL in browser code.

When Live AI is selected, the browser asks for the access code and keeps it only in that tab's session storage. The code is sent to `/api/agent` in a request header. The server rejects missing or incorrect codes **before** making a paid OpenAI request.

## Mission ledger and review

Each run receives a mission ID and run ID. The database preserves all 14 outputs in order: four initial reports, four Chief feedback packets, four revisions, the Counterintelligence report, and final synthesis. Each record includes prompt doctrine version, model, response ID, latency, token usage, retries, and estimated cost. The protected Run History interface provides audit/review details and evaluator scores for evidence use, specialization, calibration, contradiction detection, clarity, revision quality, and independence.

Cost is an estimate based on constants in `api/agent.js`; update them when model pricing changes. The reproducible rule evaluator is quality-control assistance, not a replacement for human review.

The schema includes a dossier manifest with source types and reserved attachment IDs. This prepares provenance for later PDF upload; upload, extraction, malware scanning, and private file storage are intentionally not implemented yet.

Apply the database migration before deploying:

```bash
npm run migrate
```

## Architecture

```text
Submarine ─┐
ELINT ─────┤
Aircraft ──┼─> Chief feedback ─> one revision each ─> Counterintelligence ─> Chief final brief ─> Human decision
HUMINT ────┘
```

## Run locally

Demo mode can be opened with any static server:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

The Vercel serverless routes require a Vercel-compatible local runtime or deployment.

## Verification

```bash
npm test
```

The test suite checks:

- Bundle byte length and SHA-256 integrity
- Required application markers
- Compatibility between the verified base app and Live AI module
- JavaScript syntax for client, access guard, and serverless files
- Health, configuration, authorization, and successful structured-response API contracts
- Incorrect access codes cannot reach the OpenAI API

GitHub Actions runs these checks on pushes to `main` and on pull requests.

## Deployment

The repository includes `vercel.json`. Demo mode needs no environment variables. Import the repository into Vercel with the root directory unchanged; pushes to `main` trigger production deployments through the connected project.

After adding or changing Vercel environment variables, redeploy the latest production deployment so the serverless functions receive them.
