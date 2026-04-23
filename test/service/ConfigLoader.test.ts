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

import { createCipheriv, pbkdf2Sync, randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { expect } from 'vitest';

import { join } from 'path';
import sinon from 'sinon';
import { Assembly, Constants, LoggerFactory, LogType, Utils, YamlUtils } from '../../src';
import { ConfigLoader, FileSystemService, Preset } from '../../src/service';

const logger = LoggerFactory.getLogger(LogType.Silent);

describe('ConfigLoader', () => {
  it('ConfigLoader loadPresetData no preset', async () => {
    const configLoader = new ConfigLoader(logger);
    try {
      await configLoader.createPresetData({
        workingDir: Constants.defaultWorkingDir,
        preset: undefined,
        assembly: undefined,
        customPreset: undefined,
        customPresetObject: undefined,
        password: 'abc',
      });
      expect(false).to.be.eq(true); // should have raised an error!
    } catch (e) {
      expect(Utils.getMessage(e)).eq(
        'Preset value could not be resolved from target folder contents. Please provide the --preset parameter when running the config/start command.',
      );
    }
  });

  it('ConfigLoader loadPresetData testnet no assembly', async () => {
    const configLoader = new ConfigLoader(logger);
    try {
      await configLoader.createPresetData({
        workingDir: Constants.defaultWorkingDir,
        preset: Preset.testnet,
        assembly: undefined,
        customPreset: undefined,
        customPresetObject: undefined,
        password: 'abc',
      });
      expect(false).to.be.eq(true); // should have raised an error!
    } catch (e) {
      expect(Utils.getMessage(e)).eq(
        'Preset testnet requires assembly (-a, --assembly option). Possible values are: dual, peer, api, demo',
      );
    }
  });

  it('ConfigLoader loadPresetData invalid assembly file', async () => {
    const configLoader = new ConfigLoader(logger);
    try {
      await configLoader.createPresetData({
        workingDir: Constants.defaultWorkingDir,
        preset: Preset.testnet,
        assembly: 'invalid-assembly.yml',
        customPreset: undefined,
        customPresetObject: undefined,
        password: 'abc',
      });
      expect(false).to.be.eq(true); // should have raised an error!
    } catch (e) {
      expect(Utils.getMessage(e)).eq(
        "Assembly 'invalid-assembly.yml' is not valid for preset 'testnet'. Have you provided the right --preset <preset> --assembly <assembly> ?",
      );
    }
  });

  it('ConfigLoader loadPresetData invalid preset file', async () => {
    const configLoader = new ConfigLoader(logger);
    try {
      await configLoader.createPresetData({
        workingDir: Constants.defaultWorkingDir,
        preset: 'invalid-preset.yml',
        assembly: Assembly.dual,
        customPreset: undefined,
        customPresetObject: undefined,
        password: 'abc',
      });
      expect(false).to.be.eq(true); // should have raised an error!
    } catch (e) {
      expect(Utils.getMessage(e)).eq("Preset 'invalid-preset.yml' does not exist. Have you provided the right --preset <preset> ?");
    }
  });

  it('ConfigLoader loadPresetData bootstrap no assembly', async () => {
    const configLoader = new ConfigLoader(logger);
    const presetData = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      preset: Preset.bootstrap,
      customPreset: undefined,
      customPresetObject: undefined,
      password: 'abc',
    });
    expect(presetData).to.not.be.undefined;
    expect(presetData.preset).to.eq(Preset.bootstrap);
    expect(presetData.assembly).to.eq(Assembly.dual);
  });

  it('ConfigLoader loadPresetData testnet assembly', async () => {
    const configLoader = new ConfigLoader(logger);
    const presetData = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      preset: Preset.testnet,
      assembly: Assembly.api,
      customPreset: undefined,
      customPresetObject: undefined,
      password: 'abc',
    });
    expect(presetData).to.not.be.undefined;
    expect(presetData.preset).to.eq(Preset.testnet);
    expect(presetData.assembly).to.eq(Assembly.api);
  });

  it('ConfigLoader loadPresetData testnet assembly using external files', async () => {
    const configLoader = new ConfigLoader(logger);
    const presetData = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      preset: 'presets/testnet/network.yml',
      assembly: 'presets/assemblies/assembly-api.yml',
      customPreset: undefined,
      customPresetObject: undefined,
      password: 'abc',
    });
    expect(presetData).to.not.be.undefined;
    expect(presetData.preset).to.eq('presets/testnet/network.yml');
    expect(presetData.assembly).to.eq('presets/assemblies/assembly-api.yml');
  });

  it('ConfigLoader custom maxUnlockedAccounts', async () => {
    const configLoader = new ConfigLoader(logger);
    const originalPresetData = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      preset: Preset.testnet,
      assembly: Assembly.dual,
      customPreset: 'test/unit-test-profiles/custom_preset.yml',
      customPresetObject: {
        maxUnlockedAccounts: 30,
      },
      password: 'abcd',
    });
    expect(originalPresetData).to.not.be.undefined;
    expect(originalPresetData.nodes![0].maxUnlockedAccounts).eq(undefined);
    expect(originalPresetData.maxUnlockedAccounts).eq(30);
    expect(originalPresetData.customPresetCache).deep.eq({
      maxUnlockedAccounts: 30,
      nodes: [
        {
          host: 'my-host.io',
          mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
          remotePrivateKey: 'EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
          transportPrivateKey: '6154154096354BC3DB522174ACD8BFE553893A0991BD5D105599846F17A3383B',
          voting: true,
          vrfPrivateKey: 'F3C24C153783B683E40FB2671493B54480370BF4E3AB8027D4BF1293E14EB9B8',
        },
      ],
      privateKeySecurityMode: 'PROMPT_MAIN',
    });

    const upgradedPresetData = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      oldPresetData: originalPresetData,
      preset: Preset.testnet,
      assembly: Assembly.dual,
      password: 'abcd',
    });
    expect(upgradedPresetData).to.not.be.undefined;
    expect(upgradedPresetData.nodes![0].maxUnlockedAccounts).eq(undefined);
    expect(upgradedPresetData.maxUnlockedAccounts).eq(30);
    expect(upgradedPresetData.customPresetCache).deep.eq({
      maxUnlockedAccounts: 30,
      nodes: [
        {
          host: 'my-host.io',
          mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
          remotePrivateKey: 'EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
          transportPrivateKey: '6154154096354BC3DB522174ACD8BFE553893A0991BD5D105599846F17A3383B',
          voting: true,
          vrfPrivateKey: 'F3C24C153783B683E40FB2671493B54480370BF4E3AB8027D4BF1293E14EB9B8',
        },
      ],
      privateKeySecurityMode: 'PROMPT_MAIN',
    });

    const upgradedPresetResetToDefaults = await configLoader.createPresetData({
      workingDir: '.',
      oldPresetData: originalPresetData,
      preset: Preset.testnet,
      customPresetObject: {
        maxUnlockedAccounts: 15,
      },
      assembly: Assembly.dual,
      password: 'abcd',
    });
    expect(upgradedPresetResetToDefaults).to.not.be.undefined;
    expect(upgradedPresetResetToDefaults.nodes![0].maxUnlockedAccounts).eq(undefined);
    expect(upgradedPresetResetToDefaults.maxUnlockedAccounts).eq(15);
    expect(upgradedPresetResetToDefaults.customPresetCache).deep.eq({
      maxUnlockedAccounts: 15,
    });
  });

  it('mergePreset', async () => {
    const configLoader = new ConfigLoader(logger);
    expect(
      configLoader.mergePresets(
        { maxUnlockedAccounts: 1, inflation: { a: 1, c: 1, d: 1 } },
        { maxUnlockedAccounts: 2 },
        { maxUnlockedAccounts: 3, inflation: { c: 2, d: 2, e: 2 } },
        { maxUnlockedAccounts: 4 },
      ),
    ).deep.eq({ maxUnlockedAccounts: 4, inflation: { c: 2, d: 2, e: 2 } });
  });

  it('mergePreset with node', async () => {
    const configLoader = new ConfigLoader(logger);
    const merged = configLoader.mergePresets(
      {
        maxUnlockedAccounts: 1,
        inflation: { a: 1, c: 1, d: 1 },
      },
      { nodes: [{ maxUnlockedAccounts: 5, name: 'name1' }], knownRestGateways: ['r1', 'r2'] },
      { maxUnlockedAccounts: 3, inflation: { c: 2, d: 2, e: 2 }, knownRestGateways: ['r2', 'r3'] },
      {
        maxUnlockedAccounts: 4,
        nodes: [{ maxUnlockedAccounts: 3 }, { maxUnlockedAccounts: 4, name: 'nameB' }],
      },
    );
    expect(merged).deep.eq({
      maxUnlockedAccounts: 4,
      inflation: { c: 2, d: 2, e: 2 },
      nodes: [
        { maxUnlockedAccounts: 3, name: 'name1' },
        { maxUnlockedAccounts: 4, name: 'nameB' },
      ],
      knownRestGateways: ['r2', 'r3'],
    });
  });

  it('ConfigLoader custom maxUnlockedAccounts', async () => {
    const configLoader = new ConfigLoader(logger);
    const originalPresetData = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      preset: Preset.testnet,
      assembly: Assembly.dual,
      customPreset: 'test/unit-test-profiles/custom_preset.yml',
      customPresetObject: {
        maxUnlockedAccounts: 30,
      },
      password: 'abcd',
    });
    expect(originalPresetData).to.not.be.undefined;
    expect(originalPresetData.nodes![0].maxUnlockedAccounts).eq(undefined);
    expect(originalPresetData.maxUnlockedAccounts).eq(30);
    expect(originalPresetData.customPresetCache).deep.eq({
      maxUnlockedAccounts: 30,
      nodes: [
        {
          host: 'my-host.io',
          mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
          remotePrivateKey: 'EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
          transportPrivateKey: '6154154096354BC3DB522174ACD8BFE553893A0991BD5D105599846F17A3383B',
          voting: true,
          vrfPrivateKey: 'F3C24C153783B683E40FB2671493B54480370BF4E3AB8027D4BF1293E14EB9B8',
        },
      ],
      privateKeySecurityMode: 'PROMPT_MAIN',
    });

    const upgradedPresetData = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      oldPresetData: originalPresetData,
      preset: Preset.testnet,
      assembly: Assembly.dual,
      password: 'abcd',
    });
    expect(upgradedPresetData).to.not.be.undefined;
    expect(upgradedPresetData.nodes![0].maxUnlockedAccounts).eq(undefined);
    expect(upgradedPresetData.maxUnlockedAccounts).eq(30);
    expect(upgradedPresetData.customPresetCache).deep.eq({
      maxUnlockedAccounts: 30,
      nodes: [
        {
          host: 'my-host.io',
          mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
          remotePrivateKey: 'EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
          transportPrivateKey: '6154154096354BC3DB522174ACD8BFE553893A0991BD5D105599846F17A3383B',
          voting: true,
          vrfPrivateKey: 'F3C24C153783B683E40FB2671493B54480370BF4E3AB8027D4BF1293E14EB9B8',
        },
      ],
      privateKeySecurityMode: 'PROMPT_MAIN',
    });

    const upgradedPresetResetToDefaults = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      oldPresetData: originalPresetData,
      preset: Preset.testnet,
      customPresetObject: {
        maxUnlockedAccounts: 15,
      },
      assembly: Assembly.dual,
      password: 'abcd',
    });
    expect(upgradedPresetResetToDefaults).to.not.be.undefined;
    expect(upgradedPresetResetToDefaults.nodes![0].maxUnlockedAccounts).eq(undefined);
    expect(upgradedPresetResetToDefaults.maxUnlockedAccounts).eq(15);
    expect(upgradedPresetResetToDefaults.customPresetCache).deep.eq({
      maxUnlockedAccounts: 15,
    });
  });

  it('mergePreset', async () => {
    const configLoader = new ConfigLoader(logger);
    expect(
      configLoader.mergePresets(
        { maxUnlockedAccounts: 1, inflation: { a: 1, c: 1, d: 1 } },
        { maxUnlockedAccounts: 2 },
        { maxUnlockedAccounts: 3, inflation: { c: 2, d: 2, e: 2 } },
        { maxUnlockedAccounts: 4 },
      ),
    ).deep.eq({ maxUnlockedAccounts: 4, inflation: { c: 2, d: 2, e: 2 } });
  });

  it('mergePreset with node', async () => {
    const configLoader = new ConfigLoader(logger);
    const merged = configLoader.mergePresets(
      {
        maxUnlockedAccounts: 1,
        inflation: { a: 1, c: 1, d: 1 },
      },
      { nodes: [{ maxUnlockedAccounts: 5, name: 'name1' }], knownRestGateways: ['r1', 'r2'] },
      { maxUnlockedAccounts: 3, inflation: { c: 2, d: 2, e: 2 }, knownRestGateways: ['r2', 'r3'] },
      {
        maxUnlockedAccounts: 4,
        nodes: [{ maxUnlockedAccounts: 3 }, { maxUnlockedAccounts: 4, name: 'nameB' }],
      },
    );
    expect(merged).deep.eq({
      maxUnlockedAccounts: 4,
      inflation: { c: 2, d: 2, e: 2 },
      nodes: [
        { maxUnlockedAccounts: 3, name: 'name1' },
        { maxUnlockedAccounts: 4, name: 'nameB' },
      ],
      knownRestGateways: ['r2', 'r3'],
    });
  });

  it('ConfigLoader loadPresetData bootstrap custom', async () => {
    const configLoader = new ConfigLoader(logger);
    const presetData = await configLoader.createPresetData({
      workingDir: Constants.defaultWorkingDir,
      preset: Preset.bootstrap,
      assembly: undefined,
      customPreset: 'test/override-currency-preset.yml',
      customPresetObject: undefined,
      password: 'abcd',
    });
    expect(presetData).to.not.be.undefined;
    expect(presetData?.nemesis?.mosaics?.[0].accounts).to.be.eq(20);
    const yaml = YamlUtils.toYaml(presetData);
    expect(YamlUtils.fromYaml(yaml)).to.be.deep.eq(presetData);
  });

  it('ConfigLoader loadPresetData bootstrap custom too short!', async () => {
    const configLoader = new ConfigLoader(logger);
    try {
      await configLoader.createPresetData({
        workingDir: Constants.defaultWorkingDir,
        preset: Preset.bootstrap,
        assembly: undefined,
        customPreset: 'test/override-currency-preset.yml',
        customPresetObject: undefined,
        password: 'abc',
      });
    } catch (e) {
      expect(Utils.getMessage(e)).eq('Password is too short. It should have at least 4 characters!');
    }
  });

  it('applyIndex', async () => {
    const configLoader = new ConfigLoader(logger);
    const context = { $index: 10 };
    expect(configLoader.applyValueTemplate(context, 'hello')).to.be.eq('hello');
    expect(configLoader.applyValueTemplate(context, 'index')).to.be.eq('index');
    expect(configLoader.applyValueTemplate(context, '$index')).to.be.eq('$index');
    expect(configLoader.applyValueTemplate(context, '{{index}}')).to.be.eq('');
    expect(configLoader.applyValueTemplate(context, '{{$index}}')).to.be.eq('10');
    expect(configLoader.applyValueTemplate(context, '{{add $index 2}}')).to.be.eq('12');
    expect(configLoader.applyValueTemplate(context, '100.100.{{add $index 2}}')).to.be.eq('100.100.12');
    expect(configLoader.applyValueTemplate(context, '100.100.{{add $index 5}}')).to.be.eq('100.100.15');
  });

  it('applyValueTemplate when object', async () => {
    const configLoader = new ConfigLoader(logger);
    const value = {
      _info: 'this file contains a list of api-node peers',
      knownPeers: [
        {
          publicKey: '46902d4a6136d43f8d78e3ab4494aee9b1da17886f6f0a698959714f96900bd6',
          endpoint: {
            host: 'api-node-0',
            port: 7900,
          },
          metadata: {
            name: 'api-node-0',
            roles: 'Api',
          },
        },
      ],
    };

    expect(configLoader.applyValueTemplate({}, value)).to.be.deep.eq(value);
    expect(configLoader.applyValueTemplate({}, YamlUtils.fromYaml(YamlUtils.toYaml(value)))).to.be.deep.eq(value);
  });

  it('applyValueTemplate when array', async () => {
    const configLoader = new ConfigLoader(logger);
    const value = [
      {
        _info: 'this file contains a list of api-node peers',
        knownPeers: [
          {
            publicKey: '46902d4a6136d43f8d78e3ab4494aee9b1da17886f6f0a698959714f96900bd6',
            endpoint: {
              host: 'api-node-0',
              port: 7900,
            },
            metadata: {
              name: 'api-node-0',
              roles: 'Api',
            },
          },
        ],
      },
    ];

    expect(configLoader.applyValueTemplate({}, value)).to.be.deep.eq(value);
    expect(configLoader.applyValueTemplate({}, YamlUtils.fromYaml(YamlUtils.toYaml(value)))).to.be.deep.eq(value);
  });

  describe('loadExistingAddressesIfPreset legacy encryption upgrade', () => {
    const fileSystemService = new FileSystemService(logger);
    const testTarget = 'target/test-config-loader-legacy-upgrade';
    const testAddressesFile = join(testTarget, 'addresses.yml');

    beforeEach(async () => {
      // Clean up test directory
      fileSystemService.deleteFolder(testTarget);
      await fileSystemService.mkdir(testTarget);
    });

    afterEach(() => {
      fileSystemService.deleteFolder(testTarget);
    });

    it('should create backup and upgrade when legacy encryption is detected', async () => {
      const password = '1234';
      const configLoader = new ConfigLoader(logger);

      // Create test addresses data with legacy encrypted private keys
      const addresses = {
        version: 2,
        networkType: 104,
        nodes: [
          {
            name: 'node1',
            main: {
              privateKey: createLegacyEncryptedValue('6A4E05F63EA94949D1043D59A704CBA1E1FA1F57BF99E41D5F5DCF89E549D4E8', password),
              publicKey: 'F71853563BEE2C580C9AFA0A1A84203D14868C19279ABAABF8ADE89AF9AA9B30',
              address: 'TAEAUXUZOFODY2ZQZGV5DUVQ2TN3HBSXKGBEH5Q',
            },
            transport: {
              privateKey: createLegacyEncryptedValue('E07C107F25DE9CBBC301683F527EBE05A47572EE810DB91D5C4FA6A7E0B9D5BF', password),
              publicKey: '41470F3A43095F493319A2241C3059B5EA0ECC89318E6ED32381A4AAEC4D13D1',
              address: 'TCZARKJGP4RXWWTUZRRYW4X5Z7UQFUXQ5K2VIJQ',
            },
          },
        ],
      };

      // Write the addresses file with legacy encryption
      await YamlUtils.writeYaml(testAddressesFile, addresses, '');

      // Mock logger methods to capture log output
      const loggerWarnSpy = sinon.spy(logger, 'warn');
      const loggerInfoSpy = sinon.spy(logger, 'info');
      const loggerErrorSpy = sinon.spy(logger, 'error');

      // Call the method under test
      const result = configLoader.loadExistingAddressesIfPreset(testTarget, password);

      // Should return the decrypted addresses
      expect(result).to.not.be.undefined;
      if (result && result.nodes && result.nodes.length > 0) {
        expect(result.nodes[0].main.privateKey).to.eq('6A4E05F63EA94949D1043D59A704CBA1E1FA1F57BF99E41D5F5DCF89E549D4E8');
        expect(result.nodes[0].transport.privateKey).to.eq('E07C107F25DE9CBBC301683F527EBE05A47572EE810DB91D5C4FA6A7E0B9D5BF');
      }

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify backup file was created
      const backupFile = `${testAddressesFile}.bk`;
      expect(existsSync(backupFile)).to.be.true;

      // Verify logging occurred
      expect(loggerWarnSpy.calledWith(sinon.match('Legacy encryption detected'))).to.be.true;
      expect(loggerInfoSpy.calledWith(sinon.match('Creating backup of original file'))).to.be.true;

      // Restore logger methods
      loggerWarnSpy.restore();
      loggerInfoSpy.restore();
      loggerErrorSpy.restore();
    });

    it('should not create backup when current encryption is used', async () => {
      const password = '1234';
      const configLoader = new ConfigLoader(logger);

      // Create test addresses data with current encryption
      const plainAddresses = {
        version: 2,
        networkType: 104,
        nodes: [
          {
            name: 'node1',
            main: {
              privateKey: '6A4E05F63EA94949D1043D59A704CBA1E1FA1F57BF99E41D5F5DCF89E549D4E8',
              publicKey: 'F71853563BEE2C580C9AFA0A1A84203D14868C19279ABAABF8ADE89AF9AA9B30',
              address: 'TAEAUXUZOFODY2ZQZGV5DUVQ2TN3HBSXKGBEH5Q',
            },
          },
        ],
      };

      // Encrypt with current method and write the file
      await YamlUtils.writeYaml(testAddressesFile, plainAddresses, password);

      // Mock logger methods
      const loggerWarnSpy = sinon.spy(logger, 'warn');

      // Call the method under test
      const result = configLoader.loadExistingAddressesIfPreset(testTarget, password);

      // Should return the decrypted addresses
      expect(result).to.not.be.undefined;
      if (result && result.nodes && result.nodes.length > 0) {
        expect(result.nodes[0].main.privateKey).to.eq('6A4E05F63EA94949D1043D59A704CBA1E1FA1F57BF99E41D5F5DCF89E549D4E8');
      }

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify backup file was NOT created
      const backupFile = `${testAddressesFile}.bk`;
      expect(existsSync(backupFile)).to.be.false;

      // Verify no warning was logged
      expect(loggerWarnSpy.calledWith(sinon.match('Legacy encryption detected'))).to.be.false;

      // Restore logger methods
      loggerWarnSpy.restore();
    });

    it('should return undefined when addresses file does not exist', () => {
      const configLoader = new ConfigLoader(logger);
      const result = configLoader.loadExistingAddressesIfPreset('nonexistent-target', '1234');
      expect(result).to.be.undefined;
    });

    /**
     * Helper function to create legacy encrypted value (equivalent to crypto-js 4.1.1)
     */
    function createLegacyEncryptedValue(plaintext: string, password: string): string {
      const salt = randomBytes(16);
      const iv = randomBytes(16);
      const key = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, 1024, 32, 'sha1');

      const cipher = createCipheriv('aes-256-cbc', key, iv);
      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');

      return 'ENCRYPTED:' + salt.toString('hex') + iv.toString('hex') + ciphertext;
    }
  });
});
