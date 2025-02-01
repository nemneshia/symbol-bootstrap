"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatapultVotingKeyFileProvider = exports.NativeVotingKeyFileProvider = void 0;
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
const fs_1 = require("fs");
const path_1 = require("path");
const symbol_sdk_1 = require("symbol-sdk");
const RuntimeService_1 = require("./RuntimeService");
const VotingUtils_1 = require("./VotingUtils");
class NativeVotingKeyFileProvider {
    constructor(logger) {
        this.logger = logger;
        this.runtimeService = new RuntimeService_1.RuntimeService(logger);
    }
    async createVotingFile({ presetData, votingKeysFolder, privateKeyTreeFileName, votingKeyStartEpoch, votingKeyEndEpoch, }) {
        const votingAccount = symbol_sdk_1.Account.generateNewAccount(presetData.networkType);
        const votingPrivateKey = votingAccount.privateKey;
        const votingUtils = new VotingUtils_1.VotingUtils();
        this.logger.info('Voting file is created using the native typescript voting key file generator!');
        const votingFile = await votingUtils.createVotingFile(votingPrivateKey, votingKeyStartEpoch, votingKeyEndEpoch);
        (0, fs_1.writeFileSync)((0, path_1.join)(votingKeysFolder, privateKeyTreeFileName), votingFile);
        return {
            publicKey: votingAccount.publicKey,
        };
    }
}
exports.NativeVotingKeyFileProvider = NativeVotingKeyFileProvider;
class CatapultVotingKeyFileProvider {
    constructor(logger, user) {
        this.logger = logger;
        this.user = user;
        this.runtimeService = new RuntimeService_1.RuntimeService(logger);
    }
    async createVotingFile({ presetData, votingKeysFolder, privateKeyTreeFileName, votingKeyStartEpoch, votingKeyEndEpoch, }) {
        this.logger.info(`Voting file is created using docker and catapult.tools.votingkey`);
        const votingAccount = symbol_sdk_1.Account.generateNewAccount(presetData.networkType);
        const votingPrivateKey = votingAccount.privateKey;
        const symbolServerImage = presetData.symbolServerImage;
        const binds = [`${votingKeysFolder}:/votingKeys:rw`];
        const cmd = [
            `${presetData.catapultAppFolder}/bin/catapult.tools.votingkey`,
            `--secret=${votingPrivateKey}`,
            `--startEpoch=${votingKeyStartEpoch}`,
            `--endEpoch=${votingKeyEndEpoch}`,
            `--output=/votingKeys/${privateKeyTreeFileName}`,
        ];
        const userId = await this.runtimeService.resolveDockerUserFromParam(this.user);
        const { stdout, stderr } = await this.runtimeService.runImageUsingExec({
            catapultAppFolder: presetData.catapultAppFolder,
            image: symbolServerImage,
            userId: userId,
            cmds: cmd,
            binds: binds,
        });
        if (stdout.indexOf('<error> ') > -1) {
            this.logger.info(stdout);
            this.logger.error(stderr);
            throw new Error('Voting key failed. Check the logs!');
        }
        return {
            publicKey: votingAccount.publicKey,
        };
    }
}
exports.CatapultVotingKeyFileProvider = CatapultVotingKeyFileProvider;
