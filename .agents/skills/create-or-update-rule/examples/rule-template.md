# Mall för ny regel och enhetstest

## Exempel på deklarativ regel med `defineRule` (`src/rulesets/DokRules.ts`)

```typescript
import { DiagnosticSeverity } from '@stoplight/types';
import { defineRule } from './defineRule.js';

const AREA = 'Dokumentation';
const DOK99_MESSAGE = 'Exempel på kravmeddelande enligt REST API-profilen.';

export const Dok99 = defineRule({
  id: 'DOK.99',
  area: AREA,
  message: DOK99_MESSAGE,
  severity: DiagnosticSeverity.Error, // Error för SKALL, Warning för BÖR
  given: '$.info',
  validate: (targetVal: any) => {
    if (!targetVal?.summary || String(targetVal.summary).trim() === '') {
      return [
        {
          message: DOK99_MESSAGE,
          severity: DiagnosticSeverity.Error,
        },
      ];
    }
    return [];
  },
});
```

## Exempel på enhetstest (`tests/unit/dok.test.ts`)

```typescript
import { DiagnosticSeverity } from '@stoplight/types';
import testRule from '../util/helperTest.js';

testRule('Dok99', [
  {
    name: 'giltigt testfall',
    document: {
      openapi: '3.1.0',
      info: {
        version: '1.0',
        summary: 'Kort sammanfattning av API:et',
      },
    },
    errors: [],
  },
  {
    name: 'ogiltigt testfall - summary saknas',
    document: {
      openapi: '3.1.0',
      info: {
        version: '1.0',
      },
    },
    errors: [
      {
        message: 'Exempel på kravmeddelande enligt REST API-profilen.',
        severity: DiagnosticSeverity.Error,
      },
    ],
  },
]);
```
