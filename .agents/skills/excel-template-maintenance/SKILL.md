---
name: excel-template-maintenance
description: >-
  Guide for maintaining and debugging the Excel reconciliation report processor (ExcelReportProcessor)
  and .xlsx templates in document/. Use this skill when updating the REST API profile Excel template,
  changing how rule statuses (OK, NOK, N/A, Pågående) are written to Excel, or debugging --dex and
  /api/v1/validation/generate-report.
---

# Underhålla Excel-avstämningsfil och ExcelReportProcessor

Denna skill beskriver hur RAP-LP läser och uppdaterar Excel-avstämningsfiler (`.xlsx`) i CLI-läge (`--dex`) och API-läge (`POST /api/v1/validation/generate-report`).

## Arkitektur i `ExcelReportProcessor`

Klassen `ExcelReportProcessor` i `src/util/excelReportProcessor.ts` manipulerar `.xlsx`-filer (som är ZIP-arkiv med OpenXML-filer) direkt via `adm-zip` och `fast-xml-parser` i stället för att generera om hela arbetsboken. Detta görs för att bevara formler, formatering, användarkommentarer och manuella statusar.

### Viktiga konstanter och struktur i `src/util/excelReportProcessor.ts`

- **Mallfil**: `TEMPLATE = 'Avstaemning_REST_API_profil_v_2_0_0_0.xlsx'` under `document/`.
- **Kalkylblad för regler**: `dataSheetName = 'Kravlista REST API profil'`
  - `ruleColumn = 'B'` (innehåller regel-ID, t.ex. `DOK.01`, `UFN.02`)
  - `statusColumn = 'E'` (innehåller status: `-`, `OK`, `NOK`, `N/A` eller `Pågående`)
- **Profilversionsdetektering**:
  - Läser först namngivet område (`definedName`) `profilversion` i `xl/workbook.xml`.
  - Faller tillbaka på att söka efter `version X.Y.Z` i kalkylbladet `Info`.
- **Hantering av befintlig fil och status `Pågående`**:
  - Om `outputFilePath` redan existerar på disk används den befintliga filen som bas (`isBasedOnExistingFile = true`).
  - Om filen är låst (t.ex. öppen i Excel) skapas en ny fil med tidsstämpel och `lockedFilePath` sätts.
  - Om en rad i en befintlig fil har status `Pågående` (`IN_PROGRESS_STATUS`):
    - Om valideringen ger `NOK` eller `N/A` **behålls** `Pågående` och regeln läggs till i `keptInProgressRules`.
    - Om valideringen ger `OK` **ersätts** `Pågående` med `OK` och regeln läggs till i `resolvedInProgressRules`.
- **Omräkning vid öppning**:
  - `enableFullCalcOnLoad(workbook)` sätter `calcPr[@_fullCalcOnLoad="1"]` i `xl/workbook.xml` (och placerar `calcPr` före `ELEMENTS_AFTER_CALC_PR` enligt OpenXML-schemat) så att sammanställningstabeller i Excel räknas om när filen öppnas.

## Uppgradera till en ny Excel-mall

När en ny version av avstämningsmallen läggs till under `document/`:

1. Lägg in den nya `.xlsx`-filen i `document/`.
2. Uppdatera `TEMPLATE`-konstanten i `src/util/excelReportProcessor.ts`.
3. Kontrollera strukturen i den nya `.xlsx`-filen om kalkylbladsnamn eller kolumner ändrats:

   ```bash
   unzip -l document/<ny_mall>.xlsx
   ```

4. Lägg till sökvägen till den nya `.xlsx`-filen under `# documents etc` i `REUSE.toml` (och ta bort eller behåll äldre mallar enligt `REUSE.toml`).
5. Uppdatera eventuella referenser till mallens filnamn i `README.md`.

## Köra tester för `ExcelReportProcessor`

> **Viktigt**: Enhetstestet `tests/unit/excelReportProcessor.integration.test.ts` kör `tests/unit/integration/excelRunner.mjs` i en sub-process som importerar den kompilerade koden från `dist/util/excelReportProcessor.js`. Du **måste** därför köra `npm run build` innan du kör testet!

```bash
npm run build
npx jest tests/unit/excelReportProcessor.integration.test.ts
```

