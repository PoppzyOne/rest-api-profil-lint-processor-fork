// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { DiagnosticSeverity } from '@stoplight/types';
import { parseProperties } from '../rulesetUtil.js';

const RFC3339_DATE_REGEX = /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const RFC3339_DATE_TIME_REGEX =
  /^(\d{4})-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])T([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,6})?(Z|([+-])([0-1][0-9]|2[0-3]):([0-5][0-9]))?$/;
const OFFSET_REGEX = /^([+-])(0[0-9]|1[0-4]):([0-5][0-9])$/;

export function isValidRfc3339Offset(example: string): boolean {
  if (example.includes('Z')) {
    return true;
  }
  const plusIndex = example.lastIndexOf('+');
  const minusIndex = example.lastIndexOf('-');
  const offsetIndex = plusIndex !== -1 ? plusIndex : minusIndex;
  if (offsetIndex === -1) {
    return false;
  }

  const offsetPart = example.substring(offsetIndex);
  const match = offsetPart.match(OFFSET_REGEX);
  if (!match) {
    return false;
  }

  const sign = match[1];
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);

  if ((sign === '+' && hours > 14) || (sign === '-' && hours > 12)) {
    return false;
  }
  return minutes >= 0 && minutes <= 59;
}

export function hasDateOrDateTimeProperty(schemas: any): boolean {
  if (!schemas || typeof schemas !== 'object') {
    return false;
  }
  for (const schemaKey of Object.keys(schemas)) {
    const properties = parseProperties(schemaKey, schemas);
    if (properties.some((prop) => prop.format === 'date' || prop.format === 'date-time')) {
      return true;
    }
  }
  return false;
}

export function validateSchemaDateExamples(
  schemas: any,
  paths: any,
  message: string,
  severity: DiagnosticSeverity,
  requireOffset: boolean,
): any[] {
  if (!schemas || typeof schemas !== 'object') {
    return [];
  }

  const results: any[] = [];
  const basePath = Array.isArray(paths?.path) ? paths.path : ['components', 'schemas'];

  for (const schemaKey of Object.keys(schemas)) {
    const properties = parseProperties(schemaKey, schemas);
    for (const prop of properties) {
      if (prop.format !== 'date' && prop.format !== 'date-time') {
        continue;
      }

      let isValid = false;
      if (prop.format === 'date' && prop.example !== undefined) {
        isValid = Boolean(prop.example && RFC3339_DATE_REGEX.test(String(prop.example)));
      } else if (prop.format === 'date-time' && prop.example !== undefined) {
        const exampleStr = String(prop.example);
        const offsetOk = requireOffset ? isValidRfc3339Offset(exampleStr) : true;
        isValid = offsetOk && RFC3339_DATE_TIME_REGEX.test(exampleStr);
      }

      if (!isValid) {
        results.push({
          path: [...basePath, schemaKey, 'properties', prop.name, 'example'],
          message,
          severity,
        });
      }
    }
  }

  return results;
}
