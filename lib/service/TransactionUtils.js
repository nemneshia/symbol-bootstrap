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
exports.TransactionUtils = void 0;
const rxjs_1 = require("rxjs");
const RemoteNodeService_1 = require("./RemoteNodeService");
class TransactionUtils {
    static async getRepositoryFactory(logger, presetData, url) {
        const repositoryInfo = await new RemoteNodeService_1.RemoteNodeService(logger, presetData, false).getBestRepositoryInfo(url);
        return repositoryInfo.repositoryFactory;
    }
    static async getMultisigAccount(repositoryFactory, accountAddress) {
        try {
            const info = await (0, rxjs_1.firstValueFrom)(repositoryFactory.createMultisigRepository().getMultisigAccountInfo(accountAddress));
            return info.isMultisig() ? info : undefined;
        }
        catch (e) {
            return undefined;
        }
    }
}
exports.TransactionUtils = TransactionUtils;
