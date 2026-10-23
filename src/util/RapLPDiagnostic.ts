// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { RapLPCustomSpectralDiagnostic } from './RapLPCustomSpectralDiagnostic.js';
import { RuleExecutionLog, RuleExecutionContext } from './RuleExecutionContext.js';
import { buildRuleHelpUrl } from '../rulesets/util/rules-doc.config.js';

export interface DiagnosticRuleInfo {
  id: string;
  area: string;
  requirement: string;
  /** Helper Url for guidelines */
  helpUrl?: string;
}

export interface PopulatedDiagnosticRuleInfo extends DiagnosticRuleInfo {
  status: string;
}

export interface DiagnosticRuleinfoSet {
  notApplicableRules: DiagnosticRuleInfo[];
  executedUniqueRules: DiagnosticRuleInfo[];
  executedUniqueRulesWithError: DiagnosticRuleInfo[];
}

export interface DiagnosticReport {
  note: string;
  rules: PopulatedDiagnosticRuleInfo[];
}

export class RapLPDiagnostic {
  private _ruleSets: DiagnosticRuleinfoSet = {
    notApplicableRules: [],
    executedUniqueRules: [],
    executedUniqueRulesWithError: [],
  };

  public get diagnosticInformation(): DiagnosticRuleinfoSet {
    return this._ruleSets;
  }

  constructor(private context: RuleExecutionContext) {}

  processRuleExecutionInformation(
    raplpCustomResult: RapLPCustomSpectralDiagnostic[],
    rules: Record<string, any>,
    instanceCategoryMap: Map<string, any>,
  ): void {
    this.processRuleExecutionLog(
      this.context.ruleExecutionLogDictionary,
      raplpCustomResult,
      instanceCategoryMap,
      rules,
    );
  }

  private processRuleExecutionLog(
    log: RuleExecutionLog,
    spectralResults: RapLPCustomSpectralDiagnostic[],
    instanceCategoryMap: Map<string, any>,
    rules: Record<string, any>,
  ): void {
    const executedRuleIds = new Set<string>();
    const executedRuleIdsWithError = new Set<string>();

    for (const execRules of Object.values(log)) {
      if (!execRules || execRules.length === 0) continue;
      const { className } = execRules[0];

      for (const rule of execRules) {
        const { customProperties } = rule;
        const message = rules[className]?.message ?? '';
        const hasError = spectralResults.some(
          (result) => result.area === customProperties.område && result.id === customProperties.id,
        );

        if (hasError) {
          if (!executedRuleIdsWithError.has(customProperties.id)) {
            this._ruleSets.executedUniqueRulesWithError.push({
              id: customProperties.id,
              area: customProperties.område,
              helpUrl: customProperties.id ? buildRuleHelpUrl(customProperties.id) : undefined,
              requirement: message,
            });
          }
          executedRuleIdsWithError.add(customProperties.id);
        } else {
          if (!executedRuleIds.has(customProperties.id)) {
            this._ruleSets.executedUniqueRules.push({
              id: customProperties.id,
              area: customProperties.område,
              helpUrl: customProperties.id ? buildRuleHelpUrl(customProperties.id) : undefined,
              requirement: message,
            });
          }
          executedRuleIds.add(customProperties.id);
        }
      }
    }

    const appliedRuleIds = new Set([...executedRuleIds, ...executedRuleIdsWithError]);
    for (const [key, ruleMeta] of instanceCategoryMap.entries()) {
      const customProperties = ruleMeta.customProperties;
      if (!customProperties) continue;
      const exists = this._ruleSets.notApplicableRules.some(
        (rule) => rule.id === customProperties.id && rule.area === customProperties.område,
      );
      if (!appliedRuleIds.has(customProperties.id) && !exists) {
        this._ruleSets.notApplicableRules.push({
          id: customProperties.id,
          area: customProperties.område,
          requirement: rules[key]?.message ?? '',
          helpUrl: customProperties.id ? buildRuleHelpUrl(customProperties.id) : undefined,
        });
      }
    }
  }

  setFromPrecomputedReport(
    reports: {
      note: string;
      rules: { id: string; area: string; requirement?: string; helpUrl?: string; status: string }[];
    }[],
  ): void {
    for (const report of reports) {
      for (const regel of report.rules) {
        const ruleInfo: DiagnosticRuleInfo = {
          id: regel.id,
          area: regel.area,
          requirement: regel.requirement ?? '',
          helpUrl: regel.helpUrl,
        };
        if (regel.status === 'OK') {
          this._ruleSets.executedUniqueRules.push(ruleInfo);
        } else if (regel.status === 'EJ OK') {
          this._ruleSets.executedUniqueRulesWithError.push(ruleInfo);
        } else {
          this._ruleSets.notApplicableRules.push(ruleInfo);
        }
      }
    }
  }

  processDiagnosticInformation(): DiagnosticReport[] {
    const allReports: DiagnosticReport[] = [];
    if (this._ruleSets.executedUniqueRules.length > 0) {
      allReports.push(
        this.populateDiagnosticRuleInformation(
          this._ruleSets.executedUniqueRules,
          'OK',
          'Godkända regler - RAP-LP',
        ),
      );
    }
    if (this._ruleSets.executedUniqueRulesWithError.length > 0) {
      allReports.push(
        this.populateDiagnosticRuleInformation(
          this._ruleSets.executedUniqueRulesWithError,
          'EJ OK',
          'Ej Godkända regler - RAP-LP',
        ),
      );
    }
    if (this._ruleSets.notApplicableRules.length > 0) {
      allReports.push(
        this.populateDiagnosticRuleInformation(
          this._ruleSets.notApplicableRules,
          'N/A',
          'Ej tillämpade regler - RAP-LP',
        ),
      );
    }
    return allReports;
  }

  private populateDiagnosticRuleInformation(
    rules: DiagnosticRuleInfo[],
    status: string,
    note: string,
  ): DiagnosticReport {
    return {
      note,
      rules: rules.map((rule) => ({
        ...rule,
        status,
      })),
    };
  }
}
