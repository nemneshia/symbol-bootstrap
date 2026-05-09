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

export default class Encrypt extends Command {
  static description = `指定したパスワードで yml ファイルを暗号化します。対象は custom preset、preset.yaml、addresses.yaml です。

主な用途は custom preset の暗号化です。custom preset に秘密鍵が含まれる場合は、暗号化して Bootstrap の起動や設定時に --password を指定して利用することを強く推奨します。`;

  static examples = [
    `
$ symbol-bootstrap encrypt --source plain-custom-preset.yaml --destination encrypted-custom-preset.yaml
> パスワード入力
$ symbol-bootstrap start --preset testnet --assembly dual --customPreset encrypted-custom-preset.yaml
> パスワード入力（同じパスワードを入力）
        `,
    `
$ symbol-bootstrap encrypt --password 1234 --source plain-custom-preset.yaml --destination encrypted-custom-preset.yaml
$ symbol-bootstrap start --password 1234 --preset testnet --assembly dual --customPreset encrypted-custom-preset.yaml
`,
    `
 $ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap encrypt --source plain-custom-preset.yaml --destination encrypted-custom-preset.yaml
 `,
  ];

  static flags = {
    help: CommandUtils.helpFlag,
    source: Flags.string({
      description: `暗号化する元の平文 yml ファイルを指定します。すでに暗号化済みのファイルを指定するとエラーになります。`,
      required: true,
    }),
    destination: Flags.string({
      description: `作成する暗号化済みファイルの出力先を指定します。出力先ファイルは未作成である必要があります。`,
      required: true,
    }),
    password: CommandUtils.getPasswordFlag(
      `元ファイルを暗号化して出力先ファイルを作成する際に使うパスワードを指定します。デフォルトでは対話的に入力を求めますが、コマンドライン（--password=XXXX）で指定するか、--noPassword で無効化できます。`
    ),
    logger: CommandUtils.getLoggerFlag(LogType.Console),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Encrypt);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    const password = await CommandUtils.resolvePassword(
      logger,
      flags.password,
      false,
      `元ファイルを暗号化して出力先ファイルを作成するためのパスワードを入力してください。安全な場所に保管してください。`,
      false
    );
    const encryptMessage = await new BootstrapService(logger).encryptFile({
      source: flags.source,
      destination: flags.destination,
      password,
    });
    logger.info(encryptMessage);
    process.stdout.write(encryptMessage + '\n');
  }
}
