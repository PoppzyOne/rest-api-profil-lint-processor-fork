---
name: create-or-update-rule
description: >-
  Guide for implementing a new REST API profile rule or modifying an existing rule in RAP-LP.
  Use this skill when the user asks to add a new rule (e.g., DOK.xx, UFN.xx, SAK.xx), update
  rule validation logic, add a new rule category, or write rule unit tests and documentation.
---

# Skapa eller uppdatera en regel i RAP-LP

Denna skill beskriver arbetsflödet för att implementera en ny regel eller ändra en befintlig regel i **REST API-profil - Lint Processor (RAP-LP)**.

Se även kodmallen i [examples/rule-template.md](./examples/rule-template.md).

## Steg 1: Identifiera regelkategori och kravtyp

1. Kontrollera vilken modul i `src/rulesets/` regeln tillhör:
   - `DokRules.ts` (Dokumentation – `DOK.*`)
   - `DotRules.ts` (Datum- och tidsformat – `DOT.*`)
   - `ResRules.ts` (Resurser – `RES.*`)
   - `UfnRules.ts` (URL Format och namngivning – `UFN.*`)
   - `MogRules.ts` (Mognad – `MOG.*`)
   - `SakRules.ts` (Säkerhet – `SAK.*`)
   - `SpaRules.ts` (Spårbarhet och korrelation – `SPA.*`)
   - `AmeRules.ts` (API Message – `AME.*`)
   - `ArqRules.ts` (API Request – `ARQ.*`)
   - `FelRules.ts` (Felhantering – `FEL.*`)
   - `VerRules.ts` (Versionshantering – `VER.*`)
   - `FnsRules.ts` (Filtrering, paginering och sökparametrar – `FNS.*`)
   - `ForRules.ts` (Förutsättningar – `FOR.*`)
2. Om en **helt ny regelkategori** ska läggas till:
   - Skapa `src/rulesets/<Kategori>Rules.ts` (med SPDX-header `EUPL-1.2`).
   - Lägg till kategorin i `RULE_REGISTRY` i `src/rulesets/util/ruleModules.ts`.
   - Importera och registrera modulen i `STATIC_RULE_MODULES` i `src/util/ruleUtil.ts`.
3. Bestäm allvarlighetsgrad (`severity`) utifrån REST API-profilen:
   - **SKALL** / **SKALL INTE** -> `DiagnosticSeverity.Error`
   - **BÖR** / **BÖR INTE** -> `DiagnosticSeverity.Warning`

## Steg 2: Implementera regeln deklarativt med `defineRule`

1. Importera `defineRule` från `./defineRule.js`.
2. Anropa `defineRule({ id, area, message, description, severity, given, validate | then, trackWhen })`:
   - `id`: Regel-ID (t.ex. `'DOK.99'`).
   - `area`: Områdesnamn (t.ex. `'Dokumentation'`).
   - `given`: JSONPath Plus-uttryck.
   - `message`: Felmeddelande på svenska (sätter även `errorMessage` och `ruleMessage` för bakåtkompatibilitet i tester).
   - `severity`: `DiagnosticSeverity.Error` eller `DiagnosticSeverity.Warning`.
   - `validate` (egen valideringsfunktion) eller `then` (inbyggda Spectral-funktioner som `truthy`, `pattern`, `undefinedFunc`).
   - `trackWhen` (valfritt): Predikat `(targetVal, opts, context) => boolean` om en `given`-träff endast är tillämpbar under vissa villkor. Om `trackWhen` utelämnas räknas varje `given`-träff automatiskt som verkställd i `RuleExecutionContext`.
   - `formats` (valfritt): Standard är `['OAS3']`. Ange `['OAS2', 'OAS3']` om regeln även ska köras på Swagger 2.0.
3. Exportera regeln både som `export const <RegelNamn> = defineRule(...)` och i modulens `export default { ... }`.
4. Kontrollera att alla relativa importer slutar på `.js` (krav för `"moduleResolution": "NodeNext"`).

## Steg 3: Registrera regeln för tester

1. Öppna `tests/util/rulesetTest.ts`.
2. Lägg till regeln i `ruleInstances`-objektet (`<RegelNamn>: <Kategori>Rules.<RegelNamn>`).
   - Utan detta steg kommer `testRule('<RegelNamn>', ...)` i enhetstesterna inte att känna igen regeln.

## Steg 4: Skriv enhetstester och uppdatera testfixturer

1. Lägg till positiva (`errors: []`) och negativa testfall i motsvarande `tests/unit/<kategori>.test.ts` med hjälp av `testRule` från `tests/util/helperTest.js`.
2. Vid behov, uppdatera motsvarande exempel-API under `apis/<kategori>-api.yaml`.

## Steg 5: Uppdatera dokumentation

1. Dokumentera regeln i `GUIDELINES.md` under rätt område.
2. Rubriken **måste** ha formatet `### ID: XYZ.01` så att det genererade ankaret `#id-xyz01` matchar `buildRuleHelpUrl('XYZ.01')` i `src/rulesets/util/rules-doc.config.ts`.
3. Uppdatera täckningsgrad och innehållsförteckning i `GUIDELINES.md` vid behov.

## Steg 6: Bygg och verifiera

> **Tips för WSL**: Kör Jest med `--runInBand` (eller enstaka testfiler åt gången) för att undvika hög minnesförbrukning från parallella `ts-jest`-workers.

```bash
npm run build
npx jest --runInBand tests/unit/<kategori>.test.ts
```
