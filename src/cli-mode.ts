// SPDX-FileCopyrightText: 2025 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import * as fs from 'node:fs';
import util from 'util';
import { DiagnosticReport } from './util/RapLPDiagnostic.js';
import { AggregateError } from './util/RapLPCustomErrorInfo.js';
import chalk from 'chalk';
import { ExcelReportProcessor } from './util/excelReportProcessor.js';
import { Issue } from './util/Issue.js';
import { parseApiSpecInput, detectSpecFormatPreference, ParseResult } from './util/validateUtil.js';
import { SpecParseError } from './util/RapLPSpecParseError.js';
import { parseRuleCategories, resolveRuleCategories } from './rulesets/util/ruleModules.js';
import { executeRuleEngine } from './util/validationPipeline.js';

declare var AggregateError: {
  prototype: AggregateError;
  new (errors: any[], message?: string): AggregateError;
};

const writeFileAsync = util.promisify(fs.writeFile);
const appendFileAsync = util.promisify(fs.appendFile);

export type CliArgs = {
  file?: string;
  categories?: string;
  logError?: string;
  append: boolean;
  logDiagnostic?: string;
  dex?: string;
  strict?: boolean;
};

export async function execCLI<T extends CliArgs>(argv: T) {
  try {
    const apiSpecFileName = (argv.file as string) || '';
    const ruleCategories = parseRuleCategories(argv.categories as string | undefined);
    const resolvedCategories = resolveRuleCategories(ruleCategories);
    const logErrorFilePath = argv.logError as string | undefined;
    const logDiagnosticFilePath = argv.logDiagnostic as string | undefined;
    const strict = (argv.strict as boolean) ?? false;

    let parseResult: ParseResult;
    try {
      const prefer = detectSpecFormatPreference(apiSpecFileName, undefined, 'auto');
      parseResult = await parseApiSpecInput(
        { filePath: apiSpecFileName },
        {
          strict,
          preferJsonError: prefer,
        },
      );

      if (parseResult.strictIssues && parseResult.strictIssues.length > 0) {
        console.error('Strict validation reported issues:');
        parseResult.strictIssues.forEach((iss: Issue) =>
          console.error(
            chalk.yellow(`- ${iss.type} at ${iss.path} : ${iss.message} ${iss.line ? `(line ${iss.line})` : ''}`),
          ),
        );
        process.exitCode = 2;
        return;
      }
    } catch (err: any) {
      if (err instanceof SpecParseError) {
        const formattedDate = new Date().toISOString();
        const logData = {
          timeStamp: formattedDate,
          message: 'Fel vid parsing av API-specifikationen.',
          error: err.toJSON ? err.toJSON() : { message: String(err) },
        };

        if (logErrorFilePath) {
          try {
            let existingLogs: any[] = [];
            if (argv.append && fs.existsSync(logErrorFilePath)) {
              const fileContent = await fs.promises.readFile(logErrorFilePath, 'utf8');
              try {
                existingLogs = JSON.parse(fileContent);
                if (!Array.isArray(existingLogs)) existingLogs = [existingLogs];
              } catch {
                existingLogs = [];
              }
            }
            existingLogs.push(logData);
            const updatedContent = JSON.stringify(existingLogs, null, 2);
            await writeFileAsync(logErrorFilePath, Buffer.from(updatedContent, 'utf8'));
            console.log(chalk.green(`Parserfel loggat till ${logErrorFilePath}`));
          } catch (fileErr: any) {
            console.error(chalk.red('Misslyckades att skriva parserfel till loggfilen:'), fileErr.message);
          }
        } else {
          console.error(chalk.red('<<< Parserfel i API-specifikationen >>>'));
          console.error(chalk.red(`Fel: ${err.message}`));
          if (err.line || err.column) {
            console.error(chalk.yellow(`Rad: ${err.line ?? '-'}, Kolumn: ${err.column ?? '-'}`));
          }
          if (err.snippet && !err.message.includes(err.snippet)) {
            console.error(chalk.gray('--- snippet ---'));
            console.error(chalk.gray(err.snippet));
            console.error(chalk.gray('---------------'));
          }
        }

        process.exitCode = 1;
        return;
      }

      logErrorToFile(err);
      console.error(chalk.red('Ett fel uppstod vid inläsning/parsing av spec-filen. Se felloggen för mer information.'));
      process.exitCode = 1;
      return;
    }

    try {
      const { result, diagnostic: customDiagnostic, reports: diagnosticReports } = await executeRuleEngine(
        parseResult,
        resolvedCategories,
        apiSpecFileName,
      );

      if (argv.dex != null) {
        try {
          const reportHandler = new ExcelReportProcessor({
            outputFilePath: argv.dex,
          });
          reportHandler.generateReportDocument(customDiagnostic);
          if (reportHandler.lockedFilePath) {
            console.log(
              chalk.yellow(
                `Avstämningsfilen ${reportHandler.lockedFilePath} är låst (öppen i Excel?), skriver till ${reportHandler.outputFilePath} i stället`,
              ),
            );
          } else if (reportHandler.isBasedOnExistingFile) {
            console.log(
              chalk.green(
                `Uppdaterar avstämningsfil ${reportHandler.outputFilePath}, kommentarer och övriga ändringar bevaras`,
              ),
            );
          } else {
            console.log(
              chalk.green(`Skriver avstämningsfil i Excel-format från RAP-LP till ${reportHandler.outputFilePath}`),
            );
          }
          if (reportHandler.isBasedOnExistingFile) {
            const { templateProfileVersion, fileProfileVersion } = reportHandler;
            if (!fileProfileVersion) {
              console.log(
                chalk.yellow(
                  `Kunde inte avgöra vilken version av REST API-profilen avstämningsfilen avser, RAP-LP använder version ${templateProfileVersion ?? 'okänd'}`,
                ),
              );
            } else if (templateProfileVersion && fileProfileVersion !== templateProfileVersion) {
              console.log(
                chalk.yellow(
                  `Avstämningsfilen avser version ${fileProfileVersion} av REST API-profilen men RAP-LP använder version ${templateProfileVersion}, regler kan saknas eller ha ändrats`,
                ),
              );
            }
            if (reportHandler.missingRules.length > 0) {
              console.log(
                chalk.yellow(
                  `Följande regler har verkställts av RAP-LP men saknas i avstämningsfilen, deras utfall har inte skrivits: ${reportHandler.missingRules.join(', ')}`,
                ),
              );
            }
          }
          if (reportHandler.keptInProgressRules.length > 0) {
            console.log(
              chalk.yellow(
                `Status "Pågående" behålls för regler som inte validerats OK: ${reportHandler.keptInProgressRules.join(', ')}`,
              ),
            );
          }
          if (reportHandler.resolvedInProgressRules.length > 0) {
            console.log(
              chalk.green(
                `Status "Pågående" ersatt med OK för regler som nu validerats OK: ${reportHandler.resolvedInProgressRules.join(', ')}`,
              ),
            );
          }
        } catch (excelError: any) {
          logErrorToFile(excelError);
          console.error(chalk.red(`Misslyckades att skriva avstämningsfil i Excel-format: ${excelError.message}`));
        }
      }

      const colorizeSeverity = (allvarlighetsgrad: string) => {
        switch (allvarlighetsgrad) {
          case 'ERROR':
            return chalk.red('Error');
          case 'WARNING':
            return chalk.yellow('Warning');
          case 'HINT':
            return chalk.greenBright('Hint');
          default:
            return chalk.white('Info');
        }
      };

      const formatLintingResult = (item: any) => {
        return `\nallvarlighetsgrad: ${colorizeSeverity(item.severity)} \nid: ${item.id} \nkrav: ${
          item.requirement
        } \nområde: ${item.area} \nsökväg:[${item.path}] \nomfattning:${JSON.stringify(
          item.range,
          null,
          2,
        )}\ndesignregel: ${item.helpUrl} `;
      };

      const currentDate = new Date();
      const padZero = (num: number): string => (num < 10 ? `0${num}` : `${num}`);
      const formattedDate = `${currentDate.getFullYear()}-${padZero(currentDate.getMonth() + 1)}-${padZero(
        currentDate.getDate(),
      )} ${padZero(currentDate.getHours())}:${padZero(currentDate.getMinutes())}:${padZero(currentDate.getSeconds())}`;

      if (logDiagnosticFilePath) {
        const allDiagnosticReports: DiagnosticReport[] = diagnosticReports;
        const logEntry = `${formattedDate}\n${JSON.stringify(allDiagnosticReports, null, 2)}\n`;
        await writeFileAsync(logDiagnosticFilePath, Buffer.from(logEntry, 'utf8'));
        console.log(chalk.green(`Skriver diagnostiseringsinformation från RAP-LP till ${logDiagnosticFilePath}`));
      } else {
        if (
          customDiagnostic.diagnosticInformation.executedUniqueRules != undefined &&
          customDiagnostic.diagnosticInformation.executedUniqueRules.length > 0
        ) {
          console.log(chalk.green('<<<Verkställda och godkända regler - RAP-LP>>>\r'));
          console.log(chalk.whiteBright('STATUS\tOMRÅDE') + ' / ' + chalk.whiteBright('IDENTIFIKATIONSNUMMER'));
          customDiagnostic.diagnosticInformation.executedUniqueRules
            .sort((a, b) => a.id.localeCompare(b.id, 'sv'))
            .forEach((item) => {
              console.log(chalk.bgGreen('OK') + '\t' + item.area + ' / ' + item.id);
            });
        }
        if (
          customDiagnostic.diagnosticInformation.executedUniqueRulesWithError != undefined &&
          customDiagnostic.diagnosticInformation.executedUniqueRulesWithError.length > 0
        ) {
          console.log(chalk.green('<<<Verkställda och ej godkända regler - RAP-LP>>>\r'));
          console.log(chalk.whiteBright('STATUS\tOMRÅDE') + ' / ' + chalk.whiteBright('IDENTIFIKATIONSNUMMER'));
          customDiagnostic.diagnosticInformation.executedUniqueRulesWithError
            .sort((a, b) => a.id.localeCompare(b.id, 'sv'))
            .forEach((item) => {
              console.log(chalk.bgRed('EJ OK') + '\t' + item.area + ' / ' + item.id);
            });
        }
        if (
          customDiagnostic.diagnosticInformation.notApplicableRules != undefined &&
          customDiagnostic.diagnosticInformation.notApplicableRules.length > 0
        ) {
          console.log(chalk.grey('<<<Ej tillämpade regler - RAP-LP>>>\r'));
          console.log(chalk.whiteBright('STATUS\tOMRÅDE') + ' / ' + chalk.whiteBright('IDENTIFIKATIONSNUMMER'));
          customDiagnostic.diagnosticInformation.notApplicableRules
            .sort((a, b) => a.id.localeCompare(b.id, 'sv'))
            .forEach((item) => {
              console.log(chalk.bgGrey('N/A') + '\t' + item.area + '/' + item.id);
            });
        }
      }
      if (logErrorFilePath) {
        const content = JSON.stringify(result, null, 2);
        const logEntry = `${formattedDate}\n${content}\n`;
        const utf8EncodedContent = Buffer.from(logEntry, 'utf8');
        if (argv.append) {
          await appendFileAsync(logErrorFilePath, utf8EncodedContent);
          console.log(chalk.green(`Skriver inspektion/valideringsinformation från RAP-LP till ${logErrorFilePath}`));
        } else {
          await writeFileAsync(logErrorFilePath, utf8EncodedContent);
          console.log(chalk.green(`Skriver inspektion/valideringsinformation från RAP-LP till ${logErrorFilePath}`));
        }
      } else {
        console.log(chalk.whiteBright('\n<<Regelutfall RAP-LP>> \n'));
        result
          .sort((a, b) => {
            const idA = a.id ?? '';
            const idB = b.id ?? '';
            return idA.localeCompare(idB, 'sv');
          })
          .forEach((item) => {
            console.log(formatLintingResult(item));
          });
      }
    } catch (spectralError: any) {
      logErrorToFile(spectralError);
      console.error(
        chalk.red(
          'Ett fel uppstod vid initiering/körning av regelklasser! Undersök felloggen för RAP-LP för mer information om felet',
        ),
      );
    }
  } catch (error: any) {
    logErrorToFile(error);
    console.error(
      chalk.red('Ett oväntat fel uppstod! Undersök felloggen för RAP-LP för mer information om felet', error.message),
    );
  }

  function logErrorToFile(error: any) {
    const errorMessage = `${new Date().toISOString()} - ${error.stack}\n`;
    fs.appendFileSync('rap-lp-error.log', errorMessage);
    if (error.errors) {
      const detailedMessage = `${new Date().toISOString()} - ${JSON.stringify(error.errors, null, 2)}\n`;
      fs.appendFileSync('rap-lp-error.log', detailedMessage);
    }
    if (error instanceof AggregateError) {
      error.errors.forEach((err: any, index: number) => {
        const causeMessage = `Cause ${index + 1}: ${err.stack || err}\n`;
        fs.appendFileSync('rap-lp-error.log', causeMessage);
      });
    }
  }
}
