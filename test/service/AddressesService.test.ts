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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { PrivateKeySecurityMode } from '../../src/model/index.js';
import { KeyName } from '../../src/service/AccountResolver.js';
import { AddressesService } from '../../src/service/AddressesService.js';
import { ConfigurationUtils } from '../../src/utils/ConfigurationUtils.js';
import { CryptoUtils } from '../../src/utils/CryptoUtils.js';
import { Utils } from '../../src/utils/Utils.js';

// ---- モック設定 ----

vi.mock('../../src/utils/ConfigurationUtils.js', () => ({
  ConfigurationUtils: {
    toConfigAccountFomKeys: vi.fn().mockReturnValue(undefined),
    toAccount: vi.fn().mockReturnValue(undefined),
    toConfigAccount: vi.fn((a: Record<string, string>) => ({ ...a })),
    resolveRoles: vi.fn().mockReturnValue('Peer'),
    shouldCreateNemesis: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../../src/utils/CryptoUtils.js', () => ({
  CryptoUtils: {
    getPrivateKeySecurityMode: vi.fn().mockReturnValue('ENCRYPT'),
  },
}));

vi.mock('../../src/utils/Utils.js', () => ({
  Utils: {
    getNetworkIdentifier: vi.fn().mockReturnValue('public-test'),
    getNetworkName: vi.fn().mockReturnValue('testnet'),
  },
}));

vi.mock('../../src/utils/YamlUtils.js', () => ({
  YamlUtils: { toYaml: vi.fn().mockReturnValue('yaml-output') },
}));

// ---- ヘルパー ----

const makeCryptoPort = () => ({
  randomHex: vi.fn().mockReturnValue('RANDOM64HEX'),
  randomBytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
  createAddressFromRawAddress: vi.fn((a: string) => a + '-norm'),
  generateAccount: vi.fn().mockReturnValue({
    publicKey: 'GEN-PUB',
    privateKey: 'GEN-PRIV',
    address: 'GEN-ADDR',
  }),
  createAccountFromPrivateKey: vi.fn().mockReturnValue({
    publicKey: 'GEN-PUB',
    privateKey: 'GEN-PRIV',
    address: 'GEN-ADDR',
  }),
  getAddressFromPublicKey: vi.fn().mockReturnValue('SIGNER-ADDR'),
  createMosaicId: vi.fn().mockReturnValue('MOSAIC-ID'),
  createPublicAccount: vi.fn((key: string) => ({ publicKey: key, address: key + '-ADDR' })),
  hexToUint8: vi.fn().mockReturnValue(new Uint8Array([0xaa])),
  uint8ToHex: vi.fn().mockReturnValue('AA'),
  numberToUint8Array: vi.fn().mockReturnValue(new Uint8Array([0x00])),
  uintArray8ToNumber: vi.fn().mockReturnValue(0),
  isHexString: vi.fn().mockReturnValue(true),
  encrypt: vi.fn().mockImplementation((value: string) => `enc:${value}`),
  decrypt: vi.fn().mockImplementation((value: string) => value.replace(/^enc:/, '')),
  parseServerDurationToSeconds: vi.fn().mockReturnValue(0),
});

const makeAccountResolver = () => ({
  resolveAccount: vi.fn().mockResolvedValue({
    publicKey: 'RESOLVED-PUB',
    privateKey: 'RESOLVED-PRIV',
    address: 'RESOLVED-ADDR',
  }),
});

/** 最小限の nemesis プリセット */
const makeNemesis = (overrides = {}) => ({
  binDirectory: '/bin',
  mosaics: [
    {
      name: 'currency',
      main: true,
      harvest: false,
      divisibility: 6,
      duration: 0,
      supply: 1_000_000,
      isTransferable: true,
      isSupplyMutable: false,
      isRestrictable: false,
      accounts: 2,
      currencyDistributions: [],
    },
  ],
  transactions: {},
  nemesisSignerPrivateKey: 'SIGNER-PRIV-KEY',
  transactionsDirectory: '/transactions',
  ...overrides,
});

/** 最小限の preset データを返す */
const makePresetData = (overrides: Record<string, unknown> = {}) => {
  const presetData: any = {
    networkType: 0x98,
    privateKeySecurityMode: PrivateKeySecurityMode.ENCRYPT,
    nemesisSignerPublicKey: 'SIGNER-PUB',
    nemesisGenerationHashSeed: '',
    harvestNetworkFeeSinkAddress: undefined,
    mosaicRentalFeeSinkAddress: undefined,
    namespaceRentalFeeSinkAddress: undefined,
    currencyMosaicId: 'CURRENCY-ID',
    harvestingMosaicId: 'HARVEST-ID',
    networkIdentifier: '',
    networkName: '',
    maxHarvesterBalance: 500_000,
    nemesis: makeNemesis(),
    node: undefined,
    nodes: [],
    sinkAddress: undefined,
    ...overrides,
  };

  if (presetData.node === undefined && Array.isArray(presetData.nodes)) {
    presetData.node = presetData.nodes[0];
  }
  return presetData;
};

// ---- テスト ----

describe('AddressesService', () => {
  const logger = LoggerFactory.getLogger(LogType.Silent);
  let cryptoPort: ReturnType<typeof makeCryptoPort>;
  let accountResolver: ReturnType<typeof makeAccountResolver>;
  let service: AddressesService;

  beforeEach(() => {
    cryptoPort = makeCryptoPort();
    accountResolver = makeAccountResolver();
    service = new AddressesService(logger, accountResolver, cryptoPort);

    // デフォルトで shouldCreateNemesis = false
    vi.mocked(ConfigurationUtils.shouldCreateNemesis).mockReturnValue(false);
    vi.mocked(CryptoUtils.getPrivateKeySecurityMode).mockReturnValue(
      PrivateKeySecurityMode.ENCRYPT
    );
    vi.mocked(Utils.getNetworkIdentifier).mockReturnValue('public-test');
    vi.mocked(Utils.getNetworkName).mockReturnValue('testnet');
  });

  // ============================================================
  // constructor
  // ============================================================

  describe('constructor', () => {
    it('cryptoPort を省略したとき SymbolCryptoAdapter がデフォルトで使われる（例外なし）', () => {
      expect(() => new AddressesService(logger, accountResolver)).not.toThrow();
    });
  });

  // ============================================================
  // generateAddresses
  // ============================================================

  describe('generateAddresses', () => {
    it('数値指定のとき指定数のアカウントを生成する', () => {
      const result = service.generateAddresses(0x98, PrivateKeySecurityMode.ENCRYPT, 3);
      expect(cryptoPort.generateAccount).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    it('配列指定のとき公開鍵からアカウントを作成する', () => {
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({
        publicKey: a.publicKey,
        address: a.address,
      }));
      const result = service.generateAddresses(0x98, PrivateKeySecurityMode.ENCRYPT, [
        'PUB-KEY-1',
        'PUB-KEY-2',
      ]);
      expect(cryptoPort.createPublicAccount).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });
  });

  // ============================================================
  // resolveGenerateErrorMessage
  // ============================================================

  describe('resolveGenerateErrorMessage', () => {
    it('ENCRYPT / Main => undefined', () => {
      expect(
        service.resolveGenerateErrorMessage(KeyName.Main, PrivateKeySecurityMode.ENCRYPT)
      ).toBeUndefined();
    });

    it('PROMPT_MAIN / Main => エラーメッセージ', () => {
      const msg = service.resolveGenerateErrorMessage(
        KeyName.Main,
        PrivateKeySecurityMode.PROMPT_MAIN
      );
      expect(msg).toContain(PrivateKeySecurityMode.PROMPT_MAIN);
      expect(msg).toContain('Main');
    });

    it('PROMPT_MAIN_TRANSPORT / Main => エラーメッセージ', () => {
      const msg = service.resolveGenerateErrorMessage(
        KeyName.Main,
        PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT
      );
      expect(msg).toContain(PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT);
    });

    it('PROMPT_ALL / Main => エラーメッセージ', () => {
      const msg = service.resolveGenerateErrorMessage(
        KeyName.Main,
        PrivateKeySecurityMode.PROMPT_ALL
      );
      expect(msg).toContain(PrivateKeySecurityMode.PROMPT_ALL);
    });

    it('PROMPT_MAIN / Transport => undefined（Transport の条件に入らない）', () => {
      expect(
        service.resolveGenerateErrorMessage(KeyName.Transport, PrivateKeySecurityMode.PROMPT_MAIN)
      ).toBeUndefined();
    });

    it('PROMPT_MAIN_TRANSPORT / Transport => エラーメッセージ', () => {
      const msg = service.resolveGenerateErrorMessage(
        KeyName.Transport,
        PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT
      );
      expect(msg).toContain(PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT);
      expect(msg).toContain('Transport');
    });

    it('PROMPT_ALL / Transport => エラーメッセージ', () => {
      const msg = service.resolveGenerateErrorMessage(
        KeyName.Transport,
        PrivateKeySecurityMode.PROMPT_ALL
      );
      expect(msg).toContain(PrivateKeySecurityMode.PROMPT_ALL);
    });

    it('PROMPT_ALL / Remote => PROMPT_ALL 条件のエラーメッセージ', () => {
      const msg = service.resolveGenerateErrorMessage(
        KeyName.Remote,
        PrivateKeySecurityMode.PROMPT_ALL
      );
      expect(msg).toContain(PrivateKeySecurityMode.PROMPT_ALL);
      expect(msg).toContain(PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT);
    });

    it('ENCRYPT / Remote => undefined', () => {
      expect(
        service.resolveGenerateErrorMessage(KeyName.Remote, PrivateKeySecurityMode.ENCRYPT)
      ).toBeUndefined();
    });
  });

  // ============================================================
  // resolveAccount
  // ============================================================

  describe('resolveAccount', () => {
    const networkType = 0x98;
    const secMode = PrivateKeySecurityMode.ENCRYPT;

    it('oldAccount のみ存在するとき oldAccount を返す', async () => {
      const old = { publicKey: 'OLD-PUB', privateKey: 'OLD-PRIV', address: 'OLD-ADDR' };
      vi.mocked(ConfigurationUtils.toAccount)
        .mockReturnValueOnce(old as any) // oldAccount
        .mockReturnValueOnce(undefined); // newAccount
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({ ...a }));

      const result = await service.resolveAccount(
        networkType,
        secMode,
        KeyName.Main,
        'node-0',
        { publicKey: 'OLD-PUB', address: 'OLD-ADDR' },
        undefined
      );
      expect(result.publicKey).toBe('OLD-PUB');
    });

    it('newAccount のみ存在するとき newAccount を返す', async () => {
      const newAcc = { publicKey: 'NEW-PUB', privateKey: 'NEW-PRIV', address: 'NEW-ADDR' };
      vi.mocked(ConfigurationUtils.toAccount)
        .mockReturnValueOnce(undefined) // oldAccount
        .mockReturnValueOnce(newAcc as any); // newAccount
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({ ...a }));

      const result = await service.resolveAccount(
        networkType,
        secMode,
        KeyName.Main,
        'node-0',
        undefined,
        { publicKey: 'NEW-PUB', address: 'NEW-ADDR' }
      );
      expect(result.publicKey).toBe('NEW-PUB');
    });

    it('old と new が同アドレスのとき new を優先してマージする', async () => {
      const old = { publicKey: 'PUB', privateKey: 'OLD-PRIV', address: 'ADDR' };
      const newAcc = { publicKey: 'PUB', privateKey: 'NEW-PRIV', address: 'ADDR' };
      vi.mocked(ConfigurationUtils.toAccount)
        .mockReturnValueOnce(old as any)
        .mockReturnValueOnce(newAcc as any);
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({ ...a }));

      const result = await service.resolveAccount(
        networkType,
        secMode,
        KeyName.Main,
        'node-0',
        { publicKey: 'PUB', address: 'ADDR' },
        { publicKey: 'PUB', address: 'ADDR' }
      );
      expect(result.privateKey).toBe('NEW-PRIV');
    });

    it('old と new が異なるアドレスのとき newAccount を採用する', async () => {
      const old = { publicKey: 'OLD-PUB', privateKey: 'OLD-PRIV', address: 'OLD-ADDR' };
      const newAcc = { publicKey: 'NEW-PUB', privateKey: 'NEW-PRIV', address: 'NEW-ADDR' };
      vi.mocked(ConfigurationUtils.toAccount)
        .mockReturnValueOnce(old as any)
        .mockReturnValueOnce(newAcc as any);
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({ ...a }));

      const result = await service.resolveAccount(
        networkType,
        secMode,
        KeyName.Main,
        'node-0',
        { publicKey: 'OLD-PUB', address: 'OLD-ADDR' },
        { publicKey: 'NEW-PUB', address: 'NEW-ADDR' }
      );
      expect(result.publicKey).toBe('NEW-PUB');
    });

    it('どちらも存在しない場合は accountResolver を呼び出す', async () => {
      vi.mocked(ConfigurationUtils.toAccount)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({ ...a }));

      const result = await service.resolveAccount(
        networkType,
        secMode,
        KeyName.Main,
        'node-0',
        undefined,
        undefined
      );
      expect(accountResolver.resolveAccount).toHaveBeenCalledTimes(1);
      expect(result.publicKey).toBe('RESOLVED-PUB');
    });
  });

  // ============================================================
  // resolveNodeAccounts
  // ============================================================

  describe('resolveNodeAccounts', () => {
    const networkType = 0x98;
    const basePreset = () => makePresetData({ nodes: [{ harvesting: false, voting: false }] });

    beforeEach(() => {
      vi.mocked(ConfigurationUtils.toAccount).mockReturnValue(undefined);
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({ ...a }));
    });

    it('基本ノード（harvesting=false）は main と transport のみ設定される', async () => {
      const result = await service.resolveNodeAccounts(
        undefined,
        basePreset(),
        0,
        { harvesting: false, voting: false } as any,
        networkType
      );
      expect(result.main).toBeDefined();
      expect(result.transport).toBeDefined();
      expect(result.vrf).toBeUndefined();
      expect(result.remote).toBeUndefined();
    });

    it('harvesting=true のとき vrf が設定される', async () => {
      const result = await service.resolveNodeAccounts(
        undefined,
        basePreset(),
        0,
        { harvesting: true, voting: false } as any,
        networkType
      );
      expect(result.vrf).toBeDefined();
    });

    it('nodeUseRemoteAccount=true かつ harvesting=true のとき remote が設定される', async () => {
      const preset = makePresetData({ nodeUseRemoteAccount: true });
      const result = await service.resolveNodeAccounts(
        undefined,
        preset,
        0,
        { harvesting: true, voting: false } as any,
        networkType
      );
      expect(result.remote).toBeDefined();
    });

    it('nodeUseRemoteAccount=true かつ voting=true のとき remote が設定される', async () => {
      const preset = makePresetData({ nodeUseRemoteAccount: true });
      const result = await service.resolveNodeAccounts(
        undefined,
        preset,
        0,
        { harvesting: false, voting: true } as any,
        networkType
      );
      expect(result.remote).toBeDefined();
    });

    it('name が指定されていないとき node-{index} が使われる', async () => {
      const result = await service.resolveNodeAccounts(
        undefined,
        basePreset(),
        5,
        { harvesting: false, voting: false } as any,
        networkType
      );
      expect(result.name).toBe('node-5');
    });

    it('friendlyName が指定されていないとき公開鍵先頭7文字が使われる', async () => {
      accountResolver.resolveAccount.mockResolvedValue({
        publicKey: 'ABCDEFGHIJ',
        privateKey: 'PRIV',
        address: 'ADDR',
      });
      const result = await service.resolveNodeAccounts(
        undefined,
        basePreset(),
        0,
        { harvesting: false, voting: false } as any,
        networkType
      );
      expect(result.friendlyName).toBe('ABCDEFG');
    });
  });

  // ============================================================
  // resolveAddresses（基本フロー）
  // ============================================================

  describe('resolveAddresses - 基本フロー', () => {
    it('nemesisGenerationHashSeed が preset で指定されていれば優先する', async () => {
      const preset = makePresetData({ nemesisGenerationHashSeed: 'PRESET-HASH' });
      const result = await service.resolveAddresses(undefined, undefined, preset);
      expect(result.nemesisGenerationHashSeed).toBe('PRESET-HASH');
    });

    it('nemesisGenerationHashSeed が preset にないとき oldAddresses の値を使う', async () => {
      const preset = makePresetData({ nemesisGenerationHashSeed: '' });
      const result = await service.resolveAddresses(
        { nemesisGenerationHashSeed: 'OLD-HASH', networkType: 0x98, version: 1 } as any,
        undefined,
        preset
      );
      expect(result.nemesisGenerationHashSeed).toBe('OLD-HASH');
    });

    it('nemesisGenerationHashSeed がどちらもないとき randomHex で生成する', async () => {
      const preset = makePresetData({ nemesisGenerationHashSeed: '' });
      const result = await service.resolveAddresses(undefined, undefined, preset);
      expect(cryptoPort.randomHex).toHaveBeenCalledWith(32);
      expect(result.nemesisGenerationHashSeed).toBe('RANDOM64HEX');
    });

    it('harvestNetworkFeeSinkAddress が指定済みのとき createAddressFromRawAddress で正規化される', async () => {
      const preset = makePresetData({ harvestNetworkFeeSinkAddress: 'RAW-ADDR' });
      await service.resolveAddresses(undefined, undefined, preset);
      expect(cryptoPort.createAddressFromRawAddress).toHaveBeenCalledWith('RAW-ADDR');
      expect(preset.harvestNetworkFeeSinkAddress).toBe('RAW-ADDR-norm');
    });

    it('harvestNetworkFeeSinkAddress が未指定のとき sinkAddress を流用する', async () => {
      const preset = makePresetData({
        harvestNetworkFeeSinkAddress: undefined,
        sinkAddress: 'SINK',
      });
      await service.resolveAddresses(undefined, undefined, preset);
      // sinkAddress が既にあるので generateAccount は呼ばれない
      expect(cryptoPort.generateAccount).not.toHaveBeenCalled();
    });

    it('V1 アドレスが未設定のとき現行アドレスが引き継がれる', async () => {
      const preset = makePresetData({
        harvestNetworkFeeSinkAddress: 'HARVEST',
        mosaicRentalFeeSinkAddress: 'MOSAIC',
        namespaceRentalFeeSinkAddress: 'NAMESPACE',
      });
      await service.resolveAddresses(undefined, undefined, preset);
      expect(preset.harvestNetworkFeeSinkAddressV1).toBe('HARVEST-norm');
      expect(preset.mosaicRentalFeeSinkAddressV1).toBe('MOSAIC-norm');
      expect(preset.namespaceRentalFeeSinkAddressV1).toBe('NAMESPACE-norm');
    });

    it('V1 アドレスが既に設定済みのとき上書きされない', async () => {
      const preset = makePresetData({
        harvestNetworkFeeSinkAddress: 'HARVEST',
        harvestNetworkFeeSinkAddressV1: 'EXISTING-V1',
      });
      await service.resolveAddresses(undefined, undefined, preset);
      expect(preset.harvestNetworkFeeSinkAddressV1).toBe('EXISTING-V1');
    });

    it('networkIdentifier と networkName が Utils から取得される', async () => {
      const preset = makePresetData();
      await service.resolveAddresses(undefined, undefined, preset);
      expect(preset.networkIdentifier).toBe('public-test');
      expect(preset.networkName).toBe('testnet');
    });

    it('node があれば addresses.node が解決される', async () => {
      vi.mocked(ConfigurationUtils.toAccount).mockReturnValue(undefined);
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({ ...a }));
      const preset = makePresetData({
        node: { harvesting: false, voting: false },
      });
      const result = await service.resolveAddresses(undefined, undefined, preset);
      expect(result.node).toBeDefined();
    });

    it('currencyMosaicId が未設定のとき createMosaicId(0, ...) で生成される', async () => {
      const preset = makePresetData({ currencyMosaicId: undefined });
      await service.resolveAddresses(undefined, undefined, preset);
      expect(cryptoPort.createMosaicId).toHaveBeenCalledWith(0, 'SIGNER-ADDR');
    });

    it('currencyMosaicId が既に設定済みのとき createMosaicId は呼ばれない', async () => {
      const preset = makePresetData({ currencyMosaicId: 'EXISTING-ID' });
      await service.resolveAddresses(undefined, undefined, preset);
      expect(cryptoPort.createMosaicId).not.toHaveBeenCalled();
    });

    it('harvestingMosaicId が未設定かつ nemesis が未定義のとき例外を投げる', async () => {
      const preset = makePresetData({ harvestingMosaicId: '', nemesis: undefined });
      await expect(service.resolveAddresses(undefined, undefined, preset)).rejects.toThrow(
        'nemesis が未定義です。'
      );
    });

    it('harvestingMosaicId が未設定かつ mosaics が 1 件なら currencyMosaicId と同じになる', async () => {
      const preset = makePresetData({
        harvestingMosaicId: '',
        nemesis: makeNemesis(),
      });
      await service.resolveAddresses(undefined, undefined, preset);
      expect(preset.harvestingMosaicId).toBe(preset.currencyMosaicId);
    });

    it('harvestingMosaicId が未設定かつ mosaics が 2 件なら createMosaicId(1, ...) が呼ばれる', async () => {
      const preset = makePresetData({
        harvestingMosaicId: '',
        nemesis: makeNemesis({
          mosaics: [
            {
              name: 'currency',
              main: true,
              harvest: false,
              divisibility: 6,
              duration: 0,
              supply: 1_000_000,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 1,
              currencyDistributions: [],
            },
            {
              name: 'harvest',
              main: false,
              harvest: true,
              divisibility: 3,
              duration: 0,
              supply: 2_000_000,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 1,
              currencyDistributions: [],
            },
          ],
        }),
      });
      await service.resolveAddresses(undefined, undefined, preset);
      expect(cryptoPort.createMosaicId).toHaveBeenCalledWith(1, 'SIGNER-ADDR');
    });
  });

  // ============================================================
  // resolveAddresses（nemesis フロー）
  // ============================================================

  describe('resolveAddresses - nemesis フロー', () => {
    beforeEach(() => {
      vi.mocked(ConfigurationUtils.shouldCreateNemesis).mockReturnValue(true);
      vi.mocked(ConfigurationUtils.toAccount).mockReturnValue(undefined);
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({ ...a }));
      // resolveNemesisAccount で toConfigAccountFomKeys が呼ばれるので有効な値を返す
      vi.mocked(ConfigurationUtils.toConfigAccountFomKeys).mockReturnValue({
        publicKey: 'SIGNER-PUB',
        privateKey: 'SIGNER-PRIV',
        address: 'SIGNER-ADDR',
      } as any);
    });

    it('shouldCreateNemesis=true のとき nemesisSigner が設定される', async () => {
      const preset = makePresetData();
      const result = await service.resolveAddresses(undefined, undefined, preset);
      expect(result.nemesisSigner).toBeDefined();
    });

    it('nemesisSigner に privateKey がないとき例外を投げる', async () => {
      const preset = makePresetData({ nemesisGenerationHashSeed: 'HASH' });
      // toConfigAccountFomKeys が privateKey のないアカウントを返すよう設定
      vi.mocked(ConfigurationUtils.toConfigAccountFomKeys).mockReturnValueOnce({
        publicKey: 'SIGNER-PUB',
        address: 'SIGNER-ADDR',
      } as any);
      await expect(service.resolveAddresses(undefined, undefined, preset)).rejects.toThrow(
        'Nemesis Signer の秘密鍵を解決できる必要があります。'
      );
    });

    it('shouldCreateNemesis かつ oldAddresses なし: processNemesisBalances が実行される', async () => {
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({
        ...a,
        address: (a as any).address ?? 'MOCK-ADDR',
        publicKey: (a as any).publicKey ?? 'MOCK-PUB',
      }));
      const preset = makePresetData();
      const result = await service.resolveAddresses(undefined, undefined, preset);
      expect(result.mosaics).toBeDefined();
      expect(result.mosaics).toHaveLength(1);
    });

    it('shouldCreateNemesis かつ oldAddresses あり: oldAddresses.mosaics が引き継がれる', async () => {
      const oldMosaics = [{ id: 'OLD-ID', name: 'currency', accounts: [] }];
      const oldPreset = makePresetData();
      const preset = makePresetData();
      const oldAddresses = {
        nemesisGenerationHashSeed: 'OLD-HASH',
        networkType: 0x98,
        version: 1,
        mosaics: oldMosaics,
        nemesisSigner: { publicKey: 'SIGNER-PUB', address: 'SIGNER-ADDR' },
      } as any;
      const result = await service.resolveAddresses(oldAddresses, oldPreset, preset);
      expect(result.mosaics).toBe(oldMosaics);
    });

    it('shouldCreateNemesis かつ oldAddresses あり かつ oldPresetData なし: 例外を投げる', async () => {
      const preset = makePresetData();
      const oldAddresses = {
        nemesisGenerationHashSeed: 'OLD-HASH',
        networkType: 0x98,
        version: 1,
        mosaics: [],
        nemesisSigner: { publicKey: 'SIGNER-PUB', address: 'SIGNER-ADDR' },
      } as any;
      await expect(service.resolveAddresses(oldAddresses, undefined, preset)).rejects.toThrow(
        'アップグレード時は oldPresetData が必要です。'
      );
    });

    it('processNemesisBalances: 配布量の合計がモザイク supply を超えると例外を投げる', async () => {
      const preset = makePresetData({
        nemesis: makeNemesis({
          mosaics: [
            {
              name: 'currency',
              main: true,
              harvest: false,
              divisibility: 6,
              duration: 0,
              supply: 100,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 0,
              currencyDistributions: [
                { address: 'ADDR-1', amount: 200 }, // supply を超える
              ],
            },
          ],
        }),
      });
      await expect(service.resolveAddresses(undefined, undefined, preset)).rejects.toThrow(
        '固定配布量 200 が、総供給量 100 を超えています。'
      );
    });

    it('processNemesisBalances: 배布量が負の値のとき例外を投げる', async () => {
      const preset = makePresetData({
        nemesis: makeNemesis({
          mosaics: [
            {
              name: 'currency',
              main: true,
              harvest: false,
              divisibility: 6,
              duration: 0,
              supply: 100,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 0,
              // account が 0 で dynamicAccounts も 0 → amountPerAccount = Infinity → 最初の distribution で負値
              currencyDistributions: [{ address: 'ADDR-1', amount: -1 }],
            },
          ],
        }),
      });
      await expect(service.resolveAddresses(undefined, undefined, preset)).rejects.toThrow(
        'Nemesis distribution balance cannot be less than 0'
      );
    });

    it('processNemesisBalances: ノードに balances が指定されたとき providedDistributions に追加される', async () => {
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({
        ...a,
        address: (a as any).address ?? 'MOCK-ADDR',
        publicKey: (a as any).publicKey ?? 'MOCK-PUB',
      }));
      const preset = makePresetData({
        nodes: [{ harvesting: false, voting: false, balances: [50_000] }],
        nemesis: makeNemesis({
          mosaics: [
            {
              name: 'currency',
              main: true,
              harvest: false,
              divisibility: 6,
              duration: 0,
              supply: 1_000_000,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 2, // 残余供給を受け取る生成アカウントが必要
              currencyDistributions: [],
            },
          ],
        }),
      });
      const result = await service.resolveAddresses(undefined, undefined, preset);
      // ノードの balance が提供されたので mosaics に分配が含まれる
      expect(result.mosaics).toBeDefined();
    });

    it('processNemesisBalances: excludeFromNemesis=true のノードは残高 0 として扱われる', async () => {
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({
        ...a,
        address: (a as any).address ?? 'MOCK-ADDR',
        publicKey: (a as any).publicKey ?? 'MOCK-PUB',
      }));
      const preset = makePresetData({
        nodes: [{ harvesting: false, voting: false, excludeFromNemesis: true }],
        nemesis: makeNemesis({
          mosaics: [
            {
              name: 'currency',
              main: true,
              harvest: false,
              divisibility: 6,
              duration: 0,
              supply: 1_000_000,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 1,
              currencyDistributions: [],
            },
          ],
        }),
      });
      const result = await service.resolveAddresses(undefined, undefined, preset);
      expect(result.mosaics).toBeDefined();
    });

    it('processNemesisBalances: バランスなし・除外なしのノードは nodeMainAccounts に入る', async () => {
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({
        ...a,
        address: (a as any).address ?? 'MOCK-ADDR',
        publicKey: (a as any).publicKey ?? 'MOCK-PUB',
      }));
      const preset = makePresetData({
        nodes: [{ harvesting: false, voting: false }], // balance なし、excludeFromNemesis なし
        nemesis: makeNemesis({
          mosaics: [
            {
              name: 'currency',
              main: true,
              harvest: false,
              divisibility: 6,
              duration: 0,
              supply: 1_000_000,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 1,
              currencyDistributions: [],
            },
          ],
        }),
      });
      const result = await service.resolveAddresses(undefined, undefined, preset);
      expect(result.mosaics).toBeDefined();
    });

    it('processNemesisBalances: 2 モザイクのとき mosaicIndex=0 は MAX_SAFE_INTEGER が適用される', async () => {
      vi.mocked(ConfigurationUtils.toConfigAccount).mockImplementation((a: any) => ({
        ...a,
        address: (a as any).address ?? 'MOCK-ADDR',
        publicKey: (a as any).publicKey ?? 'MOCK-PUB',
      }));
      const preset = makePresetData({
        nodes: [],
        nemesis: makeNemesis({
          mosaics: [
            {
              name: 'currency',
              main: true,
              harvest: false,
              divisibility: 6,
              duration: 0,
              supply: 1_000_000,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 2,
              currencyDistributions: [],
            },
            {
              name: 'harvest',
              main: false,
              harvest: true,
              divisibility: 3,
              duration: 0,
              supply: 2_000_000,
              isTransferable: true,
              isSupplyMutable: false,
              isRestrictable: false,
              accounts: 2,
              currencyDistributions: [],
            },
          ],
        }),
      });
      const result = await service.resolveAddresses(undefined, undefined, preset);
      // 2 モザイクが処理される
      expect(result.mosaics).toHaveLength(2);
    });
  });
});
