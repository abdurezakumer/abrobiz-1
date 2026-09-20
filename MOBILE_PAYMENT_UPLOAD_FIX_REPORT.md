# AbroBiz Mobile Payment-Proof Upload Report

Audit date: 2026-09-20  
Production: `https://abrobiz.com`  
Scope: mobile payment-proof upload diagnosis and safe diagnostics.  
Deployment or Git push: not performed for this report.

## Final status

**ROOT CAUSE NOT YET PROVEN**

The repository confirms separate desktop and mobile upload transports and the complete protected Telegram workflow. It does not contain a real-device Network/Console trace or a matching Supabase Edge Function log, so claiming a phone-specific root cause would be speculation.

## Upload pipeline

```text
Billing file input
  -> image type detection and optional JPEG conversion
  -> binary upload client
  -> authenticated request to telegram-payment-proof
  -> JWT verification
  -> business-owner authorization
  -> rate limiting and pending-payment check
  -> byte-size and file-signature validation
  -> Telegram sendPhoto
  -> telegram_payment_proofs insert
  -> proofId returned to Billing
```

Payment proofs are not stored in Supabase Storage. They are archived through Telegram and referenced by Telegram file/message identifiers.

## Evidence from the repository

### Authentication/session

`RequireOwner` does not render Billing while the AuthProvider is still loading, and it requires an authenticated session before the Billing page is available. This makes an initial page-load session race less likely, but the upload client independently calls `supabase.auth.getSession()` and a mobile background/foreground token race still requires real-device evidence.

### Mobile/desktop difference

- Desktop uses XHR so upload byte progress can be shown.
- Mobile browsers prefer authenticated `fetch` because some mobile browsers expose XHR but fail binary cross-origin uploads.
- The same UUID upload ID is sent on retries to prevent duplicate Telegram/database records.
- Phone images are converted to bounded JPEG when conversion is required; HEIC/HEIF support still depends on the device browser being able to decode the source image.

### CORS

The Edge Function allows the production origins `https://abrobiz.com` and `https://www.abrobiz.com`, plus validated one-label tenant origins. It allows the headers used by the client, including authorization, apikey, content type, business ID, and upload ID. No wildcard authenticated CORS rule was added.

### Backend status semantics

The payment-proof function preserves these categories:

- `400`: malformed request or invalid upload identifiers
- `401`: missing/invalid authentication
- `403`: business is not owned by the authenticated user
- `409`: another payment is already pending review
- `413`: body exceeds 5 MB
- `415`: MIME/signature mismatch
- `429`: rate limit
- `500`: Telegram or database failure
- `503`: missing payment-proof configuration

## Safe diagnostic improvement

The client now preserves the server's safe `X-Request-ID` on upload failures and displays it as a reference in the Billing error message. It never displays authorization headers, tokens, API keys, Telegram credentials, image bytes, or stack traces.

This allows a failed phone request to be matched with the Supabase Edge Function log.

## Why desktop works and mobile does not

This is not proven yet. The two most plausible branches are:

1. Mobile image preparation fails before a network request, especially for HEIC/HEIF or a memory-constrained device.
2. The mobile browser's fetch request fails during authentication, CORS preflight, network transition, or response handling while the desktop XHR path succeeds.

The report cannot distinguish these without the phone's request status and console result.

## Why refresh may change behavior

A refresh may change browser authentication/storage readiness, return the browser to the production asset version, or cause a different image-selection/decoding path. The source does not prove which one occurs. The current auth guards already wait for the initial AuthProvider loading state, so an arbitrary delay was not added.

## Required real-device verification

Run these tests without collecting credentials or tokens:

1. Android Chrome: small JPG under 1 MB.
2. Android Chrome: normal camera JPG.
3. iPhone Safari: JPG.
4. iPhone Safari: HEIC if available.
5. PNG on one mobile browser.
6. Repeat after refresh and after returning from background.

For every failure record:

- phone model and browser;
- file type and approximate size;
- whether the Network tab shows `telegram-payment-proof`;
- whether `OPTIONS` succeeds;
- POST status code;
- `X-Request-ID` response header;
- matching Supabase Edge Function log entry.

Interpretation:

- No request: image preparation or local session state.
- OPTIONS failure: origin/CORS/preflight.
- `401`: session/token state.
- `409`: existing pending payment.
- `413`/`415`: image size or signature.
- `429`: rate limit.
- `500`: Telegram/database path.
- `503`: function configuration.

## Files changed

- `src/lib/uploadClient.ts`: retain safe response request ID on fetch/XHR failures.
- `src/pages/Billing.tsx`: show a safe upload reference when the Edge Function returns one.
- `MOBILE_PAYMENT_UPLOAD_FIX_REPORT.md`: this report.

No authentication, RLS, CORS policy, Telegram architecture, file validation, rate limiting, tenant isolation, or database schema was weakened or changed.

## Validation

The application checks passed after this diagnostic-only change:

- TypeScript typecheck
- 138 Vitest tests
- ESLint with existing warnings and no errors
- Production build

The remaining requirement is real-device verification of the upload request and its corresponding Edge Function log.
