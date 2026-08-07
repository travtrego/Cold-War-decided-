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
