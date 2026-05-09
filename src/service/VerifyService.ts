/*
 * Copyright 2022 Fernando Boucquez
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { compareVersions } from 'compare-versions';

import * as os from 'node:os';

import { Logger } from '../logger/index.js';
import { Utils } from '../utils/Utils.js';
import { RuntimeService } from './RuntimeService.js';

export interface VerifyReport {
  platform: string;
  lines: ReportLine[];
}

export interface ReportLine {
  header: string;
  message: string;
  recommendation?: string;
}

export interface ExpectedVersions {
  node: string;
  docker: string;
  dockerCompose: string;
}

const defaultExpectedVersions: ExpectedVersions = {
  node: '18.0.0',
  docker: '20.10.13',
  dockerCompose: '2.0.0',
};

export interface VerifyAction {
  shouldRun(lines: ReportLine[]): boolean;
  verify(): Promise<ReportLine>;
}

export class AppVersionService {
  constructor(private readonly runtimeService: RuntimeService) {}

  /**
   * アプリ出力文字列から最初に見つかったバージョン文字列を抽出する。
   */
  public loadVersion(text: string): string | undefined {
    return text
      .replace(',', '')
      .split(' ')
      .map((word) => this.normalizeVersion(word.trim()))
      .find((a) => a)
      ?.trim();
  }

  public async loadVersionFromCommand(command: string): Promise<string | undefined> {
    return this.loadVersion((await this.runtimeService.exec(command)).stdout.trim());
  }

  /**
   * 指定アプリのバージョンを検証し、レポート行を返す。
   */
  public async verifyInstalledApp(
    versionLoader: () => Promise<string | undefined>,
    header: string,
    minVersion: string,
    recommendationUrl: string
  ): Promise<ReportLine> {
    const recommendationPrefix = `At least version ${minVersion} is required.`;
    const recommendationSuffix = `Check ${recommendationUrl}`;
    try {
      const version = await versionLoader();
      if (!version) {
        return this.createMissingVersionLine(header, recommendationPrefix, recommendationSuffix);
      }
      if (this.isVersionLowerThan(version, minVersion)) {
        return this.createOldVersionLine(
          header,
          version,
          recommendationPrefix,
          recommendationSuffix
        );
      }
      return { header, message: version };
    } catch (e) {
      return {
        header,
        message: `Error: ${Utils.getMessage(e)}`,
        recommendation: `${recommendationPrefix} ${recommendationSuffix}`,
      };
    }
  }

  private normalizeVersion(value: string): string | undefined {
    const match = value.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!match) {
      return undefined;
    }
    return [match[1], match[2] ?? '0', match[3] ?? '0'].join('.');
  }

  private isVersionLowerThan(version: string, minVersion: string): boolean {
    const normalizedMinVersion = this.normalizeVersion(minVersion);
    if (!normalizedMinVersion) {
      throw new Error(`最低バージョン '${minVersion}' を解釈できません。`);
    }
    return compareVersions(version, normalizedMinVersion) < 0;
  }

  private createMissingVersionLine(
    header: string,
    recommendationPrefix: string,
    recommendationSuffix: string
  ): ReportLine {
    return {
      header,
      message: 'Version could not be found!',
      recommendation: `${recommendationPrefix} ${recommendationSuffix}`,
    };
  }

  private createOldVersionLine(
    header: string,
    version: string,
    recommendationPrefix: string,
    recommendationSuffix: string
  ): ReportLine {
    return {
      header,
      message: version,
      recommendation: `${recommendationPrefix} Currently installed version is ${version}. ${recommendationSuffix}`,
    };
  }
}

export class AppVersionVerifyAction implements VerifyAction {
  constructor(
    readonly service: AppVersionService,
    readonly params: {
      header: string;
      version?: string;
      command?: string;
      recommendationUrl: string;
      expectedVersion: string;
    }
  ) {}

  verify(): Promise<ReportLine> {
    return this.service.verifyInstalledApp(
      async () => {
        if (this.params.version) {
          return this.params.version;
        }
        if (this.params.command) {
          return this.service.loadVersionFromCommand(this.params.command);
        }
        throw new Error('version または command のいずれかを指定してください。');
      },
      this.params.header,
      this.params.expectedVersion,
      this.params.recommendationUrl
    );
  }

  shouldRun(): boolean {
    return true;
  }
}

