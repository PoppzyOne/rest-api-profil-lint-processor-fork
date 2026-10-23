// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { DiagnosticSeverity } from '@stoplight/types';
import { hasHeaderSchemaType, isValidApplicationJson } from './rulesetUtil.js';
import { defineRule } from './defineRule.js';

const AREA = 'API Request';
const ARQ05_BASE_MESSAGE = 'Payload data SKALL INTE användas i HTTP-headers';
const ARQ05_GIVEN = "$.paths.*.*.parameters[?(@.in=='header' && @.schema)]";

const ARQ05_NESTED_DESCRIPTION = 'Om en header använder nästlade strukturer, är en requestbody mer lämplig.';
const ARQ05_NESTED_MESSAGE = '[' + ARQ05_BASE_MESSAGE + '] ' + ARQ05_NESTED_DESCRIPTION;

export const Arq05NestedStructure = defineRule({
  id: 'ARQ.05',
  area: AREA,
  description: ARQ05_NESTED_DESCRIPTION,
  message: ARQ05_NESTED_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: ARQ05_GIVEN,
  validate: (targetVal: any) => {
    if (hasHeaderSchemaType(targetVal, 'object') && targetVal?.schema?.properties) {
      return [{ message: ARQ05_NESTED_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

const ARQ05_BINARY_DESCRIPTION =
  'Om en header förväntas innehålla data med ovanliga MIME-typer kan det indikera en okonventionell användning av headers.';
const ARQ05_BINARY_MESSAGE = '[' + ARQ05_BASE_MESSAGE + '] ' + ARQ05_BINARY_DESCRIPTION;

export const Arq05StringBinary = defineRule({
  id: 'ARQ.05',
  area: AREA,
  description: ARQ05_BINARY_DESCRIPTION,
  message: ARQ05_BINARY_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: ARQ05_GIVEN,
  validate: (targetVal: any) => {
    if (hasHeaderSchemaType(targetVal, 'string', 'binary')) {
      return [{ message: ARQ05_BINARY_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

const ARQ05_COMPLEX_DESCRIPTION =
  'Om en header förväntas innehålla komplexa datastrukturer, såsom JSON eller XML, kan det indikera en okonventionell användning av headers.';
const ARQ05_COMPLEX_MESSAGE = '[' + ARQ05_BASE_MESSAGE + '] ' + ARQ05_COMPLEX_DESCRIPTION;

export const Arq05ComplexStructure = defineRule({
  id: 'ARQ.05',
  area: AREA,
  description: ARQ05_COMPLEX_DESCRIPTION,
  message: ARQ05_COMPLEX_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: ARQ05_GIVEN,
  validate: (targetVal: any) => {
    if (hasHeaderSchemaType(targetVal, 'object')) {
      return [{ message: ARQ05_COMPLEX_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

const ARQ01_MESSAGE = 'Ett request BÖR skickas i UTF-8';

export const Arq01 = defineRule({
  id: 'ARQ.01',
  area: AREA,
  description: ARQ01_MESSAGE,
  message: ARQ01_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.paths[*][*].requestBody.content',
  validate: (targetVal: any) => {
    const valid = Object.keys(targetVal ?? {}).some((property) => isValidApplicationJson(property));
    if (!valid) {
      return [{ message: ARQ01_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});

const ARQ03_MESSAGE =
  'Alla API:er BÖR supportera följande request headers: Accept, Date, Cache-Control, ETag, Connection och Cookie.';

export const Arq03 = defineRule({
  id: 'ARQ.03',
  area: AREA,
  description: ARQ03_MESSAGE,
  message: ARQ03_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.paths.*.*',
  validate: (targetVal: any) => {
    let isValid = true;
    if (Array.isArray(targetVal?.parameters)) {
      for (const element of targetVal.parameters) {
        if (element?.in === 'header') {
          if (element.name === 'Date' && element.schema?.format !== 'date-time') {
            isValid = false;
          }
          if (element.name === 'Cache-Control' && element.schema?.enum?.length === 0) {
            isValid = false;
          }
          if (element.name === 'ETag' && element.schema?.format !== 'etag') {
            isValid = false;
          }
          if (element.name === 'Connection' && !element.schema?.enum?.includes('keep-alive')) {
            isValid = false;
          }
        }
        if (element?.in === 'cookie' && element.schema?.type === undefined) {
          isValid = false;
        }
      }
    }
    if (!isValid) {
      return [{ message: ARQ03_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});
