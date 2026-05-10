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
import { BootstrapService, CommandUtils, Constants } from '../service/index.js';

export default class UpdateVotingKey extends Command {
  static description = `必要に応じて、Voting キーを含む投票ファイルを更新します。
現在の投票ファイルの終了 epoch がネットワークの現在 epoch に近い場合、このコマンドは既存ファイルを引き継ぐ新しい 'private_key_treeX.dat' を作成します。
デフォルトでは、現在のファイルが最終月に入ると Bootstrap が新しい投票ファイルを作成します。現在 epoch はネットワークから解決されますが、\`finalizationEpoch\` で明示指定もできます。
新しい投票ファイルが作成された場合、Bootstrap は \`link\` コマンドの再実行を案内します。
`;

  static examples = [`$ symbol-bootstrap updateVotingKey`];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    user: Flags.string({
      char: 'u',
      description: `投票キーファイル生成時に Docker イメージを実行するユーザーを指定します。"${Constants.CURRENT_USER}" は現在のユーザーを意味します。`,
      default: Constants.CURRENT_USER,
    }),
    finalizationEpoch: Flags.integer({
      char: 'f',
      description: `ネットワークの finalization epoch を指定します。/chain/info REST エンドポイントから取得できます。
      未指定の場合は Bootstrap が解決した既知の epoch を使用します。`,
    }),
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(UpdateVotingKey);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    const votingKeyUpgrade = await new BootstrapService(logger).updateVotingKeys({
      target: flags.target,
      user: flags.user,
      finalizationEpoch: flags.finalizationEpoch,
    });
    if (votingKeyUpgrade) {
      logger.warn('Bootstrap が新しい投票ファイルを作成しました。ログを確認してください。');
      logger.warn('');
    } else {
      logger.info('');
      logger.info('投票ファイルは最新です。アップグレードの必要はありません。');
      logger.info('');
    }
  }
}
