// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import { isValidApplicationJson } from './util/AmeRulesUtil.js';

export { isValidApplicationJson };

export interface Property {
  name: string;
  type: any;
  format?: any;
  example?: any;
}

const EXAMPLE_FIELD_PATTERN = /^example(?:s$|$)/;

/**
 * Shared validation helper for DOK.15 (checks example/examples on media type or schema level).
 */
export function hasExampleInMediaType(targetVal: any): boolean {
  if (!targetVal || typeof targetVal !== 'object') {
    return false;
  }
  if (targetVal.schema && targetVal.schema.example) {
    return true;
  }
  return Object.keys(targetVal).some((prop) => EXAMPLE_FIELD_PATTERN.test(prop));
}

/**
 * Shared validation helper for ARQ.05 (checks parameter schema type and optional format).
 */
export function hasHeaderSchemaType(targetVal: any, expectedType: string, expectedFormat?: string): boolean {
  const schema = targetVal?.schema;
  if (schema && typeof schema === 'object' && schema.type === expectedType) {
    return !expectedFormat || schema.format === expectedFormat;
  }
  return false;
}

export function parseProperties(key: string, data: any): Property[] {
  const result: Property[] = [];
  if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, key)) {
    const properties = data[key]?.properties;
    if (properties && typeof properties === 'object') {
      for (const [propName, propVal] of Object.entries<any>(properties)) {
        result.push({
          name: propName,
          type: propVal?.type,
          format: propVal?.format,
          example: propVal?.example,
        });
      }
    }
  }
  return result;
}

export function parsePropertyNames(key: string, data: any): string[] {
  if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, key)) {
    const properties = data[key]?.properties;
    if (properties && typeof properties === 'object') {
      return Object.keys(properties);
    }
  }
  return [];
}

const RFC3339_REGEX =
  /^(\d{4})-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])T([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,6})?(Z|([+-])([0-1][0-9]|2[0-3]):([0-5][0-9]))?$/;

export function isValidRFC3339DateTime(dateTimeString: string): boolean {
  const match = dateTimeString.match(RFC3339_REGEX);
  if (!match) {
    return false;
  }
  const [, year, month, day, hour, minute, second] = match;
  const yearInt = parseInt(year, 10);
  const monthInt = parseInt(month, 10);
  const dayInt = parseInt(day, 10);
  const hourInt = parseInt(hour, 10);
  const minuteInt = parseInt(minute, 10);
  const secondInt = parseInt(second, 10);

  return !(
    isNaN(yearInt) ||
    isNaN(monthInt) ||
    isNaN(dayInt) ||
    isNaN(hourInt) ||
    isNaN(minuteInt) ||
    isNaN(secondInt) ||
    yearInt < 0 ||
    monthInt < 1 ||
    monthInt > 12 ||
    dayInt < 1 ||
    dayInt > 31 ||
    hourInt < 0 ||
    hourInt > 23 ||
    minuteInt < 0 ||
    minuteInt > 59 ||
    secondInt < 0 ||
    secondInt > 59
  );
}
