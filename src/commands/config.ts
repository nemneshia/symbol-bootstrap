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
import {
  Assembly,
  BootstrapAccountResolver,
  BootstrapService,
  CommandUtils,
  ConfigService,
  Constants,
  Preset,
} from '../service/index.js';

export default class Config extends Command {
  static description = '現在のネットワーク向けに設定ファイルとネメシスブロックを生成します。';

  static examples = [
    `
$ symbol-bootstrap config -p testnet -a dual --password 1234
$ symbol-bootstrap config -p testnet -a api -c custom-preset.yaml
$ symbol-bootstrap config -p mainnet -a peer -c custom-preset.yaml
$ symbol-bootstrap config -p mainnet -a my-custom-assembly.yaml -c custom-preset.yaml
$ symbol-bootstrap config -p custom-network.yaml -a dual -c custom-preset.yaml
$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap config -p testnet -a dual
    `,
  ];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    password: CommandUtils.passwordFlag,
    noPassword: CommandUtils.noPasswordFlag,
    preset: Flags.string({
      char: 'p',
      description: `ネットワークプリセットを指定します。
      カスタムプリセットまたは CLI パラメータから指定できます。未指定の場合は  \`target/preset.yaml\` から解決されます。
      指定可能な値: ${Object.keys(Preset).join(', ')}, custom-network.yaml（上級者向け、カスタムネットワーク専用）。`,
    }),
    assembly: Flags.string({
      char: 'a',
      description: `ノード構成を定義するアセンブリを指定します。
      カスタムプリセットまたは CLI パラメータから指定できます。未指定の場合は \`target/preset.yaml\` から解決されます。
      指定可能な値: ${Object.keys(Assembly).join(', ')}, custom-assembly.yaml（上級者向け）。`,
    }),
    customPreset: Flags.string({
      char: 'c',
      description: `外部プリセットファイルを指定します。このファイルの値は指定済みプリセットを上書きします。`,
    }),
    reset: Flags.boolean({
      char: 'r',
      description: '設定をリセットして新しく生成します。',
      default: ConfigService.defaultParams.reset,
    }),

    upgrade: Flags.boolean({
      description: `既存の鍵を再利用して設定を再生成します。
      ローカルデータを削除せずに bootstrap のバージョンを上げる場合に使用してください。
      アップグレード前に \`target\` フォルダをバックアップすることを推奨します。`,
      default: ConfigService.defaultParams.reset,
    }),
    offline: CommandUtils.offlineFlag,

    user: Flags.string({
      char: 'u',
      description: `証明書やネメシスブロックなどの設定ファイル生成時に Docker イメージを実行するユーザーを指定します。
      \`${Constants.CURRENT_USER}\` は現在のユーザーを意味します。`,
      default: Constants.CURRENT_USER,
    }),
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Config);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    flags.password = await CommandUtils.resolvePassword(
      logger,
      flags.password,
      flags.noPassword,
      CommandUtils.passwordPromptDefaultMessage,
      true
    );
    const workingDir = Constants.defaultWorkingDir;
    const accountResolver = new BootstrapAccountResolver(logger);
    await new BootstrapService(logger).config({ ...flags, workingDir, accountResolver });
  }
}
