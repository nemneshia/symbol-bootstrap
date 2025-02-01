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
exports.ConfigService = exports.KeyName = exports.defaultAssembly = exports.Assembly = exports.Preset = void 0;
const fs = require("fs");
const fs_1 = require("fs");
const _ = require("lodash");
const path_1 = require("path");
const symbol_sdk_1 = require("symbol-sdk");
const AccountResolver_1 = require("./AccountResolver");
const AddressesService_1 = require("./AddressesService");
const CertificateService_1 = require("./CertificateService");
const ConfigLoader_1 = require("./ConfigLoader");
const ConfigurationUtils_1 = require("./ConfigurationUtils");
const Constants_1 = require("./Constants");
const CryptoUtils_1 = require("./CryptoUtils");
const FileSystemService_1 = require("./FileSystemService");
const HandlebarsUtils_1 = require("./HandlebarsUtils");
const KnownError_1 = require("./KnownError");
const NemgenService_1 = require("./NemgenService");
const RemoteNodeService_1 = require("./RemoteNodeService");
const ReportService_1 = require("./ReportService");
const Utils_1 = require("./Utils");
const VotingService_1 = require("./VotingService");
const YamlUtils_1 = require("./YamlUtils");
/**
 * Defined presets.
 */
var Preset;
(function (Preset) {
    Preset["bootstrap"] = "bootstrap";
    Preset["testnet"] = "testnet";
    Preset["mainnet"] = "mainnet";
})(Preset = exports.Preset || (exports.Preset = {}));
var Assembly;
(function (Assembly) {
    Assembly["dual"] = "dual";
    Assembly["peer"] = "peer";
    Assembly["api"] = "api";
    Assembly["demo"] = "demo";
    Assembly["multinode"] = "multinode";
    Assembly["services"] = "services";
})(Assembly = exports.Assembly || (exports.Assembly = {}));
exports.defaultAssembly = {
    [Preset.bootstrap]: Assembly.multinode,
};
var KeyName;
(function (KeyName) {
    KeyName["Main"] = "Main";
    KeyName["Remote"] = "Remote";
    KeyName["Transport"] = "Transport";
    KeyName["Voting"] = "Voting";
    KeyName["VRF"] = "VRF";
    KeyName["NemesisAccount"] = "Nemesis Account";
    KeyName["ServiceProvider"] = "Service Provider";
})(KeyName = exports.KeyName || (exports.KeyName = {}));
class ConfigService {
    constructor(logger, params) {
        this.logger = logger;
        this.params = params;
        this.configLoader = new ConfigLoader_1.ConfigLoader(logger);
        this.fileSystemService = new FileSystemService_1.FileSystemService(logger);
        this.addressesService = new AddressesService_1.AddressesService(logger, params.accountResolver);
    }
    resolveConfigPreset(password) {
        const target = this.params.target;
        const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
        if (fs.existsSync(presetLocation) && !this.params.upgrade) {
            return this.configLoader.loadExistingPresetData(target, password);
        }
        const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target, password);
        return this.resolveCurrentPresetData(oldPresetData, password);
    }
    async run() {
        var _a;
        const target = this.params.target;
        try {
            if (this.params.reset) {
                this.fileSystemService.deleteFolder(target);
            }
            const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
            const addressesLocation = this.configLoader.getGeneratedAddressLocation(target);
            const password = this.params.password;
            if (fs.existsSync(presetLocation) && !this.params.upgrade) {
                this.logger.info(`The generated preset ${presetLocation} already exist, ignoring configuration. (run -r to reset or --upgrade to upgrade)`);
                const presetData = this.configLoader.loadExistingPresetData(target, password);
                const addresses = this.configLoader.loadExistingAddresses(target, password);
                if (this.params.report) {
                    await new ReportService_1.ReportService(this.logger, this.params).run(presetData);
                }
                return { presetData, addresses };
            }
            const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target, password);
            if (oldPresetData) {
                // HACK! https://github.com/symbol/symbol-bootstrap/pull/270 would fix this!
                delete oldPresetData.knownPeers;
                delete oldPresetData.knownRestGateways;
            }
            const oldAddresses = this.configLoader.loadExistingAddressesIfPreset(target, password);
            if (oldAddresses && !oldPresetData) {
                throw new KnownError_1.KnownError(`Configuration cannot be upgraded without a previous ${presetLocation} file. (run -r to reset)`);
            }
            if (!oldAddresses && oldPresetData) {
                throw new KnownError_1.KnownError(`Configuration cannot be upgraded without a previous ${addressesLocation} file. (run -r to reset)`);
            }
            if (oldAddresses && oldPresetData) {
                this.logger.info('Upgrading configuration...');
            }
            const presetData = this.resolveCurrentPresetData(oldPresetData, password);
            const addresses = await this.addressesService.resolveAddresses(oldAddresses, oldPresetData, presetData);
            const privateKeySecurityMode = CryptoUtils_1.CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
            await this.fileSystemService.mkdir(target);
            const remoteNodeService = new RemoteNodeService_1.RemoteNodeService(this.logger, presetData, this.params.offline);
            this.cleanUpConfiguration(presetData);
            await this.generateNodeCertificates(presetData, addresses);
            await this.generateNodes(presetData, addresses, remoteNodeService);
            await this.generateGateways(presetData);
            await this.generateExplorers(presetData, remoteNodeService);
            const isUpgrade = !!oldPresetData || !!oldAddresses;
            if ((_a = presetData.nodes) === null || _a === void 0 ? void 0 : _a.length) {
                await this.resolveNemesis(presetData, addresses, isUpgrade);
                await this.copyNemesis(addresses);
            }
            if (this.params.report) {
                await new ReportService_1.ReportService(this.logger, this.params).run(presetData);
            }
            await YamlUtils_1.YamlUtils.writeYaml(addressesLocation, CryptoUtils_1.CryptoUtils.removePrivateKeysAccordingToSecurityMode(addresses, privateKeySecurityMode), password);
            await YamlUtils_1.YamlUtils.writeYaml(presetLocation, CryptoUtils_1.CryptoUtils.removePrivateKeys(presetData), password);
            this.logger.info(`Configuration generated.`);
            return { presetData, addresses };
        }
        catch (e) {
            if (e.known) {
                this.logger.error(Utils_1.Utils.getMessage(e));
            }
            else {
                this.logger.error(`Unknown error generating the configuration. ${Utils_1.Utils.getMessage(e)}`, e);
                this.logger.error(`The target folder '${target}' should be deleted!!!`);
            }
            throw e;
        }
    }
    resolveCurrentPresetData(oldPresetData, password) {
        return this.configLoader.createPresetData(Object.assign(Object.assign({}, this.params), { workingDir: this.params.workingDir, password: password, oldPresetData }));
    }
    async copyNemesis(addresses) {
        const target = this.params.target;
        const nemesisSeedFolder = this.fileSystemService.getTargetNemesisFolder(target, false, 'seed');
        await this.fileSystemService.validateSeedFolder(nemesisSeedFolder, `Invalid final seed folder ${nemesisSeedFolder}`);
        await Promise.all((addresses.nodes || []).map(async (account) => {
            const name = account.name;
            const dataFolder = this.fileSystemService.getTargetNodesFolder(target, false, name, 'data');
            await this.fileSystemService.mkdir(dataFolder);
            const seedFolder = this.fileSystemService.getTargetNodesFolder(target, false, name, 'seed');
            await this.fileSystemService.copyDir(nemesisSeedFolder, seedFolder);
        }));
    }
    async resolveNemesis(presetData, addresses, isUpgrade) {
        const target = this.params.target;
        const nemesisSeedFolder = this.fileSystemService.getTargetNemesisFolder(target, false, 'seed');
        await this.fileSystemService.mkdir(nemesisSeedFolder);
        if (ConfigurationUtils_1.ConfigurationUtils.shouldCreateNemesis(presetData)) {
            if (isUpgrade) {
                this.logger.info('Nemesis data cannot be generated when upgrading...');
            }
            else {
                this.fileSystemService.deleteFolder(nemesisSeedFolder);
                await this.fileSystemService.mkdir(nemesisSeedFolder);
                await this.generateNemesisConfig(presetData, addresses);
                await this.fileSystemService.validateSeedFolder(nemesisSeedFolder, `Is the generated nemesis seed a valid seed folder?`);
            }
            return;
        }
        if (isUpgrade) {
            this.logger.info('Upgrading genesis on upgrade!');
        }
        const resolvePresetNemesisSeedFolder = () => {
            if (!presetData.nemesisSeedFolder) {
                return undefined;
            }
            return Utils_1.Utils.resolveWorkingDirPath(this.params.workingDir, presetData.nemesisSeedFolder);
        };
        const presetNemesisSeedFolder = resolvePresetNemesisSeedFolder();
        if (presetNemesisSeedFolder) {
            await this.fileSystemService.validateSeedFolder(presetNemesisSeedFolder, `Is the provided preset nemesisSeedFolder: ${presetNemesisSeedFolder} a valid seed folder?`);
            this.logger.info(`Using custom nemesis seed folder in ${presetNemesisSeedFolder}`);
            this.fileSystemService.deleteFolder(nemesisSeedFolder);
            await this.fileSystemService.mkdir(nemesisSeedFolder);
            await this.fileSystemService.copyDir(presetNemesisSeedFolder, nemesisSeedFolder);
            await this.fileSystemService.validateSeedFolder(nemesisSeedFolder, `Is the ${presetData.preset} preset default seed a valid seed folder?`);
            return;
        }
        if (YamlUtils_1.YamlUtils.isYmlFile(presetData.preset)) {
            throw new KnownError_1.KnownError(`Seed for preset ${presetData.preset} could not be found. Please provide 'nemesisSeedFolder'!`);
        }
        else {
            const networkNemesisSeed = (0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'presets', presetData.preset, 'seed');
            if ((0, fs_1.existsSync)(networkNemesisSeed)) {
                this.fileSystemService.deleteFolder(nemesisSeedFolder);
                await this.fileSystemService.mkdir(nemesisSeedFolder);
                await this.fileSystemService.copyDir(networkNemesisSeed, nemesisSeedFolder);
                await this.fileSystemService.validateSeedFolder(nemesisSeedFolder, `Is the ${presetData.preset} preset default seed a valid seed folder?`);
                return;
            }
            this.logger.warn(`Seed for preset ${presetData.preset} could not be found in ${networkNemesisSeed}`);
            throw new Error('Seed could not be found!!!!');
        }
    }
    async generateNodes(presetData, addresses, remoteNodeService) {
        const currentFinalizationEpoch = await remoteNodeService.resolveCurrentFinalizationEpoch();
        const externalPeers = await remoteNodeService.getPeerInfos();
        const localPeers = (presetData.nodes || []).map((nodePresetData, index) => {
            const node = (addresses.nodes || [])[index];
            return {
                publicKey: node.main.publicKey,
                endpoint: {
                    host: nodePresetData.host || '',
                    port: 7900,
                },
                metadata: {
                    name: nodePresetData.friendlyName || '',
                    roles: ConfigurationUtils_1.ConfigurationUtils.resolveRoles(nodePresetData),
                },
            };
        });
        const allPeers = _.uniqBy([...externalPeers, ...localPeers], (p) => p.publicKey);
        await Promise.all((addresses.nodes || []).map((account, index) => this.generateNodeConfiguration(account, index, presetData, currentFinalizationEpoch, allPeers)));
    }
    async generateNodeCertificates(presetData, addresses) {
        await Promise.all((addresses.nodes || []).map((account) => {
            const providedCertificates = {
                main: account.main,
                transport: account.transport,
            };
            return new CertificateService_1.CertificateService(this.logger, this.params.accountResolver, this.params).run(presetData, account.name, providedCertificates, CertificateService_1.RenewMode.ONLY_WARNING);
        }));
    }
    async generateNodeConfiguration(account, index, presetData, currentFinalizationEpoch, knownPeers) {
        const copyFrom = (0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'config', 'node');
        const name = account.name;
        const serverConfig = this.fileSystemService.getTargetNodesFolder(this.params.target, false, name, 'server-config');
        const brokerConfig = this.fileSystemService.getTargetNodesFolder(this.params.target, false, name, 'broker-config');
        const dataFolder = this.fileSystemService.getTargetNodesFolder(this.params.target, false, name, 'data');
        await this.fileSystemService.mkdir(dataFolder);
        const nodePreset = (presetData.nodes || [])[index];
        const harvestingKeyName = account.remote ? KeyName.Remote : KeyName.Main;
        const harvestingAccount = account.remote || account.main;
        const harvesterSigningAccount = nodePreset.harvesting
            ? await this.params.accountResolver.resolveAccount(presetData.networkType, harvestingAccount, harvestingKeyName, account.name, 'storing the harvesterSigningPrivateKey in the server properties', 'Should not generate!')
            : undefined;
        const harvesterVrf = nodePreset.harvesting
            ? await this.params.accountResolver.resolveAccount(presetData.networkType, account.vrf, KeyName.VRF, account.name, 'storing the harvesterVrfPrivateKey in the server properties', 'Should not generate!')
            : undefined;
        const beneficiaryAddress = nodePreset.beneficiaryAddress || presetData.beneficiaryAddress;
        const generatedContext = {
            name: name,
            friendlyName: (nodePreset === null || nodePreset === void 0 ? void 0 : nodePreset.friendlyName) || account.friendlyName,
            harvesterSigningPrivateKey: (harvesterSigningAccount === null || harvesterSigningAccount === void 0 ? void 0 : harvesterSigningAccount.privateKey) || '',
            harvesterVrfPrivateKey: (harvesterVrf === null || harvesterVrf === void 0 ? void 0 : harvesterVrf.privateKey) || '',
            unfinalizedBlocksDuration: nodePreset.voting
                ? presetData.votingUnfinalizedBlocksDuration
                : presetData.nonVotingUnfinalizedBlocksDuration,
            beneficiaryAddress: beneficiaryAddress == undefined ? account.main.address : beneficiaryAddress,
            roles: ConfigurationUtils_1.ConfigurationUtils.resolveRoles(nodePreset),
        };
        const templateContext = Object.assign(Object.assign(Object.assign({}, presetData), generatedContext), nodePreset);
        const excludeFiles = [];
        // Exclude files depending on the enabled extensions. To complete...
        if (!templateContext.harvesting) {
            excludeFiles.push('config-harvesting.properties');
        }
        if (!templateContext.networkheight) {
            excludeFiles.push('config-networkheight.properties');
        }
        const serverRecoveryConfig = {
            addressextractionRecovery: false,
            mongoRecovery: false,
            zeromqRecovery: false,
            filespoolingRecovery: true,
            hashcacheRecovery: true,
        };
        const brokerRecoveryConfig = {
            addressextractionRecovery: true,
            mongoRecovery: true,
            zeromqRecovery: true,
            filespoolingRecovery: false,
            hashcacheRecovery: true,
        };
        this.logger.info(`Generating ${name} server configuration`);
        await HandlebarsUtils_1.HandlebarsUtils.generateConfiguration(Object.assign(Object.assign({}, serverRecoveryConfig), templateContext), copyFrom, serverConfig, excludeFiles);
        const isPeer = (nodePresetData) => nodePresetData.metadata.roles.includes('Peer');
        const peers = knownPeers.filter((peer) => isPeer(peer) && peer.publicKey != account.main.publicKey);
        const peersP2PFile = await this.generateP2PFile(peers, presetData.peersP2PListLimit, serverConfig, `this file contains a list of peers`, 'peers-p2p.json');
        const isApi = (nodePresetData) => nodePresetData.metadata.roles.includes('Api');
        const apiPeers = knownPeers.filter((peer) => isApi(peer) && peer.publicKey != account.main.publicKey);
        const peersApiFile = await this.generateP2PFile(apiPeers, presetData.peersApiListLimit, serverConfig, `this file contains a list of api peers`, 'peers-api.json');
        if (!peers.length && !apiPeers.length) {
            this.logger.warn('The peer lists could not be resolved. peers-p2p.json and peers-api.json are empty!');
        }
        if (nodePreset.brokerName) {
            this.logger.info(`Generating ${nodePreset.brokerName} broker configuration`);
            await HandlebarsUtils_1.HandlebarsUtils.generateConfiguration(Object.assign(Object.assign({}, brokerRecoveryConfig), templateContext), copyFrom, brokerConfig, excludeFiles);
            (0, fs_1.copyFileSync)(peersP2PFile, (0, path_1.join)((0, path_1.join)(brokerConfig, 'resources', 'peers-p2p.json')));
            (0, fs_1.copyFileSync)(peersApiFile, (0, path_1.join)((0, path_1.join)(brokerConfig, 'resources', 'peers-api.json')));
        }
        await new VotingService_1.VotingService(this.logger, this.params).run(presetData, account, nodePreset, currentFinalizationEpoch, undefined, ConfigurationUtils_1.ConfigurationUtils.shouldCreateNemesis(presetData));
    }
    async generateP2PFile(knownPeers, listLimit, outputFolder, info, jsonFileName) {
        const data = {
            _info: info,
            knownPeers: knownPeers.length > listLimit ? _.sampleSize(knownPeers, listLimit) : knownPeers,
        };
        const peerFile = (0, path_1.join)(outputFolder, `resources`, jsonFileName);
        await fs.promises.writeFile(peerFile, JSON.stringify(data, null, 2));
        await fs.promises.chmod(peerFile, 0o600);
        return peerFile;
    }
    async generateNemesisConfig(presetData, addresses) {
        if (!presetData.nemesis) {
            throw new Error('nemesis must not be defined!');
        }
        const target = this.params.target;
        const nemesisWorkingDir = this.fileSystemService.getTargetNemesisFolder(target, false);
        const transactionsDirectory = (0, path_1.join)(nemesisWorkingDir, presetData.nemesis.transactionsDirectory || presetData.transactionsDirectory);
        await this.fileSystemService.mkdir(transactionsDirectory);
        const copyFrom = (0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, `config`, `nemesis`);
        const moveTo = (0, path_1.join)(nemesisWorkingDir, `server-config`);
        const templateContext = Object.assign(Object.assign({}, presetData), { addresses });
        const nodes = (addresses.nodes || []).filter((n, index) => { var _a, _b; return !((_b = (_a = presetData.nodes) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.excludeFromNemesis); });
        await Promise.all(nodes.filter((n) => n.vrf).map((n) => this.createVrfTransaction(transactionsDirectory, presetData, n)));
        await Promise.all(nodes.filter((n) => n.remote).map((n) => this.createAccountKeyLinkTransaction(transactionsDirectory, presetData, n)));
        await Promise.all(nodes.map((n) => this.createVotingKeyTransactions(transactionsDirectory, presetData, n)));
        if (presetData.nemesis.transactions) {
            const transactionHashes = [];
            const transactions = (await Promise.all(Object.entries(presetData.nemesis.transactions || {})
                .map(([key, payload]) => {
                const transactionHash = symbol_sdk_1.Transaction.createTransactionHash(payload, Array.from(symbol_sdk_1.Convert.hexToUint8(presetData.nemesisGenerationHashSeed)));
                if (transactionHashes.indexOf(transactionHash) > -1) {
                    this.logger.warn(`Transaction ${key} wth hash ${transactionHash} already exist. Excluded from folder.`);
                    return undefined;
                }
                transactionHashes.push(transactionHash);
                return this.storeTransaction(transactionsDirectory, key, payload);
            })
                .filter((p) => p))).filter((p) => p);
            this.logger.info(`Found ${transactions.length} provided in transactions.`);
        }
        await HandlebarsUtils_1.HandlebarsUtils.generateConfiguration(templateContext, copyFrom, moveTo);
        await new NemgenService_1.NemgenService(this.logger, this.params).run(presetData);
    }
    async createVrfTransaction(transactionsDirectory, presetData, node) {
        if (!node.vrf) {
            throw new Error('VRF keys should have been generated!!');
        }
        if (!node.main) {
            throw new Error('Main keys should have been generated!!');
        }
        const deadline = symbol_sdk_1.Deadline.createFromDTO('1');
        const vrf = symbol_sdk_1.VrfKeyLinkTransaction.create(deadline, node.vrf.publicKey, symbol_sdk_1.LinkAction.Link, presetData.networkType, symbol_sdk_1.UInt64.fromUint(0));
        const account = await this.params.accountResolver.resolveAccount(presetData.networkType, node.main, KeyName.Main, node.name, 'creating the vrf key link transactions', 'Should not generate!');
        const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
        return this.storeTransaction(transactionsDirectory, `vrf_${node.name}`, signedTransaction.payload);
    }
    async createAccountKeyLinkTransaction(transactionsDirectory, presetData, node) {
        if (!node.remote) {
            throw new Error('Remote keys should have been generated!!');
        }
        if (!node.main) {
            throw new Error('Main keys should have been generated!!');
        }
        const deadline = symbol_sdk_1.Deadline.createFromDTO('1');
        const akl = symbol_sdk_1.AccountKeyLinkTransaction.create(deadline, node.remote.publicKey, symbol_sdk_1.LinkAction.Link, presetData.networkType, symbol_sdk_1.UInt64.fromUint(0));
        const account = await this.params.accountResolver.resolveAccount(presetData.networkType, node.main, KeyName.Main, node.name, 'creating the account link transactions', 'Should not generate!');
        const signedTransaction = account.sign(akl, presetData.nemesisGenerationHashSeed);
        return this.storeTransaction(transactionsDirectory, `remote_${node.name}`, signedTransaction.payload);
    }
    async createVotingKeyTransactions(transactionsDirectory, presetData, node) {
        const votingFiles = node.voting || [];
        const account = await this.params.accountResolver.resolveAccount(presetData.networkType, node.main, KeyName.Main, node.name, 'creating the voting key link transactions', 'Should not generate!');
        return Promise.all(votingFiles.map(async (votingFile) => {
            const voting = symbol_sdk_1.VotingKeyLinkTransaction.create(symbol_sdk_1.Deadline.createFromDTO('1'), votingFile.publicKey, votingFile.startEpoch, votingFile.endEpoch, symbol_sdk_1.LinkAction.Link, presetData.networkType, 1, symbol_sdk_1.UInt64.fromUint(0));
            const signedTransaction = account.sign(voting, presetData.nemesisGenerationHashSeed);
            return this.storeTransaction(transactionsDirectory, `voting_${node.name}`, signedTransaction.payload);
        }));
    }
    async storeTransaction(transactionsDirectory, name, payload) {
        const transaction = symbol_sdk_1.TransactionMapping.createFromPayload(payload);
        await fs.promises.writeFile(`${transactionsDirectory}/${name}.bin`, symbol_sdk_1.Convert.hexToUint8(payload));
        return transaction;
    }
    generateGateways(presetData) {
        return Promise.all((presetData.gateways || []).map(async (gatewayPreset, index) => {
            const copyFrom = (0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'config', 'rest-gateway');
            const generatedContext = {
                restDeploymentToolVersion: Constants_1.Constants.VERSION,
                restDeploymentToolLastUpdatedDate: new Date().toISOString().slice(0, 10),
            };
            const templateContext = Object.assign(Object.assign(Object.assign({}, generatedContext), presetData), gatewayPreset);
            const name = templateContext.name || `rest-gateway-${index}`;
            const moveTo = this.fileSystemService.getTargetGatewayFolder(this.params.target, false, name);
            await HandlebarsUtils_1.HandlebarsUtils.generateConfiguration(templateContext, copyFrom, moveTo);
            const apiNodeConfigFolder = this.fileSystemService.getTargetNodesFolder(this.params.target, false, gatewayPreset.apiNodeName, 'server-config', 'resources');
            const apiNodeCertFolder = this.fileSystemService.getTargetNodesFolder(this.params.target, false, gatewayPreset.apiNodeName, 'cert');
            await HandlebarsUtils_1.HandlebarsUtils.generateConfiguration({}, apiNodeConfigFolder, (0, path_1.join)(moveTo, 'api-node-config'), [], ['config-network.properties', 'config-node.properties', 'config-inflation.properties']);
            await HandlebarsUtils_1.HandlebarsUtils.generateConfiguration({}, apiNodeCertFolder, (0, path_1.join)(moveTo, 'api-node-config', 'cert'), [], ['node.crt.pem', 'node.key.pem', 'ca.cert.pem']);
            if (gatewayPreset.restProtocol === 'HTTPS') {
                if (gatewayPreset.restSSLKeyBase64 && gatewayPreset.restSSLCertificateBase64) {
                    fs.writeFileSync((0, path_1.join)(moveTo, presetData.restSSLKeyFileName), gatewayPreset.restSSLKeyBase64, 'base64');
                    fs.writeFileSync((0, path_1.join)(moveTo, presetData.restSSLCertificateFileName), gatewayPreset.restSSLCertificateBase64, 'base64');
                }
                else {
                    if (!(0, fs_1.existsSync)((0, path_1.join)(moveTo, presetData.restSSLKeyFileName)) &&
                        !(0, fs_1.existsSync)((0, path_1.join)(moveTo, presetData.restSSLCertificateFileName))) {
                        throw new KnownError_1.KnownError(`Native SSL is enabled but restSSLKeyBase64 or restSSLCertificateBase64 properties are not found in the custom-preset file! Either use 'symbol-bootstrap wizard' command to fill those properties in the custom-preset or make sure you copy your SSL key and cert files to ${moveTo} folder.`);
                    }
                    else {
                        this.logger.info(`Native SSL certificates for gateway ${gatewayPreset.name} have been previously provided. Reusing...`);
                    }
                }
            }
        }));
    }
    resolveCurrencyName(presetData) {
        var _a, _b;
        const mosaicPreset = (_b = (_a = presetData.nemesis) === null || _a === void 0 ? void 0 : _a.mosaics) === null || _b === void 0 ? void 0 : _b[0];
        const currencyName = mosaicPreset === null || mosaicPreset === void 0 ? void 0 : mosaicPreset.name;
        if (!currencyName) {
            throw new Error('Currency name could not be resolved!!');
        }
        return currencyName;
    }
    generateExplorers(presetData, remoteNodeService) {
        return Promise.all((presetData.explorers || []).map(async (explorerPreset, index) => {
            const copyFrom = (0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'config', 'explorer');
            const fullName = `${presetData.baseNamespace}.${this.resolveCurrencyName(presetData)}`;
            const namespaceId = new symbol_sdk_1.NamespaceId(fullName);
            const { restNodes, defaultNode } = await remoteNodeService.resolveRestUrlsForServices();
            const templateContext = Object.assign(Object.assign({ namespaceName: fullName, namespaceId: namespaceId.toHex(), restNodes: restNodes, defaultNode: defaultNode }, presetData), explorerPreset);
            const name = templateContext.name || `explorer-${index}`;
            const moveTo = this.fileSystemService.getTargetFolder(this.params.target, false, Constants_1.Constants.targetExplorersFolder, name);
            await HandlebarsUtils_1.HandlebarsUtils.generateConfiguration(templateContext, copyFrom, moveTo);
        }));
    }
    cleanUpConfiguration(presetData) {
        const target = this.params.target;
        (presetData.nodes || []).forEach(({ name }) => {
            const serverConfigFolder = this.fileSystemService.getTargetNodesFolder(target, false, name, 'server-config');
            this.fileSystemService.deleteFolder(serverConfigFolder);
            const brokerConfigFolder = this.fileSystemService.getTargetNodesFolder(target, false, name, 'broker-config');
            this.fileSystemService.deleteFolder(brokerConfigFolder);
            // Remove old user configs when upgrading.
            const userConfigFolder = this.fileSystemService.getTargetNodesFolder(target, false, name, 'userconfig');
            this.fileSystemService.deleteFolder(userConfigFolder);
            const seedFolder = this.fileSystemService.getTargetNodesFolder(target, false, name, 'seed');
            this.fileSystemService.deleteFolder(seedFolder);
        });
        (presetData.gateways || []).forEach(({ name }) => {
            const configFolder = this.fileSystemService.getTargetGatewayFolder(target, false, name);
            this.fileSystemService.deleteFolder(configFolder, [
                (0, path_1.join)(configFolder, presetData.restSSLKeyFileName),
                (0, path_1.join)(configFolder, presetData.restSSLCertificateFileName),
            ]);
        });
    }
}
exports.ConfigService = ConfigService;
ConfigService.defaultParams = {
    target: Constants_1.Constants.defaultTargetFolder,
    workingDir: Constants_1.Constants.defaultWorkingDir,
    report: false,
    offline: false,
    reset: false,
    upgrade: false,
    user: Constants_1.Constants.CURRENT_USER,
    accountResolver: new AccountResolver_1.DefaultAccountResolver(),
};
