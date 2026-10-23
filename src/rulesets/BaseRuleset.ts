// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { RulesetInterface } from '../ruleinterface/RuleInterface.js';
import { CustomProperties } from '../ruleinterface/CustomProperties.js';
import { CustomFormatType } from './util/CustomOasVersion.js';
import { DiagnosticSeverity } from '@stoplight/types';
import { RuleExecutionContext } from '../util/RuleExecutionContext.js';
import { resolveFormats } from './defineRule.js';

export abstract class BaseRuleset implements RulesetInterface {
  static customProperties: CustomProperties = { område: undefined!, id: '' };
  static getCustomProperties(): CustomProperties {
    return this.customProperties;
  }
  given: string | string[] = '';
  message: string = '';
  then: any = {};
  description: string = '';
  severity: DiagnosticSeverity = DiagnosticSeverity.Error;
  formats: any = resolveFormats(['OAS3']);

  #context?: RuleExecutionContext;

  constructor(context?: RuleExecutionContext) {
    this.#context = context;
  }

  protected trackRuleExecutionHandler(
    _targetVal: string,
    _opts: string,
    _paths: string[],
    _severity: DiagnosticSeverity,
    subclassInfo: any,
    moduleName: any,
    subclassProperties: CustomProperties,
  ) {
    this.#context?.logRuleExecution(moduleName, subclassInfo, subclassProperties, this.severity.toString(), true);
    return [];
  }

  initializeFormats(formats: CustomFormatType[] = ['OAS3']): void {
    this.formats = resolveFormats(formats);
  }
}
