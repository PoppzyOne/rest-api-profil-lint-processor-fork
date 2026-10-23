// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { RuleCategoryError } from './RapLPBaseApiErrorHandling.js';
import { RuleExecutionContext } from './RuleExecutionContext.js';
import { RuleModuleName } from '../rulesets/util/ruleModules.js';
import { cloneRuleWithTracking, RapLPRule } from '../rulesets/defineRule.js';
import * as UfnRules from '../rulesets/UfnRules.js';
import * as SakRules from '../rulesets/SakRules.js';
import * as SpaRules from '../rulesets/SpaRules.js';
import * as VerRules from '../rulesets/VerRules.js';
import * as FnsRules from '../rulesets/FnsRules.js';
import * as ArqRules from '../rulesets/ArqRules.js';
import * as DokRules from '../rulesets/DokRules.js';
import * as AmeRules from '../rulesets/AmeRules.js';
import * as ForRules from '../rulesets/ForRules.js';
import * as DotRules from '../rulesets/DotRules.js';
import * as FelRules from '../rulesets/FelRules.js';
import * as ResRules from '../rulesets/ResRules.js';
import * as MogRules from '../rulesets/MogRules.js';

const STATIC_RULE_MODULES: Record<string, Record<string, unknown>> = {
  UfnRules,
  SakRules,
  SpaRules,
  VerRules,
  FnsRules,
  ArqRules,
  DokRules,
  AmeRules,
  ForRules,
  DotRules,
  FelRules,
  ResRules,
  MogRules,
};

const ruleModules = Object.keys(STATIC_RULE_MODULES);

export function getRuleModules(): string[] {
  return ruleModules;
}

function isRapLPRule(value: unknown): value is RapLPRule {
  return Boolean(value && typeof value === 'object' && (value as RapLPRule).isRapLPRule === true);
}

function bindRuleToContext(
  rule: RapLPRule,
  ruleName: string,
  moduleName: string,
  context: RuleExecutionContext,
): RapLPRule {
  return cloneRuleWithTracking(rule, {
    function: (targetVal: any, opts: any, paths: any) => {
      if (!rule.trackWhen || rule.trackWhen(targetVal, opts, paths)) {
        context.logRuleExecution(moduleName, ruleName, rule.customProperties, String(rule.severity), true);
      }
      return [];
    },
  });
}

/**
 * Resolves and binds declarative rules for the requested categories to a per-run RuleExecutionContext.
 */
export async function importAndCreateRuleInstances(
  context: RuleExecutionContext,
  ruleCategories: RuleModuleName[],
): Promise<{ rules: Record<string, RapLPRule>; instanceCategoryMap: Map<string, RapLPRule> }> {
  const ruleInstances: Record<string, RapLPRule> = {};
  const instanceCategoryMap: Map<string, RapLPRule> = new Map();

  const categoriesToLoad: string[] = ruleCategories && ruleCategories.length > 0 ? ruleCategories : ruleModules;

  for (const category of categoriesToLoad) {
    const ruleModule = STATIC_RULE_MODULES[category];
    if (!ruleModule) {
      throw new RuleCategoryError(`Fel vid importering av regler för kategori ${category}: okänd modul`);
    }

    const entries = Object.entries(ruleModule).filter(
      ([exportName, val]) => exportName !== 'default' && isRapLPRule(val),
    );
    if (entries.length === 0) {
      throw new RuleCategoryError(`inga exporterade typer hittade i modulen för kategori ${category}`);
    }

    const moduleFileName = `${category}.js`;
    for (const [ruleName, rawRule] of entries) {
      const rule = rawRule as RapLPRule;
      ruleInstances[ruleName] = bindRuleToContext(rule, ruleName, moduleFileName, context);
      instanceCategoryMap.set(ruleName, rule);
    }
  }

  return { rules: ruleInstances, instanceCategoryMap };
}
