// SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { Document as SpectralDocument } from '@stoplight/spectral-core';
import Parsers from '@stoplight/spectral-parsers';
import type { IParser } from '@stoplight/spectral-parsers';
import { Request, Response } from 'express';
import { RapLPCustomSpectral } from './RapLPCustomSpectral.js';
import { DiagnosticReport, RapLPDiagnostic } from './RapLPDiagnostic.js';
import { RuleExecutionContext } from './RuleExecutionContext.js';
import { importAndCreateRuleInstances } from './ruleUtil.js';
import { parseRuleCategories, resolveRuleCategories, RuleModuleName } from '../rulesets/util/ruleModules.js';
import { detectSpecFormatPreference, parseApiSpecInput, ParseResult } from './validateUtil.js';
import * as IssueHelper from './RapLPIssueHelpers.js';
import { ProblemDetailsDTO } from '../model/ProblemDetailsDto.js';
import { sendProblem } from './RapLPBaseApiErrorHandling.js';
import { ValidationResponseDto } from '../model/ValidationResponseDto.js';
import { measure } from './performance.js';

export interface RuleEngineExecutionResult {
  result: any[];
  diagnostic: RapLPDiagnostic;
  reports: DiagnosticReport[];
  sortedReports: DiagnosticReport[];
}

export function createSpectralDocument(parseResult: ParseResult, sourceName = 'payload.yaml'): SpectralDocument {
  const parser: IParser<any> = (parseResult.format === 'json' ? Parsers.Json : Parsers.Yaml) as unknown as IParser<any>;
  return new SpectralDocument(parseResult.raw, parser, sourceName);
}

export async function executeRuleEngine(
  parseResult: ParseResult,
  resolvedCategories: RuleModuleName[],
  sourceName = 'payload.yaml',
): Promise<RuleEngineExecutionResult> {
  const context = new RuleExecutionContext();
  const enabledRulesAndCategories = await importAndCreateRuleInstances(context, resolvedCategories);
  const apiSpecDocument = createSpectralDocument(parseResult, sourceName);

  const customSpectral = new RapLPCustomSpectral();
  customSpectral.setCategorys(enabledRulesAndCategories.instanceCategoryMap);
  customSpectral.setRuleset(enabledRulesAndCategories.rules);
  const result = await customSpectral.run(apiSpecDocument);

  const diagnostic = new RapLPDiagnostic(context);
  diagnostic.processRuleExecutionInformation(
    result,
    enabledRulesAndCategories.rules,
    enabledRulesAndCategories.instanceCategoryMap,
  );
  const reports = diagnostic.processDiagnosticInformation();
  const sortedReports = reports.map((report) => ({
    ...report,
    rules: [...report.rules].sort((a, b) => a.id.localeCompare(b.id)),
  }));

  return {
    result,
    diagnostic,
    reports,
    sortedReports,
  };
}

/**
 * Shared validation and HTTP response flow for `/api/v1/validation/validatespec` and `/api/v1/validation/url`.
 */
export async function executeApiSpecValidationFlow(options: {
  req: Request;
  res: Response;
  raw: string;
  strict: boolean;
  categories?: string[] | string;
  requestId: string;
}): Promise<Response> {
  const { req, res, raw, strict, categories = [], requestId } = options;
  const context = new RuleExecutionContext();

  const prefer = await measure({ requestId, operation: 'detectSpecFormatPreference' }, () =>
    detectSpecFormatPreference(undefined, raw, 'auto'),
  );

  const parseResult = await measure({ requestId, operation: 'parseApiSpecInput' }, () =>
    parseApiSpecInput({ raw }, { strict, preferJsonError: prefer }),
  );

  if (parseResult.strictIssues?.length) {
    const sorted = IssueHelper.sortIssues(parseResult.strictIssues);
    const snippet = IssueHelper.formatIssuesAsEditorText(sorted);

    return sendProblem(
      res,
      400,
      new ProblemDetailsDTO({
        type: 'https://raplp.digg.se/problems/semantic-validation',
        title: 'Rule validation failed',
        status: 400,
        detail: 'Specifikationen innehåller strukturella eller semantiska fel',
        instance: req.originalUrl,
        kind: 'spec-validation',
        format: parseResult.format,
        stage: 'strict',
        issues: sorted,
        snippet,
      }),
    );
  }

  const apiSpecDocument = await measure({ requestId, operation: 'create Document' }, () =>
    createSpectralDocument(parseResult, 'payload.yaml'),
  );

  const ruleCategories = parseRuleCategories(categories);
  const resolvedCategories = resolveRuleCategories(ruleCategories);

  const rules = await measure({ requestId, operation: 'importAndCreateRuleInstances' }, () =>
    importAndCreateRuleInstances(context, resolvedCategories),
  );

  const payload: ValidationResponseDto = await measure({ requestId, operation: 'processApiSpec' }, async () => {
    const customSpectral = new RapLPCustomSpectral();
    customSpectral.setCategorys(rules.instanceCategoryMap);
    customSpectral.setRuleset(rules.rules);
    const result = await customSpectral.run(apiSpecDocument);

    const customDiagnostic = new RapLPDiagnostic(context);
    customDiagnostic.processRuleExecutionInformation(result, rules.rules, rules.instanceCategoryMap);
    const diagnosticReports = customDiagnostic.processDiagnosticInformation();
    const sortedReports: DiagnosticReport[] = diagnosticReports.map((report) => ({
      ...report,
      rules: [...report.rules].sort((a, b) => a.id.localeCompare(b.id)),
    }));
    return { result, report: sortedReports };
  });

  const hasRuleViolations = payload.result.some((d) => d.severity === 'ERROR' || d.severity === 'WARNING');
  if (hasRuleViolations) {
    return sendProblem(
      res,
      400,
      new ProblemDetailsDTO({
        type: 'https://raplp.digg.se/problems/rule-validation',
        title: 'Rule validation failed',
        status: 400,
        detail: 'API-specifikationen bryter mot en eller flera regler enligt den svenska REST API-profilen.',
        instance: req.originalUrl,
        kind: 'rule-validation',
        stage: 'rule-engine',
        format: parseResult.format,
        payload,
      }),
    );
  }

  return res.status(200).json({
    ok: true,
    stage: 'rule-engine',
    format: parseResult.format,
    payload,
  });
}
