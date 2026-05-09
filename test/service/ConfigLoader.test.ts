import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { NetworkType } from '../../src/sdk/index.js';
import { ConfigLoader } from '../../src/service/ConfigLoader.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
  };
});

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    copyFile: vi.fn(actual.copyFile),
  };
});

describe('ConfigLoader', () => {
  const existsSyncMock = vi.mocked(existsSync);
  const copyFileMock = vi.mocked(copyFile);
  const logger = LoggerFactory.getLogger(LogType.Silent);
  let loader: ConfigLoader;
  let tempDir: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    ConfigLoader.presetInfoLogged = false;
    loader = new ConfigLoader(logger);
    tempDir = mkdtempSync(join(tmpdir(), 'config-loader-test-'));
    existsSyncMock.mockClear();
    copyFileMock.mockClear();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadCustomPreset', () => {
    it('undefined を渡した場合は空オブジェクトを返すこと', () => {
      expect(loader.loadCustomPreset(undefined, false)).toEqual({});
    });

    it('存在しないファイルを渡した場合は KnownError をスローすること', async () => {
      const { KnownError } = await import('../../src/errors/KnownError.js');

      expect(() => loader.loadCustomPreset('/non/existent/file.yml', false)).toThrow(KnownError);
    });

    it('存在するファイルを読み込むこと', () => {
      const customPreset = join(tempDir, 'custom-preset.yml');
      const loadedPreset = { preset: 'testnet', assembly: 'dual' };
      writeFileSync(customPreset, 'preset: testnet\nassembly: dual\n');
      vi.spyOn(YamlUtils, 'loadYaml').mockReturnValue(loadedPreset);

      const result = loader.loadCustomPreset(customPreset, 'pass');

      expect(result).toEqual(loadedPreset);
      expect(YamlUtils.loadYaml).toHaveBeenCalledWith(customPreset, 'pass');
    });
  });

  describe('bundled preset loaders', () => {
    it('shared.yaml を読み込んで返すこと', () => {
      const result = ConfigLoader.loadSharedPreset();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('バンドル済みの network preset を読み込めること', () => {
      const result = ConfigLoader.loadNetworkPreset('testnet', '.');

      expect(result).toBeDefined();
      expect(result.networkType).toBeDefined();
    });

    it('YAML ファイルパスで network preset を読み込めること', () => {
      const presetFile = join(tempDir, 'custom-network.yaml');
      writeFileSync(presetFile, 'foo: bar\n');

      const result = ConfigLoader.loadNetworkPreset(presetFile, '.');

      expect(result).toEqual({ foo: 'bar' });
    });

    it('存在しないプリセットで KnownError をスローすること', async () => {
      const { KnownError } = await import('../../src/errors/KnownError.js');

      expect(() => ConfigLoader.loadNetworkPreset('nonexistent', '.')).toThrow(KnownError);
    });

    it('バンドル済みの assembly を読み込めること', () => {
      const result = ConfigLoader.loadAssembly('testnet', 'dual', '.');

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('存在しないアセンブリで KnownError をスローすること', async () => {
      const { KnownError } = await import('../../src/errors/KnownError.js');

      expect(() => ConfigLoader.loadAssembly('testnet', 'nonexistent-assembly', '.')).toThrow(
        KnownError
      );
    });
  });

  describe('mergePresets', () => {
    it('複数のプリセットを深くマージすること', () => {
      const base = { a: 1, b: { c: 2 } } as any;
      const overlay = { b: { d: 3 }, e: 4 } as any;

      expect(loader.mergePresets(base, overlay)).toEqual({
        a: 1,
        b: { c: 2, d: 3 },
        e: 4,
      });
    });

    it('配列型の特殊フィールドは後ろの空でない値を優先すること', () => {
      const result = loader.mergePresets(
        {
          inflation: { AAA: 1 },
          knownRestGateways: ['rest-1'],
          knownPeers: ['peer-1'],
        } as any,
        {
          inflation: { BBB: 2 },
          knownRestGateways: [],
          knownPeers: ['peer-2'],
        } as any,
        {
          knownRestGateways: ['rest-2'],
        } as any
      ) as any;

      expect(result.inflation).toEqual({ BBB: 2 });
      expect(result.knownRestGateways).toEqual(['rest-2']);
      expect(result.knownPeers).toEqual(['peer-2']);
    });
  });

  describe('createPresetData', () => {
    it('shared / network / assembly / custom をマージして preset を生成すること', () => {
      vi.spyOn(loader, 'loadCustomPreset').mockReturnValue({ nodes: [{ api: true }] } as any);
      vi.spyOn(ConfigLoader, 'loadSharedPreset').mockReturnValue({
        networkType: NetworkType.TEST_NET,
        nodes: [{ name: 'default-node' }],
      } as any);
      vi.spyOn(ConfigLoader, 'loadNetworkPreset').mockReturnValue({
        nodes: [{ name: 'network-node', harvesting: true, api: true }],
        inflation: { ABC: 1 },
      } as any);
      vi.spyOn(ConfigLoader, 'loadAssembly').mockReturnValue({
        nodes: [{ name: 'assembly-node', api: true }],
        knownPeers: ['peer-1'],
      } as any);
      const logSpy = vi.spyOn(logger, 'info');

      const result = loader.createPresetData({
        workingDir: '.',
        password: false,
        preset: 'testnet',
        assembly: 'dual',
        customPreset: 'custom.yml',
        customPresetObject: {
          node: { name: 'custom-node', api: true },
          knownRestGateways: ['rest-1'],
        } as any,
      });

      expect(result.version).toBe(1);
      expect(result.preset).toBe('testnet');
      expect(result.assembly).toBe('dual');
      expect(result.customPresetCache).toEqual({
        node: { api: true, name: 'custom-node' },
        nodes: [{ api: true }],
        knownRestGateways: ['rest-1'],
      });
      expect(result.node).toEqual(
        expect.objectContaining({
          name: 'custom-node',
          api: true,
          syncsource: false,
          filespooling: true,
          mongo: true,
          zeromq: true,
          partialtransaction: true,
          addressextraction: true,
          enableAutoSyncCleanup: false,
        })
      );
      expect(result.knownPeers).toEqual(['peer-1']);
      expect(result.knownRestGateways).toEqual(['rest-1']);
      expect(logSpy).toHaveBeenCalledWith("プリセット 'testnet' から設定を生成します");
      expect(logSpy).toHaveBeenCalledWith("アセンブリ 'dual' を使用します");
      expect(logSpy).toHaveBeenCalledWith("カスタムプリセットファイル 'custom.yml' を使用します");
      expect(ConfigLoader.presetInfoLogged).toBe(true);
    });

    it('カスタム preset が空なら oldPresetData.customPresetCache を使うこと', () => {
      vi.spyOn(loader, 'loadCustomPreset').mockReturnValue({});
      vi.spyOn(ConfigLoader, 'loadSharedPreset').mockReturnValue({
        networkType: NetworkType.TEST_NET,
      } as any);
      vi.spyOn(ConfigLoader, 'loadNetworkPreset').mockReturnValue({} as any);
      vi.spyOn(ConfigLoader, 'loadAssembly').mockReturnValue({} as any);

      const result = loader.createPresetData({
        workingDir: '.',
        password: false,
        preset: 'testnet',
        assembly: 'dual',
        oldPresetData: {
          preset: 'testnet',
          assembly: 'dual',
          customPresetCache: { node: { name: 'cached-node', harvesting: true } },
        } as any,
      });

      expect(result.customPresetCache).toEqual({
        node: { name: 'cached-node', harvesting: true },
      });
      expect(result.node).toEqual(
        expect.objectContaining({
          name: 'cached-node',
          harvesting: true,
          syncsource: true,
          filespooling: false,
          enableAutoSyncCleanup: true,
        })
      );
    });

    it('preset が解決できない場合は KnownError をスローすること', async () => {
      const { KnownError } = await import('../../src/errors/KnownError.js');
      vi.spyOn(loader, 'loadCustomPreset').mockReturnValue({});

      expect(() =>
        loader.createPresetData({
          workingDir: '.',
          password: false,
        })
      ).toThrow(KnownError);
    });

    it('assembly が解決できない場合は KnownError をスローすること', async () => {
      const { KnownError } = await import('../../src/errors/KnownError.js');
      vi.spyOn(loader, 'loadCustomPreset').mockReturnValue({});

      expect(() =>
        loader.createPresetData({
          workingDir: '.',
          password: false,
          preset: 'testnet',
        })
      ).toThrow(KnownError);
    });

    it('networkType が解決できない場合は Error をスローすること', () => {
      vi.spyOn(loader, 'loadCustomPreset').mockReturnValue({});
      vi.spyOn(ConfigLoader, 'loadSharedPreset').mockReturnValue({} as any);
      vi.spyOn(ConfigLoader, 'loadNetworkPreset').mockReturnValue({} as any);
      vi.spyOn(ConfigLoader, 'loadAssembly').mockReturnValue({} as any);

      expect(() =>
        loader.createPresetData({
          workingDir: '.',
          password: false,
          preset: 'testnet',
          assembly: 'dual',
        })
      ).toThrow('ネットワークタイプを解決できませんでした');
    });

    it('preset 情報は 2 回目以降ログ出力しないこと', () => {
      vi.spyOn(loader, 'loadCustomPreset').mockReturnValue({});
      vi.spyOn(ConfigLoader, 'loadSharedPreset').mockReturnValue({
        networkType: NetworkType.TEST_NET,
      } as any);
      vi.spyOn(ConfigLoader, 'loadNetworkPreset').mockReturnValue({} as any);
      vi.spyOn(ConfigLoader, 'loadAssembly').mockReturnValue({} as any);
      const logSpy = vi.spyOn(logger, 'info');

      loader.createPresetData({
        workingDir: '.',
        password: false,
        preset: 'testnet',
        assembly: 'dual',
      });
      loader.createPresetData({
        workingDir: '.',
        password: false,
        preset: 'testnet',
        assembly: 'dual',
      });

      expect(
        logSpy.mock.calls.filter(([message]) => message.includes('設定を生成します')).length
      ).toBe(1);
    });
  });

  describe('template helpers', () => {
    it('dynamicDefaultNodeConfiguration はロール別の既定値を適用すること', () => {
      const full = loader.dynamicDefaultNodeConfiguration({
        name: 'full',
        api: true,
        harvesting: true,
      });
      const api = loader.dynamicDefaultNodeConfiguration({
        name: 'api',
        api: true,
        harvesting: false,
      });
      const peer = loader.dynamicDefaultNodeConfiguration({
        name: 'peer',
        api: false,
        harvesting: false,
      });

      expect(full).toEqual(
        expect.objectContaining({
          syncsource: true,
          filespooling: true,
          partialtransaction: true,
          addressextraction: true,
          mongo: true,
          zeromq: true,
          enableAutoSyncCleanup: false,
        })
      );
      expect(api).toEqual(
        expect.objectContaining({
          syncsource: false,
          filespooling: true,
          partialtransaction: true,
          addressextraction: true,
          mongo: true,
          zeromq: true,
          enableAutoSyncCleanup: false,
        })
      );
      expect(peer).toEqual(
        expect.objectContaining({
          syncsource: true,
          filespooling: false,
          partialtransaction: false,
          addressextraction: false,
          zeromq: false,
          enableAutoSyncCleanup: true,
        })
      );
    });

    it('toConfig は privateKey の有無で戻り値を切り替えること', () => {
      expect(
        ConfigLoader.toConfig({
          privateKey: 'PRIVATE',
          publicKey: 'PUBLIC',
          address: 'ADDRESS',
        } as any)
      ).toEqual({
        privateKey: 'PRIVATE',
        publicKey: 'PUBLIC',
        address: 'ADDRESS',
      });

      expect(
        ConfigLoader.toConfig({
          publicKey: 'PUBLIC',
          address: 'ADDRESS',
        } as any)
      ).toEqual({
        publicKey: 'PUBLIC',
        address: 'ADDRESS',
      });
    });
  });

  describe('existing preset helpers', () => {
    it('loadExistingPresetDataIfPreset はファイルがなければ undefined を返すこと', () => {
      const missingPresetPath = join(tempDir, 'missing-preset.yaml');
      vi.spyOn(loader, 'getGeneratedPresetLocation').mockReturnValue(missingPresetPath);

      expect(loader.loadExistingPresetDataIfPreset('target', false)).toBeUndefined();
    });

    it('loadExistingPresetDataIfPreset は preset.yaml を読み込むこと', () => {
      const presetPath = join(tempDir, 'preset.yaml');
      writeFileSync(presetPath, 'preset: testnet\n');
      vi.spyOn(loader, 'getGeneratedPresetLocation').mockReturnValue(presetPath);
      vi.spyOn(YamlUtils, 'loadYaml').mockReturnValue({ preset: 'testnet' });

      expect(loader.loadExistingPresetDataIfPreset('target', false)).toEqual({ preset: 'testnet' });
      expect(YamlUtils.loadYaml).toHaveBeenCalledWith(presetPath, false);
    });

    it('loadExistingPresetData はファイルがない場合にエラーをスローすること', () => {
      vi.spyOn(loader, 'getGeneratedPresetLocation').mockReturnValue('target/preset.yml');

      expect(() => loader.loadExistingPresetData('target', false)).toThrow(
        'ファイル target/preset.yml が存在しません'
      );
    });

    it('getGeneratedPresetLocation は preset.yaml を返すこと', () => {
      expect(loader.getGeneratedPresetLocation('abc')).toBe(join('abc', 'preset.yaml'));
    });
  });

  describe('existing addresses helpers', () => {
    it('loadExistingAddressesIfPreset はファイルがなければ undefined を返すこと', () => {
      const missingAddressPath = join(tempDir, 'missing-addresses.yaml');
      vi.spyOn(loader, 'getGeneratedAddressLocation').mockReturnValue(missingAddressPath);

      expect(loader.loadExistingAddressesIfPreset('target', false)).toBeUndefined();
    });

    it('通常の addresses を読み込んでそのまま返すこと', () => {
      const addressPath = join(tempDir, 'addresses.yaml');
      const loadedAddresses = { version: 1, networkType: NetworkType.TEST_NET };
      writeFileSync(addressPath, 'version: 1\n');
      vi.spyOn(loader, 'getGeneratedAddressLocation').mockReturnValue(addressPath);
      vi.spyOn(YamlUtils, 'loadYamlWithUpgradeInfo').mockReturnValue({
        data: loadedAddresses,
        hasLegacyUpgrade: false,
        filePath: addressPath,
      });

      const result = loader.loadExistingAddressesIfPreset('target', false);

      expect(result).toEqual(loadedAddresses);
      expect(YamlUtils.loadYamlWithUpgradeInfo).toHaveBeenCalledWith(addressPath, false);
    });

    it('legacy encryption を検出した場合は backup と再保存を非同期実行すること', async () => {
      const addressPath = join(tempDir, 'addresses.yaml');
      const loadedAddresses = { version: 1, networkType: NetworkType.TEST_NET };
      const warnSpy = vi.spyOn(logger, 'warn');
      const infoSpy = vi.spyOn(logger, 'info');
      writeFileSync(addressPath, 'version: 1\n');
      vi.spyOn(loader, 'getGeneratedAddressLocation').mockReturnValue(addressPath);
      vi.spyOn(YamlUtils, 'loadYamlWithUpgradeInfo').mockReturnValue({
        data: loadedAddresses,
        hasLegacyUpgrade: true,
        filePath: addressPath,
      });
      vi.spyOn(YamlUtils, 'writeYaml').mockResolvedValue(undefined);
      copyFileMock.mockResolvedValue(undefined);

      const result = loader.loadExistingAddressesIfPreset('target', 'pass');
      await Promise.resolve();
      await Promise.resolve();

      expect(result).toEqual(loadedAddresses);
      expect(copyFileMock).toHaveBeenCalledWith(addressPath, `${addressPath}.bk`);
      expect(YamlUtils.writeYaml).toHaveBeenCalledWith(addressPath, loadedAddresses, 'pass');
      expect(warnSpy).toHaveBeenCalledWith(
        `${addressPath} でレガシー暗号化を検出しました。より強力な暗号化へアップグレードします...`
      );
      expect(infoSpy).toHaveBeenCalledWith('バックアップの作成に成功しました');
    });

    it('legacy encryption でも password がなければアップグレードしないこと', () => {
      const addressPath = join(tempDir, 'addresses.yaml');
      writeFileSync(addressPath, 'version: 1\n');
      vi.spyOn(loader, 'getGeneratedAddressLocation').mockReturnValue(addressPath);
      vi.spyOn(YamlUtils, 'loadYamlWithUpgradeInfo').mockReturnValue({
        data: { version: 1, networkType: NetworkType.TEST_NET },
        hasLegacyUpgrade: true,
        filePath: addressPath,
      });
      const writeYamlSpy = vi.spyOn(YamlUtils, 'writeYaml').mockResolvedValue(undefined);

      loader.loadExistingAddressesIfPreset('target', false);

      expect(copyFileMock).not.toHaveBeenCalled();
      expect(writeYamlSpy).not.toHaveBeenCalled();
    });

    it('非同期アップグレード失敗時は error ログを出すこと', async () => {
      const addressPath = join(tempDir, 'addresses.yaml');
      const errorSpy = vi.spyOn(logger, 'error');
      copyFileMock.mockRejectedValue(new Error('copy failed'));

      (loader as any).upgradeEncryptionAsync(
        addressPath,
        { version: 1, networkType: NetworkType.TEST_NET },
        'pass'
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(errorSpy).toHaveBeenCalledWith(
        `${addressPath} の暗号化アップグレードに失敗しました: copy failed`
      );
    });

    it('loadExistingAddresses はファイルがない場合にエラーをスローすること', () => {
      vi.spyOn(loader, 'getGeneratedAddressLocation').mockReturnValue('target/addresses.yml');

      expect(() => loader.loadExistingAddresses('target', false)).toThrow(
        'ファイル target/addresses.yml が存在しません'
      );
    });

    it('getGeneratedAddressLocation は addresses.yaml を返すこと', () => {
      expect(loader.getGeneratedAddressLocation('abc')).toBe(join('abc', 'addresses.yaml'));
    });
  });
});
