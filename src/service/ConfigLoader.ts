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
import { existsSync, promises as fs } from 'fs';

import { join } from 'path';
import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { Addresses, ConfigAccount, ConfigPreset, CustomPreset, NodePreset } from '../model/index.js';
import { Account, ICryptoPort, PublicAccount, SymbolCryptoAdapter } from '../sdk/index.js';
import { Constants } from '../utils/Constants.js';
import { HandlebarsUtils } from '../utils/HandlebarsUtils.js';
import { Utils } from '../utils/Utils.js';
import { Password, YamlUtils } from '../utils/YamlUtils.js';
import { Assembly, defaultAssembly } from './ConfigService.js';
import { MigrationService } from './MigrationService.js';

/**
 * Helper object that knows how to load addresses and preset files.
 */
export class ConfigLoader {
  public static presetInfoLogged = false;

  constructor(
    private readonly logger: Logger,
    private readonly cryptoPort?: ICryptoPort,
  ) {}

  public loadCustomPreset(customPreset: string | undefined, password: Password): CustomPreset {
    if (!customPreset) {
      return {};
    }
    if (!existsSync(customPreset)) {
      throw new KnownError(
        `Custom preset '${customPreset}' doesn't exist. Have you provided the right --customPreset <customPrestFileLocation> ?`,
      );
    }
    return YamlUtils.loadYaml(customPreset, password);
  }

  public static loadAssembly(preset: string, assembly: string, workingDir: string): CustomPreset {
    const fileLocation = join(Constants.ROOT_FOLDER, 'presets', 'assemblies', `assembly-${assembly}.yaml`);
    const errorMessage = `Assembly '${assembly}' is not valid for preset '${preset}'. Have you provided the right --preset <preset> --assembly <assembly> ?`;
    return this.loadBundledPreset(assembly, fileLocation, workingDir, errorMessage);
  }

  public static loadNetworkPreset(preset: string, workingDir: string): CustomPreset {
    const fileLocation = join(Constants.ROOT_FOLDER, 'presets', preset, `network.yaml`);
    const errorMessage = `Preset '${preset}' does not exist. Have you provided the right --preset <preset> ?`;
    return this.loadBundledPreset(preset, fileLocation, workingDir, errorMessage);
  }

  private static loadBundledPreset(presetFile: string, bundledLocation: string, workingDir: string, errorMessage: string): CustomPreset {
    if (YamlUtils.isYamlFile(presetFile)) {
      const assemblyFile = Utils.resolveWorkingDirPath(workingDir, presetFile);
      if (!existsSync(assemblyFile)) {
        throw new KnownError(errorMessage);
      }
      return YamlUtils.loadYaml(assemblyFile, false);
    }
    if (existsSync(bundledLocation)) {
      return YamlUtils.loadYaml(bundledLocation, false);
    }
    throw new KnownError(errorMessage);
  }

  public static loadSharedPreset(): CustomPreset {
    return YamlUtils.loadYaml(join(Constants.ROOT_FOLDER, 'presets', 'shared.yaml'), false) as ConfigPreset;
  }
  public mergePresets<T extends CustomPreset>(object: T | undefined, ...otherArgs: (CustomPreset | undefined)[]): T {
    const presets = [object, ...otherArgs];
    const reversed = [...presets].reverse();
    const presetData = Utils.deepMerge({}, ...presets);
    const inflation = reversed.find((p) => p?.inflation && Object.keys(p.inflation).length > 0)?.inflation;
    const knownRestGateways = reversed.find((p) => p?.knownRestGateways && p.knownRestGateways.length > 0)?.knownRestGateways;
    const knownPeers = reversed.find((p) => p?.knownPeers && p.knownPeers.length > 0)?.knownPeers;
    if (inflation) presetData.inflation = inflation;
    if (knownRestGateways) presetData.knownRestGateways = knownRestGateways;
    if (knownPeers) presetData.knownPeers = knownPeers;
    return presetData;
  }

  public createPresetData(params: {
    workingDir: string;
    password: Password;
    preset?: string;
    assembly?: string;
    customPreset?: string;
    customPresetObject?: CustomPreset;
    oldPresetData?: ConfigPreset;
  }): ConfigPreset {
    const customPreset = params.customPreset;
    const customPresetObject = params.customPresetObject;
    const oldPresetData = params.oldPresetData;
    const customPresetFileObject = this.loadCustomPreset(customPreset, params.password);
    const preset = params.preset || params.customPresetObject?.preset || customPresetFileObject?.preset || oldPresetData?.preset;
    if (!preset) {
      throw new KnownError(
        'Preset value could not be resolved from target folder contents. Please provide the --preset parameter when running the config/start command.',
      );
    }

    const sharedPreset = ConfigLoader.loadSharedPreset();
    const networkPreset = ConfigLoader.loadNetworkPreset(preset, params.workingDir);

    const assembly =
      params.assembly ||
      params.customPresetObject?.assembly ||
      customPresetFileObject?.assembly ||
      params.oldPresetData?.assembly ||
      defaultAssembly[preset];

    if (!assembly) {
      throw new KnownError(
        `Preset ${preset} requires assembly (-a, --assembly option). Possible values are: ${Object.keys(Assembly).join(', ')}`,
      );
    }

    const assemblyPreset = ConfigLoader.loadAssembly(preset, assembly, params.workingDir);
    const providedCustomPreset = this.mergePresets(customPresetFileObject, customPresetObject);
    const resolvedCustomPreset =
      providedCustomPreset && Object.keys(providedCustomPreset).length > 0 ? providedCustomPreset : oldPresetData?.customPresetCache || {};
    const presetData = this.mergePresets(sharedPreset, networkPreset, assemblyPreset, resolvedCustomPreset) as ConfigPreset;

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
    const presetDataWithDynamicDefaults: ConfigPreset = {
      ...presetData,
      version: 1,
      preset: preset,
      assembly: assembly,
      nodes: this.dynamicDefaultNodeConfiguration(presetData.nodes),
      customPresetCache: resolvedCustomPreset,
    };
    return this.expandRepeat(presetDataWithDynamicDefaults);
  }

