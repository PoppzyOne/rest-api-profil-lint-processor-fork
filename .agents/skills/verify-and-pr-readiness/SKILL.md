---
name: verify-and-pr-readiness
description: >-
  Run local build, test, license (REUSE/SPDX), and linter checks to ensure changes pass CI.
  Use this skill before finishing a task, preparing a commit/PR, or troubleshooting failing
  tests or devbase-check linters.
---

# Verifiera kodkvalitet, licenser och tester inför PR

Denna skill beskriver hur du verifierar att alla ändringar i RAP-LP uppfyller projektets krav på bygge, tester, formatering, markdown och REUSE-licenser.

## Steg 1: Kompilera TypeScript först (`npm run build`)

Många tester i `tests/unit/` (såsom `parseApiSpecInput.integration.test.ts` och `excelReportProcessor.integration.test.ts`) startar Node-underprocesser via `tests/unit/integration/*.mjs` som importerar kompilerad kod från `dist/`.

Kör **alltid** bygget innan testsviten:

```bash
npm run build
```

## Steg 2: Kör enhetstester

```bash
npm test
```

Om ett test fallerar kan du köra en enskild testfil isolerat:

```bash
npx jest tests/unit/<filnamn>.test.ts
```

## Steg 3: Kontrollera REUSE / SPDX-licenskrav

Alla filer i repot måste ha giltig licensinformation enligt REUSE-specifikationen:

1. **Nya källkods- eller testfiler** (`.ts`, `.js`, `.cjs`, `.mjs`) ska ha följande SPDX-header överst:

   ```typescript
   // SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
   //
   // SPDX-License-Identifier: EUPL-1.2
   ```

2. **Nya binära filer, Excel-mallar eller specialfiler** som inte kan ha kommentarer måste läggas till i `REUSE.toml` (notera att `**/*.md` och `**/*.json` redan täcks av `REUSE.toml`).

## Steg 4: Kontrollera Markdown och kodformatering

- **Markdown (`rumdl`)**:
  - Nya `.md`-filer (som inte är undantagna för `MD041` i `rumdl.toml`) ska börja med en H1-rubrik (`# ...`) på rad 1 (eller ha giltig YAML-frontmatter följt av H1 i `.agents/skills/`).
  - Alla kodblock med tre backticks måste ange språk (t.ex. `bash`, `typescript`, `json`, `text`, `yaml`).
- **TypeScript / Prettier**:
  - 2 mellanslag, enkla citattecken (`'`), semikolon (`;`), radlängd max 120 tecken, LF-radbrytningar och trailing commas (`all`).
  - Alla relativa ESM-importer i `.ts`-filer måste sluta med `.js`.

## Steg 5: Kör `just`-kontroller (om `mise` och `devbase-check` är installerade)

```bash
# Kör alla linters och tester
just verify

# Autofixa formatering vid behov
just lint-fix
```

