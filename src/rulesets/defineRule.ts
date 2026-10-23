// SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { DiagnosticSeverity } from '@stoplight/types';
import * as Format from '@stoplight/spectral-formats';
import { CustomProperties } from '../ruleinterface/CustomProperties.js';
import { CustomFormatType } from './util/CustomOasVersion.js';

export interface RuleThenStep {
  field?: string;
  function: (...args: any[]) => any;
  functionOptions?: Record<string, any>;
}

export type RuleValidateFn = (targetVal: any, opts: any, context: any) => any;

export interface DefineRuleOptions {
  id: string;
  area: string;
  message: string;
  description?: string;
  severity: DiagnosticSeverity;
  given: string | string[];
  formats?: CustomFormatType[];
  then?: RuleThenStep | RuleThenStep[];
  validate?: RuleValidateFn;
  /**
   * Optional predicate controlling when this rule counts as executed (applicable)
   * when its `given` JSONPath matches. Defaults to `() => true`.
   * Return `false` if the rule is not applicable for `targetVal` (so it stays N/A unless another match applies).
   */
  trackWhen?: (targetVal: any, opts?: any, context?: any) => boolean;
}

export interface RapLPRule {
  readonly isRapLPRule: true;
  readonly id: string;
  readonly area: string;
  readonly customProperties: CustomProperties;
  getCustomProperties(): CustomProperties;
  readonly given: string | string[];
  readonly message: string;
  readonly errorMessage: string;
  readonly ruleMessage: string;
  readonly description?: string;
  readonly severity: DiagnosticSeverity;
  readonly formats: any[];
  readonly then: RuleThenStep[];
  readonly trackWhen?: (targetVal: any, opts?: any, context?: any) => boolean;
}

function getFormatPkg(): any {
  return (Format as any)?.oas3 ? Format : ((Format as any)?.default ?? Format);
}

function mapFormat(format: CustomFormatType): any {
  const pkg = getFormatPkg();
  switch (format) {
    case 'OAS2':
      return pkg.oas2;
    case 'OAS3':
      return pkg.oas3;
    case 'OAS3_0':
      return pkg.oas3_0;
    case 'OAS3_1':
      return pkg.oas3_1;
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

export function resolveFormats(formats: CustomFormatType[] = ['OAS3']): any[] {
  const pkg = getFormatPkg();
  return formats.length > 0 ? formats.map(mapFormat) : [pkg.oas2, pkg.oas3];
}

function attachNonEnumerableMetadata(
  target: Record<string, any>,
  metadata: {
    id: string;
    area: string;
    customProperties: CustomProperties;
    message: string;
    trackWhen?: (targetVal: any, opts?: any, context?: any) => boolean;
  },
): RapLPRule {
  Object.defineProperties(target, {
    isRapLPRule: { value: true, enumerable: false, configurable: true },
    id: { value: metadata.id, enumerable: false, configurable: true },
    area: { value: metadata.area, enumerable: false, configurable: true },
    customProperties: { value: metadata.customProperties, enumerable: false, configurable: true },
    getCustomProperties: {
      value: () => metadata.customProperties,
      enumerable: false,
      configurable: true,
    },
    errorMessage: { value: metadata.message, enumerable: false, configurable: true },
    ruleMessage: { value: metadata.message, enumerable: false, configurable: true },
    trackWhen: { value: metadata.trackWhen, enumerable: false, configurable: true },
  });
  return target as RapLPRule;
}

export function defineRule(options: DefineRuleOptions): RapLPRule {
  const customProperties: CustomProperties = {
    område: options.area,
    id: options.id,
  };

  const thenSteps: RuleThenStep[] = options.then
    ? Array.isArray(options.then)
      ? [...options.then]
      : [options.then]
    : options.validate
      ? [{ function: options.validate }]
      : [];

  const spectralRuleObject: Record<string, any> = {
    given: options.given,
    message: options.message,
    severity: options.severity,
    formats: resolveFormats(options.formats ?? ['OAS3']),
    then: thenSteps,
  };

  if (options.description !== undefined) {
    spectralRuleObject.description = options.description;
  }

  return attachNonEnumerableMetadata(spectralRuleObject, {
    id: options.id,
    area: options.area,
    customProperties,
    message: options.message,
    trackWhen: options.trackWhen,
  });
}

export function cloneRuleWithTracking(rule: RapLPRule, trackingStep: RuleThenStep): RapLPRule {
  const spectralRuleObject: Record<string, any> = {
    given: rule.given,
    message: rule.message,
    severity: rule.severity,
    formats: rule.formats,
    then: [...rule.then, trackingStep],
  };

  if (rule.description !== undefined) {
    spectralRuleObject.description = rule.description;
  }

  return attachNonEnumerableMetadata(spectralRuleObject, {
    id: rule.id,
    area: rule.area,
    customProperties: rule.customProperties,
    message: rule.message,
    trackWhen: rule.trackWhen,
  });
}
