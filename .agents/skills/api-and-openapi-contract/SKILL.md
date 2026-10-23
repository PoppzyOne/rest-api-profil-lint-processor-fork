---
name: api-and-openapi-contract
description: >-
  Guide for modifying the HTTP API mode (-m api), Express routes, ProblemDetails error handling,
  URL validation (SSRF protection), and synchronizing with rap-lp-openapi.yaml. Use this skill
  when changing endpoints in src/routes/, DTOs in src/model/, or the OpenAPI contract in rap-lp-openapi.yaml.
---

# Utveckla och synkronisera HTTP API-läget (`-m api`)

Denna skill beskriver hur RAP-LP:s HTTP API är uppbyggt och hur ändringar i endpoints, felhantering och `rap-lp-openapi.yaml` hålls synkroniserade.

## Översikt över API-läget

1. **Serverkonfiguration (`src/api-mode.ts`)**:
   - Startar Express 5 på `RAP_LP_PORT` (standard `3000`).
   - Exponerar Swagger UI på `/api/v1/docs` och specifikationen på `/api/v1/rap-lp-openapi.yaml`.
   - Registrerar `express-openapi-validator` med `validateRequests: true` och `validateResponses: true` mot `rap-lp-openapi.yaml` (notera att `/api/v1/validation/validatespec` har egen request-validering via `ignorePaths` för skräddarsydd ProblemDetails-felhantering).
2. **Routes (`src/routes/`)**:
   - `src/routes/validate.ts`:
     - `GET /api/v1/validation/rules` – Returnerar `RULE_REGISTRY`.
     - `GET /api/v1/api-info` – Returnerar `ApiInfo` med `apiVersion` från `package.json`.
     - `POST /api/v1/validation/validatespec` – Validerar base64-kodad specifikation (`strict` är `true` som standard).
     - `POST /api/v1/validation/generate-report` – Genererar Excel-avstämningsfil (`.xlsx`) från diagnostikrapport.
   - `src/routes/urlValidation.ts`:
     - `POST /api/v1/validation/url` – Hämtar och validerar specifikation från URL om `--enableUrlValidation` är satt (annars returneras HTTP 409 Conflict via fallback-route).
     - Innehåller SSRF-skydd (`assertSsrfSafeUrl`) som blockerar icke-HTTP(S), omdirigeringar (`redirect: 'error'`), privata IPv4-adresser (`10.x`, `127.x`, `169.254.x`, `172.16-31.x`, `192.168.x`, `0.x`) samt `localhost` (såvida inte `allowLocalhost` / `RAP_LP_ALLOW_LOCALHOST_URL_VALIDATION=true` är aktiverat).
   - `src/routes/health.ts`:
     - `GET /health/live` och `GET /metrics` (Prometheus-metrics från `src/metrics.ts`).
3. **Felhantering och ProblemDetails (`src/model/ProblemDetailsDto.ts`)**:
   - Alla API-fel returneras som `application/problem+json` via `sendProblem` och `errorHandler` i `src/util/RapLPBaseApiErrorHandling.ts` samt `mapValidationExecutionError` i `src/util/mapValidationExecutionError.ts`.

## Checklista vid ändring av API-endpoints

1. **Uppdatera `rap-lp-openapi.yaml`**:
   - Eftersom `express-openapi-validator` har `validateResponses: true` aktiverat kommer ändringar i svarsstruktur som inte matchar `rap-lp-openapi.yaml` att orsaka valideringsfel vid körning.
2. **Uppdatera DTO-modeller**:
   - Kontrollera eller uppdatera klasser under `src/model/`.
3. **Kör kontrakts- och API-tester**:
   - Bygg först till `dist/` och kör sedan samtliga API- och felhanteringstester:

   ```bash
   npm run build
   npx jest tests/unit/api/ tests/unit/mapValidationExecutionError.test.ts tests/unit/parseApiSpecInput.integration.test.ts
   ```

