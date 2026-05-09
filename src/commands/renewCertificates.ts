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
import { BootstrapService, CommandUtils, Constants, KnownError } from '../service/index.js';

export default class RenewCertificates extends Command {
  static description = `ノードの SSL 証明書を更新します。node.csr.pem は再生成しますが、既存の秘密鍵は再利用します。

証明書は有効期限が近い場合（30 日以内）にのみ再生成されます。期限に関係なく更新したい場合は --force を指定してください。

このコマンドはノード秘密鍵自体は変更しません（現時点）。秘密鍵を変更するには harvesters.dat の移行とノードキーの再リンクが必要です。

実行前に target フォルダをバックアップすることを推奨します。
`;

  static examples = [`$ symbol-bootstrap renewCertificates`];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    password: CommandUtils.passwordFlag,
    noPassword: CommandUtils.noPasswordFlag,
    customPreset: Flags.string({
      char: 'c',
      description: `このコマンドは暗号化された addresses.yaml から main/transport の秘密鍵を解決します。main/transport の秘密鍵が custom preset にのみ保存されている場合は、このパラメータで指定してください。未指定の場合は必要時に入力を求めることがあります。`,
      required: false,
    }),
    user: Flags.string({
      char: 'u',
      description: `証明書生成時に Docker イメージを実行するユーザーを指定します。"${Constants.CURRENT_USER}" は現在のユーザーを意味します。`,
      default: Constants.CURRENT_USER,
    }),

    force: Flags.boolean({
      description: `有効期限が近くなくても証明書を更新します。`,
      default: false,
    }),
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(RenewCertificates);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    const password = await CommandUtils.resolvePassword(
      logger,
      flags.password,
      flags.noPassword,
      CommandUtils.passwordPromptDefaultMessage,
      true
    );
    const target = flags.target;
    let certificateUpgraded: boolean;
    try {
      certificateUpgraded = await new BootstrapService(logger).renewCertificates({
        target,
        password,
        customPreset: flags.customPreset,
        user: flags.user,
        force: flags.force,
      });
    } catch (error) {
      if (
        error instanceof KnownError &&
        error.message.includes('秘密鍵入力をキャンセルしました。')
      ) {
        logger.info('証明書更新をキャンセルしました。');
        return;
      }
      throw error;
    }
    if (certificateUpgraded) {
      logger.warn('');
      logger.warn('Bootstrap が新しい SSL 証明書を作成しました。ログを確認してください。');
      logger.warn('');
    } else {
      logger.info('');
      logger.info('SSL 証明書は最新です。アップグレードの必要はありません。');
      logger.info('');
    }
  }
}
