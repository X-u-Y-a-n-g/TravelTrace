# Security policy

TravelTrace stores personal photos, GPS traces and travel history. Security and privacy are part of
the product, not an afterthought.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's [private vulnerability reporting](https://github.com/X-u-Y-a-N-g/TravelTrace/security/advisories/new)
on the repository. Include:

- affected version and deployment mode (Docker Compose, local development, reverse proxy, …),
- reproduction steps or a proof of concept,
- impact assessment (data exposure, privilege escalation, denial of service, …),
- any suggested mitigation.

You can expect an initial acknowledgement within a few days. Please give maintainers reasonable time
to publish a fix before disclosing the issue.

## Security model

- **Authentication** — JWT (HS256) issued on login; the token is also stored in an `HttpOnly`,
  `SameSite=Lax` cookie so image requests authenticate without JavaScript. `Secure` follows the request
  scheme. Tokens expire after seven days.
- **Authorization** — every trip, photo, place, event, import task and export query is scoped to the
  authenticated user. Unauthorized and missing resources both return `404`.
- **Passwords** — bcrypt with cost 12; 8–72 bytes. No password reset flow exists in v0.1.0.
- **Files** — originals and derivatives are streamed through authenticated endpoints. Derived images
  are re-encoded without EXIF. Path resolution is restricted to the storage root.
- **Uploads** — formats are validated by decoding the bytes (not by extension), with per-file size
  limits and Pillow decompression-bomb protection.
- **Privacy** — reverse geocoding is disabled by default; no analytics or telemetry. Trips are private
  by default.
- **Deduplication** — hashes are scoped per user and never shared across accounts.
- **Injection** — SQL uses SQLAlchemy expressions; API input is validated with Pydantic. Map popups
  use DOM text nodes rather than HTML strings.
- **Headers** — nginx and the API set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer` and a restrictive permissions policy.

## Known limitations in v0.1.0

- No rate limiting, account lockout, email verification, password reset or 2FA.
- Registration is open by default. Close it after creating your accounts.
- No CSRF token for cookie-authenticated state-changing requests; `SameSite=Lax` is the mitigation.
  Bearer-token API clients are unaffected.
- The default Docker deployment serves HTTP on port 8080. TLS must be terminated by a reverse proxy.
- Refresh token rotation and session revocation lists are not implemented; tokens are valid until
  expiry or until the signing key changes.
- Third-party map tiles and the optional geocoding provider receive network requests from the browser
  or server respectively. Choose providers that match your privacy requirements.
- Public sharing pages are not implemented; `unlisted`/`public` only store the intent for future
  releases.

## Deployment checklist

- [ ] `POSTGRES_PASSWORD` and `TRAVELTRACE_SECRET_KEY` are long, unique and stored safely.
- [ ] HTTPS is configured; port 8080 is not exposed directly to the internet.
- [ ] Only ports 80/443 are reachable; PostgreSQL and Redis are private.
- [ ] Registration is disabled after creating accounts.
- [ ] Backups of the database and uploads volume are taken regularly and stored off-host.
- [ ] The demo account/data is not present on a public instance.
- [ ] Map and geocoding providers are appropriate for your traffic and privacy policy.
- [ ] Dependencies are kept up to date (`pip list --outdated`, `npm outdated`).

## Dependencies

Backend and frontend dependencies are pinned with ranges in `backend/pyproject.toml` and
`frontend/package-lock.json`. CI builds and tests the application on every change. Consider enabling
Dependabot or a similar scanner on your fork.

Thank you for helping keep TravelTrace users safe.
