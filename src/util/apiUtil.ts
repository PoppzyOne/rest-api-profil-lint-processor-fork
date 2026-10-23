// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import * as fs from 'node:fs';
import { RapLPCustomSpectral } from './RapLPCustomSpectral.js';
import { Document } from '@stoplight/spectral-core';
import Parsers from '@stoplight/spectral-parsers';
import { DiagnosticReport, RapLPDiagnostic } from '../util/RapLPDiagnostic.js';
import { ValidationResponseDto } from '../model/ValidationResponseDto.js';
import { RuleExecutionContext } from './RuleExecutionContext.js';
import { AggregateError } from '../util/RapLPCustomErrorInfo.js';
import { decodeBase64String as decodeBase64 } from './validateUtil.js';

/**
 * RAP_LP_LOG_TARGET=stderr should be default mode in container.
 * Use RAP_LP_LOG_TARGET=file to activate a mode that supports writing to disk!
 */
const LOG_TARGET = process.env.RAP_LP_LOG_TARGET ?? 'stderr';
function writeLog(fileName: string, message: string) {
  if (LOG_TARGET === 'file') {
    fs.appendFileSync(fileName, message);
    return;
  }

  console.error(message.trimEnd());
}

declare var AggregateError: {
  prototype: AggregateError;
  new (errors: any[], message?: string): AggregateError;
};

export const decodeBase64String = decodeBase64;

export async function processApiSpec(
  context: RuleExecutionContext,
  enabledRulesAndCategorys: {
    rules: Record<string, any>;
    instanceCategoryMap: Map<string, any>;
  },
  apiSpecDocument: Document<unknown, Parsers.YamlParserResult<unknown>>,
): Promise<ValidationResponseDto> {
  const customSpectral = new RapLPCustomSpectral();
  customSpectral.setCategorys(enabledRulesAndCategorys.instanceCategoryMap);
  customSpectral.setRuleset(enabledRulesAndCategorys.rules);
  const result = await customSpectral.run(apiSpecDocument);

  const customDiagnostic = new RapLPDiagnostic(context);
  customDiagnostic.processRuleExecutionInformation(
    result,
    enabledRulesAndCategorys.rules,
    enabledRulesAndCategorys.instanceCategoryMap,
  );
  const diagnosticReports: DiagnosticReport[] = customDiagnostic.processDiagnosticInformation();

  const sortedReports: DiagnosticReport[] = diagnosticReports.map((report) => ({
    ...report,
    rules: [...report.rules].sort((a, b) => a.id.localeCompare(b.id)),
  }));
  return { result, report: sortedReports };
}

export function hasOwnProperty<X extends {}, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Log error. Either to stderr or to disk!
 */
export function logError(error: any) {
  const errorMessage = `${new Date().toISOString()} - ${error.stack ?? error}\n`;
  writeLog('rap-lp-api-mode-error.log', errorMessage);

  if (error.errors) {
    const detailedMessage = `${new Date().toISOString()} - ${JSON.stringify(error.errors, null, 2)}\n`;
    writeLog('rap-lp-api-mode-error.log', detailedMessage);
  }

  if (error instanceof AggregateError) {
    error.errors.forEach((err: any, index: number) => {
      const causeMessage = `Cause ${index + 1}: ${err.stack || err}\n`;
      writeLog('rap-lp-api-mode-error.log', causeMessage);
    });
  }
}
