# AGENTS.md

Denna fil ger kontext, arkitekturöversikt och riktlinjer för AI-agenter och utvecklare som arbetar i **REST API-profil - Lint Processor (RAP-LP)**.

## Projektöversikt

**RAP-LP** (`@diggsweden/rest-api-profil-lint-processor`) är ett verktyg utvecklat av Digg (Myndigheten för digital förvaltning) för att validera OpenAPI v3-specifikationer (YAML/JSON) mot den svenska [REST API-profilen](https://dev.dataportal.se/rest-api-profil) samt tilläggsregler under kategorin *Förutsättningar*.

Verktyget bygger på [Stoplight Spectral](https://github.com/stoplightio/spectral) och kan köras i två lägen:

- **CLI-läge** (standard): Validerar en lokal OpenAPI-specifikation och skriver ut resultat till terminalen, JSON-loggfil eller en Excel-avstämningsfil (`--dex`).
- **API-läge** (`-m api`): Startar en Express-baserad HTTP-server som exponerar endpoints för validering av specifikationer (base64 eller via URL), hämtning av regler, generering av Excel-rapporter samt Prometheus-metrics och Swagger UI.

## Teknikstack och miljö

- **Runtime**: Node.js (`<=24.17.0`, Node 24 specificerat i `.mise.toml`).
- **Språk & Modulsystem**: TypeScript (`5.9.x`), ES Modules (`"type": "module"` i `package.json`, `"module": "NodeNext"` och `"moduleResolution": "NodeNext"` i `tsconfig.json`).
- **Kärnberoenden**:
  - `@stoplight/spectral-core`, `@stoplight/spectral-functions`, `@stoplight/spectral-parsers`, `@stoplight/spectral-rulesets` (regelmotor och semantisk OAS-validering)
  - `@apidevtools/swagger-parser` (strukturell OAS-validering i `--strict`-läge)
  - `express` (v5), `express-openapi-validator`, `swagger-ui-express` (HTTP API)
  - `adm-zip`, `fast-xml-parser` (läsning och uppdatering av `.xlsx`-avstämningsfiler i `ExcelReportProcessor`)
  - `yargs` (CLI-argumenthantering), `prom-client` (metrics)
- **Testramverk**: Jest (`30.x`) med `ts-jest` i ESM-läge samt `supertest`.
- **Kvalitetsverktyg**: Hanteras via `mise` och `just` (använder Diggs `devbase-check` för ESLint, Prettier, TypeScript-typkontroll, `rumdl`, `yamlfmt`, `shellcheck`, `shfmt`, `actionlint`, `gitleaks`, `gommitlint` och `reuse`).

## Projektstruktur

```text
├── apis/                        # OpenAPI-testfixturer per regelkategori (dok-api.yaml, ufn-api.yaml m.fl.)
├── development/DEVELOPMENT.md   # Utvecklingsguide och instruktioner för lokala verktyg
├── document/                    # Excel-mallar för avstämningsfil (Avstaemning_REST_API_profil_v_*.xlsx)
├── images/                      # Bilder som refereras i GUIDELINES.md
├── src/
│   ├── cli.ts                   # Binär entrypoint (raplp) som importerar app.ts
│   ├── app.ts                   # Tolkar CLI-flaggor med yargs och väljer CLI- eller API-läge
│   ├── cli-mode.ts              # Exekveringsflöde för CLI-läge
│   ├── api-mode.ts              # Konfigurerar och startar Express-servern i API-läge
│   ├── metrics.ts               # Prometheus-metrics (prom-client)
│   ├── model/                   # DTO-klasser och svarsmodeller för API:et (ProblemDetailsDto m.fl.)
│   ├── routes/                  # Express-routes:
│   │   ├── validate.ts          # /api/v1/validation/rules, /api-info, /validatespec, /generate-report
│   │   ├── urlValidation.ts     # /api/v1/validation/url (inkl. SSRF-skydd)
│   │   └── health.ts            # /health/live och /metrics
│   ├── ruleinterface/           # Gränssnitt för regler (RuleInterface.ts, CustomProperties.ts)
│   ├── rulesets/                # Alla regelimplementationer uppdelade per regelkategori:
│   │   ├── defineRule.ts        # Deklarativ regelbyggare (defineRule, RapLPRule)
│   │   ├── BaseRuleset.ts       # Bakåtkompatibel basklass (legacy)
│   │   ├── rulesetUtil.ts       # Delade hjälpfunktioner och konstanter för regler
│   │   ├── *Rules.ts            # Regelmoduler (DokRules, UfnRules, SakRules, AmeRules, etc.)
│   │   ├── constants/           # Ordlistor och konstanter (t.ex. CommonWords.ts, ResConstants.ts)
│   │   └── util/                # Regelregister (ruleModules.ts), hjälplänkar (rules-doc.config.ts) och regelhjälpare
│   ├── types/                   # TypeScript-typdefinitioner (openapi-3.0.d.ts)
│   └── util/                    # Kärnlogik för validering, diagnostik och rapportgenerering:
│       ├── validateUtil.ts      # Parsing (YAML/JSON), säkerhetskontroller (förbjuder externa $ref) och strict mode
│       ├── validationPipeline.ts # Gemensam valideringspipeline för både CLI och HTTP API
│       ├── RapLPCustomSpectral.ts # Wrapper runt Spectral som berikar utfall med id, område och helpUrl
│       ├── RapLPDiagnostic.ts   # Sammanställer OK, EJ OK (NOK) och N/A per regel
│       ├── RuleExecutionContext.ts # Kontext som spårar vilka regler som verkställts under en körning
│       ├── excelReportProcessor.ts # Läser och uppdaterar Excel-avstämningsfiler (.xlsx via ZIP/XML)
│       └── ruleUtil.ts          # Statisk registrering och kontextbindning av deklarativa regler
├── tests/
│   ├── util/                    # Testverktyg för regeltester (helperTest.ts, rulesetTest.ts)
│   ├── unit/                    # Enhetstester för regler (*.test.ts), API-kontrakt och hjälpfunktioner
│   └── integration/             # Integrationstester (api.test.ts)
├── GUIDELINES.md                # Dokumentation av samtliga implementerade regler
├── rap-lp-openapi.yaml          # OpenAPI-specifikation för RAP-LP:s eget HTTP API
├── justfile                     # Automatisering av bygge, tester och linting
└── REUSE.toml                   # Licenskonfiguration enligt REUSE-specifikationen
```

## Kommandon för bygge, körning och test

### Bygga och köra

```bash
# Installera beroenden
npm install

# Kompilera TypeScript till dist/
npm run build

# Kör i CLI-läge (efter build)
npm start -- -f apis/dok-api.yaml
npm start -- -f apis/dok-api.yaml -c DokRules,UfnRules --strict

# Kör i API-läge (startar server på port 3000 eller RAP_LP_PORT)
npm start -- -m api
npm start -- -m api --enableUrlValidation
```

### Tester

```bash
# Kör alla enhetstester (matchar tests/unit/**/*.test.ts)
npm test

# Kör en specifik testfil med Jest
npx jest tests/unit/dok.test.ts

# Kör integrationstester (matchar tests/integration/**/*.test.ts)
npm run test:integration
```

> **Notera om tester**: Flera tester i `tests/unit/` (exempelvis `parseApiSpecInput.integration.test.ts` och `excelReportProcessor.integration.test.ts`) spawns sub-processer via `tests/unit/integration/*.mjs` som importerar byggd kod från `dist/`. Kör därför alltid `npm run build` innan `npm test` om du har ändrat filer under `src/`.

### Kvalitetskontroller (just)

Projektet använder `just` tillsammans med `devbase-check`:

```bash
# Installera verktyg och devbase-check (första gången)
just setup-devtools

# Kör samtliga kvalitetskontroller (alla linters + tester)
just verify

# Kör enbart linters eller specifik linter
just lint-all
just lint-node
just lint-markdown
just lint-license

# Autofixa formatering (YAML, Markdown, Shell, Prettier)
just lint-fix
```

## Arkitektur och viktiga mönster

### 1. Hur regler fungerar och spåras

- Varje regelkategori ligger i en egen fil under `src/rulesets/<Kategori>Rules.ts` (t.ex. `DokRules.ts`, `UfnRules.ts`, `SakRules.ts`, `AmeRules.ts`, `ArqRules.ts`, `DotRules.ts`, `FelRules.ts`, `FnsRules.ts`, `ForRules.ts`, `MogRules.ts`, `ResRules.ts`, `SpaRules.ts`, `VerRules.ts`).
- Varje regel definieras deklarativt och tillståndslöst med `defineRule(...)` från `src/rulesets/defineRule.ts`:
  - `id: 'XYZ.01'` och `area: '...'` (genererar `customProperties: { område, id }`).
  - `given`: JSONPath Plus-uttryck som pekar ut vilka delar av OpenAPI-dokumentet regeln granskar.
  - `severity`: `DiagnosticSeverity.Error` (för **SKALL** / **SKALL INTE**-krav) eller `DiagnosticSeverity.Warning` (för **BÖR** / **BÖR INTE**-krav).
  - `message`: Felmeddelande på svenska.
  - `validate` (en egen valideringsfunktion) eller `then` (inbyggda Spectral-funktioner som `truthy`, `pattern`, `undefinedFunc`).
  - `trackWhen` (valfritt predikat): Avgör om en `given`-träff ska räknas som att regeln är tillämpbar. `ruleUtil.ts` binder automatiskt verkställningsspårning till `RuleExecutionContext` per körning så att `RapLPDiagnostic` vet om regeln är `OK` eller `N/A` (ej tillämpad).
- Sammansatta regler (som `DOK.03`, `DOK.15`, `UFN.05`, `UFN.09`, `ARQ.05`) kan vara uppdelade i flera delregler med samma `id` (t.ex. `Dok15Get` och `Dok15ReqBody` som båda har id `DOK.15`). `RapLPDiagnostic` aggregerar utfallet per regel-ID.

### 2. Lägga till eller ändra en regel (Checklista)

När du lägger till en ny regel eller regelkategori, kontrollera följande platser:

1. **Regeldefinition**: Implementera och exportera regeln med `defineRule(...)` i rätt `src/rulesets/<Kategori>Rules.ts` (både som named export och i `export default`).
2. **Ny regelkategori** (endast om en helt ny `*Rules.ts`-modul skapas):
   - Lägg till modulen i `RULE_REGISTRY` i `src/rulesets/util/ruleModules.ts`.
   - Importera och registrera modulen i `STATIC_RULE_MODULES` i `src/util/ruleUtil.ts`.
3. **Testregistrering**: Lägg till regeln i `ruleInstances`-objektet i `tests/util/rulesetTest.ts` så att `testRule('<RegelNamn>', ...)` får tillgång till regeln.
4. **Enhetstester**: Lägg till positiva och negativa testfall i motsvarande `tests/unit/<kategori>.test.ts`.
5. **Dokumentation**: Dokumentera regeln i `GUIDELINES.md` med rätt ankarformat (`### ID: XYZ.01` som ger `#id-xyz01`, vilket matchar `buildRuleHelpUrl` i `src/rulesets/util/rules-doc.config.ts`).

### 3. Valideringspipeline och säkerhet

- All inläsning av OpenAPI-specifikationer i både CLI och API går via `parseApiSpecInput` i `src/util/validateUtil.ts`.
- **Säkerhet**:
  - Externa `$ref`-referenser (allt som inte börjar med `#/`) avvisas i `ensureIsSecureOpenApiLike` av säkerhetsskäl.
  - XML-innehåll avvisas tidigt.
  - I API-lägets URL-validering (`src/routes/urlValidation.ts`) kontrolleras URL:er mot SSRF (blockerar privata IPv4-intervall, omdirigeringar och `localhost` om inte `allowLocalhost` / `RAP_LP_ALLOW_LOCALHOST_URL_VALIDATION` är aktiverat).
- **Strict mode (`--strict`)**:
  - Kör först strukturell validering med `@apidevtools/swagger-parser` och därefter utvalda semantiska OAS-regler i Spectral (`path-params`, `operation-operationId-unique`, `operation-parameters`, `oas3-schema`).
  - I CLI-läge är `strict` `false` som standard; i API-läge (`/api/v1/validation/validatespec` och `/api/v1/validation/url`) är `strict` `true` som standard.

### 4. Excel-avstämningsfil (`ExcelReportProcessor`)

- Ligger i `src/util/excelReportProcessor.ts` och använder mallen `document/Avstaemning_REST_API_profil_v_2_0_0_0.xlsx`.
- Manipulerar `.xlsx`-arkivets XML-filer (`xl/workbook.xml`, `xl/sharedStrings.xml`, kalkylbladet `Kravlista REST API profil`) direkt via `adm-zip` och `fast-xml-parser` för att bevara kommentarer, formatering och statusen `Pågående` (som endast skrivs över när en regel valideras till `OK`).

## Kodkonventioner och riktlinjer

- **ESM-importer**: Eftersom projektet använder TypeScript med `"moduleResolution": "NodeNext"` **måste** alla relativa importer i `.ts`-filer sluta på `.js` (t.ex. `import { BaseRuleset } from './BaseRuleset.js';`).
- **Formatering (Prettier)**:
  - Indentering: 2 mellanslag (`"tabWidth": 2`)
  - Semikolon: Ja (`"semi": true`)
  - Enkla citattecken: Ja (`"singleQuote": true`)
  - Radlängd: 120 tecken (`"printWidth": 120`)
  - Radbrytning: LF (`"endOfLine": "lf"`)
  - Trailing commas: `"all"`
- **Språk**:
  - Användarvända texter, regelmeddelanden, CLI-utskrifter och dokumentation skrivs på **svenska**.
  - Undvik att ändra befintliga felmeddelandetexter i regler utan att samtidigt uppdatera berörda enhetstester under `tests/unit/`.
- **Licens och REUSE (SPDX)**:
  - Alla nya källkods- och testfiler (`.ts`, `.js`, `.cjs`, `.mjs`) ska ha SPDX-header överst i filen:

    ```typescript
    // SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
    //
    // SPDX-License-Identifier: EUPL-1.2
    ```

  - Konfigurationsfiler, bilder och dokumentation hanteras via `REUSE.toml` eller egna SPDX-kommentarer (`CC0-1.0` / `CC-BY-4.0`).
- **Git & Commits**:
  - Följ [Conventional Commits](https://www.conventionalcommits.org/) (t.ex. `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
  - Commits i PR-flödet förväntas vara DCO-signerade (`git commit --signoff`) och kryptografiskt signerade (`--gpg-sign` enligt `.gommitlint.yaml`).
