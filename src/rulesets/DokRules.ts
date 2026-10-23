// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { truthy, falsy, pattern } from '@stoplight/spectral-functions';
import { DiagnosticSeverity } from '@stoplight/types';
import { hasExampleInMediaType } from './rulesetUtil.js';
import { commonEnglishWords, commonSwedishWords } from './constants/CommonWords.js';
import {
  OpenAPIObject,
  OperationObject,
  PathItemObject,
  PathsObject,
  SecurityRequirementObject,
} from '../types/openapi-3.0.js';
import { defineRule } from './defineRule.js';

const AREA = 'Dokumentation';

const DOK03_DESCRIPTION =
  'Dokumentationen för ett API SKALL innehålla följande: Om API, Användarvillkor, Datamodell för representation av resurser, Krav på autentisering, Livscykelhantering och versionshantering, Kontaktuppgifter.';

const DOK15_MESSAGE =
  'I dokumentationen av API:et SKALL exempel på API:ets fråga (eng:request) och svar (eng:reply) finnas i sin helhet.';

export const Dok15Get = defineRule({
  id: 'DOK.15',
  area: AREA,
  message: DOK15_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*][*].responses[*].content.application/json',
  validate: (targetVal) => {
    if (!hasExampleInMediaType(targetVal)) {
      return [{ message: DOK15_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

export const Dok15ReqBody = defineRule({
  id: 'DOK.15',
  area: AREA,
  message: DOK15_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*][?(@ != "get")].requestBody.content.application/json',
  validate: (targetVal) => {
    if (!hasExampleInMediaType(targetVal)) {
      return [{ message: DOK15_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

const DOK17_DESCRIPTION =
  ' ( Linter-analysverktyget (RAP-LP) för den nationella REST API-profilen är designat för senaste major versionen av OpenAPI Specification. Använd därför denna för full täckning av de implementerade reglerna. )';

export const Dok17 = defineRule({
  id: 'DOK.17',
  area: AREA,
  description: DOK17_DESCRIPTION,
  message: 'API specifikation BÖR dokumenteras med den senaste versionen av OpenAPI Specification.' + DOK17_DESCRIPTION,
  severity: DiagnosticSeverity.Warning,
  formats: ['OAS2', 'OAS3'],
  given: '$',
  then: [
    {
      field: 'swagger',
      function: falsy,
    },
    {
      field: 'openapi',
      function: pattern,
      functionOptions: {
        match: '^(3|[4-9]|[1-9]\\d+)\\.\\d+\\.\\d+$',
      },
    },
  ],
});

export const Dok20 = defineRule({
  id: 'DOK.20',
  area: AREA,
  message: 'Förväntade returkoder och felkoder SKALL vara fullständigt dokumenterade.',
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*][*].responses[*]',
  then: [
    {
      field: 'description',
      function: truthy,
    },
  ],
});

const DOK06_MESSAGE = 'Dokumentationen BÖR finnas på både svenska och engelska.';

export const Dok06 = defineRule({
  id: 'DOK.06',
  area: AREA,
  message: DOK06_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.info.description',
  validate: (targetVal: string) => {
    const words = String(targetVal ?? '').toLowerCase().match(/[a-zåäö]+/gi) || [];
    const containsEnglish = words.some((word) => commonEnglishWords.includes(word));
    const containsSwedish = words.some((word) => commonSwedishWords.includes(word));

    if (!containsEnglish || !containsSwedish) {
      return [{ message: DOK06_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});

export const Dok07 = defineRule({
  id: 'DOK.07',
  area: AREA,
  message: 'Dokumentationen av ett API BÖR innehålla övergripande information om API:et.',
  severity: DiagnosticSeverity.Warning,
  given: '$.info',
  then: [
    {
      field: 'description',
      function: truthy,
    },
  ],
});

const DOK08_MESSAGE = 'Ett API:s servicenivå SKALL finnas tydligt beskriven i dokumentationen.';
const SLA_URL_PATTERN = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/\S*)?$/;
const SLA_TERMS = ['service level agreement', 'sla'];

export const Dok08 = defineRule({
  id: 'DOK.08',
  area: AREA,
  message: DOK08_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$',
  validate: (targetVal: any) => {
    if (targetVal?.info?.termsOfService) {
      return [];
    }

    const customSla = targetVal?.info?.['x-sla'];
    if (customSla?.availability && customSla?.responseTime && customSla?.support) {
      return [];
    }

    const externalDocs = targetVal?.externalDocs;
    if (
      externalDocs?.description &&
      externalDocs?.url &&
      SLA_URL_PATTERN.test(externalDocs.url) &&
      SLA_TERMS.some((term) => String(externalDocs.description).toLowerCase().includes(term))
    ) {
      return [];
    }

    return [{ message: DOK08_MESSAGE, severity: DiagnosticSeverity.Error }];
  },
});

const DOK09_MESSAGE = 'Kända problem och begränsningar SKALL finnas tydlig beskrivna i dokumentationen.';
const LIMIT_TERMS = ['limit', 'begränsning', 'problem'];

export const Dok09 = defineRule({
  id: 'DOK.09',
  area: AREA,
  message: DOK09_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$',
  validate: (targetVal: any) => {
    const includesLimitTerm = (description?: string): boolean =>
      Boolean(description && LIMIT_TERMS.some((term) => description.toLowerCase().includes(term)));

    if (
      targetVal?.info?.['x-limitations'] ||
      includesLimitTerm(targetVal?.info?.description) ||
      includesLimitTerm(targetVal?.externalDocs?.description)
    ) {
      return [];
    }

    return [{ message: DOK09_MESSAGE, severity: DiagnosticSeverity.Error }];
  },
});

const DOK11_MESSAGE = 'Avsikten och beteendet hos API:et SKALL beskrivas så utförligt och tydligt som möjligt.';

export const Dok11 = defineRule({
  id: 'DOK.11',
  area: AREA,
  message: DOK11_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.info',
  validate: (targetVal: any) => {
    const description = targetVal?.description;
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return [{ message: DOK11_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

export const Dok19 = defineRule({
  id: 'DOK.19',
  area: AREA,
  message:
    'Ett API:s resurser och de möjliga operationer som kan utföras på resursen SKALL beskrivas så utförligt och tydligt som möjligt',
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*][*]',
  then: [
    {
      field: 'summary',
      function: truthy,
    },
    {
      field: 'description',
      function: truthy,
    },
  ],
});

const DOK21_MESSAGE = 'Krav på autentisering SKALL anges i specifikationen.';
const HTTP_OPERATION_KEYS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export const Dok21 = defineRule({
  id: 'DOK.21',
  area: AREA,
  message: DOK21_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$',
  validate: (targetVal: OpenAPIObject) => {
    const rootSecurity: SecurityRequirementObject[] | undefined = targetVal?.security;
    if (Array.isArray(rootSecurity)) {
      return [];
    }

    const hasSecurityInAnyPath = (paths: PathsObject | undefined): boolean => {
      if (!paths) return false;
      return Object.values(paths).some((pathItem: PathItemObject | undefined) => {
        if (!pathItem) return false;
        return (Object.keys(pathItem) as (keyof PathItemObject)[])
          .filter((k) => HTTP_OPERATION_KEYS.includes(String(k)))
          .some((k) => Boolean((pathItem[k] as OperationObject | undefined)?.security));
      });
    };

    if (hasSecurityInAnyPath(targetVal?.paths)) {
      return [];
    }

    return [{ message: DOK21_MESSAGE, severity: DiagnosticSeverity.Error }];
  },
});

const DOK01_MESSAGE = 'I regel BÖR dokumentationen och specifikationen för ett API finnas allmänt tillgänglig online';

export const Dok01 = defineRule({
  id: 'DOK.01',
  area: AREA,
  message: DOK01_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$',
  trackWhen: (targetVal) => Boolean(targetVal && Object.prototype.hasOwnProperty.call(targetVal, 'externalDocs')),
  validate: (targetVal: any) => {
    if (!targetVal || !Object.prototype.hasOwnProperty.call(targetVal, 'externalDocs')) {
      return [];
    }
    const obj = targetVal.externalDocs;
    if (obj === null || typeof obj !== 'object') {
      return [{ path: ['externalDocs'], message: DOK01_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    const hasValidDescription =
      Object.prototype.hasOwnProperty.call(obj, 'description') &&
      obj.description != null &&
      obj.description.toString().trim() !== '';
    const hasValidUrl =
      Object.prototype.hasOwnProperty.call(obj, 'url') && obj.url != null && obj.url.toString().trim() !== '';
    if (!hasValidDescription || !hasValidUrl) {
      return [{ path: ['externalDocs'], message: DOK01_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});

export const Dok03Info = defineRule({
  id: 'DOK.03',
  area: AREA,
  description: DOK03_DESCRIPTION,
  message:
    DOK03_DESCRIPTION + '[ info objektet bör ha title, version , description, termsOfService, contact , license ]',
  severity: DiagnosticSeverity.Error,
  given: '$.info',
  then: [
    { field: 'version', function: truthy },
    { field: 'title', function: truthy },
    { field: 'description', function: truthy },
    { field: 'termsOfService', function: truthy },
  ],
});

export const Dok03ContactName = defineRule({
  id: 'DOK.03',
  area: AREA,
  description: DOK03_DESCRIPTION,
  message: DOK03_DESCRIPTION + '(Contact saknar name)',
  severity: DiagnosticSeverity.Error,
  given: '$.info.contact',
  trackWhen: () => false,
  then: [{ field: 'name', function: truthy }],
});

export const Dok03ContactEmail = defineRule({
  id: 'DOK.03',
  area: AREA,
  description: DOK03_DESCRIPTION,
  message: DOK03_DESCRIPTION + '(Contact saknar email)',
  severity: DiagnosticSeverity.Error,
  given: '$.info.contact',
  trackWhen: () => false,
  then: [{ field: 'email', function: truthy }],
});

export const Dok03ContactUrl = defineRule({
  id: 'DOK.03',
  area: AREA,
  description: DOK03_DESCRIPTION,
  message: DOK03_DESCRIPTION + '(Contact saknar url)',
  severity: DiagnosticSeverity.Error,
  given: '$.info.contact',
  trackWhen: () => false,
  then: [{ field: 'url', function: truthy }],
});

export const Dok03Contact = defineRule({
  id: 'DOK.03',
  area: AREA,
  description: DOK03_DESCRIPTION,
  message: DOK03_DESCRIPTION + '(Saknar contact objektet)',
  severity: DiagnosticSeverity.Error,
  given: '$.info',
  trackWhen: () => false,
  then: [{ field: 'contact', function: truthy }],
});

export const Dok03License = defineRule({
  id: 'DOK.03',
  area: AREA,
  description: DOK03_DESCRIPTION,
  message: DOK03_DESCRIPTION + '(Saknar license objektet)',
  severity: DiagnosticSeverity.Error,
  given: '$.info',
  trackWhen: () => false,
  then: [{ field: 'license', function: truthy }],
});

export const Dok03LicenseUrl = defineRule({
  id: 'DOK.03',
  area: AREA,
  description: DOK03_DESCRIPTION,
  message: DOK03_DESCRIPTION + '(license saknar url)',
  severity: DiagnosticSeverity.Error,
  given: '$.info.license',
  trackWhen: () => false,
  then: [{ field: 'url', function: truthy }],
});

export const Dok03LicenseName = defineRule({
  id: 'DOK.03',
  area: AREA,
  description: DOK03_DESCRIPTION,
  message: DOK03_DESCRIPTION + '(license saknar name)',
  severity: DiagnosticSeverity.Error,
  given: '$.info.license',
  trackWhen: () => false,
  then: [{ field: 'name', function: truthy }],
});
