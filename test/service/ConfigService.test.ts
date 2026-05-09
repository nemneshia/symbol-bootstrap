import { beforeEach, describe, expect, it, vi } from 'vitest';

import { existsSync } from 'node:fs';

import { KnownError } from '../../src/errors/KnownError.js';
import { NetworkType } from '../../src/sdk/index.js';
import { AddressesService } from '../../src/service/AddressesService.js';
import { ConfigLoader } from '../../src/service/ConfigLoader.js';
import { ConfigService } from '../../src/service/ConfigService.js';
import { FileSystemService } from '../../src/service/FileSystemService.js';
import { GatewayConfigurationService } from '../../src/service/GatewayConfigurationService.js';
import { NemesisConfigurationService } from '../../src/service/NemesisConfigurationService.js';
import { NodeConfigurationService } from '../../src/service/NodeConfigurationService.js';
import { CryptoUtils } from '../../src/utils/CryptoUtils.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
  };
});

describe('ConfigService', () => {
  const existsSyncMock = vi.mocked(existsSync);
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  const accountResolver = {} as any;
  const cryptoPort = {} as any;
  const networkPort = {} as any;

  const presetLocation = 'target/preset.yml';
  const addressesLocation = 'target/addresses.yml';
  const oldPreset = {
    knownPeers: ['peer'],
    knownRestGateways: ['gateway'],
    nodes: [],
  } as any;
  const oldAddresses = { version: 1 } as any;
  const addresses = {
    version: 1,
    nemesisGenerationHashSeed: 'seed',
    networkType: NetworkType.TEST_NET,
  } as any;

  const baseParams = () =>
    ({
      target: 'target',
      workingDir: 'working',
      offline: false,
      reset: false,
      upgrade: false,
      user: 'current',
      password: 'password',
      accountResolver,
    }) as any;

  const createPreset = () =>
    ({
      privateKeySecurityMode: 'ENCRYPT',
      dockerComposeProjectName: 'bootstrap',
      restSSLKeyFileName: 'rest.key.pem',
      restSSLCertificateFileName: 'rest.crt.pem',
      node: {
        name: 'api-node',
        databaseHost: 'mongo',
        brokerName: 'broker',
      },
      gateway: {
        name: 'gateway',
        apiNodeName: 'api-node',
        databaseHost: 'mongo',
        apiNodeHost: 'api-host',
        apiNodeBrokerHost: 'broker-host',
      },
      database: { name: 'mongo' },
    }) as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    logger.error.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
    existsSyncMock.mockReturnValue(false);

    vi.spyOn(ConfigLoader.prototype, 'getGeneratedPresetLocation').mockReturnValue(presetLocation);
    vi.spyOn(ConfigLoader.prototype, 'getGeneratedAddressLocation').mockReturnValue(
      addressesLocation
    );
    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockReturnValue(oldPreset);
    vi.spyOn(ConfigLoader.prototype, 'loadExistingAddresses').mockReturnValue(oldAddresses);
    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetDataIfPreset').mockReturnValue(undefined);
    vi.spyOn(ConfigLoader.prototype, 'loadExistingAddressesIfPreset').mockReturnValue(undefined);
    vi.spyOn(ConfigLoader.prototype, 'createPresetData').mockReturnValue(createPreset());

    vi.spyOn(FileSystemService.prototype, 'deleteFolder').mockImplementation(() => {});
    vi.spyOn(FileSystemService.prototype, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(AddressesService.prototype, 'resolveAddresses').mockResolvedValue(addresses);
    vi.spyOn(NodeConfigurationService.prototype, 'generateNodeCertificates').mockResolvedValue(
      undefined
    );
    vi.spyOn(NodeConfigurationService.prototype, 'generateNodes').mockResolvedValue(undefined);
    vi.spyOn(GatewayConfigurationService.prototype, 'generateGateways').mockResolvedValue([]);
    vi.spyOn(NemesisConfigurationService.prototype, 'resolveNemesis').mockResolvedValue(undefined);
    vi.spyOn(NemesisConfigurationService.prototype, 'copyNemesis').mockResolvedValue(undefined);
    vi.spyOn(YamlUtils, 'writeYaml').mockResolvedValue(undefined);
  });

  describe('defaultParams', () => {
    it('CLI から省略される値のデフォルトを持つこと', () => {
      expect(ConfigService.defaultParams.reset).toBe(false);
      expect(ConfigService.defaultParams.upgrade).toBe(false);
      expect(ConfigService.defaultParams.offline).toBe(false);
      expect(ConfigService.defaultParams.accountResolver).toBeDefined();
    });
  });

  describe('resolveConfigPreset', () => {
    it('生成済み preset があり upgrade でない場合は既存 preset を返すこと', () => {
      existsSyncMock.mockReturnValue(true);
      const service = new ConfigService(logger as any, baseParams(), cryptoPort, networkPort);

      const result = service.resolveConfigPreset('password');

      expect(result).toBe(oldPreset);
      expect(ConfigLoader.prototype.loadExistingPresetData).toHaveBeenCalledWith(
        'target',
        'password'
      );
      expect(ConfigLoader.prototype.createPresetData).not.toHaveBeenCalled();
    });

    it('生成済み preset がない場合は旧 preset を引き継いで現在の preset を作成すること', () => {
      const params = { ...baseParams(), upgrade: true };
      vi.mocked(ConfigLoader.prototype.loadExistingPresetDataIfPreset).mockReturnValue(oldPreset);
      const service = new ConfigService(logger as any, params, cryptoPort, networkPort);

      const result = service.resolveConfigPreset('secret');

      expect(result).toEqual(createPreset());
      expect(ConfigLoader.prototype.createPresetData).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'secret',
          oldPresetData: oldPreset,
          upgrade: true,
        })
      );
    });
  });

  describe('run', () => {
    it('reset 指定時に target を削除し、生成済み preset がある場合は早期リターンすること', async () => {
      existsSyncMock.mockReturnValue(true);
      const service = new ConfigService(
        logger as any,
        { ...baseParams(), reset: true },
        cryptoPort,
        networkPort
      );

      const result = await service.run();

      expect(result).toEqual({ presetData: oldPreset, addresses: oldAddresses });
      expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalledWith('target');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('既に存在するため、設定生成をスキップします')
      );
      expect(AddressesService.prototype.resolveAddresses).not.toHaveBeenCalled();
      expect(YamlUtils.writeYaml).not.toHaveBeenCalled();
    });

    it('新規生成フローで prefix 適用、各サービス委譲、YAML 出力を行うこと', async () => {
      const presetData = createPreset();
      vi.mocked(ConfigLoader.prototype.createPresetData).mockReturnValue(presetData);
      const service = new ConfigService(logger as any, baseParams(), cryptoPort, networkPort);

      const result = await service.run();

      expect(result).toEqual({ presetData, addresses });
      expect(presetData.node).toMatchObject({
        name: 'api-node',
        databaseHost: 'mongo',
        brokerName: 'broker',
      });
      expect(presetData.gateway).toMatchObject({
        apiNodeName: 'api-node',
        databaseHost: 'mongo',
        apiNodeHost: 'api-host',
        apiNodeBrokerHost: 'broker-host',
      });
      expect(presetData.database).toEqual({ name: 'mongo' });
      expect(AddressesService.prototype.resolveAddresses).toHaveBeenCalledWith(
        undefined,
        undefined,
        presetData
      );
      expect(FileSystemService.prototype.mkdir).toHaveBeenCalledWith('target');
      expect(NodeConfigurationService.prototype.generateNodeCertificates).toHaveBeenCalledWith(
        presetData,
        addresses
      );
      expect(NodeConfigurationService.prototype.generateNodes).toHaveBeenCalledWith(
        presetData,
        addresses,
        expect.any(Object)
      );
      expect(GatewayConfigurationService.prototype.generateGateways).toHaveBeenCalledWith(
        presetData
      );
      expect(NemesisConfigurationService.prototype.resolveNemesis).toHaveBeenCalledWith(
        presetData,
        addresses,
        false
      );
      expect(NemesisConfigurationService.prototype.copyNemesis).toHaveBeenCalledWith(addresses);
      expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalledWith(
        'target/api-node/server-config'
      );
      expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalledWith(
        'target/api-node/broker-config'
      );
      expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalledWith(
        'target/api-node/userconfig'
      );
      expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalledWith('target/api-node/seed');
      expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalledWith('target/gateway', [
        'target/gateway/rest.key.pem',
        'target/gateway/rest.crt.pem',
      ]);
      expect(YamlUtils.writeYaml).toHaveBeenNthCalledWith(
        1,
        addressesLocation,
        addresses,
        'password'
      );
      expect(YamlUtils.writeYaml).toHaveBeenNthCalledWith(
        2,
        presetLocation,
        presetData,
        'password'
      );
      expect(logger.info).toHaveBeenCalledWith('設定の生成が完了しました。');
    });

    it('node がない preset では Nemesis 生成をスキップすること', async () => {
      const presetData = {
        privateKeySecurityMode: undefined,
        restSSLKeyFileName: 'key.pem',
        restSSLCertificateFileName: 'crt.pem',
        node: undefined,
        gateway: undefined,
        database: undefined,
      } as any;
      vi.mocked(ConfigLoader.prototype.createPresetData).mockReturnValue(presetData);
      const service = new ConfigService(logger as any, baseParams(), cryptoPort, networkPort);

      await service.run();

      expect(NemesisConfigurationService.prototype.resolveNemesis).not.toHaveBeenCalled();
      expect(NemesisConfigurationService.prototype.copyNemesis).not.toHaveBeenCalled();
    });

    it('旧 preset と addresses が揃っている場合は upgrade として生成すること', async () => {
      const params = { ...baseParams(), upgrade: true };
      const previousPreset = { ...oldPreset };
      vi.mocked(ConfigLoader.prototype.loadExistingPresetDataIfPreset).mockReturnValue(
        previousPreset
      );
      vi.mocked(ConfigLoader.prototype.loadExistingAddressesIfPreset).mockReturnValue(oldAddresses);
      const service = new ConfigService(logger as any, params, cryptoPort, networkPort);

      await service.run();

      expect(previousPreset).not.toHaveProperty('knownPeers');
      expect(previousPreset).not.toHaveProperty('knownRestGateways');
      expect(logger.info).toHaveBeenCalledWith('設定をアップグレードします...');
      expect(ConfigLoader.prototype.createPresetData).toHaveBeenCalledWith(
        expect.objectContaining({ oldPresetData: previousPreset })
      );
      expect(AddressesService.prototype.resolveAddresses).toHaveBeenCalledWith(
        oldAddresses,
        previousPreset,
        expect.any(Object)
      );
      expect(NemesisConfigurationService.prototype.resolveNemesis).toHaveBeenCalledWith(
        expect.any(Object),
        addresses,
        true
      );
    });

    it('旧 addresses のみ存在する場合は KnownError をスローすること', async () => {
      vi.mocked(ConfigLoader.prototype.loadExistingAddressesIfPreset).mockReturnValue(oldAddresses);
      const service = new ConfigService(logger as any, baseParams(), cryptoPort, networkPort);

      await expect(service.run()).rejects.toThrow(KnownError);

      expect(logger.error).toHaveBeenCalledWith(
        `以前の ${presetLocation} ファイルがないため、設定をアップグレードできません。（リセットは -r を実行）`
      );
    });

    it('旧 preset のみ存在する場合は KnownError をスローすること', async () => {
      vi.mocked(ConfigLoader.prototype.loadExistingPresetDataIfPreset).mockReturnValue(oldPreset);
      const service = new ConfigService(logger as any, baseParams(), cryptoPort, networkPort);

      await expect(service.run()).rejects.toThrow(KnownError);

      expect(logger.error).toHaveBeenCalledWith(
        `以前の ${addressesLocation} ファイルがないため、設定をアップグレードできません。（リセットは -r を実行）`
      );
    });

    it('未知のエラーでは詳細ログと target 削除の警告を出して再スローすること', async () => {
      const error = new Error('boom');
      vi.mocked(ConfigLoader.prototype.createPresetData).mockImplementation(() => {
        throw error;
      });
      const service = new ConfigService(logger as any, baseParams(), cryptoPort, networkPort);

      await expect(service.run()).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        '設定生成中に不明なエラーが発生しました。boom',
        error
      );
      expect(logger.error).toHaveBeenCalledWith(
        "ターゲットフォルダー 'target' を削除してください。"
      );
    });

    it('デフォルトの cryptoPort と networkPort でもインスタンス化できること', () => {
      expect(new ConfigService(logger as any, baseParams())).toBeDefined();
    });
  });

  describe('private helper behavior', () => {
    it('dockerComposeProjectName が未設定の場合は prefix を適用しないこと', () => {
      const presetData = {
        node: { name: 'node', databaseHost: undefined, brokerName: undefined },
        gateway: {
          apiNodeName: 'node',
          databaseHost: 'mongo',
          apiNodeHost: undefined,
          apiNodeBrokerHost: undefined,
        },
        database: { name: 'mongo' },
      } as any;
      const service = new ConfigService(logger as any, baseParams(), cryptoPort, networkPort);

      (service as any).applyContainerNamePrefixes(presetData);

      expect(presetData.node.name).toBe('node');
      expect(presetData.gateway.databaseHost).toBe('mongo');
      expect(presetData.database.name).toBe('mongo');
    });

    it('writeOutputFiles はセキュリティモードに従って秘密鍵を除去した値を書き出すこと', async () => {
      const service = new ConfigService(logger as any, baseParams(), cryptoPort, networkPort);
      vi.spyOn(CryptoUtils, 'removePrivateKeysAccordingToSecurityMode').mockReturnValue({
        sanitized: 'addresses',
      });
      vi.spyOn(CryptoUtils, 'removePrivateKeys').mockReturnValue({ sanitized: 'preset' });

      await (service as any).writeOutputFiles(
        { privateKey: 'preset-private-key' },
        { nodes: [{ privateKey: 'address-private-key' }] },
        'password',
        'ENCRYPT'
      );

      expect(YamlUtils.writeYaml).toHaveBeenNthCalledWith(
        1,
        addressesLocation,
        { sanitized: 'addresses' },
        'password'
      );
      expect(YamlUtils.writeYaml).toHaveBeenNthCalledWith(
        2,
        presetLocation,
        { sanitized: 'preset' },
        'password'
      );
    });
  });
});
