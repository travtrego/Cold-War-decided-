# Cold War Decided

A Cold War strategic-crisis simulator built to teach multi-agent AI architecture by making the entire pipeline visible.

## What the player sees

- **Operations tab:** the Chief Agent's final briefing and a human authorization gate.
- **Agent Pipeline tab:** four siloed specialists running in parallel, Chief feedback, one revision per specialist, Counterintelligence review, and final synthesis.
- **After-action review:** Chief scoring, hidden-truth reveal, and the objectively correct player decision.

## Architecture

```text
Submarine ─┐
ELINT ─────┤
Aircraft ──┼─> Chief feedback ─> one revision each ─> Counterintelligence ─> Chief final brief ─> Human decision
HUMINT ────┘
```

The browser orchestrates separate agent calls. Specialist evidence remains siloed. The Chief receives only structured reports, sends one feedback request to each specialist, then uses the revised reports and a red-team review to produce an independent confidence score.

## Modes

### Demo

Works immediately with a five-minute staged run and a **Skip processing** control. The outputs are prebuilt so the architecture can be studied without API cost.

### Live AI

Set `OPENAI_API_KEY` in Vercel. The app calls the OpenAI Responses API through `/api/agent` and runs the specialist stage in parallel. `OPENAI_MODEL` defaults to `gpt-5-mini` and can be changed through an environment variable.

## PDF dossiers

The four included mission PDFs are plain, detailed evidence packages:

- Submarine / sonar
- Radar / ELINT
- Aircraft / weapons technology
- Field intelligence / HUMINT

Additional PDFs can be dropped into the Pipeline tab and assigned to a specific silo before a Live AI run.

## Local preview

Demo mode is a static app:

```bash
python3 -m http.server 3000
```

Open `http://localhost:3000/?speed=fast` for a seven-second development run.

API routes require Vercel Functions (`vercel dev`) or a deployed project.

## Deploy

Import the GitHub repository into Vercel or deploy from the project root. Demo mode requires no environment variables. Add `OPENAI_API_KEY` only when you are ready to pay for live agent calls.
