// SPDX-FileCopyrightText: 2025 diggsweden/rest-api-profil-lint-processor
//
// SPDX-License-Identifier: EUPL-1.2

import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import { prettifySwaggerParserErrorToEditorStyle } from './prettifyOpenAPIErrors.js';
import * as SpectralCore from '@stoplight/spectral-core';
import { Document as SpectralDocument } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';
import * as fs2 from 'node:fs';
import { RapLPCustomSpectral } from './RapLPCustomSpectral.js';
import Parsers from '@stoplight/spectral-parsers';
import type { IParser } from '@stoplight/spectral-parsers';
import * as IssueHelper from './RapLPIssueHelpers.js';
import { SpecParseError } from './RapLPSpecParseError.js';
import { Issue } from './Issue.js';

type ExternalRefFinding = {
  path: string;
  ref: string;
};

/**
 * Possible input types for specifications
 * - filePath: Read from filesystem
 * - raw: raw text (probably YAML or JSON)
 * - base64: base64-coded content
 * - parsed: already parsed object (skip parsing)
 */
export type SpecInput =
  | { filePath: string }
  | { raw: string }
  | { base64: string }
  | { parsed: any };

/**
 * Return result after successful parsing
 */
export type ParseResult = {
  format: 'json' | 'yaml';
  raw: string;
  parsed: any;
  strictIssues?: Issue[];
};

export type ParseOptions = {
  preferJsonError?: 'auto' | 'never' | 'always';
  /**
   * Limit how long the snippet in SpecParseError can be (optional).
   */
  maxSnippetLength?: number;
  disableSanity?: boolean;
  strict?: boolean;
};

export type PreferJsonOption = 'auto' | 'never' | 'always';

const SELECTED_OAS_SEMANTIC_RULES = [
  'path-params',
  'operation-operationId-unique',
  'operation-parameters',
  'oas3-schema',
] as const;

/**
 * detectSpecFormatPreference
 * --------------------------------
 * Function to determine how we should interpret the format of the OpenAPI Specification.
 * Normal case is either JSON, YAML or undefined format
 *          'always' Expect JSON, give JSON-errorMessages
 *          'never'  Expect YAML, give YAML-errorMessages
 *          'auto'   Try to solve format based on content
 * Returns: PreferJsonOption
 */
export function detectSpecFormatPreference(
  filePath?: string | null,
  raw?: string | null,
  defaultOption: PreferJsonOption = 'never',
): PreferJsonOption {
  if (filePath) {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    if (ext === 'json') return 'always';
    if (ext === 'yaml' || ext === 'yml') return 'never';
  }

  if (raw) {
    const t = raw.trim();
    if (t.startsWith('{') || t.startsWith('[')) return 'always';
    if (/^\s*<\?xml|^\s*<[\w-]+[\s>]/i.test(t)) return 'never';
  }

  return defaultOption;
}

/**
 * @param input SpecInput // input type for specifications
 * @param opts ParseOptions (Optional)
 * @returns Promise<ParseResult>
 * @throws SpecParseError if the content is not valid JSON or YAML.
 */
