// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import * as SpectralCore from '@stoplight/spectral-core';
import { ISpectralDiagnostic } from '@stoplight/spectral-core';
import spectralCore from '@stoplight/spectral-core';
const { Spectral } = spectralCore;
import { RapLPCustomSpectralDiagnostic } from './RapLPCustomSpectralDiagnostic.js';
import { buildRuleHelpUrl } from '../rulesets/util/rules-doc.config.js';
import { CustomProperties } from '../ruleinterface/CustomProperties.js';

interface RuleMetadataSource {
  customProperties?: CustomProperties;
  getCustomProperties?: () => CustomProperties;
}

interface EnabledRules {
  rules: Record<string, any>;
}

const SEVERITY_NAMES: Record<number, string> = {
  0: 'ERROR',
  1: 'WARNING',
  2: 'INFORMATION',
  3: 'HINT',
};

export class RapLPCustomSpectral {
  private spectral: SpectralCore.Spectral;
  private enabledRules: EnabledRules = {
    rules: {},
  };
  private instanceCategoryMap: Map<string, RuleMetadataSource> = new Map();

  constructor() {
    this.spectral = new Spectral();
  }

  setRuleset(enabledRules: Record<string, any>): void {
    this.enabledRules.rules = enabledRules;
    this.spectral.setRuleset(this.enabledRules);
  }

  setRawRuleset(ruleset: any): void {
    this.spectral.setRuleset(ruleset);
  }

  setCategorys(instanceCategoryMap: Map<string, RuleMetadataSource>): void {
    this.instanceCategoryMap = instanceCategoryMap;
  }

  async run(document: any): Promise<RapLPCustomSpectralDiagnostic[]> {
    const spectralResults = await this.spectral.run(document);
    return this.modifyResults(spectralResults);
  }

  async runSemanticValidation(document: any): Promise<ISpectralDiagnostic[]> {
    return await this.spectral.run(document);
  }

  private modifyResults(results: ISpectralDiagnostic[]): RapLPCustomSpectralDiagnostic[] {
    const customResults: RapLPCustomSpectralDiagnostic[] = [];
    const activeRules = this.enabledRules.rules;

    for (const result of results) {
      const ruleName = String(result.code);
      const ruleMetadata = this.instanceCategoryMap.get(ruleName) ?? activeRules[ruleName];
      const customProps =
        ruleMetadata?.customProperties ??
        (typeof ruleMetadata?.getCustomProperties === 'function' ? ruleMetadata.getCustomProperties() : undefined);

      if (customProps) {
        const ruleId = customProps.id;
        customResults.push({
          id: ruleId,
          area: customProps.område,
          helpUrl: ruleId ? buildRuleHelpUrl(ruleId) : undefined,
          ...this.mapResultToCustom(result),
        });
      }
    }

    return customResults;
  }

  private mapResultToCustom(result: ISpectralDiagnostic): RapLPCustomSpectralDiagnostic {
    const { message, code: _code, severity: spectralSeverity, path, source: _source, range, ...rest } = result;
    return {
      ...rest,
      requirement: message,
      severity: SEVERITY_NAMES[spectralSeverity] ?? '',
      path,
      range,
    };
  }
}
