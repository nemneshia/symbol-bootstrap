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
exports.LinkTransactionGenericFactory = exports.LinkService = void 0;
const inquirer_1 = require("inquirer");
const symbol_sdk_1 = require("symbol-sdk");
const service_1 = require("../service");
const AnnounceService_1 = require("./AnnounceService");
const ConfigLoader_1 = require("./ConfigLoader");
const Constants_1 = require("./Constants");
class LinkService {
    constructor(logger, params) {
        this.logger = logger;
        this.params = params;
        this.configLoader = new ConfigLoader_1.ConfigLoader(logger);
    }
    async run(passedPresetData, passedAddresses) {
        const presetData = passedPresetData !== null && passedPresetData !== void 0 ? passedPresetData : this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
        const addresses = passedAddresses !== null && passedAddresses !== void 0 ? passedAddresses : this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
        const customPreset = this.configLoader.loadCustomPreset(this.params.customPreset, this.params.password);
        this.logger.info(`${this.params.unlink ? 'Unlinking' : 'Linking'} nodes`);
        const accountResolver = this.params.accountResolver || new service_1.BootstrapAccountResolver(this.logger);
        await new AnnounceService_1.AnnounceService(this.logger, accountResolver).announce(this.params.url, this.params.maxFee, this.params.useKnownRestGateways, this.params.ready, this.params.target, this.configLoader.mergePresets(presetData, customPreset), addresses, this, 'some', this.params.serviceProviderPublicKey);
    }
    async createTransactions({ presetData, nodeAccount, mainAccountInfo, deadline, maxFee, latestFinalizedBlockEpoch, }) {
        const networkType = presetData.networkType;
        const mainAccountAddress = nodeAccount.main.address;
        const nodeName = nodeAccount.name;
        const remoteTransactionFactory = ({ publicKey }, action) => symbol_sdk_1.AccountKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee);
        const vrfTransactionFactory = ({ publicKey }, action) => symbol_sdk_1.VrfKeyLinkTransaction.create(deadline, publicKey, action, networkType, maxFee);
        const votingKeyTransactionFactory = (account, action) => {
            return symbol_sdk_1.VotingKeyLinkTransaction.create(deadline, account.publicKey, account.startEpoch, account.endEpoch, action, networkType, 1, maxFee);
        };
        this.logger.info(`Creating transactions for node: ${nodeName}, ca/main account: ${mainAccountAddress}`);
        const transactions = await new LinkTransactionGenericFactory(this.logger, this.params).createGenericTransactions(nodeName, {
            vrf: mainAccountInfo === null || mainAccountInfo === void 0 ? void 0 : mainAccountInfo.supplementalPublicKeys.vrf,
            remote: mainAccountInfo === null || mainAccountInfo === void 0 ? void 0 : mainAccountInfo.supplementalPublicKeys.linked,
            voting: (mainAccountInfo === null || mainAccountInfo === void 0 ? void 0 : mainAccountInfo.supplementalPublicKeys.voting) || [],
        }, nodeAccount, latestFinalizedBlockEpoch || presetData.lastKnownNetworkEpoch, remoteTransactionFactory, vrfTransactionFactory, votingKeyTransactionFactory);
        //Unlink transactions go first.
        return transactions.sort((t1, t2) => t1.linkAction - t2.linkAction);
    }
}
exports.LinkService = LinkService;
LinkService.defaultParams = {
    target: Constants_1.Constants.defaultTargetFolder,
    useKnownRestGateways: false,
    ready: false,
    url: 'http://localhost:3000',
    maxFee: 100000,
    unlink: false,
};
class LinkTransactionGenericFactory {
    constructor(logger, params) {
        this.logger = logger;
        this.params = params;
    }
    async createGenericTransactions(nodeName, currentMainAccountKeys, nodeAccount, latestFinalizedBlockEpoch, remoteTransactionFactory, vrfTransactionFactory, votingKeyTransactionFactory) {
        const transactions = [];
        const print = (account) => `public key ${account.publicKey}`;
        if (nodeAccount.remote) {
            transactions.push(...(await this.addTransaction(currentMainAccountKeys.remote, remoteTransactionFactory, nodeName, 'Remote', nodeAccount.remote, print)));
        }
        if (nodeAccount.vrf) {
            transactions.push(...(await this.addTransaction(currentMainAccountKeys.vrf, vrfTransactionFactory, nodeName, 'VRF', nodeAccount.vrf, print)));
        }
        const votingPrint = (account) => `public key ${account.publicKey}, start epoch ${account.startEpoch}, end epoch ${account.endEpoch}`;
        if (this.params.unlink) {
            transactions.push(...(await this.addVotingKeyUnlinkTransactions((currentMainAccountKeys === null || currentMainAccountKeys === void 0 ? void 0 : currentMainAccountKeys.voting) || [], nodeAccount.voting || [], nodeName, votingKeyTransactionFactory, votingPrint)));
        }
        else {
            transactions.push(...(await this.addVotingKeyLinkTransactions((currentMainAccountKeys === null || currentMainAccountKeys === void 0 ? void 0 : currentMainAccountKeys.voting) || [], nodeAccount.voting || [], nodeName, latestFinalizedBlockEpoch, votingKeyTransactionFactory, votingPrint)));
        }
        return transactions;
    }
    async addVotingKeyLinkTransactions(linkedVotingKeyAccounts, votingKeyFiles, nodeName, lastKnownNetworkEpoch, transactionFactory, print) {
        const transactions = [];
        const accountName = 'Voting';
        let remainingVotingKeys = linkedVotingKeyAccounts;
        for (const alreadyLinkedAccount of linkedVotingKeyAccounts) {
            if (alreadyLinkedAccount.endEpoch < lastKnownNetworkEpoch &&
                (await this.confirmUnlink(accountName, alreadyLinkedAccount, print))) {
                const unlinkTransaction = transactionFactory(alreadyLinkedAccount, symbol_sdk_1.LinkAction.Unlink);
                this.logger.info(`Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`);
                remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
                transactions.push(unlinkTransaction);
            }
        }
        const activeVotingKeyFiles = votingKeyFiles.filter((a) => a.endEpoch >= lastKnownNetworkEpoch);
        for (const accountTobeLinked of activeVotingKeyFiles) {
            const alreadyLinkedAccount = remainingVotingKeys.find((a) => LinkTransactionGenericFactory.overlapsVotingAccounts(accountTobeLinked, a));
            const isAlreadyLinkedSameAccount = (alreadyLinkedAccount === null || alreadyLinkedAccount === void 0 ? void 0 : alreadyLinkedAccount.publicKey.toUpperCase()) === accountTobeLinked.publicKey.toUpperCase() &&
                (alreadyLinkedAccount === null || alreadyLinkedAccount === void 0 ? void 0 : alreadyLinkedAccount.startEpoch) === accountTobeLinked.startEpoch &&
                (alreadyLinkedAccount === null || alreadyLinkedAccount === void 0 ? void 0 : alreadyLinkedAccount.endEpoch) === accountTobeLinked.endEpoch;
            let addTransaction = !isAlreadyLinkedSameAccount;
            if (alreadyLinkedAccount && !isAlreadyLinkedSameAccount) {
                this.logger.warn(`Node ${nodeName} is already linked to ${accountName} ${print(alreadyLinkedAccount)} which is different from the configured ${print(accountTobeLinked)}.`);
                if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
                    const unlinkTransaction = transactionFactory(alreadyLinkedAccount, symbol_sdk_1.LinkAction.Unlink);
                    this.logger.info(`Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`);
                    remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
                    transactions.push(unlinkTransaction);
                }
                else {
                    addTransaction = false;
                }
            }
            if (remainingVotingKeys.length < 3 && addTransaction) {
                const transaction = transactionFactory(accountTobeLinked, symbol_sdk_1.LinkAction.Link);
                this.logger.info(`Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`);
                transactions.push(transaction);
                remainingVotingKeys.push(accountTobeLinked);
            }
        }
        return transactions;
    }
    async addVotingKeyUnlinkTransactions(linkedVotingKeyAccounts, votingKeyFiles, nodeName, transactionFactory, print) {
        const transactions = [];
        const accountName = 'Voting';
        let remainingVotingKeys = linkedVotingKeyAccounts;
        for (const accountTobeLinked of votingKeyFiles) {
            const alreadyLinkedAccount = remainingVotingKeys.find((a) => LinkTransactionGenericFactory.overlapsVotingAccounts(accountTobeLinked, a));
            const isAlreadyLinkedSameAccount = (alreadyLinkedAccount === null || alreadyLinkedAccount === void 0 ? void 0 : alreadyLinkedAccount.publicKey.toUpperCase()) === accountTobeLinked.publicKey.toUpperCase() &&
                (alreadyLinkedAccount === null || alreadyLinkedAccount === void 0 ? void 0 : alreadyLinkedAccount.startEpoch) === accountTobeLinked.startEpoch &&
                (alreadyLinkedAccount === null || alreadyLinkedAccount === void 0 ? void 0 : alreadyLinkedAccount.endEpoch) === accountTobeLinked.endEpoch;
            if (alreadyLinkedAccount && isAlreadyLinkedSameAccount) {
                if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
                    const unlinkTransaction = transactionFactory(alreadyLinkedAccount, symbol_sdk_1.LinkAction.Unlink);
                    this.logger.info(`Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`);
                    remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
                    transactions.push(unlinkTransaction);
                }
            }
        }
        return transactions;
    }
    static overlapsVotingAccounts(x, y) {
        return x.endEpoch >= y.startEpoch && x.startEpoch <= y.endEpoch;
    }
    async addTransaction(alreadyLinkedAccount, transactionFactory, nodeName, accountName, accountTobeLinked, print) {
        const transactions = [];
        const isAlreadyLinkedSameAccount = accountTobeLinked.publicKey.toUpperCase() === (alreadyLinkedAccount === null || alreadyLinkedAccount === void 0 ? void 0 : alreadyLinkedAccount.publicKey.toUpperCase());
        if (this.params.unlink) {
            if (alreadyLinkedAccount) {
                if (isAlreadyLinkedSameAccount) {
                    const transaction = transactionFactory(accountTobeLinked, symbol_sdk_1.LinkAction.Unlink);
                    this.logger.info(`Creating Unlink ${accountName} Transaction for node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`);
                    transactions.push(transaction);
                }
                else {
                    this.logger.warn(`Node ${nodeName} is linked to a different ${accountName} ${print(alreadyLinkedAccount)} and not the configured ${print(accountTobeLinked)}.`);
                    if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
                        const transaction = transactionFactory(alreadyLinkedAccount, symbol_sdk_1.LinkAction.Unlink);
                        this.logger.info(`Creating Unlink ${accountName} Transaction  for node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`);
                        transactions.push(transaction);
                    }
                }
            }
            else {
                this.logger.info(`Node ${nodeName} is not linked to ${accountName} ${print(accountTobeLinked)}.`);
            }
        }
        else {
            if (alreadyLinkedAccount) {
                if (isAlreadyLinkedSameAccount) {
                    this.logger.info(`Node ${nodeName} is already linked to ${accountName} ${print(alreadyLinkedAccount)}.`);
                }
                else {
                    this.logger.warn(`Node ${nodeName} is already linked to ${accountName} ${print(alreadyLinkedAccount)} which is different from the configured ${print(accountTobeLinked)}.`);
                    if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
                        const unlinkTransaction = transactionFactory(alreadyLinkedAccount, symbol_sdk_1.LinkAction.Unlink);
                        this.logger.info(`Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`);
                        transactions.push(unlinkTransaction);
                        const linkTransaction = transactionFactory(accountTobeLinked, symbol_sdk_1.LinkAction.Link);
                        this.logger.info(`Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`);
                        transactions.push(linkTransaction);
                    }
                }
            }
            else {
                const transaction = transactionFactory(accountTobeLinked, symbol_sdk_1.LinkAction.Link);
                this.logger.info(`Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`);
                transactions.push(transaction);
            }
        }
        return transactions;
    }
    async confirmUnlink(accountName, alreadyLinkedAccount, print) {
        if (this.params.removeOldLinked === undefined) {
            return (this.params.ready ||
                (await (0, inquirer_1.prompt)([
                    {
                        name: 'value',
                        message: `Do you want to unlink the old ${accountName} ${print(alreadyLinkedAccount)}?`,
                        type: 'confirm',
                        default: false,
                    },
                ])).value);
        }
        return this.params.removeOldLinked;
    }
}
exports.LinkTransactionGenericFactory = LinkTransactionGenericFactory;
