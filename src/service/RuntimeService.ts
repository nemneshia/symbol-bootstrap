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
import { exec as callbackExec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { Logger } from '../logger/index.js';
import { Utils } from '../utils/Utils.js';

const exec = promisify(callbackExec);

export interface SpawnParams {
  command: string;
  args: string[];
  useLogger: boolean;
  logPrefix?: string;
  shell?: boolean;
}

export interface RunImageUsingExecParams {
  catapultAppFolder?: string;
  image: string;
  userId?: string;
  workdir?: string;
  cmds: string[];
  binds: string[];
  ignoreErrors?: boolean;
}

/**
 * OS コマンド実行を担当するサービス。
 * コマンドをホスト OS 上で直接実行することも、Docker コンテナ経由で実行することもできる。
 */
export class RuntimeService {
  private static readonly pulledImages: string[] = [];
  private static dockerUserId: string;
  public static readonly CURRENT_USER = 'current';
  constructor(private readonly logger: Logger) {}

  /**
   * シェルコマンドを `exec` で実行する。
   *
   * @param runCommand 実行するコマンド文字列
   * @param ignoreErrors `true` の場合はエラー時も stdout/stderr を返す
   * @returns 実行結果の stdout/stderr
   */
  public exec(
    runCommand: string,
    ignoreErrors?: boolean
  ): Promise<{ stdout: string; stderr: string }> {
    this.logger.debug(`実行コマンド: ${runCommand}`);
    return exec(runCommand)
      .then((result: any) => {
        if (typeof result === 'string') {
          return { stdout: result, stderr: '' };
        }
        return result;
      })
      .catch((error) => {
        if (ignoreErrors) return { stdout: error.stdout, stderr: error.stderr };
        throw error;
      });
  }

  /**
   * Docker イメージを `docker run` + `exec` で実行する。
   *
   * @param params 実行パラメータ
   * @returns 実行結果の stdout/stderr
   */
  public runImageUsingExec({
    catapultAppFolder,
    image,
    userId,
    workdir,
    cmds,
    binds,
    ignoreErrors,
  }: RunImageUsingExecParams): Promise<{ stdout: string; stderr: string }> {
    const runCommand = this.createDockerRunCommand({
      catapultAppFolder,
      image,
      userId,
      workdir,
      cmds,
      binds,
    });
    this.logger.info(Utils.secureString(`Exec でイメージを実行します: ${image} ${cmds.join(' ')}`));
    return this.exec(runCommand, ignoreErrors);
  }

  /**
   * `docker run` のコマンド文字列を組み立てる。
   *
   * @param params Docker 実行パラメータ
   * @returns 実行可能な `docker run` コマンド
   */
  private createDockerRunCommand({
    catapultAppFolder,
    image,
    userId,
    workdir,
    cmds,
    binds,
  }: Omit<RunImageUsingExecParams, 'ignoreErrors'>): string {
    const volumes = binds.map((b) => `-v ${b}`).join(' ');
    const userParam = userId ? `-u ${userId}` : '';
    const workdirParam = workdir ? `--workdir=${workdir}` : '';
    const environmentParam = catapultAppFolder
      ? `--env LD_LIBRARY_PATH=${catapultAppFolder}/lib:${catapultAppFolder}/deps`
      : '';
    const commandLine = cmds.map((a) => `"${a}"`).join(' ');
    return `docker run --rm ${userParam} ${workdirParam} ${environmentParam} ${volumes} ${image} ${commandLine}`
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 子プロセスを `spawn` で実行し、出力をログへ中継する。
   *
   * @param params spawn 実行パラメータ
   * @returns 収集したログ文字列（`useLogger=false` の場合は固定メッセージ）
   */
  public async spawn({
    command,
    args,
    useLogger,
    logPrefix = '',
    shell,
  }: SpawnParams): Promise<string> {
    const cmd = spawn(command, args, { shell: shell });
    return new Promise<string>((resolve, reject) => {
      this.logger.info(`spawn コマンド: ${command} ${args.join(' ')}`);
      const state = this.createSpawnLogState(useLogger, logPrefix);
      const log = (data: string, isError: boolean) => this.logSpawnOutput(state, data, isError);

      cmd.stdout.on('data', (data) => {
        log(`${data}`.trim(), false);
      });

      cmd.stderr.on('data', (data) => {
        log(`${data}`.trim(), true);
      });

      cmd.on('error', (error) => {
        log(`${error.message}`.trim(), true);
      });

      cmd.on('close', (code) => {
        if (code) {
          log(`Process closed with code ${code}`, true);
          reject(new Error(`Process closed with code ${code}\n${state.logText}`));
        } else {
          resolve(state.logText);
        }
      });

      process.on('SIGINT', () => {
        resolve(state.logText);
      });
    });
  }

  /** spawn 実行時のログ保持状態を生成する。 */
  private createSpawnLogState(
    useLogger: boolean,
    logPrefix: string
  ): { useLogger: boolean; logPrefix: string; logText: string } {
    return {
      useLogger,
      logPrefix,
      logText: useLogger ? '' : 'Check console for output....',
    };
  }

  /** spawn 出力を logger または console に中継し、必要に応じてログ蓄積する。 */
  private logSpawnOutput(
    state: { useLogger: boolean; logPrefix: string; logText: string },
    data: string,
    isError: boolean
  ): void {
    if (state.useLogger) {
      state.logText += `${data}\n`;
      if (isError) this.logger.warn(Utils.secureString(state.logPrefix + data));
      else this.logger.info(Utils.secureString(state.logPrefix + data));
      return;
    }
    console.log(state.logPrefix + data);
  }

  /**
   * Docker イメージを pull する。
   * 一度 pull したイメージはプロセス内キャッシュにより再 pull をスキップする。
   *
   * @param image pull 対象イメージ
   */
  public async pullImage(image: string): Promise<void> {
    Utils.validateIsDefined(image, 'Image must be provided');
    if (RuntimeService.pulledImages.includes(image)) {
      return;
    }
    try {
      this.logger.info(`イメージを pull します: ${image}`);
      const stdout = await this.spawn({
        command: 'docker',
        args: ['pull', image],
        useLogger: true,
        logPrefix: `${image} `,
      });
      const outputLines = stdout.toString().split('\n');
      this.logger.info(`イメージの pull が完了しました: ${outputLines[outputLines.length - 2]}`);
      RuntimeService.pulledImages.push(image);
    } catch {
      this.logger.warn(`イメージ ${image} を pull できませんでした。`);
    }
  }
  /**
   * Docker コンテナ実行時の `uid:gid` を解決する。
   * Windows では root 実行を返し、それ以外では現在プロセスの uid/gid を返す。
   */
  public async getDockerUserGroup(): Promise<string | undefined> {
    const isWin = Utils.isWindows();
    if (isWin) {
      // ホストがWindowsの場合はパーミッションがないためrootで起動
      return 'root:root';
    }
    if (RuntimeService.dockerUserId !== undefined) {
      return RuntimeService.dockerUserId;
    }
    try {
      const userId = process.getuid!();
      const groupId = process.getgid!();
      const user = `${userId}:${groupId}`;
      this.logger.info(`docker 用ユーザーを解決しました: ${user}`);
      if (userId === 0) {
        this.logger.error('Bootstrap を root で実行しています。非推奨です。');
      }
      RuntimeService.dockerUserId = user;
      return user;
    } catch (e) {
      this.logger.info(`docker 用ユーザーを解決できませんでした: ${e}`);
      return undefined;
    }
  }

  /**
   * CLI で指定された Docker 実行ユーザー引数を解決する。
   * `current` の場合は実行環境の `uid:gid` に展開する。
   */
  public async resolveDockerUserFromParam(
    paramUser: string | undefined
  ): Promise<string | undefined> {
    if (!paramUser || paramUser.trim() === '') {
      return undefined;
    }
    if (paramUser === RuntimeService.CURRENT_USER) {
      return this.getDockerUserGroup();
    }
    return paramUser;
  }
}
