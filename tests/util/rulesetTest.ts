// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

'use strict';
/**
 * Usage: Import all declarative rule modules so unit tests can run via testRule('<RuleName>', ...)
 */
import * as UfnRules from '../../src/rulesets/UfnRules.js';
import * as SakRules from '../../src/rulesets/SakRules.js';
import * as SpaRules from '../../src/rulesets/SpaRules.js';
import * as VerRules from '../../src/rulesets/VerRules.js';
import * as FnsRules from '../../src/rulesets/FnsRules.js';
import * as ArqRules from '../../src/rulesets/ArqRules.js';
import * as DokRules from '../../src/rulesets/DokRules.js';
import * as AmeRules from '../../src/rulesets/AmeRules.js';
import * as ForRules from '../../src/rulesets/ForRules.js';
import * as DotRules from '../../src/rulesets/DotRules.js';
import * as FelRules from '../../src/rulesets/FelRules.js';
import * as ResRules from '../../src/rulesets/ResRules.js';
import * as MogRules from '../../src/rulesets/MogRules.js';

const ruleInstances = {
  For02: ForRules.For02,
  Ame01: AmeRules.Ame01,
  Ame02: AmeRules.Ame02,
  Ame07: AmeRules.Ame07,
  Ame05: AmeRules.Ame05,
  Ame04: AmeRules.Ame04,
  Arq01: ArqRules.Arq01,
  Arq03: ArqRules.Arq03,
  Arq05ComplexStructure: ArqRules.Arq05ComplexStructure,
  Arq05NestedStructure: ArqRules.Arq05NestedStructure,
  Arq05StringBinary: ArqRules.Arq05StringBinary,
  Ufn01: UfnRules.Ufn01,
  Ufn02: UfnRules.Ufn02,
  Ufn05Servers: UfnRules.Ufn05Servers,
  Ufn05paths: UfnRules.Ufn05paths,
  Ufn07: UfnRules.Ufn07,
  Ufn08: UfnRules.Ufn08,
  Ufn09Path: UfnRules.Ufn09Path,
  Ufn09Server: UfnRules.Ufn09Server,
  Ufn09InPathParameters: UfnRules.Ufn09InPathParameters,
  Sak01: SakRules.Sak01,
  Sak09: SakRules.Sak09,
  Sak10: SakRules.Sak10,
  Sak11: SakRules.Sak11,
  Sak15: SakRules.Sak15,
  Sak16: SakRules.Sak16,
  Sak18: SakRules.Sak18,
  Sak29: SakRules.Sak29,
  Spa02: SpaRules.Spa02,
  Spa04: SpaRules.Spa04,
  Spa07: SpaRules.Spa07,
  Ver05: VerRules.Ver05,
  Ver06: VerRules.Ver06,
  Fns01: FnsRules.Fns01,
  Fns03: FnsRules.Fns03,
  Fns05: FnsRules.Fns05,
  Fns09: FnsRules.Fns09,
  Fns07: FnsRules.Fns07,
  Fns06: FnsRules.Fns06,
  Dok20: DokRules.Dok20,
  Dok06: DokRules.Dok06,
  Dok07: DokRules.Dok07,
  Dok08: DokRules.Dok08,
  Dok09: DokRules.Dok09,
  Fel01: FelRules.Fel01,
  Fel02: FelRules.Fel02,
  Fns08: FnsRules.Fns08,
  Dot02: DotRules.Dot02,
  Dok15Get: DokRules.Dok15Get,
  Dok15ReqBody: DokRules.Dok15ReqBody,
  Dot04: DotRules.Dot04,
  Dok19: DokRules.Dok19,
  Dok21: DokRules.Dok21,
  Dok01: DokRules.Dok01,
  Dok11: DokRules.Dok11,
  Dok17: DokRules.Dok17,
  Dok03Info: DokRules.Dok03Info,
  Dok03ContactName: DokRules.Dok03ContactName,
  Dok03ContactEmail: DokRules.Dok03ContactEmail,
  Dok03ContactUrl: DokRules.Dok03ContactUrl,
  Dok03Contact: DokRules.Dok03Contact,
  Dok03License: DokRules.Dok03License,
  Dok03LicenseName: DokRules.Dok03LicenseName,
  Dok03LicenseUrl: DokRules.Dok03LicenseUrl,
  Res02: ResRules.Res02,
  Res06: ResRules.Res06,
  Mog01: MogRules.Mog01,
  Mog02: MogRules.Mog02,
};

export default {
  // Usage outside
  rules: ruleInstances,
};
