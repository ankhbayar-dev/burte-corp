# burte-corporate (simple)

Very small and easy version.

## Install

```bash
npm install
```

## Setup

1. Copy `.env.example` -> `.env`
2. Copy `corporates.example.json` -> `corporates.json`
3. Fill `loginName`, `loginPass`, `startDate`, `journalNo`

## Run

```bash
npm start
```

## How it works

- Runs once on startup.
- Runs every 5 minutes (`CHECK_INTERVAL_MS=300000`).
- Prevents overlap if previous run is still active.
- Separates each transaction as `ORLOGO` / `ZARLAGA` / `UNKNOWN`.
- Writes logs to console and file (`logs/corporate.log` by default).
- Saves each transaction as JSON line to `logs/transactions.ndjson` by default.
- Easy to add new bank:
  - add new file in `banks/`
  - register in `banks/index.js`
