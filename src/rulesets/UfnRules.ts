// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { pattern } from '@stoplight/spectral-functions';
import { DiagnosticSeverity } from '@stoplight/types';
import { defineRule } from './defineRule.js';

const AREA = 'URL Format och namngivning';
const MAX_URL_LENGTH = 2048;

const UFN01_DESCRIPTION = '{protokoll}://{domännamn}/{api}/{version}/{resurs}/{identifierare}?{parametrar}';
const UFN01_MESSAGE = 'En URL för ett API BÖR följa namnstandarden nedan: ' + UFN01_DESCRIPTION;
const UFN01_BASE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/]+\/[^/]+\/v[0-9]+\/?$/i;

export const Ufn01 = defineRule({
  id: 'UFN.01',
  area: AREA,
  description: UFN01_DESCRIPTION,
  message: UFN01_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.servers[*]',
  validate: (server: any) => {
    const url = server?.url;
    if (typeof url !== 'string') {
      return [];
    }
    const variables = server.variables ?? {};
    let resolvable = true;
    const resolvedUrl = url.replace(/\{([^}]+)\}/g, (_placeholder: string, name: string) => {
      const variable = Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : undefined;
      if (
        variable === null ||
        typeof variable !== 'object' ||
        !Object.prototype.hasOwnProperty.call(variable, 'default')
      ) {
        resolvable = false;
        return '';
      }
      return String(variable.default);
    });

    if (resolvable && UFN01_BASE_URL_PATTERN.test(resolvedUrl)) {
      return [];
    }
    return [{ message: UFN01_MESSAGE, severity: DiagnosticSeverity.Warning }];
  },
});

const UFN02_MESSAGE = 'Alla API:er SKALL exponeras via HTTPS på port 443.';
const HTTPS_PROTOCOL_PATTERN = /^https:/i;
const PORT_PATTERN = /(?<port>:[0-9]+)\//;

export const Ufn02 = defineRule({
  id: 'UFN.02',
  area: AREA,
  message: UFN02_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.servers.[url]',
  validate: (targetVal: string) => {
    const url = String(targetVal ?? '');
    const port = url.match(PORT_PATTERN);
    if (HTTPS_PROTOCOL_PATTERN.test(url)) {
      if (port == null || port.groups?.port === ':443') {
        return [];
      }
    }
    return [{ message: UFN02_MESSAGE, severity: DiagnosticSeverity.Error }];
  },
});

const UFN05_MESSAGE = 'En URL BÖR INTE vara längre än 2048 tecken.';

function extractEffectivePaths(pathsObj: any): { string: string; jsonPath: string }[] {
  if (!pathsObj || typeof pathsObj !== 'object') {
    return [];
  }
  const pathArray: { string: string; jsonPath: string }[] = [];
  for (const [pathKey, pathItem] of Object.entries<any>(pathsObj)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [, methodObj] of Object.entries<any>(pathItem)) {
      if (!methodObj || typeof methodObj !== 'object') continue;
      let pathStr = pathKey;
      let paramStr = '';
      if (Array.isArray(methodObj.parameters)) {
        for (const parameter of methodObj.parameters) {
          if (parameter?.in === 'path' && parameter?.name) {
            paramStr += `${parameter.name}=&`;
          }
        }
        if (paramStr.length > 0) {
          pathStr += `?${paramStr}`;
        }
      }
      pathArray.push({ string: pathStr, jsonPath: pathKey });
    }
  }
  return pathArray;
}

export const Ufn05Servers = defineRule({
  id: 'UFN.05',
  area: AREA,
  description: UFN05_MESSAGE,
  message: UFN05_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.servers[*].url',
  validate: (targetVal: any, _opts: any, paths: any) => {
    const urlStr = String(targetVal ?? '');
    if (urlStr.length > MAX_URL_LENGTH) {
      return [
        {
          message: UFN05_MESSAGE,
          severity: DiagnosticSeverity.Warning,
          path: paths.path,
        },
      ];
    }
    return [];
  },
});

export const Ufn05paths = defineRule({
  id: 'UFN.05',
  area: AREA,
  description: UFN05_MESSAGE,
  message: UFN05_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.paths',
  validate: (targetVal: any, _opts: any, context: any) => {
    const result: any[] = [];
    const pathArray = extractEffectivePaths(targetVal);
    const rootDoc = context?.document?.data as any;
    const servers: any[] = Array.isArray(rootDoc?.servers) ? rootDoc.servers : [];

    for (const pathEntry of pathArray) {
      if (pathEntry.string.length > MAX_URL_LENGTH) {
        result.push({
          message: UFN05_MESSAGE,
          severity: DiagnosticSeverity.Warning,
          path: ['paths', pathEntry.jsonPath],
        });
      } else {
        servers.forEach((server, idx) => {
          const baseUrl = typeof server?.url === 'string' ? server.url : '';
          if (baseUrl.length > 0 && baseUrl.length <= MAX_URL_LENGTH && baseUrl.length + pathEntry.string.length > MAX_URL_LENGTH) {
            result.push(
              {
                message: UFN05_MESSAGE,
                severity: DiagnosticSeverity.Warning,
                path: ['paths', pathEntry.jsonPath],
              },
              {
                message: UFN05_MESSAGE,
                severity: DiagnosticSeverity.Warning,
                path: ['servers', idx, 'url'],
              },
            );
          }
        });
      }
    }
    return result;
  },
});

