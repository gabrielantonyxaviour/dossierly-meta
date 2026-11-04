# Dossierly

A mobile-first personal AI caseworker for newcomers in Poland. Dossierly helps you prepare for official
appointments, interprets while you talk to the official, reads the letters that follow and counts their deadlines.
It interprets and explains. It never gives legal or medical advice.

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026) on Meta Muse models (Muse Spark,
SAM 3.1, Muse Voice Transcribe).

## Origin

This project is derived from an earlier version built for the Nebius × NVIDIA hackathon. For the Meta build, the
payments, plans and per-user sandbox infrastructure of that version were removed and the model layer is being
moved to Meta's models.

## What is new for Meta

To be filled in.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the values you need
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run typecheck
```

Stack: Next.js 16 with OpenNext on Cloudflare Workers (D1 for accounts and the ledger). Sign-in is by email code.
Cases are stored encrypted in the browser.
