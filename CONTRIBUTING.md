# Contributing to TravelTrace

Thanks for taking the time to improve TravelTrace. This project aims to be a dependable,
privacy-respecting travel journal — small enough to understand, complete enough to use.

## Before you start

- For bugs, open an issue with reproduction steps, expected/actual behaviour, browser and OS.
- For security issues, **do not** open a public issue; follow [SECURITY.md](SECURITY.md).
- For larger features, open an issue first so the design can be discussed.

## Development setup

The full guide is [docs/development.md](docs/development.md). In short:

```bash
python -m venv .venv
. .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -e "backend[dev]"

cd frontend && npm install && cd ..

# API (SQLite, no external services)
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

## Making changes

### Backend

- Keep the layering: routers → services → repositories/processors → models.
- Do not put EXIF parsing, clustering or raw SQL in a route handler.
- Raise `AppError` subclasses (`NotFoundError`, `ConflictError`, …) and let the global handler format
  the response.
- Any schema change needs an Alembic migration:

  ```bash
  cd backend
  alembic revision --autogenerate -m "short description"
  alembic upgrade head
  ```

  Review the generated migration for PostgreSQL-specific types (`geography`, `jsonb`, boolean
  defaults) and verify it on SQLite as well.
- Preserve the privacy model: never expose originals without authorization, never call a third-party
  service during upload, and keep new metadata out of derived images.

### Frontend

- TypeScript strict mode; avoid `any` at API boundaries by extending `src/lib/types.ts`.
- Server state belongs in TanStack Query, not component state.
- Use the shared UI primitives and design tokens rather than ad-hoc colours or spacing.
- Check the layout at 390 px width and with a keyboard.
- New user-visible behaviour should come with a unit test (helpers/components) or an E2E flow.

## Tests and checks

```bash
# Backend
ruff check backend tests
ruff format --check backend tests
python -m pytest

# Frontend
cd frontend
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright test     # with the stack running
```

CI runs all of the above, plus a PostGIS integration test and Docker image builds. Please make sure
your change passes locally before opening a pull request.

## Commit style

Use clear, conventional-style subjects:

```
feat(timeline): allow merging two draft events
fix(photos): restore soft-deleted duplicate on re-upload
docs(deploy): document HTTPS cookie behaviour
```

Keep commits focused. Update `CHANGELOG.md` under `Unreleased` for user-visible changes.

## Pull request checklist

- [ ] The change is described and linked to an issue where applicable.
- [ ] Backend: new tests, migrations and permission checks are included.
- [ ] Frontend: typecheck, lint, unit tests and build pass; responsive layout verified.
- [ ] Privacy and security implications considered.
- [ ] Documentation updated (README, docs, CHANGELOG).
- [ ] No secrets, personal photos or generated build output committed.

## Code of conduct

Be respectful and constructive. Harassment, discrimination and personal attacks are not welcome.
Maintainers may remove content or contributions that violate these expectations.

## License

By contributing, you agree that your contribution is licensed under the project's [MIT License](LICENSE).
