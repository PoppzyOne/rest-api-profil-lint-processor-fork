// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { pattern } from '@stoplight/spectral-functions';
import { DiagnosticSeverity } from '@stoplight/types';
import { parsePropertyNames } from './rulesetUtil.js';
import { isValidApplicationJson } from './util/AmeRulesUtil.js';
import { defineRule } from './defineRule.js';

const AREA = 'API Message';

export const Ame07 = defineRule({
  id: 'AME.07',
  area: AREA,
  description: 'Fältnamn BÖR använda tecken som är alfanumeriska.',
  message: 'Fältnamn BÖR använda tecken som är alfanumeriska.',
  severity: DiagnosticSeverity.Warning,
  given: '$.components.schemas..properties[*]~',
  then: [
    {
      function: pattern,
      functionOptions: {
        match: '^[a-zA-Z0-9_]+$',
      },
    },
  ],
});

const AME04_MESSAGE = 'För fältnamn i request och response body BÖR camelCase eller snake_case notation användas.';
const RESERVED_HAL_FIELDS = ['_links', '_embedded'];
const CAMEL_OR_SNAKE_PATTERN = /^(?:[a-z]+(?:_[a-z]+)*|[a-z]+(?:[A-Z][a-z]*)*)$/;

export const Ame04 = defineRule({
  id: 'AME.04',
  area: AREA,
  description: AME04_MESSAGE,
  message: AME04_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.components.schemas..properties[*]~',
  validate: (targetVal: string) => {
    const fieldName = String(targetVal ?? '');
    if (RESERVED_HAL_FIELDS.includes(fieldName)) {
      return [];
    }
    if (!CAMEL_OR_SNAKE_PATTERN.test(fieldName)) {
      return [{ message: AME04_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});

const AME01_MESSAGE = 'Datamodellen för en representation BÖR beskrivas med JSON enligt senaste versionen, RFC 8259.';

export const Ame01 = defineRule({
  id: 'AME.01',
  area: AREA,
  description: 'Denna regel validerar att request och response är application/json.',
  message: AME01_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: ['$.paths[*][*].responses[?(@property < 400)].content', '$.paths.*.*.requestBody.content'],
  validate: (targetVal: any) => {
    const valid = Object.keys(targetVal ?? {}).some((property) => isValidApplicationJson(property));
    if (!valid) {
      return [{ message: AME01_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});

const AME02_MESSAGE =
  "Det BÖR förutsättas att alla request headers som standard använder 'Accept' med värde 'application/json'";

export const Ame02 = defineRule({
  id: 'AME.02',
  area: AREA,
  description: 'Denna regel validerar att response är application/json.',
  message: AME02_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: ['$.paths.*.*.requestBody.content'],
  validate: (targetVal: any) => {
    const valid = Object.keys(targetVal ?? {}).some((property) => isValidApplicationJson(property));
    if (!valid) {
      return [{ message: AME02_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});

const AME05_MESSAGE = 'Inom ett API SKALL namnsättningen vara konsekvent, dvs blanda inte camelCase och snake_case.';
const LOWERCASE_ONLY_PATTERN = /^[a-z]+$/;
const SNAKE_CASE_PATTERN = /^[a-z]+(?:_[a-z]+)*$/;
const CAMEL_CASE_PATTERN = /^([a-z]+)(?:([A-Z]{1})([a-z]+))+$/;

export const Ame05 = defineRule({
  id: 'AME.05',
  area: AREA,
  description: AME05_MESSAGE,
  message: AME05_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.components.schemas',
  validate: (targetVal: any, _opts: any, paths: any) => {
    if (!targetVal || typeof targetVal !== 'object') {
      return [];
    }

    const result: any[] = [];
    const basePath = Array.isArray(paths?.path) ? paths.path : ['components', 'schemas'];

    for (const schemaKey of Object.keys(targetVal)) {
      const propertyNames = parsePropertyNames(schemaKey, targetVal);
      const snakeProps: string[] = [];
      const camelProps: string[] = [];
      const classifiedInOrder: string[] = [];

      for (const name of propertyNames) {
        if (LOWERCASE_ONLY_PATTERN.test(name)) {
          continue;
        }
        if (SNAKE_CASE_PATTERN.test(name)) {
          snakeProps.push(name);
          classifiedInOrder.push(name);
        } else if (CAMEL_CASE_PATTERN.test(name)) {
          camelProps.push(name);
          classifiedInOrder.push(name);
        }
      }

      if (snakeProps.length > 0 && camelProps.length > 0) {
        for (const propName of classifiedInOrder) {
          result.push({
            path: [...basePath, schemaKey, 'properties', propName],
            message: AME05_MESSAGE,
            severity: DiagnosticSeverity.Error,
          });
        }
      }
    }

    return result;
  },
});