const UFN08_MESSAGE =
  "Endast bindestreck '-' SKALL användas för att separera ord för att öka läsbarheten samt förenkla för sökmotorer att indexera varje ord för sig (gäller URL-elementen Authority och Path. Mer specifikt API-elementen domännamn, api, resurs, identifierare).";

export const Ufn08 = defineRule({
  id: 'UFN.08',
  area: AREA,
  message: UFN08_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*]~',
  validate: (targetVal: string) => {
    const pathElements = String(targetVal ?? '')
      .split('/')
      .filter((part) => part && !part.startsWith('{'));

    for (const part of pathElements) {
      if (/[,._~]+/.test(part) || part.startsWith('-') || part.endsWith('-') || part.includes('--')) {
        return [{ message: UFN08_MESSAGE, severity: DiagnosticSeverity.Error }];
      }
    }
    return [];
  },
});

const UFN07_MESSAGE =
  'URL:n SKALL använda dessa tecknen a-z, 0-9, "-", "." samt "~", se vidare i RFC 3986) (gäller URL-elementen Scheme, Authority och Path samt API-elementen protokoll, domännamn, api, version, resurs och identifierare).';
const UFN07_REMOVE_TEMPLATING = /{.[^{}]*}/;
const UFN07_ALLOWED_CHARS = /^[a-z0-9/\-,.~]+$/;

export const Ufn07 = defineRule({
  id: 'UFN.07',
  area: AREA,
  message: UFN07_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.',
  trackWhen: (targetVal: any) => {
    const hasServerUrl =
      Array.isArray(targetVal?.servers) &&
      targetVal.servers.some((s: any) => s && Object.prototype.hasOwnProperty.call(s, 'url'));
    const hasPaths = Boolean(targetVal?.paths && Object.keys(targetVal.paths).length > 0);
    return hasServerUrl || hasPaths;
  },
  then: [
    {
      field: 'servers',
      function: (targetVal: any, _opts: any, paths: any) => {
        const result: any[] = [];
        if (Array.isArray(targetVal)) {
          for (let i = 0; i < targetVal.length; i++) {
            if (targetVal[i] && Object.prototype.hasOwnProperty.call(targetVal[i], 'url')) {
              const url = String(targetVal[i].url)
                .replace(/:/g, '')
                .split(UFN07_REMOVE_TEMPLATING)
                .join('');
              if (!UFN07_ALLOWED_CHARS.test(url)) {
                result.push({
                  path: [...paths.path, i, 'url'],
                  message: UFN07_MESSAGE,
                  severity: DiagnosticSeverity.Error,
                });
              }
            }
          }
        }
        return result;
      },
    },
    {
      field: 'paths',
      function: (targetVal: any, _opts: any, paths: any) => {
        const result: any[] = [];
        if (targetVal && typeof targetVal === 'object') {
          for (const rawPath of Object.keys(targetVal)) {
            const cleanedPath = rawPath.split(UFN07_REMOVE_TEMPLATING).join('');
            if (!UFN07_ALLOWED_CHARS.test(cleanedPath)) {
              result.push({
                path: [...paths.path, cleanedPath],
                message: UFN07_MESSAGE,
                severity: DiagnosticSeverity.Error,
              });
            }
          }
        }
        return result;
      },
    },
  ],
});

const UFN09_DESCRIPTION =
  "Blanksteg ' ' och understreck '_' SKALL INTE användas i URL:er med undantag av parameter-delen.";
const UFN09_MESSAGE =
  "Blanksteg ' ' och understreck '_' SKALL INTE användas i URL:er med undantag av parameter-delen (gäller alltså URL-elementen Scheme, Authority och Path samt API-elementen protokoll, domännamn, api, version, resurs och identifierare).";

const UFN09_THEN = [
  {
    function: pattern,
    functionOptions: {
      notMatch: '/[\\s_]/',
    },
  },
];

export const Ufn09Server = defineRule({
  id: 'UFN.09',
  area: AREA,
  description: UFN09_DESCRIPTION,
  message: UFN09_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.servers.[url]',
  then: UFN09_THEN,
});

export const Ufn09InPathParameters = defineRule({
  id: 'UFN.09',
  area: AREA,
  description: UFN09_DESCRIPTION,
  message: UFN09_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: "$.paths.*.*.parameters[?(@.in=='path')].name",
  then: UFN09_THEN,
});

export const Ufn09Path = defineRule({
  id: 'UFN.09',
  area: AREA,
  description: UFN09_DESCRIPTION,
  message: UFN09_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths[*]~',
  then: UFN09_THEN,
});
