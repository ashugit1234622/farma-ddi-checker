# Farma DDI Checker

AI-Powered Oncology & Pharmacology Platform for Drug-Drug Interaction Analysis.
Built with Node.js, Express, Chart.js, better-sqlite3, and OpenAI.

## Features
- **Drug Search**: Autocomplete search for drugs loaded in the SQLite database.
- **Evidence-Based DDI**: Checks interactions using verified database facts (ADME profiling, enzyme kinetics, etc.).
- **Toxicity Radar Chart**: Visualizes combined hepatotoxicity, nephrotoxicity, cardiotoxicity, and neurotoxicity risks.
- **AI Chatbox**: Ask questions about the interaction directly from the report using OpenAI GPT-4o.

## Setup
1. Run `npm install`
2. Create a `.env` file with `OPENAI_API_KEY=sk-your-api-key`
3. Run `npm run seed` (or `node scripts/seed-expanded.js`) to populate the database.
4. Run `node server.js` to start the server at `http://localhost:3000`.
