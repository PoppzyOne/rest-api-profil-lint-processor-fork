// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { DiagnosticSeverity } from '@stoplight/types';
import { personalIdentityNumberFieldNames } from './constants/ResConstants.js';
import { defineRule } from './defineRule.js';

const AREA = 'Resurser';

const RES02_MESSAGE =
  'Primärnycklar eller personligt identifierbar information (personnummer, etc.) BÖR INTE exponeras. ';
const RES06_MESSAGE =
  'Resurser SKALL följa den namnsättningskonvention som beskrivs för URL:er, det vill säga att resurser anges med gemener, använder endast alfanumeriska tecken och bindestreck för att separera eventuella ord. ';

const SEGMENT_REGEX = /^(?!-)[a-z0-9-]+(?<!-)$/;
const INVALID_PREFIXES = ['get-', 'post-', 'put-', 'delete-', 'patch-'];

export const Res02 = defineRule({
  id: 'RES.02',
  area: AREA,
  message: RES02_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.paths[*].*.parameters[*]',
  validate: (targetVal: any) => {
    if (targetVal?.in === 'query' || targetVal?.in === 'path') {
      const lowerName = String(targetVal.name ?? '').toLowerCase();
      if (personalIdentityNumberFieldNames.includes(lowerName)) {
        return [{ message: RES02_MESSAGE, severity: DiagnosticSeverity.Warning }];
      }
    }
    return [];
  },
});

export const Res06 = defineRule({
  id: 'RES.06',
  area: AREA,
  message: RES06_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*]~',
  validate: (targetVal: any) => {
    const segments = String(targetVal ?? '').split('/');
    for (const part of segments) {
      if (part.length > 0 && !part.includes('{') && !part.includes('}')) {
        const hasInvalidPrefix = INVALID_PREFIXES.some((prefix) => part.startsWith(prefix));
        if (!SEGMENT_REGEX.test(part) || hasInvalidPrefix) {
          return [{ message: RES06_MESSAGE, severity: DiagnosticSeverity.Error }];
        }
      }
    }
    return [];
  },
});