export class DockerRunVerifyAction implements VerifyAction {
  constructor(
    private readonly logger: Logger,
    private readonly runtimeService: RuntimeService
  ) {}
  async verify(): Promise<ReportLine> {
    const header = 'Docker Run Test';
    const command = 'docker run hello-world';
    const recommendationUrl = `https://www.digitalocean.com/community/questions/how-to-fix-docker-got-permission-denied-while-trying-to-connect-to-the-docker-daemon-socket`;

    try {
      const output = (await this.runtimeService.exec(command)).stdout.trim();
      const expectedText = 'Hello from Docker!';
      if (!output.includes(expectedText)) {
        return {
          header,
          message: `コマンド '${command}' を実行できませんでした。'${expectedText}' が出力に含まれていません。\n${output}`,
          recommendation: `${recommendationUrl} を確認してください。`,
        };
      }
      return { header, message: `コマンド '${command}' を実行しました。` };
    } catch (e) {
      return {
        header,
        message: `コマンド '${command}' を実行できませんでした。詳細: ${Utils.getMessage(e)}`,
        recommendation: `${recommendationUrl} を確認してください。`,
      };
    }
  }
  shouldRun(lines: ReportLine[]): boolean {
    return !!lines.find((l) => l.header === 'Docker Version' && !l.recommendation);
  }
}

export class SudoRunVerifyAction implements VerifyAction {
  async verify(): Promise<ReportLine> {
    const header = 'Sudo User Test';
    if (Utils.isRoot()) {
      return {
        header,
        message: `sudo ユーザーで実行しています。`,
        recommendation: `sudo を使わないか、Bootstrap 実行用の非 sudo ユーザーを作成してください。`,
      };
    }
    return { header, message: `sudo ユーザーではありません。` };
  }
  shouldRun(): boolean {
    return !Utils.isWindows();
  }
}

export class VerifyService {
  private readonly expectedVersions: ExpectedVersions;
  public static readonly currentNodeJsVersion = process.versions.node;
  public readonly actions: VerifyAction[] = [];
  private readonly runtimeService: RuntimeService;

  constructor(
    private readonly logger: Logger,
    expectedVersions: Partial<ExpectedVersions> = {}
  ) {
    this.runtimeService = new RuntimeService(logger);
    this.expectedVersions = { ...defaultExpectedVersions, ...expectedVersions };
    this.actions.push(...this.createAppVersionActions());
    this.actions.push(new DockerRunVerifyAction(this.logger, this.runtimeService));
    this.actions.push(new SudoRunVerifyAction());
  }

  public async createReport(): Promise<VerifyReport> {
    const lines: ReportLine[] = [];
    const platform = `${os.type()} - ${os.release()} - ${os.platform()}`;
    for (const action of this.actions) {
      if (action.shouldRun(lines)) lines.push(await action.verify());
    }
    return { lines, platform };
  }

  public logReport(report: VerifyReport): void {
    this.logger.info(`OS: ${report.platform}`);
    for (const line of report.lines) {
      this.logReportLine(line);
    }
  }

  public validateReport(report: VerifyReport): void {
    const errors = report.lines.filter((r) => r.recommendation);
    if (errors.length) {
      throw new Error(
        'エラーが発生しました。レポートを確認してください:\n' +
          errors
            .map((line) => ` - ${line.header} - エラー - ${line.message} - ${line.recommendation}`)
            .join('\n')
      );
    }
  }

  private createAppVersionActions(): VerifyAction[] {
    const appVersionService = new AppVersionService(this.runtimeService);
    return [
      new AppVersionVerifyAction(appVersionService, {
        header: 'NodeVersion',
        version: VerifyService.currentNodeJsVersion,
        recommendationUrl: `https://nodejs.org/en/download/package-manager/`,
        expectedVersion: this.expectedVersions.node,
      }),
      new AppVersionVerifyAction(appVersionService, {
        header: 'Docker Version',
        command: 'docker --version',
        recommendationUrl: `https://docs.docker.com/get-docker/`,
        expectedVersion: this.expectedVersions.docker,
      }),
      new AppVersionVerifyAction(appVersionService, {
        header: 'Docker Compose Version',
        command: 'docker compose version',
        recommendationUrl: `https://docs.docker.com/compose/install/`,
        expectedVersion: this.expectedVersions.dockerCompose,
      }),
    ];
  }

  private logReportLine(line: ReportLine): void {
    if (line.recommendation) {
      this.logger.error(`${line.header} - エラー - ${line.message} - ${line.recommendation}`);
      return;
    }
    this.logger.info(`${line.header} - OK - ${line.message}`);
  }

  /**
   * 検証レポートの生成・出力・妥当性確認を一括で実行する。
   */
  public async run(): Promise<void> {
    const report = await this.createReport();
    this.logReport(report);
    this.validateReport(report);
  }
}
