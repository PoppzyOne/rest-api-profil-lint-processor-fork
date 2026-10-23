// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { DiagnosticSeverity } from '@stoplight/types';
import { hasDateOrDateTimeProperty, validateSchemaDateExamples } from './util/DotRulesUtil.js';
import { defineRule } from './defineRule.js';

const AREA = 'Datum- och tidsformat';

const DOT02_MESSAGE = 'Datum och tid SKALL anges enligt RFC 3339 som bygger på ISO-8601.';
const DOT04_MESSAGE =
  'Tidzonen BÖR representeras med UTC formatet, där tid anges som offset från UTC (Coordinated Universal Time).';

export const Dot02 = defineRule({
  id: 'DOT.02',
  area: AREA,
  description: 'Ett giltigt exempel enligt DOT.02 behöver anges som ett exempel',
  message: DOT02_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.components.schemas',
  trackWhen: hasDateOrDateTimeProperty,
  validate: (targetVal: any, _opts: any, paths: any) =>
    validateSchemaDateExamples(targetVal, paths, DOT02_MESSAGE, DiagnosticSeverity.Error, false),
});

export const Dot04 = defineRule({
  id: 'DOT.04',
  area: AREA,
  description: 'När man använder RFC 3339 format BÖR tidszonen anges.',
  message: DOT04_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.components.schemas',
  trackWhen: hasDateOrDateTimeProperty,
  validate: (targetVal: any, _opts: any, paths: any) =>
    validateSchemaDateExamples(targetVal, paths, DOT04_MESSAGE, DiagnosticSeverity.Warning, true),
});
