// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { undefined as undefinedFunc } from '@stoplight/spectral-functions';
import { DiagnosticSeverity } from '@stoplight/types';
import { defineRule } from './defineRule.js';

const AREA = 'Förutsättningar';

export const For02 = defineRule({
  id: 'FOR.02',
  area: AREA,
  description: 'EN GET -förfrågan SKALL INTE acceptera en body',
  message: 'EN GET -förfrågan SKALL INTE acceptera en body',
  severity: DiagnosticSeverity.Error,
  given: '$.paths..get',
  then: [
    {
      field: 'requestBody',
      function: undefinedFunc,
    },
  ],
});
