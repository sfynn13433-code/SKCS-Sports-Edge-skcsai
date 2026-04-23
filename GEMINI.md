# SKCS AI Sports Edge - Project Stack & Architecture

This document outlines the core technology stack and architecture of the SKCS AI Sports Edge platform.

## Core Stack
* **Backend Framework:** Node.js with Express.js handling API routes, rate limiting, and background cron endpoints.
* **Database & Authentication:** PostgreSQL hosted on Supabase. We utilize Supabase for Auth, Realtime features, and Storage. (Our frontend employs a custom SafeStorage adapter to bypass Intelligent Tracking Prevention).

## Data Pipelines & AI Integration
* **Data Ingestion Waterfall:** A highly resilient, multi-tiered data fetching system (`dataProvider.js`). It pulls live fixtures, odds, and deep context primarily from API-Sports and TheSportsDB, smoothly cascading to fallbacks like Odds API, FootballData.org, SportsData.io, RapidAPI, and CricketData.
* **AI Providers:** The EdgeMind analytical engine leverages the Groq API for rapid, cloud-based match analysis, with a built-in failover to a locally hosted Dolphin model.
* **Prediction Engine:** A sophisticated multi-stage pipeline (`aiPipeline.js`) that calculates baseline probabilities, adjusts for deep contextual risks (weather, injuries, form, boardroom instability), and outputs strict, mathematically-backed risk tiers.
* **ACCA Builder & Conflict Resolution:** Advanced combination logic (`accaBuilder.js`, `conflictEngine.js`) that programmatically constructs single, multi, same-match, and 12-leg Mega Accumulators (ACCAs) while enforcing a strict semantic conflict matrix to prevent paradoxical tickets.

## Deployment Architecture
* **Frontend (Vercel):** Serves the static client-side application (HTML/CSS/JS) directly from the `public/` directory. Deployments are managed via `vercel.json`. The frontend communicates with the backend using dynamically configured absolute URLs (routing to `localhost` for local development and the Render URL in production).
* **Backend (Render):** Hosts the main Node.js/Express server managed via `render.yaml`. It handles rate-limited API routes, database connections, and AI processing. Background tasks are decoupled from internal timers and triggered securely via external services (like cron-job.org) hitting dedicated `/api/cron/*` endpoints to prevent issues with instance sleeping or scaling.