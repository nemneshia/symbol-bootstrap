"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
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
const _ = require("lodash");
const path_1 = require("path");
const symbol_sdk_1 = require("symbol-sdk");
const ConfigService_1 = require("./ConfigService");
const Constants_1 = require("./Constants");
const HandlebarsUtils_1 = require("./HandlebarsUtils");
const KnownError_1 = require("./KnownError");
const MigrationService_1 = require("./MigrationService");
const Utils_1 = require("./Utils");
const YamlUtils_1 = require("./YamlUtils");
/**
 * Helper object that knows how to load addresses and preset files.
 */
class ConfigLoader {
    constructor(logger) {
        this.logger = logger;
    }
    loadCustomPreset(customPreset, password) {
        if (!customPreset) {
            return {};
        }
        if (!(0, fs_1.existsSync)(customPreset)) {
            throw new KnownError_1.KnownError(`Custom preset '${customPreset}' doesn't exist. Have you provided the right --customPreset <customPrestFileLocation> ?`);
        }
        return YamlUtils_1.YamlUtils.loadYaml(customPreset, password);
    }
    static loadAssembly(preset, assembly, workingDir) {
        const fileLocation = (0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'presets', 'assemblies', `assembly-${assembly}.yml`);
        const errorMessage = `Assembly '${assembly}' is not valid for preset '${preset}'. Have you provided the right --preset <preset> --assembly <assembly> ?`;
        return this.loadBundledPreset(assembly, fileLocation, workingDir, errorMessage);
    }
    static loadNetworkPreset(preset, workingDir) {
        const fileLocation = (0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'presets', preset, `network.yml`);
        const errorMessage = `Preset '${preset}' does not exist. Have you provided the right --preset <preset> ?`;
        return this.loadBundledPreset(preset, fileLocation, workingDir, errorMessage);
    }
    static loadBundledPreset(presetFile, bundledLocation, workingDir, errorMessage) {
        if (YamlUtils_1.YamlUtils.isYmlFile(presetFile)) {
            const assemblyFile = Utils_1.Utils.resolveWorkingDirPath(workingDir, presetFile);
            if (!(0, fs_1.existsSync)(assemblyFile)) {
                throw new KnownError_1.KnownError(errorMessage);
            }
            return YamlUtils_1.YamlUtils.loadYaml(assemblyFile, false);
        }
        if ((0, fs_1.existsSync)(bundledLocation)) {
            return YamlUtils_1.YamlUtils.loadYaml(bundledLocation, false);
        }
        throw new KnownError_1.KnownError(errorMessage);
    }
    static loadSharedPreset() {
        return YamlUtils_1.YamlUtils.loadYaml((0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'presets', 'shared.yml'), false);
    }
    mergePresets(object, ...otherArgs) {
        var _a, _b, _c;
        const presets = [object, ...otherArgs];
        const reversed = [...presets].reverse();
        const presetData = _.merge({}, ...presets);
        const inflation = (_a = reversed.find((p) => !_.isEmpty(p === null || p === void 0 ? void 0 : p.inflation))) === null || _a === void 0 ? void 0 : _a.inflation;
        const knownRestGateways = (_b = reversed.find((p) => !_.isEmpty(p === null || p === void 0 ? void 0 : p.knownRestGateways))) === null || _b === void 0 ? void 0 : _b.knownRestGateways;
        const knownPeers = (_c = reversed.find((p) => !_.isEmpty(p === null || p === void 0 ? void 0 : p.knownPeers))) === null || _c === void 0 ? void 0 : _c.knownPeers;
        if (inflation)
            presetData.inflation = inflation;
        if (knownRestGateways)
            presetData.knownRestGateways = knownRestGateways;
        if (knownPeers)
            presetData.knownPeers = knownPeers;
        return presetData;
    }
    createPresetData(params) {
        var _a, _b, _c;
        const customPreset = params.customPreset;
        const customPresetObject = params.customPresetObject;
        const oldPresetData = params.oldPresetData;
        const customPresetFileObject = this.loadCustomPreset(customPreset, params.password);
        const preset = params.preset || ((_a = params.customPresetObject) === null || _a === void 0 ? void 0 : _a.preset) || (customPresetFileObject === null || customPresetFileObject === void 0 ? void 0 : customPresetFileObject.preset) || (oldPresetData === null || oldPresetData === void 0 ? void 0 : oldPresetData.preset);
        if (!preset) {
            throw new KnownError_1.KnownError('Preset value could not be resolved from target folder contents. Please provide the --preset parameter when running the config/start command.');
        }
        const sharedPreset = ConfigLoader.loadSharedPreset();
        const networkPreset = ConfigLoader.loadNetworkPreset(preset, params.workingDir);
        const assembly = params.assembly ||
            ((_b = params.customPresetObject) === null || _b === void 0 ? void 0 : _b.assembly) ||
            (customPresetFileObject === null || customPresetFileObject === void 0 ? void 0 : customPresetFileObject.assembly) ||
            ((_c = params.oldPresetData) === null || _c === void 0 ? void 0 : _c.assembly) ||
            ConfigService_1.defaultAssembly[preset];
        if (!assembly) {
            throw new KnownError_1.KnownError(`Preset ${preset} requires assembly (-a, --assembly option). Possible values are: ${Object.keys(ConfigService_1.Assembly).join(', ')}`);
        }
        const assemblyPreset = ConfigLoader.loadAssembly(preset, assembly, params.workingDir);
        const providedCustomPreset = this.mergePresets(customPresetFileObject, customPresetObject);
        const resolvedCustomPreset = _.isEmpty(providedCustomPreset) ? (oldPresetData === null || oldPresetData === void 0 ? void 0 : oldPresetData.customPresetCache) || {} : providedCustomPreset;
        const presetData = this.mergePresets(sharedPreset, networkPreset, assemblyPreset, resolvedCustomPreset);
        if (!ConfigLoader.presetInfoLogged) {
            this.logger.info(`Generating config from preset '${preset}'`);
            if (assembly) {
                this.logger.info(`Using assembly '${assembly}'`);
            }
            if (customPreset) {
                this.logger.info(`Using custom preset file '${customPreset}'`);
            }
        }
        if (!presetData.networkType) {
            throw new Error('Network Type could not be resolved. Have your provided the right --preset?');
        }
        ConfigLoader.presetInfoLogged = true;
        const presetDataWithDynamicDefaults = Object.assign(Object.assign({}, presetData), { version: 1, preset: preset, assembly: assembly, nodes: this.dynamicDefaultNodeConfiguration(presetData.nodes), customPresetCache: resolvedCustomPreset });
        return this.expandRepeat(presetDataWithDynamicDefaults);
    }
    dynamicDefaultNodeConfiguration(nodes) {
        return _.map(nodes || [], (node) => {
            return Object.assign(Object.assign({}, this.getDefaultConfiguration(node)), node);
        });
    }
    getDefaultConfiguration(node) {
        if (node.harvesting && node.api) {
            return {
                syncsource: true,
                filespooling: true,
                partialtransaction: true,
                addressextraction: true,
                mongo: true,
                zeromq: true,
                enableAutoSyncCleanup: false,
            };
        }
        if (node.api) {
            return {
                syncsource: false,
                filespooling: true,
                partialtransaction: true,
                addressextraction: true,
                mongo: true,
                zeromq: true,
                enableAutoSyncCleanup: false,
            };
        }
        // peer only (harvesting or not).
        return {
            syncsource: true,
            filespooling: false,
            partialtransaction: false,
            addressextraction: false,
            mongo: false,
            zeromq: false,
            enableAutoSyncCleanup: true,
        };
    }
    static toConfig(account) {
        if (account instanceof symbol_sdk_1.Account) {
            return {
                privateKey: account.privateKey,
                publicKey: account.publicAccount.publicKey,
                address: account.address.plain(),
            };
        }
        else {
            return {
                publicKey: account.publicKey,
                address: account.address.plain(),
            };
        }
    }
    expandRepeat(presetData) {
        return Object.assign(Object.assign({}, presetData), { databases: this.expandServicesRepeat(presetData, presetData.databases || []), nodes: this.expandServicesRepeat(presetData, presetData.nodes || []), gateways: this.expandServicesRepeat(presetData, presetData.gateways || []), httpsProxies: this.expandServicesRepeat(presetData, presetData.httpsProxies || []), explorers: this.expandServicesRepeat(presetData, presetData.explorers || []), faucets: this.expandServicesRepeat(presetData, presetData.faucets || []), nemesis: this.applyValueTemplate(presetData, presetData.nemesis) });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    applyValueTemplate(context, value) {
        if (!value) {
            return value;
        }
        if (_.isArray(value)) {
            return this.expandServicesRepeat(context, value);
        }
        if (_.isObject(value)) {
            return _.mapValues(value, (v) => this.applyValueTemplate(Object.assign(Object.assign({}, context), value), v));
        }
        if (!_.isString(value)) {
            return value;
        }
        return HandlebarsUtils_1.HandlebarsUtils.runTemplate(value, context);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    expandServicesRepeat(context, services) {
        return _.flatMap(services || [], (service) => {
            if (!_.isObject(service)) {
                return service;
            }
            const repeat = service.repeat;
            if (repeat === 0) {
                return [];
            }
            return _.range(repeat || 1).map((index) => {
                return _.omit(_.mapValues(service, (v) => this.applyValueTemplate(Object.assign(Object.assign(Object.assign({}, context), service), { $index: index }), v)), 'repeat');
            });
        });
    }
    loadExistingPresetDataIfPreset(target, password) {
        const generatedPresetLocation = this.getGeneratedPresetLocation(target);
        if ((0, fs_1.existsSync)(generatedPresetLocation)) {
            return YamlUtils_1.YamlUtils.loadYaml(generatedPresetLocation, password);
        }
        return undefined;
    }
    loadExistingPresetData(target, password) {
        const presetData = this.loadExistingPresetDataIfPreset(target, password);
        if (!presetData) {
            throw new Error(`The file ${this.getGeneratedPresetLocation(target)} doesn't exist. Have you executed the 'config' command? Have you provided the right --target param?`);
        }
        return presetData;
    }
    getGeneratedPresetLocation(target) {
        return (0, path_1.join)(target, 'preset.yml');
    }
    loadExistingAddressesIfPreset(target, password) {
        const generatedAddressLocation = this.getGeneratedAddressLocation(target);
        if ((0, fs_1.existsSync)(generatedAddressLocation)) {
            return new MigrationService_1.MigrationService(this.logger).migrateAddresses(YamlUtils_1.YamlUtils.loadYaml(generatedAddressLocation, password));
        }
        return undefined;
    }
    loadExistingAddresses(target, password) {
        const addresses = this.loadExistingAddressesIfPreset(target, password);
        if (!addresses) {
            throw new Error(`The file ${this.getGeneratedAddressLocation(target)} doesn't exist. Have you executed the 'config' command? Have you provided the right --target param?`);
        }
        return addresses;
    }
    getGeneratedAddressLocation(target) {
        return (0, path_1.join)(target, 'addresses.yml');
    }
}
exports.ConfigLoader = ConfigLoader;
ConfigLoader.presetInfoLogged = false;
