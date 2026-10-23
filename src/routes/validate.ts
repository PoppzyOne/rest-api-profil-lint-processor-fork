// SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import * as fs from 'node:fs';
import { Express } from 'express';
import { decodeBase64String, logError } from '../util/apiUtil.js';
import { ApiInfo } from '../model/ApiInfo.js';
import { ExcelReportProcessor } from '../util/excelReportProcessor.js';
import { RapLPDiagnostic } from '../util/RapLPDiagnostic.js';
import { ProblemDetailsDTO } from '../model/ProblemDetailsDto.js';
import { SpecValidationRequestDto } from '../model/SpecValidationRequestDto.js';
import { ERROR_TYPE, RapLPBaseApiError, sendProblem } from '../util/RapLPBaseApiErrorHandling.js';
import { RuleExecutionContext } from '../util/RuleExecutionContext.js';
import { RULE_REGISTRY } from '../rulesets/util/ruleModules.js';
import { mapValidationExecutionError } from '../util/mapValidationExecutionError.js';
import { executeApiSpecValidationFlow } from '../util/validationPipeline.js';
import { validateConcurrencyLimit } from '../util/validationConcurrencyLimit.js';
import { measure } from '../util/performance.js';
import crypto from 'node:crypto';

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export const registerValidationRoutes = (app: Express) => {
  app.get('/api/v1/validation/rules', (_req, res) => {
    res.send(RULE_REGISTRY);
  });

  app.get('/api/v1/api-info', async (_req, res) => {
    res.send(new ApiInfo('RAP-LP API', pkg.apiVersion, '2026-06-16', 'https://raplp.digg.se/api/v1/docs', 'active'));
  });

  app.post(
    '/api/v1/validation/generate-report',
    validateConcurrencyLimit(Number(process.env.RAP_LP_MAX_CONCURRENT_REPORTS ?? 4)),
    async (req, res, next): Promise<any> => {
      try {
        const data = req.body;
        const context = new RuleExecutionContext();
        const reportHandler = new ExcelReportProcessor();
        let buffer: Buffer;

        const customDiagnostic = new RapLPDiagnostic(context);
        customDiagnostic.setFromPrecomputedReport(data.report);
        customDiagnostic.processDiagnosticInformation();

        try {
          buffer = reportHandler.generateReportDocumentBuffer(customDiagnostic);
        } catch (error) {
          console.error('Error generating report buffer:', error);
          return sendProblem(
            res,
            500,
            new ProblemDetailsDTO({
              type: 'https://raplp.digg.se/problems/internal-server-error',
              title: 'Failed to generate report',
              status: 500,
              detail: 'Failed to generate report.',
              instance: req.originalUrl,
            }),
          );
        }

        res.setHeader('Content-Disposition', 'attachment; filename="avstamningsfil.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
      } catch (e) {
        next(e);
      }
    },
  );

  app.post(
    '/api/v1/validation/validatespec',
    validateConcurrencyLimit(Number(process.env.RAP_LP_MAX_CONCURRENT_VALIDATIONS ?? 4)),
    async (req, res, next) => {
      let strict = true;
      try {
        const requestId = crypto.randomUUID();
        const body: SpecValidationRequestDto = req.body;

        if (!body.spec) {
          throw new RapLPBaseApiError('Invalid Request', 'Required field missing: spec', ERROR_TYPE.BAD_REQUEST);
        }
        if (typeof body.spec !== 'string') {
          throw new RapLPBaseApiError(
            'Invalid Request',
            'Field "spec" must be a base64 encoded string',
            ERROR_TYPE.BAD_REQUEST,
          );
        }

        const raw = await measure({ requestId, operation: 'Decoding Base64String' }, () =>
          decodeBase64String(body.spec),
        );

        strict = body.strict ?? true;
        const categories = body.categories ?? [];

        return await executeApiSpecValidationFlow({
          req,
          res,
          raw,
          strict,
          categories,
          requestId,
        });
      } catch (e) {
        logError(e);
        next(
          mapValidationExecutionError(e, {
            strictEnabled: strict,
          }),
        );
      }
    },
  );
};
