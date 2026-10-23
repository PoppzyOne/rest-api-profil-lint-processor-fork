// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { pattern } from '@stoplight/spectral-functions';
import { DiagnosticSeverity } from '@stoplight/types';
import { defineRule } from './defineRule.js';

const AREA = 'Säkerhet';

const SAK01_MESSAGE = 'All transport SKALL ske över HTTPS med minst TLS 1.2.';
const HTTPS_URL_PATTERN = /^https:\/\/.+$/;

export const Sak01 = defineRule({
  id: 'SAK.01',
  area: AREA,
  message: SAK01_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.servers[*].url',
  validate: (targetVal: any) => {
    if (HTTPS_URL_PATTERN.test(String(targetVal ?? ''))) {
      return [];
    }
    return [{ message: SAK01_MESSAGE, severity: DiagnosticSeverity.Error }];
  },
});

export const Sak09 = defineRule({
  id: 'SAK.09',
  area: AREA,
  description:
    'HTTP Basic är ett naturligt osäkert sätt att skicka inloggningsuppgifter till API:et. De placeras i URL:en i base64 som enkelt kan dekrypteras. Även om du använder en token finns det mycket bättre sätt att hantera att skicka tokens till ett API som är mindre benägna att läcka ut information',
  message: 'Basic- eller Digest-autentisering SKALL INTE användas.',
  severity: DiagnosticSeverity.Error,
  given: '$.components.securitySchemes[*]',
  trackWhen: (targetVal: any) => Boolean(targetVal?.scheme),
  then: [
    {
      field: 'scheme',
      function: pattern,
      functionOptions: {
        notMatch: 'basic',
      },
    },
    {
      field: 'scheme',
      function: pattern,
      functionOptions: {
        notMatch: 'digest',
      },
    },
  ],
});

export const Sak10 = defineRule({
  id: 'SAK.10',
  area: AREA,
  description:
    'Genom att använda HTTPS för att kryptera kommunikationen mellan klient och server kan Bearer Authentication erbjuda en hög nivå av säkerhet. Det gör det svårare för angripare att avlyssna eller ändra åtkomsttoken under överföringen',
  message: 'Authorization: Bearer header SKALL användas för autentisering/auktorisation.',
  severity: DiagnosticSeverity.Error,
  given: '$..components.securitySchemes[?(@ && @.scheme)]',
  then: [
    {
      field: 'scheme',
      function: pattern,
      functionOptions: {
        match: 'bearer',
      },
    },
  ],
});

const SAK11_MESSAGE =
  'En uppdateringstoken SKALL tillhandahållas för att förlänga giltighetstiden för befintliga token utan att behöva tillhandahålla referenserna igen.';

export const Sak11 = defineRule({
  id: 'SAK.11',
  area: AREA,
  description: 'OAuth 2.0 authorizationCode- och password-flow SKALL ha attributet refreshUrl definierat.',
  message: SAK11_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: ['$.components.securitySchemes[?(@.type=="oauth2")]'],
  validate: (targetVal: any, _opts: any, context: any) => {
    const flows = targetVal?.flows;
    if (!flows || (!flows.authorizationCode?.refreshUrl && !flows.password?.refreshUrl)) {
      return [
        {
          message: SAK11_MESSAGE,
          severity: DiagnosticSeverity.Error,
          path: [...context.path, 'flows'],
        },
      ];
    }
    return [];
  },
});

const API_KEY_GIVEN = "$.components.securitySchemes[?(@ && @.type=='apiKey')]";
const SAK15_MESSAGE = 'API-nycklar SKALL INTE inkluderas i URL eller querysträngen';

export const Sak15 = defineRule({
  id: 'SAK.15',
  area: AREA,
  description: '-',
  message: SAK15_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: API_KEY_GIVEN,
  validate: (targetVal: any) => {
    if (targetVal?.in && String(targetVal.in).toLowerCase() === 'query') {
      return [{ message: SAK15_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

const SAK16_MESSAGE =
  'API-nycklar SKALL inkluderas i HTTP-headern eftersom querysträngar kan sparas av klienten eller servern i okrypterat format av webbläsaren eller serverapplikationen.';

export const Sak16 = defineRule({
  id: 'SAK.16',
  area: AREA,
  description: 'API-nycklar SKALL inkluderas i HTTP-headern eftersom querysträngar kan sparas i okrypterat format.',
  message: SAK16_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: API_KEY_GIVEN,
  validate: (targetVal: any) => {
    if (String(targetVal?.in ?? '').toLowerCase() !== 'header') {
      return [{ message: SAK16_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

export const Sak18 = defineRule({
  id: 'SAK.18',
  area: AREA,
  description: 'OAuth är ett auktorisationsprotokoll som säkert delegerar behörighet till en annan resurs.',
  message: 'OAuth version 2.0 eller senare BÖR användas för auktorisation.',
  severity: DiagnosticSeverity.Warning,
  given:
    "$..[securitySchemes][?(@ && @.type=='oauth2' && @.flows ? true : false)][*].[?(@property && @property.match(/Url$/i))]",
  then: [
    {
      function: pattern,
      functionOptions: {
        notMatch: '^http:',
      },
    },
  ],
});

const SAK29_MESSAGE =
  'Man BÖR (SAK.29) respektera angiven Content-Type i header. Förfrågningar som innehåller oväntade eller saknade Content-Type headers bör avvisas med HTTP-status 415 Unsupported Media Type.';

export const Sak29 = defineRule({
  id: 'SAK.29',
  area: AREA,
  message: SAK29_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.paths[*][post,put,patch,delete,options]',
  validate: (targetVal: any) => {
    if (!targetVal?.requestBody) {
      return [];
    }
    const response415 = targetVal.responses && (targetVal.responses['415'] || targetVal.responses[415]);
    if (response415) {
      return [];
    }
    return [{ message: SAK29_MESSAGE, severity: DiagnosticSeverity.Warning }];
  },
});