export async function parseApiSpecInput(
  input: SpecInput,
  opts: ParseOptions = {},
): Promise<ParseResult> {
  const prefer = opts.preferJsonError ?? 'never';
  const maxSnippetLength = opts.maxSnippetLength ?? 5000;
  const strict = opts.strict ?? false;

  if ('parsed' in input) {
    const parsed = input.parsed;
    if (!isOpenApiLike(parsed)) {
      throw new SpecParseError('Det parsade objektet verkar inte vara en giltig OpenAPI-specifikation.', {
        source: 'unknown',
        stage: 'sanity',
      });
    }
    const serialized = JSON.stringify(parsed, null, 2);
    let strictIssues: Issue[] | undefined;
    if (strict) {
      try {
        await runStrictValidationIfRequested(parsed, 'json');
      } catch (err: any) {
        const pretty = prettifySwaggerParserErrorToEditorStyle(err?.message ?? String(err), serialized);
        strictIssues = IssueHelper.parsePrettyLinesToIssues(pretty);
      }
    }
    return { format: 'json', raw: serialized, parsed, strictIssues };
  }

  // Step one - Get raw text from input
  let raw: string;
  try {
    raw = getRawFromInput(input);
  } catch (e: any) {
    throw new SpecParseError(String(e.message || e), {
      source: 'unknown',
      stage: 'sanity',
    });
  }

  // Step two - Create "stripped" variant (removes SPDX comments, empty lines, block comment at the beginning)
  const stripped = stripLeadingCommentsAndWhitespace(raw).trimStart();

  // Step three - Quick XML detection: If looks like XML -> reject
  ensureIsNotXmlLike(stripped);

  // Step four - Check if input looks like JSON or YAML
  const jsonCandidate = looksLikeJson(stripped);
  const yamlCandidate = looksLikeYamlOpenApi(stripped);

  if (!jsonCandidate && !yamlCandidate) {
    throw new SpecParseError('Innehållet verkar inte vara JSON eller YAML.', {
      source: 'unknown',
      stage: 'sanity',
    });
  }

  // Step five - Decision logic when choosing parser
  const shouldTryJson = prefer === 'always' || (prefer === 'auto' && jsonCandidate);
  const shouldTryYaml = prefer === 'never' || (prefer === 'auto' && yamlCandidate && !jsonCandidate);

  let lastJsonError: SpecParseError | SyntaxError | undefined;
  let parsedSpec: any;
  let target: any;

  // Step six - Try parse in chosen order, and return ParseResult or throw SpecParseError
  if (shouldTryJson) {
    try {
      parsedSpec = tryParseJson(raw);
      target = 'json';
    } catch (e: any) {
      if (e instanceof SpecParseError) {
        lastJsonError = e;
        if (prefer === 'always') throw e;
      } else {
        throw e;
      }
    }
  } else if (!parsedSpec && shouldTryYaml) {
    try {
      parsedSpec = tryParseYaml(raw, maxSnippetLength);
      target = 'yaml';
    } catch (yamlErr: any) {
      if (yamlErr instanceof SpecParseError) throw yamlErr;
      if (lastJsonError) throw lastJsonError;

      throw new SpecParseError('Kunde inte tolka innehållet som JSON eller YAML.', {
        source: 'unknown',
        stage: 'sanity',
      });
    }
  }

  // Make sure parsed specification is OpenAPI like
  ensureIsOpenApiLike(parsedSpec, target);
  // Make sure parsed specification is a secure OpenAPI like
  ensureIsSecureOpenApiLike(parsedSpec, target);

  let issues: Issue[] | undefined;
  let prettyLines: string[] = [];

  if (strict) {
    try {
      await runStrictValidationIfRequested(parsedSpec, target);
    } catch (err: any) {
      prettyLines = prettifySwaggerParserErrorToEditorStyle(err?.message ?? String(err), raw ?? '');
    }

    let spectralDiagnostics: SpectralCore.ISpectralDiagnostic[] = [];
    try {
      const parser: IParser<any> = (target === 'json' ? Parsers.Json : Parsers.Yaml) as unknown as IParser<any>;
      const apiSpecDocument = new SpectralDocument(raw, parser, '');
      spectralDiagnostics = await semanticValidate(apiSpecDocument);
    } catch (e: any) {
      console.error('Spectral semantic validation failed (non-fatal):', e?.message ?? String(e));
      spectralDiagnostics = [];
    }
    const finalIssues = IssueHelper.buildIssuesFromPrettyAndSpectral(
      prettyLines ?? [],
      spectralDiagnostics,
      true /* addOneToLine */,
    );
    issues = Array.isArray(finalIssues) && finalIssues.length ? finalIssues : undefined;
  }

  return { format: target, raw, parsed: parsedSpec, strictIssues: issues };
}

/**
 * Helper function to decode Base64 encoded string
 */
export function decodeBase64String(base64YamlFile: string): string {
  return Buffer.from(base64YamlFile, 'base64').toString('utf-8');
}

function isOpenApiLike(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if ('openapi' in obj) return true;
  if ('swagger' in obj) return true;
  if ('paths' in obj && 'info' in obj) return true;
  return false;
}

function stripLeadingCommentsAndWhitespace(raw: string): string {
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i].trim();
    if (ln === '' || ln.startsWith('#') || ln.startsWith('//')) {
      i++;
      continue;
    }
    if (ln.startsWith('/*')) {
      let j = i;
      while (j < lines.length && !lines[j].includes('*/')) j++;
      i = j + 1;
      continue;
    }
    break;
  }
  return lines.slice(i).join('\n');
}

