// SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { Express } from 'express';
import { logError } from '../util/apiUtil.js';
import { ERROR_TYPE, RapLPBaseApiError } from '../util/RapLPBaseApiErrorHandling.js';
import { loadUrlValidationConfiguration } from '../util/urlValidationConfig.js';
import { SpecValidationRequestDto } from '../model/SpecValidationRequestDto.js';
import { mapValidationExecutionError } from '../util/mapValidationExecutionError.js';
import { executeApiSpecValidationFlow } from '../util/validationPipeline.js';
import { validateConcurrencyLimit } from '../util/validationConcurrencyLimit.js';
import { measure } from '../util/performance.js';
import crypto from 'node:crypto';

const isIpv4Address = (value: string): boolean => {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
};

const isPrivateOrLocalIpv4 = (ip: string): boolean => {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
};

const assertSsrfSafeUrl = (config: any, urlString: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new RapLPBaseApiError('Invalid Request', 'Invalid URL format.', ERROR_TYPE.BAD_REQUEST);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new RapLPBaseApiError(
      'Invalid Request',
      'Only HTTPS and HTTP protocols are allowed.',
      ERROR_TYPE.BAD_REQUEST,
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost =
    hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1' || hostname === '[::1]';

  if (isLocalhost && !config?.allowLocalhost) {
    throw new RapLPBaseApiError('Invalid Request', 'The requested host is not allowed', ERROR_TYPE.BAD_REQUEST);
  }
  if (isIpv4Address(hostname) && isPrivateOrLocalIpv4(hostname)) {
    throw new RapLPBaseApiError('Invalid Request', 'The requested host is not allowed.', ERROR_TYPE.BAD_REQUEST);
  }
};

export const registerUrlValidationRoutes = (app: Express, urlValidationConfigFile?: string) => {
  const config = loadUrlValidationConfiguration(urlValidationConfigFile);

  app.post(
    '/api/v1/validation/url',
    validateConcurrencyLimit(Number(process.env.RAP_LP_MAX_CONCURRENT_VALIDATIONS ?? 4)),
    async (req, res, next) => {
      let strict = true;
      try {
        const requestId = crypto.randomUUID();
        const body: SpecValidationRequestDto = req.body;
        const url = body.url!;

        if (config?.urlMatchRegex && !url.match(config.urlMatchRegex)) {
          throw new RapLPBaseApiError(
            'Invalid Request',
            'The requested address did not meet the allowed URL pattern. Please contact your administrator if you believe this is a mistake.',
            ERROR_TYPE.BAD_REQUEST,
          );
        }
        assertSsrfSafeUrl(config, url);
        let response: Response;
        try {
          response = await measure({ requestId, operation: 'fetch' }, () =>
            fetch(url, { ...config?.customFetchConfig, redirect: 'error' }),
          );
        } catch {
          throw new RapLPBaseApiError(
            'Invalid Request',
            'The requested URL could not be retrieved. Redirects are not allowed.',
            ERROR_TYPE.BAD_REQUEST,
          );
        }
        if (!response.ok) {
          throw new RapLPBaseApiError(
            'Invalid Request',
            `The requested URL returned HTTP ${response.status}.`,
            ERROR_TYPE.BAD_REQUEST,
          );
        }

        const raw = await response.text();
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

// Fallback route if feature disabled.
export const registerUrlValidationFallbackRoutes = (app: Express) => {
  app.post('/api/v1/validation/url', async (_req, _res, next) => {
    next(
      new RapLPBaseApiError(
        'Conflict',
        'This feature is currently disabled due to server configuration. Contact your administrator if you think this is a mistake.',
        ERROR_TYPE.CONFLICT,
      ),
    );
  });
};
