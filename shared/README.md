# Shared contract

`openapi.json` is generated from the FastAPI application:

```bash
python scripts/export_openapi.py
```

It is the source of truth for API consumers (including the React client) and can be used to generate
typed clients:

```bash
npx openapi-typescript shared/openapi.json -o frontend/src/lib/schema.d.ts
```

Regenerate the file whenever routes or schemas change, and include it in the same pull request.