function ensureIsSecureOpenApiLike(parsed: any, target: any) {
  const violations: string[] = [];
  if (findExternalRefs(parsed).length > 0) {
    violations.push('Externa $ref-referenser är ej tillåtna.');
  }
  if (violations.length > 0) {
    throw new SpecParseError(
      [
        'API-specifikationen innehåller konstruktioner som inte är tillåtna enligt säkerhetsreglerna:',
        ...violations.map((v) => ` * ${v}`),
      ].join('\n'),
      {
        source: target,
        stage: 'security',
      },
    );
  }
}

function ensureIsOpenApiLike(parsed: any, target: any) {
  if (!isOpenApiLike(parsed)) {
    throw new SpecParseError(
      'Filen verkar inte vara en giltig OpenAPI-specifikation (saknar openapi/swagger eller paths+info).',
      { source: target, stage: 'sanity' },
    );
  }
}

function ensureIsNotXmlLike(stripped: string) {
  if (/^\s*<\?xml|^\s*<[\w-]+[\s>]/i.test(stripped)) {
    throw SpecParseError.fromXmlNotice();
  }
}

function looksLikeJson(stripped: string): boolean {
  const s = stripped.trimStart();
  return s.startsWith('{') || s.startsWith('[');
}

function looksLikeYamlOpenApi(stripped: string): boolean {
  const s = stripped.trimStart();
  if (s.startsWith('openapi:') || s.startsWith('swagger:') || s.startsWith('---') || s.startsWith('info:')) return true;
  return /^[a-zA-Z0-9_-]+\s*:/.test(s);
}

function tryParseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (e: any) {
    throw SpecParseError.fromJsonError(e);
  }
}

function tryParseYaml(raw: string, maxSnippetLength: number): any {
  try {
    return yaml.load(raw);
  } catch (e: any) {
    if (e && typeof e === 'object' && (e.name === 'YAMLException' || e.mark)) {
      const spe = SpecParseError.fromYamlError(e);
      if (spe.snippet && spe.snippet.length > maxSnippetLength) {
        spe.snippet = spe.snippet.slice(0, maxSnippetLength) + '...(truncated)';
      }
      throw spe;
    }
    throw new SpecParseError('Kunde inte tolka YAML-innehållet.', { source: 'yaml', stage: 'sanity' });
  }
}

export function getRawFromInput(input: SpecInput): string {
  if ('filePath' in input) {
    return fs2.readFileSync(input.filePath, 'utf8');
  } else if ('raw' in input) {
    return input.raw;
  } else if ('base64' in input) {
    return decodeBase64String(input.base64);
  } else if ('parsed' in input) {
    throw new Error('invalid variant to parse with');
  }
  throw new Error('Unexpected error - invalid input when trying to get raw from input');
}

async function runStrictValidationIfRequested(
  parsed: any,
  source: 'yaml' | 'json' | 'xml' | 'unknown' = 'unknown',
): Promise<void> {
  try {
    await SwaggerParser.validate(parsed);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    throw new SpecParseError(`Strict validation failed: ${msg}`, {
      source,
      stage: 'strict',
      cause: e,
    });
  }
}

/**
 * semanticValidate - in-memory Spectral OAS semantic validation without temp files
 */
export async function semanticValidate(
  apiSpecDocument: SpectralDocument,
): Promise<SpectralCore.ISpectralDiagnostic[]> {
  const runner = new RapLPCustomSpectral();

  const rules: Record<string, boolean> = {};
  for (const ruleName of SELECTED_OAS_SEMANTIC_RULES) {
    if (oas.rules && ruleName in oas.rules) {
      rules[ruleName] = true;
    }
  }

  runner.setRawRuleset({
    extends: [[oas as any, 'off']],
    rules,
  });

  return runner.runSemanticValidation(apiSpecDocument);
}

function findExternalRefs(parsed: any): ExternalRefFinding[] {
  const findings: ExternalRefFinding[] = [];

  function walk(node: any, path: string) {
    if (!node || typeof node !== 'object') return;

    if (typeof node.$ref === 'string' && isExternalRef(node.$ref)) {
      findings.push({
        path: `${path}.$ref`,
        ref: node.$ref,
      });
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, path ? `${path}.${escapePathPart(key)}` : escapePathPart(key));
    }
  }
  walk(parsed, '');
  return findings;
}

function isExternalRef(ref: string): boolean {
  const normalized = ref.trim();
  return !normalized.startsWith('#/');
}

function escapePathPart(part: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) ? part : `[${JSON.stringify(part)}]`;
}
