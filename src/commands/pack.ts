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
import { confirm, isCancel } from '@clack/prompts';
import { Command, Flags } from '@oclif/core';

import { LogType, LoggerFactory } from '../logger/index.js';
import { SymbolCryptoAdapter } from '../sdk/index.js';
import {
  BootstrapAccountResolver,
  BootstrapService,
  CommandUtils,
  Constants,
} from '../service/index.js';
import Clean from './clean.js';
import Compose from './compose.js';
import Config from './config.js';

export default class Pack extends Command {
  static description =
    'ノード設定を生成し、最終ノード環境へアップロード可能な ZIP ファイルとしてパッケージ化します。';

  static examples = [
    `$ symbol-bootstrap pack`,
    `$ symbol-bootstrap pack -c custom-preset.yaml`,
    `$ symbol-bootstrap pack -p testnet -a dual -c custom-preset.yaml`,
    `$ symbol-bootstrap pack -p mainnet -a dual --password 1234 -c custom-preset.yaml`,
    `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap pack -c custom-preset.yaml`,
  ];

  static flags = {
    ...Compose.flags,
    ...Clean.flags,
    ...Config.flags,
    ready: Flags.boolean({
      description: '--ready を指定すると、オフライン確認のプロンプトを表示せずに実行します。',
    }),
    logger: CommandUtils.getLoggerFlag(LogType.Console),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Pack);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    logger.info('');
    logger.info('');
    if (!flags.ready || flags.offline) {
      const response = await confirm({
        message: `Symbol Bootstrap はこれから機密情報（証明書・投票ファイル生成）を扱います。続行前にネットワークから切断することを強く推奨します。オフラインである、または気にしない場合は YES を選択してください。`,
        initialValue: true,
      });
      if (isCancel(response) || !response) {
        logger.info('オフラインになってから再度実行してください...');
        return;
      }
    }

    flags.password = await CommandUtils.resolvePassword(
      logger,
      flags.password,
      flags.noPassword,
      CommandUtils.passwordPromptDefaultMessage,
      true
    );
    const workingDir = Constants.defaultWorkingDir;
    const accountResolver = new BootstrapAccountResolver(logger, new SymbolCryptoAdapter());
    const { targetZip } = await new BootstrapService(logger).pack({
      ...flags,
      workingDir,
      accountResolver,
    });
    logger.info('');
    logger.info(
      `ZIP ファイル ${targetZip} を作成しました。ノード環境で展開し、次を実行してください:`
    );
    logger.info(`$ symbol-bootstrap start`);
  }
}
