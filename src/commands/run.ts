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
import { Command, Flags } from '@oclif/core';

import { LoggerFactory, System } from '../logger/index.js';
import { BootstrapService, CommandUtils, RunService } from '../service/index.js';
import CheckHealth from './checkHealth.js';

export default class Run extends Command {
  static description = `生成済みの \`compose.yaml\` と設定を使って、docker でネットワークを起動します。
    事前に config と compose を実行してください。このコマンドは \`docker compose up\` のラッパーです。`;

  static examples = [`$ symbol-bootstrap run`];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    yes: CommandUtils.yesFlag,
    detached: Flags.boolean({
      char: 'd',
      description:
        '指定すると docker compose を -d（--detached）で実行し、サーバー起動を確認してから終了します。',
    }),

    checkHealth: Flags.boolean({
      description: CheckHealth.description,
    }),

    resetData: Flags.boolean({
      description:
        'データを削除します。生成済みの設定、証明書、各種キー、ネメシスブロックは保持します。',
    }),

    pullImages: Flags.boolean({
      description:
        '起動時に DockerHub からイメージを取得します。alpha/dev の docker イメージにのみ影響します。',
      default: RunService.defaultParams.pullImages,
    }),

    args: Flags.string({
      multiple: true,
      description:
        'docker compose up に追加引数を渡します。詳細は https://docs.docker.com/compose/reference/up を参照してください。',
    }),

    build: Flags.boolean({
      char: 'b',
      description: '指定すると docker compose を --build 付きで実行します。',
    }),

    timeout: Flags.integer({
      description: 'detached モード実行時のタイムアウト時間（ミリ秒）を指定します。',
      default: RunService.defaultParams.timeout,
    }),
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Run);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    if (flags.resetData && !flags.yes) {
      const confirmed = await CommandUtils.confirmDangerousAction(
        `起動前に対象フォルダ ${flags.target} のデータを削除してもよいですか？`
      );
      if (!confirmed) {
        logger.info('削除をキャンセルしました。ネットワーク起動は行いません。');
        return;
      }
    }
    return new BootstrapService(logger).run(flags);
  }
}