  public dynamicDefaultNodeConfiguration(nodes?: Partial<NodePreset>[]): NodePreset[] {
    return (nodes || []).map((node) => {
      return { ...this.getDefaultConfiguration(node), ...node } as NodePreset;
    });
  }

  private getDefaultConfiguration(node: Partial<NodePreset>): Partial<NodePreset> {
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

  public static toConfig(account: Account | PublicAccount): ConfigAccount {
    if (account instanceof Account) {
      return {
        privateKey: account.privateKey,
        publicKey: account.publicAccount.publicKey,
        address: account.address.plain(),
      };
    } else {
      return {
        publicKey: account.publicKey,
        address: account.address.plain(),
      };
    }
  }

  public expandRepeat(presetData: ConfigPreset): ConfigPreset {
    return {
      ...presetData,
      databases: this.expandServicesRepeat(presetData, presetData.databases || []),
      nodes: this.expandServicesRepeat(presetData, presetData.nodes || []),
      gateways: this.expandServicesRepeat(presetData, presetData.gateways || []),
      httpsProxies: this.expandServicesRepeat(presetData, presetData.httpsProxies || []),
      nemesis: this.applyValueTemplate(presetData, presetData.nemesis),
    };
  }

  public applyValueTemplate(context: any, value: any): any {
    if (!value) {
      return value;
    }
    if (Array.isArray(value)) {
      return this.expandServicesRepeat(context, value as []);
    }

    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]: [string, any]) => [k, this.applyValueTemplate({ ...context, ...value }, v)]),
      );
    }

    if (typeof value !== 'string') {
      return value;
    }
    return HandlebarsUtils.runTemplate(value, context);
  }

  public expandServicesRepeat(context: any, services: any[]): any[] {
    return (services || []).map((service) => {
      if (typeof service !== 'object' || service === null) {
        return service;
      }
      return Object.fromEntries(
        Object.entries(service).map(([k, v]: [string, any]) => [k, this.applyValueTemplate({ ...context, ...service }, v)]),
      );
    });
  }

  public loadExistingPresetDataIfPreset(target: string, password: Password): ConfigPreset | undefined {
    const generatedPresetLocation = this.getGeneratedPresetLocation(target);
    if (existsSync(generatedPresetLocation)) {
      return YamlUtils.loadYaml(generatedPresetLocation, password);
    }
    return undefined;
  }

  public loadExistingPresetData(target: string, password: Password): ConfigPreset {
    const presetData = this.loadExistingPresetDataIfPreset(target, password);
    if (!presetData) {
      throw new Error(
        `The file ${this.getGeneratedPresetLocation(
          target,
        )} doesn't exist. Have you executed the 'config' command? Have you provided the right --target param?`,
      );
    }
    return presetData;
  }

  public getGeneratedPresetLocation(target: string): string {
    return join(target, 'preset.yml');
  }

  public loadExistingAddressesIfPreset(target: string, password: Password): Addresses | undefined {
    const generatedAddressLocation = this.getGeneratedAddressLocation(target);
    if (existsSync(generatedAddressLocation)) {
      const result = YamlUtils.loadYamlWithUpgradeInfo(generatedAddressLocation, password);
      const addresses = new MigrationService(this.logger, this.cryptoPort ?? new SymbolCryptoAdapter()).migrateAddresses(result.data);

      // If legacy encryption was upgraded, re-save the file with stronger encryption
      if (result.hasLegacyUpgrade && password) {
        const backupLocation = `${generatedAddressLocation}.bk`;
        this.logger.warn(`Legacy encryption detected in ${generatedAddressLocation}. Upgrading to stronger encryption...`);
        this.logger.info(`Creating backup of original file at ${backupLocation}`);

        fs.copyFile(generatedAddressLocation, backupLocation)
          .then(() => {
            this.logger.info(`Backup created successfully`);
            return YamlUtils.writeYaml(generatedAddressLocation, addresses, password);
          })
          .then(() => {
            this.logger.info(`Successfully upgraded encryption for ${generatedAddressLocation}`);
            this.logger.info(`Original file backed up to ${backupLocation} (encrypted with legacy method)`);
          })
          .catch((e) => {
            this.logger.error(`Failed to upgrade encryption for ${generatedAddressLocation}: ${e.message}`);
          });
      }

      return addresses;
    }
    return undefined;
  }

  public loadExistingAddresses(target: string, password: Password): Addresses {
    const addresses = this.loadExistingAddressesIfPreset(target, password);
    if (!addresses) {
      throw new Error(
        `The file ${this.getGeneratedAddressLocation(
          target,
        )} doesn't exist. Have you executed the 'config' command? Have you provided the right --target param?`,
      );
    }
    return addresses;
  }
  public getGeneratedAddressLocation(target: string): string {
    return join(target, 'addresses.yml');
  }
}
