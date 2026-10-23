// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { DiagnosticSeverity } from '@stoplight/types';
import { defineRule } from './defineRule.js';

const AREA = 'Felhantering';
const MANDATORY_PROBLEM_PROPERTIES = ['type', 'title', 'status', 'detail', 'instance'];
const FEL01_MESSAGE = `Om HTTP svarskoderna inte räcker\u00A0SKALL\u00A0(FEL.01) API:et beskriva feldetaljer enligt RFC 9457 med dessa ingående attribut; ${MANDATORY_PROBLEM_PROPERTIES.join(
  ', ',
)}.`;

type OpenApiSchema = {
  $ref?: string;
  allOf?: unknown[];
  oneOf?: unknown[];
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

type OpenApiObject = OpenApiSchema & {
  type: 'object';
};

const isOpenApiSchema = (x: unknown): x is OpenApiSchema =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const isOpenApiObject = (x: unknown): x is OpenApiObject =>
  isOpenApiSchema(x) && x.type === 'object';

function resolveLocalRef(ref: string, rootDocument: unknown, visitedRefs: Set<string>): unknown {
  if (!ref.startsWith('#/') || !isOpenApiSchema(rootDocument) || visitedRefs.has(ref)) {
    return undefined;
  }
  visitedRefs.add(ref);

  const pathSegments = ref
    .slice(2)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current: unknown = rootDocument;
  for (const segment of pathSegments) {
    if (!isOpenApiSchema(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function collectSchemaInfo(
  schema: unknown,
  rootDocument: unknown,
  visitedRefs: Set<string>,
): { properties: Set<string>; required: Set<string> } {
  const properties = new Set<string>();
  const required = new Set<string>();

  if (!isOpenApiSchema(schema)) {
    return { properties, required };
  }

  if (isOpenApiObject(schema)) {
    if (schema.properties) {
      Object.keys(schema.properties).forEach((key) => properties.add(key));
    }
    if (Array.isArray(schema.required)) {
      schema.required.forEach((key) => required.add(key));
    }
  }

  if (typeof schema.$ref === 'string') {
    const resolved = resolveLocalRef(schema.$ref, rootDocument, visitedRefs);
    if (resolved) {
      const refInfo = collectSchemaInfo(resolved, rootDocument, visitedRefs);
      refInfo.properties.forEach((p) => properties.add(p));
      refInfo.required.forEach((r) => required.add(r));
    }
  }

  if (Array.isArray(schema.allOf)) {
    for (const subSchema of schema.allOf) {
      const subInfo = collectSchemaInfo(subSchema, rootDocument, visitedRefs);
      subInfo.properties.forEach((p) => properties.add(p));
      subInfo.required.forEach((r) => required.add(r));
    }
  }

  return { properties, required };
}

export const Fel01 = defineRule({
  id: 'FEL.01',
  area: AREA,
  message: FEL01_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: [
    "$.paths.*.*.responses.*.content['application/problem+json'].schema",
    "$.paths.*.*.responses.*.content['application/problem+xml'].schema",
  ],
  validate: (targetVal: unknown, _opts: unknown, context: any) => {
    const rootDocument = context?.document?.data;
    if (!isOpenApiSchema(targetVal)) {
      return [{ message: 'Schema must be an object' }];
    }
    if (Array.isArray(targetVal.oneOf)) {
      return [{ message: FEL01_MESSAGE }];
    }

    const schemaInfo = collectSchemaInfo(targetVal, rootDocument, new Set<string>());
    return MANDATORY_PROBLEM_PROPERTIES.flatMap((mandatory) => {
      const issues: Array<{ message: string }> = [];
      if (!schemaInfo.properties.has(mandatory)) {
        issues.push({ message: `Missing property: ${mandatory}` });
      }
      if (!schemaInfo.required.has(mandatory)) {
        issues.push({ message: `Missing required field: ${mandatory}` });
      }
      return issues;
    });
  },
});

const FEL02_MESSAGE =
  'Schemat enligt RFC 9457 bör innehålla de beskrivna attributen i FEL.01 och SKALL (FEL.02) använda mediatypen application/problem+json eller application/problem+xml i svaret.';

export const Fel02 = defineRule({
  id: 'FEL.02',
  area: AREA,
  message: FEL02_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: "$.paths[*][*].responses[?(@property == 'default' || @property >= 400)].content",
  validate: (targetVal: any, _opts: any, paths: any) => {
    const hasJson = Boolean(targetVal?.['application/problem+json']);
    const hasXml = Boolean(targetVal?.['application/problem+xml']);
    if (!hasJson && !hasXml) {
      return [{ message: FEL02_MESSAGE, path: paths.given }];
    }
    return [];
  },
});
