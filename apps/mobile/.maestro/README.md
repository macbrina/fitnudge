# Maestro E2E Flows

Run these flows with Maestro against the FitNudge app.

## Prerequisites

- Maestro CLI: `curl -Ls "https://get.maestro.mobile.dev" | bash`
- **App built and installed** – You MUST rebuild the app after adding testIDs (SignupScreen, HomeScreen, etc.). Old builds won't have them.
- Backend running (for signup/login flows)

## Run flows

**Important:** Rebuild and reinstall the app first (`pnpm start` then press `i` for iOS), or flows will fail on `id: username`, `id: todays-goals`, etc.

```bash
# From apps/mobile
export TEST_EMAIL=e2e-test@fitnudge-test.example.com
export TEST_PASSWORD=TestPassword123!
maestro test .maestro/flows/
```

## Environment

For `login.yaml`, set `TEST_EMAIL` and `TEST_PASSWORD`:

```bash
export TEST_EMAIL=e2e-test@fitnudge-test.example.com
export TEST_PASSWORD=TestPassword123!
maestro test .maestro/flows/login.yaml
```

## Email signup and verification

Emails ending with `@fitnudge-test.example.com` are **auto-verified** by the API on signup (no verification code needed). Use this domain for E2E flows so Maestro can complete signup without accessing email.

## Notes

- Selectors (text, id) may need adjustment based on actual UI labels
- Use `maestro studio` to record flows and refine selectors
