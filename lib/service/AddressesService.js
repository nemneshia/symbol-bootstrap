"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressesService = void 0;
const symbol_sdk_1 = require("symbol-sdk");
const model_1 = require("../model");
const ConfigService_1 = require("./ConfigService");
const ConfigurationUtils_1 = require("./ConfigurationUtils");
const CryptoUtils_1 = require("./CryptoUtils");
const MigrationService_1 = require("./MigrationService");
const Utils_1 = require("./Utils");
const YamlUtils_1 = require("./YamlUtils");
/**
 * Object in charge of resolving the address.yml and its accounts.
 */
class AddressesService {
    constructor(logger, accountResolver) {
        this.logger = logger;
        this.accountResolver = accountResolver;
        this.migrationService = new MigrationService_1.MigrationService(this.logger);
    }
    async resolveAddresses(oldAddresses, oldPresetData, presetData) {
        const networkType = presetData.networkType;
        const addresses = {
            version: this.migrationService.getAddressesMigration(presetData.networkType).length + 1,
            networkType: networkType,
            nemesisGenerationHashSeed: presetData.nemesisGenerationHashSeed ||
                (oldAddresses === null || oldAddresses === void 0 ? void 0 : oldAddresses.nemesisGenerationHashSeed) ||
                symbol_sdk_1.Convert.uint8ToHex(symbol_sdk_1.Crypto.randomBytes(32)),
            sinkAddress: presetData.sinkAddress || (oldAddresses === null || oldAddresses === void 0 ? void 0 : oldAddresses.sinkAddress),
        };
        //Sync address is generated on demand only
        const resolveSyncAddress = (providedAddress) => {
            if (providedAddress) {
                return symbol_sdk_1.Address.createFromRawAddress(providedAddress).plain();
            }
            addresses.sinkAddress = addresses.sinkAddress || symbol_sdk_1.Account.generateNewAccount(networkType).address.plain();
            return addresses.sinkAddress;
        };
        presetData.harvestNetworkFeeSinkAddress = resolveSyncAddress(presetData.harvestNetworkFeeSinkAddress);
        presetData.mosaicRentalFeeSinkAddress = resolveSyncAddress(presetData.mosaicRentalFeeSinkAddress);
        presetData.namespaceRentalFeeSinkAddress = resolveSyncAddress(presetData.namespaceRentalFeeSinkAddress);
        if (!presetData.harvestNetworkFeeSinkAddressV1) {
            presetData.harvestNetworkFeeSinkAddressV1 = presetData.harvestNetworkFeeSinkAddress;
        }
        if (!presetData.mosaicRentalFeeSinkAddressV1) {
            presetData.mosaicRentalFeeSinkAddressV1 = presetData.mosaicRentalFeeSinkAddress;
        }
        if (!presetData.namespaceRentalFeeSinkAddressV1) {
            presetData.namespaceRentalFeeSinkAddressV1 = presetData.namespaceRentalFeeSinkAddress;
        }
        presetData.networkIdentifier = Utils_1.Utils.getNetworkIdentifier(networkType);
        presetData.networkName = Utils_1.Utils.getNetworkName(networkType);
        presetData.nemesisGenerationHashSeed = addresses.nemesisGenerationHashSeed;
        addresses.nodes = await this.resolveNodesAccounts(oldAddresses, presetData, networkType);
        const shouldCreateNemesis = ConfigurationUtils_1.ConfigurationUtils.shouldCreateNemesis(presetData);
        if (shouldCreateNemesis) {
            const nemesisSigner = this.resolveNemesisAccount(presetData, oldAddresses);
            if (!nemesisSigner.privateKey) {
                throw new Error('Nemesis Signer Private Key should be resolved!');
            }
            addresses.nemesisSigner = nemesisSigner;
            presetData.nemesisSignerPublicKey = nemesisSigner.publicKey;
            presetData.nemesis.nemesisSignerPrivateKey = nemesisSigner.privateKey;
        }
        const nemesisSignerAddress = symbol_sdk_1.Address.createFromPublicKey(presetData.nemesisSignerPublicKey, networkType);
        if (!presetData.currencyMosaicId)
            presetData.currencyMosaicId = symbol_sdk_1.MosaicId.createFromNonce(symbol_sdk_1.MosaicNonce.createFromNumber(0), nemesisSignerAddress).toHex();
        if (!presetData.harvestingMosaicId) {
            if (!presetData.nemesis) {
                throw new Error('nemesis must be defined!');
            }
            if (presetData.nemesis.mosaics && presetData.nemesis.mosaics.length > 1) {
                presetData.harvestingMosaicId = symbol_sdk_1.MosaicId.createFromNonce(symbol_sdk_1.MosaicNonce.createFromNumber(1), nemesisSignerAddress).toHex();
            }
            else {
                presetData.harvestingMosaicId = presetData.currencyMosaicId;
            }
        }
        if (shouldCreateNemesis) {
            if (oldAddresses) {
                if (!oldPresetData) {
                    throw new Error('oldPresetData must be defined when upgrading!');
                }
                // Nemesis configuration cannot be changed on upgrade.
                addresses.mosaics = oldAddresses.mosaics;
                presetData.nemesis = oldPresetData.nemesis;
            }
            else {
                addresses.mosaics = this.processNemesisBalances(presetData, addresses, nemesisSignerAddress);
            }
        }
        return addresses;
    }
    sum(distribution, mosaicName) {
        return distribution
            .map((d, index) => {
            if (d.amount < 0) {
                throw new Error(`Nemesis distribution balance cannot be less than 0. Mosaic ${mosaicName}, distribution address: ${d.address}, amount: ${d.amount}, index ${index}. \nDistributions are:\n${YamlUtils_1.YamlUtils.toYaml(distribution)}`);
            }
            return d.amount;
        })
            .reduce((a, b) => a + b, 0);
    }
    resolveNemesisAccount(presetData, oldAddresses) {
        var _a, _b;
        const networkType = presetData.networkType;
        const signerPrivateKey = presetData.nemesis.nemesisSignerPrivateKey ||
            ((_a = oldAddresses === null || oldAddresses === void 0 ? void 0 : oldAddresses.nemesisSigner) === null || _a === void 0 ? void 0 : _a.privateKey) ||
            symbol_sdk_1.Account.generateNewAccount(networkType).privateKey;
        const signerPublicKey = presetData.nemesisSignerPublicKey || ((_b = oldAddresses === null || oldAddresses === void 0 ? void 0 : oldAddresses.nemesisSigner) === null || _b === void 0 ? void 0 : _b.publicKey);
        const nemesisSigner = ConfigurationUtils_1.ConfigurationUtils.toConfigAccountFomKeys(networkType, signerPublicKey, signerPrivateKey);
        if (!nemesisSigner) {
            throw new Error('Nemesis Signer should be resolved!');
        }
        return nemesisSigner;
    }
    processNemesisBalances(presetData, addresses, nemesisSignerAddress) {
        const privateKeySecurityMode = CryptoUtils_1.CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const networkType = presetData.networkType;
        const mosaics = [];
        presetData.nemesis.mosaics.forEach((m, mosaicIndex) => {
            var _a;
            const accounts = this.generateAddresses(networkType, privateKeySecurityMode, m.accounts);
            const id = symbol_sdk_1.MosaicId.createFromNonce(symbol_sdk_1.MosaicNonce.createFromNumber(mosaicIndex), nemesisSignerAddress).toHex();
            mosaics.push({
                id: id,
                name: m.name,
                accounts,
            });
            const getBalance = (nodeIndex) => {
                var _a, _b;
                const node = (_a = presetData === null || presetData === void 0 ? void 0 : presetData.nodes) === null || _a === void 0 ? void 0 : _a[nodeIndex];
                if (!node) {
                    return undefined;
                }
                const balance = (_b = node === null || node === void 0 ? void 0 : node.balances) === null || _b === void 0 ? void 0 : _b[mosaicIndex];
                if (balance !== undefined) {
                    return balance;
                }
                if (node.excludeFromNemesis) {
                    return 0;
                }
                return undefined;
            };
            const providedDistributions = [...(m.currencyDistributions || [])];
            (_a = addresses.nodes) === null || _a === void 0 ? void 0 : _a.forEach((node, index) => {
                const balance = getBalance(index);
                if (balance !== undefined)
                    providedDistributions.push({
                        address: node.main.address,
                        amount: balance,
                    });
            });
            const nodeMainAccounts = (addresses.nodes || []).filter((node, index) => node.main && getBalance(index) === undefined);
            const providedSupply = this.sum(providedDistributions, m.name);
            const remainingSupply = m.supply - providedSupply;
            if (remainingSupply < 0) {
                throw new Error(`Mosaic ${m.name}'s fixed distributed supply ${providedSupply} is grater than mosaic total supply ${m.supply}`);
            }
            const dynamicAccounts = accounts.length + nodeMainAccounts.length;
            const amountPerAccount = Math.floor(remainingSupply / dynamicAccounts);
            const maxHarvesterBalance = this.getMaxHarvesterBalance(presetData, mosaicIndex);
            const generatedAccounts = [
                ...accounts.map((a) => ({
                    address: a.address,
                    amount: amountPerAccount,
                })),
                ...nodeMainAccounts.map((n) => ({
                    address: n.main.address,
                    amount: Math.min(maxHarvesterBalance, amountPerAccount),
                })),
            ];
            m.currencyDistributions = [...generatedAccounts, ...providedDistributions].filter((d) => d.amount > 0);
            const generatedSupply = this.sum(generatedAccounts.slice(1), m.name);
            m.currencyDistributions[0].amount = m.supply - providedSupply - generatedSupply;
            const supplied = this.sum(m.currencyDistributions, m.name);
            if (m.supply != supplied) {
                throw new Error(`Invalid nemgen total supplied value, expected ${m.supply} but total is ${supplied}. \nDistributions are:\n${YamlUtils_1.YamlUtils.toYaml(m.currencyDistributions)}`);
            }
        });
        return mosaics;
    }
    getMaxHarvesterBalance(presetData, mosaicIndex) {
        return (presetData.nemesis.mosaics.length == 1 && mosaicIndex == 0) || (presetData.nemesis.mosaics.length > 1 && mosaicIndex == 1)
            ? presetData.maxHarvesterBalance
            : Number.MAX_SAFE_INTEGER;
    }
    async resolveNodesAccounts(oldAddresses, presetData, networkType) {
        return Promise.all((presetData.nodes || []).map((node, index) => { var _a; return this.resolveNodeAccounts((_a = oldAddresses === null || oldAddresses === void 0 ? void 0 : oldAddresses.nodes) === null || _a === void 0 ? void 0 : _a[index], presetData, index, node, networkType); }));
    }
    async resolveNodeAccounts(oldNodeAccount, presetData, index, nodePreset, networkType) {
        const privateKeySecurityMode = CryptoUtils_1.CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const name = nodePreset.name || `node-${index}`;
        const main = await this.resolveAccount(networkType, privateKeySecurityMode, ConfigService_1.KeyName.Main, nodePreset.name, oldNodeAccount === null || oldNodeAccount === void 0 ? void 0 : oldNodeAccount.main, ConfigurationUtils_1.ConfigurationUtils.toConfigAccountFomKeys(networkType, nodePreset.mainPublicKey, nodePreset.mainPrivateKey));
        const transport = await this.resolveAccount(networkType, privateKeySecurityMode, ConfigService_1.KeyName.Transport, nodePreset.name, oldNodeAccount === null || oldNodeAccount === void 0 ? void 0 : oldNodeAccount.transport, ConfigurationUtils_1.ConfigurationUtils.toConfigAccountFomKeys(networkType, nodePreset.transportPublicKey, nodePreset.transportPrivateKey));
        const friendlyName = nodePreset.friendlyName || main.publicKey.substr(0, 7);
        const nodeAccount = {
            name,
            friendlyName,
            roles: ConfigurationUtils_1.ConfigurationUtils.resolveRoles(nodePreset),
            main: main,
            transport: transport,
        };
        const useRemoteAccount = nodePreset.nodeUseRemoteAccount || presetData.nodeUseRemoteAccount;
        if (useRemoteAccount && (nodePreset.harvesting || nodePreset.voting))
            nodeAccount.remote = await this.resolveAccount(networkType, privateKeySecurityMode, ConfigService_1.KeyName.Remote, nodePreset.name, oldNodeAccount === null || oldNodeAccount === void 0 ? void 0 : oldNodeAccount.remote, ConfigurationUtils_1.ConfigurationUtils.toConfigAccountFomKeys(networkType, nodePreset.remotePublicKey, nodePreset.remotePrivateKey));
        if (nodePreset.harvesting)
            nodeAccount.vrf = await this.resolveAccount(networkType, privateKeySecurityMode, ConfigService_1.KeyName.VRF, nodePreset.name, oldNodeAccount === null || oldNodeAccount === void 0 ? void 0 : oldNodeAccount.vrf, ConfigurationUtils_1.ConfigurationUtils.toConfigAccountFomKeys(networkType, nodePreset.vrfPublicKey, nodePreset.vrfPrivateKey));
        return nodeAccount;
    }
    generateAddresses(networkType, privateKeySecurityMode, accounts) {
        if (typeof accounts == 'number') {
            return [...Array(accounts).keys()].map(() => ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(symbol_sdk_1.Account.generateNewAccount(networkType)));
        }
        else {
            return accounts.map((key) => ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(symbol_sdk_1.PublicAccount.createFromPublicKey(key, networkType)));
        }
    }
    resolveGenerateErrorMessage(keyName, privateKeySecurityMode) {
        if (keyName === ConfigService_1.KeyName.Main &&
            (privateKeySecurityMode === model_1.PrivateKeySecurityMode.PROMPT_ALL ||
                privateKeySecurityMode === model_1.PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT ||
                privateKeySecurityMode === model_1.PrivateKeySecurityMode.PROMPT_MAIN)) {
            return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere!. Please use ${model_1.PrivateKeySecurityMode.ENCRYPT}, or provider your ${keyName} account with custom presets!`;
        }
        if (keyName === ConfigService_1.KeyName.Transport &&
            (privateKeySecurityMode === model_1.PrivateKeySecurityMode.PROMPT_ALL ||
                privateKeySecurityMode === model_1.PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT)) {
            return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere!. Please use ${model_1.PrivateKeySecurityMode.ENCRYPT}, ${model_1.PrivateKeySecurityMode.PROMPT_MAIN}, or provider your ${keyName} account with custom presets!`;
        }
        else {
            if (privateKeySecurityMode === model_1.PrivateKeySecurityMode.PROMPT_ALL) {
                return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere! Please use ${model_1.PrivateKeySecurityMode.ENCRYPT}, ${model_1.PrivateKeySecurityMode.PROMPT_MAIN}, ${model_1.PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT}, or provider your ${keyName} account with custom presets!`;
            }
        }
        return undefined;
    }
    async resolveAccount(networkType, privateKeySecurityMode, keyName, nodeName, oldStoredAccount, newProvidedAccount) {
        var _a, _b, _c;
        const oldAccount = ConfigurationUtils_1.ConfigurationUtils.toAccount(networkType, oldStoredAccount === null || oldStoredAccount === void 0 ? void 0 : oldStoredAccount.publicKey.toUpperCase(), (_a = oldStoredAccount === null || oldStoredAccount === void 0 ? void 0 : oldStoredAccount.privateKey) === null || _a === void 0 ? void 0 : _a.toUpperCase());
        const newAccount = ConfigurationUtils_1.ConfigurationUtils.toAccount(networkType, (_b = newProvidedAccount === null || newProvidedAccount === void 0 ? void 0 : newProvidedAccount.publicKey) === null || _b === void 0 ? void 0 : _b.toUpperCase(), (_c = newProvidedAccount === null || newProvidedAccount === void 0 ? void 0 : newProvidedAccount.privateKey) === null || _c === void 0 ? void 0 : _c.toUpperCase());
        const getAccountLog = (a) => `${keyName} Account ${a.address.plain()} Public Key ${a.publicKey} `;
        if (oldAccount && newAccount) {
            if (oldAccount.address.equals(newAccount.address)) {
                this.logger.info(`Reusing ${getAccountLog(newAccount)}`);
                return Object.assign(Object.assign({}, ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(oldAccount)), ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(newAccount));
            }
            this.logger.info(`Old ${getAccountLog(oldAccount)} has been changed. New ${getAccountLog(newAccount)} replaces it.`);
            return ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(newAccount);
        }
        if (oldAccount) {
            this.logger.info(`Reusing ${getAccountLog(oldAccount)}...`);
            return ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(oldAccount);
        }
        if (newAccount) {
            this.logger.info(`${getAccountLog(newAccount)} has been provided`);
            return ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(newAccount);
        }
        const generateErrorMessage = this.resolveGenerateErrorMessage(keyName, privateKeySecurityMode);
        const account = await this.accountResolver.resolveAccount(networkType, newProvidedAccount || oldStoredAccount, keyName, nodeName, 'initialization', generateErrorMessage);
        return ConfigurationUtils_1.ConfigurationUtils.toConfigAccount(account);
    }
}
exports.AddressesService = AddressesService;
