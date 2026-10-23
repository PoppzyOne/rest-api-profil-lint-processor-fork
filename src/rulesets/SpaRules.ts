// SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { DiagnosticSeverity } from '@stoplight/types';
import { defineRule } from './defineRule.js';

const AREA = 'Spårbarhet och korrelation';
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'];
const TRACEPARENT_HEADER = 'traceparent';
const ALTERNATIVE_TRACE_HEADERS = ['x-request-id'];

const SPA02_MESSAGE =
  'API-producenter SKALL acceptera HTTP-headern traceparent i inkommande anrop och propagera spårningsinformationen vidare enligt W3C Trace Context vid vidare anrop till andra system.';

function hasTraceparentParameter(parameters: any[]): boolean {
  return parameters.some(
    (parameter) =>
      parameter?.in === 'header' &&
      typeof parameter.name === 'string' &&
      parameter.name.toLowerCase() === TRACEPARENT_HEADER &&
      parameter.required !== true,
  );
}

export const Spa02 = defineRule({
  id: 'SPA.02',
  area: AREA,
  message: SPA02_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*]',
  validate: (targetVal: any, _opts: any, context: { path: (string | number)[] }) => {
    const results: { message: string; path: (string | number)[] }[] = [];
    const pathParameters = Array.isArray(targetVal?.parameters) ? targetVal.parameters : [];

    for (const method of HTTP_METHODS) {
      const operation = targetVal?.[method];
      if (!operation) {
        continue;
      }
      const operationParameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      if (!hasTraceparentParameter([...pathParameters, ...operationParameters])) {
        results.push({
          message: SPA02_MESSAGE,
          path: [...context.path, method],
        });
      }
    }

    return results;
  },
});

const SPA04_MESSAGE = 'API-producenten BÖR inkludera HTTP-headern traceparent i ett API-svar.';

export const Spa04 = defineRule({
  id: 'SPA.04',
  area: AREA,
  description: '-',
  message: SPA04_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.paths[*][get,put,post,delete,patch].responses[*]',
  validate: (targetVal: any) => {
    const header = targetVal?.headers?.traceparent;
    if (header && (header.schema !== undefined || header.$ref !== undefined)) {
      return [];
    }
    return [{ message: SPA04_MESSAGE, severity: DiagnosticSeverity.Warning }];
  },
});

const SPA07_MESSAGE =
  'Alternativa identifierare, såsom x-request-id, kan användas som komplement för interna behov, men SKALL INTE ersätta traceparent vid spårning av API-anrop mellan system och organisationer.';

function collectHeaderNames(parameters: any[]): Set<string> {
  const headerNames = new Set<string>();
  for (const parameter of parameters) {
    if (parameter?.in === 'header' && typeof parameter.name === 'string') {
      headerNames.add(parameter.name.toLowerCase());
    }
  }
  return headerNames;
}

export const Spa07 = defineRule({
  id: 'SPA.07',
  area: AREA,
  message: SPA07_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*]',
  validate: (targetVal: any, _opts: any, context: { path: (string | number)[] }) => {
    const results: { message: string; path: (string | number)[] }[] = [];
    const pathParameters = Array.isArray(targetVal?.parameters) ? targetVal.parameters : [];

    for (const method of HTTP_METHODS) {
      const operation = targetVal?.[method];
      if (!operation) {
        continue;
      }
      const operationParameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      const headerNames = collectHeaderNames([...pathParameters, ...operationParameters]);
      const usesAlternativeIdentifier = ALTERNATIVE_TRACE_HEADERS.some((header) => headerNames.has(header));

      if (usesAlternativeIdentifier && !headerNames.has(TRACEPARENT_HEADER)) {
        results.push({
          message: SPA07_MESSAGE,
          path: [...context.path, method],
        });
      }
    }

    return results;
  },
});
