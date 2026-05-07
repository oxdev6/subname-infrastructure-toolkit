# Dashboard

Next.js admin dashboard for ENS subname analytics, status lookup, and recent indexed events.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Ensure backend API is running on `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`).
3. Start dashboard:

```bash
npm --workspace dashboard run dev
```

## Features

- Analytics cards (`totalSubnames`, `activeSubnames`, `revokedSubnames`, `uniqueHolders`)
- Subname status lookup (`/subname-status`)
- Recent events table (`/events/recent`)
