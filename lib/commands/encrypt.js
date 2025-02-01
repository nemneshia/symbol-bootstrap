"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const command_1 = require("@oclif/command");
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = require("../logger");
const service_1 = require("../service");
class Encrypt extends command_1.Command {
    async run() {
        const { flags } = this.parse(Encrypt);
        if (!(0, fs_1.existsSync)(flags.source)) {
            throw new service_1.KnownError(`Source file ${flags.source} does not exist!`);
        }
        if ((0, fs_1.existsSync)(flags.destination)) {
            throw new service_1.KnownError(`Destination file ${flags.destination} already exists!`);
        }
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        const password = await service_1.CommandUtils.resolvePassword(logger, flags.password, false, `Enter the password used to decrypt the source file into the destination file. Keep this password in a secure place!`, false);
        const data = await service_1.YamlUtils.loadYaml(flags.source, false);
        if (service_1.CryptoUtils.encryptedCount(data) > 0) {
            throw new service_1.KnownError(`Source file ${flags.source} is already encrypted. If you want to decrypt it use the decrypt command.`);
        }
        await new service_1.FileSystemService(logger).mkdir((0, path_1.dirname)(flags.destination));
        await service_1.YamlUtils.writeYaml(flags.destination, data, password);
        logger.info(`Encrypted file ${flags.destination} has been created!`);
    }
}
exports.default = Encrypt;
Encrypt.description = `It encrypts a yml file using the provided password. The source files would be a custom preset file, a preset.yml file or an addresses.yml.

The main use case of this command is encrypting custom presets files. If your custom preset contains private keys, it's highly recommended to encrypt it and use provide --password when starting or configuring the node with Bootstrap.`;
Encrypt.examples = [
    `
$ symbol-bootstrap encrypt --source plain-custom-preset.yml --destination encrypted-custom-preset.yml
> password prompt
$ symbol-bootstrap start --preset testnet --assembly dual --customPreset encrypted-custom-preset.yml
> password prompt (enter the same password)
        `,
    `
$ symbol-bootstrap encrypt --password 1234 --source plain-custom-preset.yml --destination encrypted-custom-preset.yml
$ symbol-bootstrap start --password 1234 --preset testnet --assembly dual --customPreset encrypted-custom-preset.yml
`,
    `
 $ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap encrypt --source plain-custom-preset.yml --destination encrypted-custom-preset.yml
 `,
];
Encrypt.flags = {
    help: service_1.CommandUtils.helpFlag,
    source: command_1.flags.string({
        description: `The source plain yml file to be encrypted. If this file is encrypted, the command will raise an error.`,
        required: true,
    }),
    destination: command_1.flags.string({
        description: `The destination encrypted file to create. The destination file must not exist.`,
        required: true,
    }),
    password: service_1.CommandUtils.getPasswordFlag(`The password to use to encrypt the source file into the destination file. Bootstrap prompts for a password by default, can be provided in the command line (--password=XXXX) or disabled in the command line (--noPassword).`),
    logger: service_1.CommandUtils.getLoggerFlag(logger_1.LogType.Console),
};
