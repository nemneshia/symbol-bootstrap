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

import { LogType, LoggerFactory } from '../logger/index.js';
import { BootstrapService, CommandUtils } from '../service/index.js';

export default class Decrypt extends Command {
  static description = `指定したパスワードで yaml ファイルを復号します。
    対象は custom preset、preset.yaml、addresses.yaml です。
    主な用途は、custom preset の暗号化後や --password 付きで bootstrap コマンドを実行した後に、暗号化ファイル内の秘密鍵を確認することです。`;

  static examples = [
    `
$ symbol-bootstrap start --password 1234 --preset testnet --assembly dual --customPreset decrypted-custom-preset.yaml --detached
$ symbol-bootstrap decrypt --password 1234 --source target/addresses.yaml --destination plain-addresses.yaml
$ symbol-bootstrap decrypt --password 1234 --source encrypted-custom-preset.yaml --destination plain-custom-preset.yaml
$ cat plain-addresses.yaml
$ cat plain-custom-preset.yaml
$ rm plain-addresses.yaml
$ rm plain-custom-preset.yaml
        `,

    `
$ symbol-bootstrap start --preset testnet --assembly dual --customPreset decrypted-custom-preset.yaml --detached
> パスワード入力
$ symbol-bootstrap decrypt --source target/addresses.yaml --destination plain-addresses.yaml
> パスワード入力（同じパスワードを入力）
$ symbol-bootstrap decrypt --source encrypted-custom-preset.yaml --destination plain-custom-preset.yaml
> パスワード入力（同じパスワードを入力）
$ cat plain-addresses.yaml
$ cat plain-custom-preset.yaml
$ rm plain-addresses.yaml
$ rm plain-custom-preset.yaml`,
    `
$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap decrypt --source target/addresses.yaml --destination plain-addresses.yaml
`,
  ];

  static flags = {
    help: CommandUtils.helpFlag,
    source: Flags.string({
      char: 's',
      description: `復号する元の暗号化済み yaml ファイルを指定します。`,
      required: true,
    }),
    destination: Flags.string({
      char: 'd',
      description: `作成する復号済みファイルの出力先を指定します。出力先ファイルは未作成である必要があります。`,
      required: true,
    }),
    password: CommandUtils.getPasswordFlag(
      `入力ファイルを復号して出力ファイルを作成するためのパスワードを指定します。
      デフォルトでは対話的に入力を求めますが、コマンドライン（--password=XXXX）で指定するか、--noPassword で無効化できます。`
    ),
    logger: CommandUtils.getLoggerFlag(LogType.Console),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Decrypt);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    const password = await CommandUtils.resolvePassword(
      logger,
      flags.password,
      false,
      `入力ファイルを復号して出力ファイルを作成するパスワードを入力してください。安全な場所に保管してください。`,
      false
    );
    const decryptMessage = await new BootstrapService(logger).decryptFile({
      source: flags.source,
      destination: flags.destination,
      password,
    });
    logger.info(decryptMessage);
    process.stdout.write(decryptMessage + '\n');
  }
}
