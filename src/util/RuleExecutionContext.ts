// SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { CustomProperties } from '../ruleinterface/CustomProperties.js';

export interface RuleExecutionInfo {
  moduleName: string;
  className: string;
  customProperties: CustomProperties;
  severity: string;
  passed: boolean;
  targetVal?: string;
}

export interface RuleExecutionLog {
  [key: string]: RuleExecutionInfo[];
}

/**
 * Tracks which rules were applicable and executed during a validation run.
 * Deduplicates entries per rule class to avoid redundant memory allocation and post-processing.
 */
export class RuleExecutionContext {
  public ruleExecutionLogDictionary: RuleExecutionLog = {};
  public ruleExecutionStatus: Record<string, boolean> = {};

  registerRuleExecutionStatus(
    moduleName: string,
    _className: string,
    customProperties: CustomProperties,
    severity: string,
  ): void {
    const key = `${moduleName}:${customProperties.id}:${customProperties.område}:${severity}`;
    this.ruleExecutionStatus[key] = true;
  }

  logRuleExecution(
    moduleName: string,
    className: string,
    customProperties: CustomProperties,
    severity: string,
    passed: boolean = true,
    _targetVal?: string,
  ): void {
    const key = `${moduleName}:${customProperties.id}:${customProperties.område}:${severity}`;
    this.ruleExecutionStatus[key] = true;

    const existing = this.ruleExecutionLogDictionary[key];
    if (!existing) {
      this.ruleExecutionLogDictionary[key] = [
        {
          moduleName,
          className,
          customProperties,
          severity,
          passed,
        },
      ];
      return;
    }

    if (!existing.some((entry) => entry.className === className)) {
      existing.push({
        moduleName,
        className,
        customProperties,
        severity,
        passed,
      });
    }
  }
}
