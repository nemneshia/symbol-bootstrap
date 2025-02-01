"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnounceService = void 0;
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
const inquirer_1 = require("inquirer");
const rxjs_1 = require("rxjs");
const symbol_sdk_1 = require("symbol-sdk");
const CommandUtils_1 = require("./CommandUtils");
const ConfigService_1 = require("./ConfigService");
const TransactionUtils_1 = require("./TransactionUtils");
const Utils_1 = require("./Utils");
class AnnounceService {
    constructor(logger, accountResolver) {
        this.logger = logger;
        this.accountResolver = accountResolver;
    }
    async announce(providedUrl, providedMaxFee, useKnownRestGateways, ready, target, presetData, addresses, transactionFactory, tokenAmount = 'some', serviceProviderPublicKey) {
        var _a, _b;
        AnnounceService.onProcessListener();
        if (!presetData.nodes || !((_a = presetData.nodes) === null || _a === void 0 ? void 0 : _a.length)) {
            this.logger.info(`There are no transactions to announce...`);
            return;
        }
        const url = providedUrl.replace(/\/$/, '');
        const repositoryFactory = await TransactionUtils_1.TransactionUtils.getRepositoryFactory(this.logger, presetData, useKnownRestGateways ? undefined : url);
        const networkType = await (0, rxjs_1.firstValueFrom)(repositoryFactory.getNetworkType());
        const transactionRepository = repositoryFactory.createTransactionRepository();
        const transactionService = new symbol_sdk_1.TransactionService(transactionRepository, repositoryFactory.createReceiptRepository());
        const epochAdjustment = await (0, rxjs_1.firstValueFrom)(repositoryFactory.getEpochAdjustment());
        const listener = repositoryFactory.createListener();
        await listener.open();
        const faucetUrl = presetData.faucetUrl;
        const currency = (await (0, rxjs_1.firstValueFrom)(repositoryFactory.getCurrencies())).currency;
        const currencyMosaicId = currency.mosaicId;
        const deadline = symbol_sdk_1.Deadline.create(epochAdjustment);
        const minFeeMultiplier = (await (0, rxjs_1.firstValueFrom)(repositoryFactory.createNetworkRepository().getTransactionFees())).minFeeMultiplier;
        const latestFinalizedBlockEpoch = (await (0, rxjs_1.firstValueFrom)(repositoryFactory.createChainRepository().getChainInfo()))
            .latestFinalizedBlock.finalizationEpoch;
        if (!currencyMosaicId) {
            throw new Error('Mosaic Id must not be null!');
        }
        if (providedMaxFee) {
            this.logger.info(`MaxFee is ${providedMaxFee / Math.pow(10, currency.divisibility)}`);
        }
        else {
            this.logger.info(`Node's minFeeMultiplier is ${minFeeMultiplier}`);
        }
        const generationHash = await (0, rxjs_1.firstValueFrom)(repositoryFactory.getGenerationHash());
        if ((generationHash === null || generationHash === void 0 ? void 0 : generationHash.toUpperCase()) !== ((_b = presetData.nemesisGenerationHashSeed) === null || _b === void 0 ? void 0 : _b.toUpperCase())) {
            throw new Error(`You are connecting to the wrong network. Expected generation hash is ${presetData.nemesisGenerationHashSeed} but got ${generationHash}`);
        }
        for (const [index, nodeAccount] of (addresses.nodes || []).entries()) {
            if (!nodeAccount || !nodeAccount.main) {
                throw new Error('CA/Main account is required!');
            }
            const nodePreset = (presetData.nodes || [])[index];
            const mainAccount = symbol_sdk_1.PublicAccount.createFromPublicKey(nodeAccount.main.publicKey, presetData.networkType);
            const serviceProviderPublicAccount = serviceProviderPublicKey
                ? symbol_sdk_1.PublicAccount.createFromPublicKey(serviceProviderPublicKey, presetData.networkType)
                : undefined;
            if (serviceProviderPublicAccount) {
                this.logger.info(`The Service Provider Account ${CommandUtils_1.CommandUtils.formatAccount(serviceProviderPublicAccount)} is creating transactions on behalf of your node account ${CommandUtils_1.CommandUtils.formatAccount(mainAccount)}.`);
            }
            const announcerPublicAccount = serviceProviderPublicAccount ? serviceProviderPublicAccount : mainAccount;
            const noFundsMessage = faucetUrl
                ? `Your account does not have enough XYM to complete this transaction. Send ${tokenAmount} tokens to ${announcerPublicAccount.address.plain()} via ${faucetUrl}/?recipient=${announcerPublicAccount.address.plain()}`
                : `Your account does not have enough XYM to complete this transaction. Send ${tokenAmount} tokens to ${announcerPublicAccount.address.plain()} .`;
            const announcerAccountInfo = await this.getAccountInfo(repositoryFactory, announcerPublicAccount.address);
            if (!announcerAccountInfo) {
                this.logger.error(`Node signing account ${CommandUtils_1.CommandUtils.formatAccount(announcerPublicAccount)} is not valid. \n\n${noFundsMessage}`);
                continue;
            }
            if (this.isAccountEmpty(announcerAccountInfo, currencyMosaicId)) {
                this.logger.error(`Node signing account ${CommandUtils_1.CommandUtils.formatAccount(announcerPublicAccount)} does not have enough currency. Mosaic id: ${currencyMosaicId}. \n\n${noFundsMessage}`);
                continue;
            }
            const mainAccountInfo = mainAccount.address.equals(announcerPublicAccount.address)
                ? announcerAccountInfo
                : await this.getAccountInfo(repositoryFactory, mainAccount.address);
            if (!mainAccountInfo) {
                this.logger.info(`Main account ${CommandUtils_1.CommandUtils.formatAccount(mainAccount)} is brand new. There are no records on the chain yet.`);
            }
            const defaultMaxFee = symbol_sdk_1.UInt64.fromUint(providedMaxFee || 0);
            const multisigAccountInfo = await TransactionUtils_1.TransactionUtils.getMultisigAccount(repositoryFactory, announcerPublicAccount.address);
            const params = {
                presetData,
                nodePreset,
                nodeAccount,
                mainAccountInfo,
                latestFinalizedBlockEpoch,
                target,
                mainAccount: announcerPublicAccount,
                deadline,
                maxFee: defaultMaxFee,
            };
            const transactions = await transactionFactory.createTransactions(params);
            if (!transactions.length) {
                this.logger.info(`There are not transactions to announce for node ${nodeAccount.name}`);
                continue;
            }
            const resolveMainAccount = async () => {
                var _a;
                const presetMainPrivateKey = (_a = (presetData.nodes || [])[index]) === null || _a === void 0 ? void 0 : _a.mainPrivateKey;
                if (presetMainPrivateKey) {
                    const account = symbol_sdk_1.Account.createFromPrivateKey(presetMainPrivateKey, networkType);
                    if (account.address.equals(announcerPublicAccount.address)) {
                        return account;
                    }
                }
                return this.accountResolver.resolveAccount(networkType, nodeAccount.main, ConfigService_1.KeyName.Main, nodeAccount.name, 'signing a transaction', 'Should not generate!');
            };
            const cosigners = [];
            if (serviceProviderPublicAccount) {
                let signerAccount;
                let requiredCosignatures = 1; // for mainAccount
                if (multisigAccountInfo) {
                    const bestCosigner = await this.getMultisigBestCosigner(multisigAccountInfo, cosigners, 'Service provider account', networkType, repositoryFactory, currencyMosaicId);
                    if (!bestCosigner) {
                        this.logger.info(`There is no cosigner with enough tokens to announce!`);
                        continue;
                    }
                    this.logger.info(`Cosigner ${CommandUtils_1.CommandUtils.formatAccount(bestCosigner.publicAccount)} is initializing the transactions.`);
                    signerAccount = bestCosigner; // override with a cosigner when multisig
                    requiredCosignatures = multisigAccountInfo.minApproval;
                }
                else {
                    signerAccount = await this.accountResolver.resolveAccount(networkType, serviceProviderPublicAccount, ConfigService_1.KeyName.ServiceProvider, undefined, 'signing a transaction', 'Should not generate!');
                }
                const mainMultisigAccountInfo = await TransactionUtils_1.TransactionUtils.getMultisigAccount(repositoryFactory, mainAccount.address);
                requiredCosignatures += (mainMultisigAccountInfo === null || mainMultisigAccountInfo === void 0 ? void 0 : mainMultisigAccountInfo.minApproval) || 0; // mainAccount.minApproval
                const zeroAmountInnerTransaction = (account) => symbol_sdk_1.TransferTransaction.create(deadline, account.address, // self transfer
                [new symbol_sdk_1.Mosaic(currencyMosaicId, symbol_sdk_1.UInt64.fromUint(0))], // zero amount
                symbol_sdk_1.PlainMessage.create(''), networkType, defaultMaxFee).toAggregate(account);
                await this.announceAggregateBonded(signerAccount, () => [
                    ...transactions.map((t) => t.toAggregate(mainAccount)),
                    zeroAmountInnerTransaction(serviceProviderPublicAccount),
                ], requiredCosignatures, deadline, networkType, defaultMaxFee, providedMaxFee, minFeeMultiplier, cosigners, generationHash, currency, transactionService, listener, ready, nodeAccount.name);
            }
            else {
                if (multisigAccountInfo) {
                    const bestCosigner = await this.getMultisigBestCosigner(multisigAccountInfo, cosigners, `The node's main account`, networkType, repositoryFactory, currencyMosaicId);
                    if (!bestCosigner) {
                        this.logger.info(`There is no cosigner with enough tokens to announce!`);
                        continue;
                    }
                    this.logger.info(`Cosigner ${CommandUtils_1.CommandUtils.formatAccount(bestCosigner.publicAccount)} is initializing the transactions.`);
                    if (cosigners.length >= multisigAccountInfo.minApproval) {
                        //agg complete
                        await this.announceAggregateComplete(bestCosigner, () => transactions.map((t) => t.toAggregate(mainAccount)), deadline, networkType, defaultMaxFee, providedMaxFee, minFeeMultiplier, generationHash, currency, transactionService, listener, ready, nodeAccount.name, cosigners.length - 1, cosigners);
                    }
                    else {
                        //agg bonded
                        await this.announceAggregateBonded(bestCosigner, () => transactions.map((t) => t.toAggregate(mainAccount)), multisigAccountInfo.minApproval, deadline, networkType, defaultMaxFee, providedMaxFee, minFeeMultiplier, cosigners, generationHash, currency, transactionService, listener, ready, nodeAccount.name);
                    }
                }
                else {
                    const signerAccount = await resolveMainAccount();
                    if (transactions.length == 1) {
                        if (transactions[0].type === symbol_sdk_1.TransactionType.MULTISIG_ACCOUNT_MODIFICATION) {
                            const multisigModificationTx = transactions[0];
                            await this.announceAggregateBonded(signerAccount, () => transactions.map((t) => t.toAggregate(mainAccount)), (multisigModificationTx.addressAdditions || []).length + (multisigModificationTx.minApprovalDelta || 0), deadline, networkType, defaultMaxFee, providedMaxFee, minFeeMultiplier, cosigners, generationHash, currency, transactionService, listener, ready, nodeAccount.name);
                        }
                        else {
                            await this.announceSimple(signerAccount, transactions[0], providedMaxFee, minFeeMultiplier, generationHash, currency, transactionService, listener, ready, nodeAccount.name);
                        }
                    }
                    else {
                        await this.announceAggregateComplete(signerAccount, () => transactions.map((t) => t.toAggregate(mainAccount)), deadline, networkType, defaultMaxFee, providedMaxFee, minFeeMultiplier, generationHash, currency, transactionService, listener, ready, nodeAccount.name, 0);
                    }
                }
            }
        }
        listener.close();
    }
    async promptAccounts(networkType, expectedAddresses, minApproval) {
        const providedAccounts = [];
        const allowedAddresses = [...expectedAddresses];
        while (true) {
            this.logger.info('');
            const expectedDescription = allowedAddresses.map((address) => address.plain()).join(', ');
            const responses = await (0, inquirer_1.prompt)([
                {
                    name: 'privateKey',
                    message: `Enter the 64 HEX private key of one of the addresses ${expectedDescription}. Already entered ${providedAccounts.length} out of ${minApproval} required cosigners.`,
                    type: 'password',
                    validate: CommandUtils_1.CommandUtils.isValidPrivateKey,
                },
            ]);
            const privateKey = responses.privateKey;
            if (!privateKey) {
                this.logger.info('Please provide the private key....');
            }
            else {
                const account = symbol_sdk_1.Account.createFromPrivateKey(privateKey, networkType);
                const expectedAddress = allowedAddresses.find((address) => address.equals(account.address));
                if (!expectedAddress) {
                    this.logger.info('');
                    this.logger.info(`Invalid private key. The entered private key has this ${account.address.plain()} address and it's not one of ${expectedDescription}. \n`);
                    this.logger.info(`Please re enter private key...`);
                }
                else {
                    allowedAddresses.splice(allowedAddresses.indexOf(expectedAddress), 1);
                    providedAccounts.push(account);
                    if (!allowedAddresses.length) {
                        this.logger.info('All cosigners have been entered.');
                        return providedAccounts;
                    }
                    if (providedAccounts.length == minApproval) {
                        this.logger.info(`Min Approval of ${minApproval} has been reached. Aggregate Complete transaction can be created.`);
                        return providedAccounts;
                    }
                    const responses = await (0, inquirer_1.prompt)([
                        {
                            name: 'more',
                            message: `Do you want to enter more cosigners?`,
                            type: 'confirm',
                            default: providedAccounts.length < minApproval,
                        },
                    ]);
                    if (!responses.more) {
                        return providedAccounts;
                    }
                    else {
                        this.logger.info('Please provide an additional private key....');
                    }
                }
            }
        }
    }
    async getAccountInfo(repositoryFactory, mainAccountAddress) {
        try {
            return await (0, rxjs_1.firstValueFrom)(repositoryFactory.createAccountRepository().getAccountInfo(mainAccountAddress));
        }
        catch (e) {
            return undefined;
        }
    }
    async getBestCosigner(repositoryFactory, cosigners, currencyMosaicId) {
        const accountRepository = repositoryFactory.createAccountRepository();
        for (const cosigner of cosigners) {
            try {
                const accountInfo = await (0, rxjs_1.firstValueFrom)(accountRepository.getAccountInfo(cosigner.address));
                if (!this.isAccountEmpty(accountInfo, currencyMosaicId)) {
                    return cosigner;
                }
            }
            catch (e) { }
        }
        return undefined;
    }
    isAccountEmpty(mainAccountInfo, currencyMosaicId) {
        if (!currencyMosaicId) {
            throw new Error('Mosaic Id must not be null!');
        }
        const mosaic = mainAccountInfo.mosaics.find((m) => m.id.equals(currencyMosaicId));
        return !mosaic || mosaic.amount.compare(symbol_sdk_1.UInt64.fromUint(0)) < 1;
    }
    async announceAggregateBonded(signerAccount, transactionFactory, requiredCosignatures, deadline, networkType, defaultMaxFee, providedMaxFee, minFeeMultiplier, cosigners, generationHash, currency, transactionService, listener, ready, nodeName) {
        let aggregateTransaction = symbol_sdk_1.AggregateTransaction.createBonded(deadline, transactionFactory(), networkType, [], defaultMaxFee);
        if (!providedMaxFee) {
            aggregateTransaction = aggregateTransaction.setMaxFeeForAggregate(minFeeMultiplier, requiredCosignatures);
        }
        const signedAggregateTransaction = signerAccount.signTransactionWithCosignatories(aggregateTransaction, cosigners.filter((a) => a !== signerAccount), generationHash);
        let lockFundsTransaction = symbol_sdk_1.LockFundsTransaction.create(deadline, currency.createRelative(10), symbol_sdk_1.UInt64.fromUint(5760), signedAggregateTransaction, networkType, defaultMaxFee);
        if (!providedMaxFee) {
            lockFundsTransaction = lockFundsTransaction.setMaxFee(minFeeMultiplier);
        }
        const signedLockFundsTransaction = signerAccount.sign(lockFundsTransaction, generationHash);
        if (!(await this.shouldAnnounce(lockFundsTransaction, signedLockFundsTransaction, ready, currency, nodeName))) {
            return false;
        }
        if (!(await this.shouldAnnounce(aggregateTransaction, signedAggregateTransaction, ready, currency, nodeName))) {
            return false;
        }
        try {
            this.logger.info(`Announcing ${this.getTransactionDescription(lockFundsTransaction, signedLockFundsTransaction, currency)}`);
            await (0, rxjs_1.firstValueFrom)(transactionService.announce(signedLockFundsTransaction, listener));
            this.logger.info(`${this.getTransactionDescription(lockFundsTransaction, signedLockFundsTransaction, currency)} has been confirmed`);
            this.logger.info(`Announcing Bonded ${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)}`);
            await (0, rxjs_1.firstValueFrom)(transactionService.announceAggregateBonded(signedAggregateTransaction, listener));
            this.logger.info(`${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)} has been announced`);
            this.logger.info('Aggregate Bonded Transaction has been confirmed! Your cosigners would need to cosign!');
        }
        catch (e) {
            const message = `Aggregate Bonded Transaction ${signedAggregateTransaction.type} ${signedAggregateTransaction.hash} - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + Utils_1.Utils.getMessage(e);
            this.logger.error(message);
            return false;
        }
        return true;
    }
    async announceAggregateComplete(signer, transactionFactory, deadline, networkType, defaultMaxFee, providedMaxFee, minFeeMultiplier, generationHash, currency, transactionService, listener, ready, nodeName, requiredCosignatures, cosigners) {
        let aggregateTransaction = symbol_sdk_1.AggregateTransaction.createComplete(deadline, transactionFactory(), networkType, [], defaultMaxFee);
        if (!providedMaxFee) {
            aggregateTransaction = aggregateTransaction.setMaxFeeForAggregate(minFeeMultiplier, requiredCosignatures || 0);
        }
        const signedAggregateTransaction = cosigners
            ? signer.signTransactionWithCosignatories(aggregateTransaction, cosigners.filter((a) => a !== signer), generationHash)
            : signer.sign(aggregateTransaction, generationHash);
        if (!(await this.shouldAnnounce(aggregateTransaction, signedAggregateTransaction, ready, currency, nodeName))) {
            return false;
        }
        try {
            this.logger.info(`Announcing ${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)}`);
            await (0, rxjs_1.firstValueFrom)(transactionService.announce(signedAggregateTransaction, listener));
            this.logger.info(`${this.getTransactionDescription(aggregateTransaction, signedAggregateTransaction, currency)} has been confirmed`);
            return true;
        }
        catch (e) {
            const message = `Aggregate Complete Transaction ${signedAggregateTransaction.type} ${signedAggregateTransaction.hash} - signer ${signedAggregateTransaction.getSignerAddress().plain()} failed!! ` + Utils_1.Utils.getMessage(e);
            this.logger.error(message);
            return false;
        }
    }
    async announceSimple(signer, transaction, providedMaxFee, minFeeMultiplier, generationHash, currency, transactionService, listener, ready, nodeName) {
        if (!providedMaxFee) {
            transaction = transaction.setMaxFee(minFeeMultiplier);
        }
        const signedTransaction = signer.sign(transaction, generationHash);
        if (!(await this.shouldAnnounce(transaction, signedTransaction, ready, currency, nodeName))) {
            return false;
        }
        try {
            this.logger.info(`Announcing ${this.getTransactionDescription(transaction, signedTransaction, currency)}`);
            await (0, rxjs_1.firstValueFrom)(transactionService.announce(signedTransaction, listener));
            this.logger.info(`${this.getTransactionDescription(transaction, signedTransaction, currency)} has been confirmed`);
            return true;
        }
        catch (e) {
            const message = `Simple Transaction ${signedTransaction.type} ${signedTransaction.hash} - signer ${signedTransaction
                .getSignerAddress()
                .plain()} failed!! ` + Utils_1.Utils.getMessage(e);
            this.logger.error(message);
            return false;
        }
    }
    getTransactionDescription(transaction, signedTransaction, currency) {
        const aggTypeDescription = (type) => {
            switch (type) {
                case symbol_sdk_1.TransactionType.AGGREGATE_BONDED:
                    return '(Bonded)';
                case symbol_sdk_1.TransactionType.AGGREGATE_COMPLETE:
                    return '(Complete)';
                default:
                    return '';
            }
        };
        return `${transaction.constructor.name + aggTypeDescription(transaction.type)} - Hash: ${signedTransaction.hash} - MaxFee ${transaction.maxFee.compact() / Math.pow(10, currency.divisibility)}`;
    }
    async shouldAnnounce(transaction, signedTransaction, ready, currency, nodeName) {
        const response = ready ||
            (await (0, inquirer_1.prompt)([
                {
                    name: 'value',
                    message: `Do you want to announce ${this.getTransactionDescription(transaction, signedTransaction, currency)}?`,
                    type: 'confirm',
                    default: true,
                },
            ])).value;
        if (!response) {
            this.logger.info(`Ignoring transaction for node[${nodeName}]`);
        }
        return response;
    }
    async getMultisigBestCosigner(msigAccountInfo, cosigners, accountName, networkType, repositoryFactory, currencyMosaicId) {
        this.logger.info(`${accountName} is a multisig account with Address: ${msigAccountInfo.minApproval} min approval. Cosigners are: ${msigAccountInfo.cosignatoryAddresses
            .map((a) => a.plain())
            .join(', ')}. The tool will ask for the cosigners provide keys in order to announce the transactions. These private keys are not stored anywhere!`);
        cosigners.push(...(await this.promptAccounts(networkType, msigAccountInfo.cosignatoryAddresses, msigAccountInfo.minApproval)));
        if (!cosigners.length) {
            return undefined;
        }
        return await this.getBestCosigner(repositoryFactory, cosigners, currencyMosaicId);
    }
}
exports.AnnounceService = AnnounceService;
AnnounceService.onProcessListener = () => {
    process.on('SIGINT', () => {
        process.exit(400);
    });
};
AnnounceService.flags = {
    password: CommandUtils_1.CommandUtils.passwordFlag,
    noPassword: CommandUtils_1.CommandUtils.noPasswordFlag,
    url: command_1.flags.string({
        char: 'u',
        description: 'the network url',
        default: 'http://localhost:3000',
    }),
    useKnownRestGateways: command_1.flags.boolean({
        description: 'Use the best NEM node available when announcing. Otherwise the command will use the node provided by the --url parameter.',
    }),
    ready: command_1.flags.boolean({
        description: 'If --ready is provided, the command will not ask for confirmation when announcing transactions.',
    }),
    maxFee: command_1.flags.integer({
        description: 'the max fee used when announcing (absolute). The node min multiplier will be used if it is not provided.',
    }),
    customPreset: command_1.flags.string({
        char: 'c',
        description: `This command uses the encrypted addresses.yml to resolve the main private key. If the main private is only stored in the custom preset, you can provide it using this param. Otherwise, the command may ask for it when required.`,
        required: false,
    }),
    serviceProviderPublicKey: command_1.flags.string({
        description: 'Public key of the service provider account, used when the transaction announcer(service provider account) is different than the main account private key holder',
    }),
};
