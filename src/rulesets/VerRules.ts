// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { truthy } from '@stoplight/spectral-functions';
import { DiagnosticSeverity } from '@stoplight/types';
import { defineRule } from './defineRule.js';

const AREA = 'Versionhantering';

export const Ver06 = defineRule({
  id: 'VER.06',
  area: AREA,
  message: 'Information om ett API SKALL tillgängliggöras via resursen api-info under roten till API:et.',
  severity: DiagnosticSeverity.Error,
  given: '$.paths',
  then: [
    {
      field: '/api-info',
      function: truthy,
    },
  ],
});

const VER05_MESSAGE =
  "Version BÖR anges i URL enligt formatet v[x] där 'v' avser förkortning för version och x avser ett och bara ett nummer (0-n) för major-version";
const VERSION_SEGMENT_PATTERN = /(v[0-9][1-9]*(?![.\-_])|\{version\})/;

export const Ver05 = defineRule({
  id: 'VER.05',
  area: AREA,
  message: VER05_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.servers.[url]',
  validate: (targetVal: string) => {
    const parts = String(targetVal ?? '')
      .split('/')
      .filter(Boolean);
    const valid = parts.some((part) => VERSION_SEGMENT_PATTERN.test(part));
    if (!valid) {
      return [{ message: VER05_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});
