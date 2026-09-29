# Play Hub frontend

TanStack Start frontend for the Play Hub FastAPI service.

## Local development

```bash
cp .env.example .env.local
bun install
bun run dev
```

Start `../PlayHub_BE` on port 8000 first. `VITE_API_URL` must include the API prefix, for example
`http://localhost:8000/api/v1`.

## Verification

```bash
bun run test
bunx tsc --noEmit
bun run lint
bun run build
bun run test:e2e
```

`test:e2e` starts an isolated seeded FastAPI server and frontend, then exercises Check-In through
Progress, Super Admin controls, organisation role boundaries, and free-plan gating. It does not
touch the normal local database or upload directory.

Authentication, family registration, session restoration, plan content, children, attempts,
progress, organisations, staff invitations, subscriptions, and media uploads are API-backed.
The persona switcher is disabled unless explicitly enabled for local testing.

## Browser developer tools

Production builds discourage the use of the browser's developer tools: the Inspect, Console and
View Source shortcuts and the right-click menu are blocked (form fields keep theirs, so paste
still works), and the app is covered while DevTools is open. Set `VITE_ALLOW_DEVTOOLS=true` to
switch this off, for example on a staging site, or `VITE_ENABLE_DEVTOOLS_GUARD=true` to try it
under `vite dev`.

This is a deterrent, not a security control: the page runs on the visitor's machine and a
determined person can get around it. Access to data is enforced by the API, and no secret may
be shipped in the frontend. See `src/lib/devtools-guard.ts`.
