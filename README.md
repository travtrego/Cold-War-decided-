# Cold War Decided

A Cold War strategic-crisis simulator built to teach multi-agent AI architecture by making the complete workflow visible.

## Current build

The repository now contains a working static demo:

- **Operations tab** with the Director's brief, Chief assessment, six response options, and after-action review
- **Agent Pipeline tab** with four siloed specialists running in parallel
- One Chief feedback and revision stage
- Counterintelligence red-team review
- Five-minute mission clock with a skip-processing control
- Final player decision, Chief score, and hidden-truth reveal
- Responsive dark command-center interface

Open `index.html` through a static web server or import this repository into Vercel. The launcher reconstructs the self-contained application from the files in `/bundle`.

## Architecture

```text
Submarine ─┐
ELINT ─────┤
Aircraft ──┼─> Chief feedback ─> one revision each ─> Counterintelligence ─> Chief final brief ─> Human decision
HUMINT ────┘
```

## Run locally

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Deploy

The repository includes `vercel.json` and requires no environment variables for demo mode. Import the repository as a static Vercel project with the root directory left unchanged.

## Next phase

The next phase replaces the deterministic training outputs with real model calls while preserving the same visible orchestration, evidence silos, one-revision loop, red-team stage, and human authorization gate.
