"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandUtils = void 0;
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
const command_1 = require("@oclif/command");
const figlet_1 = require("figlet");
const inquirer_1 = require("inquirer");
const symbol_sdk_1 = require("symbol-sdk");
const logger_1 = require("../logger");
const Constants_1 = require("./Constants");
class CommandUtils {
    static showBanner() {
        console.log((0, figlet_1.textSync)('symbol-bootstrap', { horizontalLayout: 'fitted' }));
    }
    static getPasswordFlag(description) {
        return command_1.flags.string({
            description: description,
            parse(input) {
                const result = !input || CommandUtils.isValidPassword(input);
                if (result === true)
                    return input;
                throw new Error(`--password is invalid, ${result}`);
            },
        });
    }
    static isValidPassword(input) {
        if (!input || input === '') {
            return true;
        }
        if (input.length >= 4)
            return true;
        return `Password must have at least 4 characters but got ${input.length}`;
    }
    static isValidPrivateKey(input) {
        return symbol_sdk_1.Convert.isHexString(input, 64) ? true : 'Invalid private key. It must have 64 hex characters.';
    }
    static async resolvePassword(logger, providedPassword, noPassword, message, log) {
        if (!providedPassword) {
            if (noPassword) {
                if (log)
                    logger.warn(`Password has not been provided (--noPassword)! It's recommended to use one for security!`);
                return undefined;
            }
            const responses = await (0, inquirer_1.prompt)([
                {
                    name: 'password',
                    mask: '*',
                    message: message,
                    type: 'password',
                    validate: CommandUtils.isValidPassword,
                },
            ]);
            if (responses.password === '' || !responses.password) {
                if (log)
                    logger.warn(`Password has not been provided (empty text)! It's recommended to use one for security!`);
                return undefined;
            }
            if (log)
                logger.info(`Password has been provided`);
            return responses.password;
        }
        if (log)
            logger.info(`Password has been provided`);
        return providedPassword;
    }
    /**
     * Returns account details formatted (ready to print)
     */
    static formatAccount(account, wrapped = true) {
        const log = `Address: ${account.address.plain()}`;
        return wrapped ? `[${log}]` : log;
    }
    /**
     * It returns the flag that can be used to tune the class of logger.
     * @param defaultLogTypes the default logger to be used if not provided.
     */
    static getLoggerFlag(...defaultLogTypes) {
        const options = Object.keys(logger_1.LogType).map((v) => v);
        return command_1.flags.string({
            description: `The loggers the command will use. Options are: ${options.join(logger_1.LoggerFactory.separator)}. Use '${logger_1.LoggerFactory.separator}' to select multiple loggers.`,
            default: defaultLogTypes.join(logger_1.LoggerFactory.separator),
        });
    }
}
exports.CommandUtils = CommandUtils;
CommandUtils.passwordPromptDefaultMessage = `Enter the password used to encrypt and decrypt custom presets, addresses.yml, and preset.yml files. When providing a password, private keys will be encrypted. Keep this password in a secure place!`;
CommandUtils.helpFlag = command_1.flags.help({ char: 'h', description: 'It shows the help of this command.' });
CommandUtils.targetFlag = command_1.flags.string({
    char: 't',
    description: 'The target folder where the symbol-bootstrap network is generated',
    default: Constants_1.Constants.defaultTargetFolder,
});
CommandUtils.passwordFlag = CommandUtils.getPasswordFlag(`A password used to encrypt and decrypt private keys in preset files like addresses.yml and preset.yml. Bootstrap prompts for a password by default, can be provided in the command line (--password=XXXX) or disabled in the command line (--noPassword).`);
CommandUtils.noPasswordFlag = command_1.flags.boolean({
    description: 'When provided, Bootstrap will not use a password, so private keys will be stored in plain text. Use with caution.',
    default: false,
});
CommandUtils.offlineFlag = command_1.flags.boolean({
    description: 'If --offline is used, Bootstrap resolves the configuration without querying the running network.',
    default: false,
});
