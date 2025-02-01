"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BootstrapAccountResolver = void 0;
/*
 * Copyright 2021 NEM
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
const inquirer_1 = require("inquirer");
const symbol_sdk_1 = require("symbol-sdk");
const _1 = require("./");
/**
 * Prompt ready implementation of the account resolver.
 */
class BootstrapAccountResolver {
    constructor(logger) {
        this.logger = logger;
    }
    async resolveAccount(networkType, account, keyName, nodeName, operationDescription, generateErrorMessage) {
        if (!account) {
            if (generateErrorMessage) {
                throw new _1.KnownError(generateErrorMessage);
            }
            this.logger.info(`Generating ${keyName} account...`);
            return symbol_sdk_1.Account.generateNewAccount(networkType);
        }
        if (account.privateKey) {
            return symbol_sdk_1.Account.createFromPrivateKey(account.privateKey, networkType);
        }
        while (true) {
            this.logger.info('');
            this.logger.info(`${keyName} private key is required when ${operationDescription}.`);
            const address = symbol_sdk_1.PublicAccount.createFromPublicKey(account.publicKey, networkType).address.plain();
            const nodeDescription = nodeName === '' ? `of` : `of the Node's '${nodeName}'`;
            const responses = await (0, inquirer_1.prompt)([
                {
                    name: 'value',
                    message: `Enter the 64 HEX private key ${nodeDescription} ${keyName} account with Address: ${address} and Public Key: ${account.publicKey}:`,
                    type: 'password',
                    mask: '*',
                    validate: _1.CommandUtils.isValidPrivateKey,
                },
            ]);
            const privateKey = responses.value === '' ? undefined : responses.value.toUpperCase();
            if (!privateKey) {
                this.logger.info('Please provide the private key.');
            }
            else {
                const enteredAccount = symbol_sdk_1.Account.createFromPrivateKey(privateKey, networkType);
                if (enteredAccount.publicKey.toUpperCase() !== account.publicKey.toUpperCase()) {
                    this.logger.info(`Invalid private key. Expected address is ${address} but you provided the private key for address ${enteredAccount.address.plain()}.\n`);
                    this.logger.info(`Please re-enter private key.`);
                }
                else {
                    account.privateKey = privateKey;
                    return enteredAccount;
                }
            }
        }
    }
}
exports.BootstrapAccountResolver = BootstrapAccountResolver;
