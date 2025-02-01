"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultAccountResolver = void 0;
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
const symbol_sdk_1 = require("symbol-sdk");
/**
 * Basic no prompt implementation. If the account cannot be resolved, it won't be prompted.
 */
class DefaultAccountResolver {
    async resolveAccount(networkType, account, keyName, nodeName, operationDescription, generateErrorMessage) {
        if (!account) {
            if (generateErrorMessage) {
                throw new Error(generateErrorMessage);
            }
            return this.generateNewAccount(networkType);
        }
        if (account === null || account === void 0 ? void 0 : account.privateKey) {
            return symbol_sdk_1.Account.createFromPrivateKey(account.privateKey, networkType);
        }
        throw new Error('Private key not provided');
    }
    generateNewAccount(networkType) {
        return symbol_sdk_1.Account.generateNewAccount(networkType);
    }
}
exports.DefaultAccountResolver = DefaultAccountResolver;
