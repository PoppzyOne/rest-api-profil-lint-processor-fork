// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { DiagnosticSeverity } from '@stoplight/types';
import {
  countEndpoints,
  countDistinctHttpMethods,
  eachPathHasValidRestOperation,
  hasHateoasIndicators,
} from './util/MogRulesUtil.js';
import { defineRule } from './defineRule.js';

const AREA = 'Mognad';

const MOG01_MESSAGE = 'Alla API:er SKALL designas för att uppnå nivå 2 enligt Richardson Maturity Model. ';
const MOG02_MESSAGE = 'Alla API:er BÖR designas för att uppnå nivå 3 enligt Richardson Maturity Model. ';

export const Mog01 = defineRule({
  id: 'MOG.01',
  area: AREA,
  message: MOG01_MESSAGE,
  severity: DiagnosticSeverity.Error,
  given: '$.paths',
  validate: (targetVal: any) => {
    if (
      countEndpoints(targetVal) < 2 ||
      countDistinctHttpMethods(targetVal) < 2 ||
      !eachPathHasValidRestOperation(targetVal)
    ) {
      return [{ message: MOG01_MESSAGE, severity: DiagnosticSeverity.Error }];
    }
    return [];
  },
});

export const Mog02 = defineRule({
  id: 'MOG.02',
  area: AREA,
  message: MOG02_MESSAGE,
  severity: DiagnosticSeverity.Warning,
  given: '$.paths',
  validate: (targetVal: any) => {
    if (
      countEndpoints(targetVal) < 2 ||
      countDistinctHttpMethods(targetVal) < 2 ||
      !eachPathHasValidRestOperation(targetVal) ||
      !hasHateoasIndicators(targetVal)
    ) {
      return [{ message: MOG02_MESSAGE, severity: DiagnosticSeverity.Warning }];
    }
    return [];
  },
});
