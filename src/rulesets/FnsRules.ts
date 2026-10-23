// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { pattern } from '@stoplight/spectral-functions';
import { DiagnosticSeverity } from '@stoplight/types';
import { defineRule } from './defineRule.js';

const AREA = 'Filtrering, paginering och sökparametrar';

function hasPaginationQueryParam(targetVal: any): boolean {
  return (
    Array.isArray(targetVal) &&
    targetVal.some((item) => item?.in === 'query' && (item?.name === 'page' || item?.name === 'offset'))
  );
}

export const Fns01 = defineRule({
  id: 'FNS.01',
  area: AREA,
  description:
    'Parameternamn SKALL anges med en konsekvent namnkonvention inom ett API, exempelvis antingen snake_case eller camelCase',
  message:
    'Parameternamn SKALL anges med en konsekvent namnkonvention inom ett API, exempelvis antingen snake_case eller camelCase',
  severity: DiagnosticSeverity.Error,
  given: "$.paths.*.*.parameters[?(@.in=='query')].name",
  then: [
    {
      function: pattern,
      functionOptions: {
        match: '^(?:[a-z0-9]+(?:_[a-z0-9]+)*|[a-z]+(?:[A-Z][a-z]*)*)$',
      },
    },
  ],
});

export const Fns03 = defineRule({
  id: 'FNS.03',
  area: AREA,
  description: 'Sökparametrar SKALL starta med en bokstav',
  message: 'Sökparametrar SKALL starta med en bokstav.',
  severity: DiagnosticSeverity.Error,
  given: "$.paths.*.*.parameters[?(@.in=='query')].name",
  then: [
    {
      function: pattern,
      functionOptions: {
        match: '^[a-zA-Z].*$',
      },
    },
  ],
});

const FNS09_MESSAGE = 'Defaultvärde för limit BÖR vara 20';

export const Fns09 = defineRule({
  id: 'FNS.09',
  area: AREA,
  description: FNS09_MESSAGE,
  message: FNS09_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.paths..parameters',
  trackWhen: hasPaginationQueryParam,
  validate: (targetVal: any) => {
    if (!Array.isArray(targetVal) || !hasPaginationQueryParam(targetVal)) {
      return [];
    }
    const limit = targetVal.find((param) => param?.name === 'limit');
    if (limit && limit.schema?.default !== 20) {
      return [{ message: FNS09_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});

const FNS05_MESSAGE = 'Sökparametrar BÖR vara frivilliga.';

export const Fns05 = defineRule({
  id: 'FNS.05',
  area: AREA,
  description: FNS05_MESSAGE,
  message: FNS05_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: "$.paths.[*].parameters[?(@.in=='query')].required",
  validate: (targetVal: any) => {
    return targetVal === false ? [] : [{ message: FNS05_MESSAGE, severity: DiagnosticSeverity.Warning }];
  },
});

export const Fns06 = defineRule({
  id: 'FNS.06',
  area: AREA,
  description:
    "Sökparametrar BÖR använda tecken som är URL-säkra (tecknen A-Z, a-z, 0-9, '-'', '.', '_' samt '~', se vidare i RFC 3986)",
  message:
    "Sökparametrar BÖR använda tecken som är URL-säkra (tecknen A-Z, a-z, 0-9, '-', '.', '_' samt '~', se vidare i RFC 3986)",
  severity: DiagnosticSeverity.Warning,
  given: "$.paths.[*].parameters[?(@.in=='query')].name",
  then: [
    {
      function: pattern,
      functionOptions: {
        match: '^(?:[a-zA-Z0-9-._~])+$',
      },
    },
  ],
});

const FNS07_MESSAGE =
  "Vid användande av paginering, SKALL följande parametrar ingå i request: 'limit' och någon av 'page' eller 'offset'";

export const Fns07 = defineRule({
  id: 'FNS.07',
  area: AREA,
  message: FNS07_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths..parameters',
  trackWhen: hasPaginationQueryParam,
  validate: (targetVal: any) => {
    if (!Array.isArray(targetVal) || !hasPaginationQueryParam(targetVal)) {
      return [];
    }
    const hasLimit = targetVal.some((p) => p?.in === 'query' && p?.name === 'limit');
    if (!hasLimit) {
      return [{ message: FNS07_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

const FNS08_MESSAGE = "'page' SKALL alltid starta med värde 1";

function hasPageAndLimitQueryParams(targetVal: any): boolean {
  if (!Array.isArray(targetVal)) return false;
  const hasPage = targetVal.some((p) => p?.in === 'query' && p?.name === 'page');
  const hasLimit = targetVal.some((p) => p?.in === 'query' && p?.name === 'limit');
  return hasPage && hasLimit;
}

export const Fns08 = defineRule({
  id: 'FNS.08',
  area: AREA,
  message: FNS08_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths..parameters',
  trackWhen: hasPageAndLimitQueryParams,
  validate: (targetVal: any) => {
    if (!hasPageAndLimitQueryParams(targetVal)) {
      return [];
    }
    let pageDefaultValue = -1;
    for (const parameter of targetVal) {
      if (parameter?.in === 'query' && parameter?.name === 'page') {
        pageDefaultValue = Object.prototype.hasOwnProperty.call(parameter, 'schema')
          ? parameter.schema?.default
          : pageDefaultValue;
      }
    }
    if (pageDefaultValue !== 1) {
      return [{ message: FNS08_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});
