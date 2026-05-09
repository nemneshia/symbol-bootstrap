import { beforeEach, describe, expect, it, vi } from 'vitest';

import { existsSync } from 'node:fs';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NemesisConfigurationService } from '../../src/service/NemesisConfigurationService.js';
import { NemgenService } from '../../src/service/NemgenService.js';
import { ConfigurationUtils } from '../../src/utils/ConfigurationUtils.js';
import { HandlebarsUtils } from '../../src/utils/HandlebarsUtils.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    existsSync: vi.fn((path) => original.existsSync(path)),
  };
});

const createService = () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
  };
  const params = {
    target: 'target',
    workingDir: '/work',
    accountResolver: {
      resolveAccount: vi.fn().mockResolvedValue({ privateKey: 'A'.repeat(64) }),
    },
  };
  const transactionPort = {
    createVrfKeyLinkDescriptor: vi.fn().mockReturnValue({ type: 'vrf' }),
    createAccountKeyLinkDescriptor: vi.fn().mockReturnValue({ type: 'remote' }),
    createVotingKeyLinkDescriptor: vi.fn().mockReturnValue({ type: 'voting' }),
    buildSignedPayload: vi.fn().mockResolvedValue('AA'),
    computeTransactionHash: vi.fn().mockImplementation((payload) => payload),
  };
  const fileSystemService = {
    getTargetNemesisFolder: vi.fn().mockReturnValue('target/nemesis/seed'),
    mkdir: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn(),
    validateSeedFolder: vi.fn().mockResolvedValue(undefined),
    copyDir: vi.fn().mockResolvedValue(undefined),
    getTargetNodesFolder: vi
      .fn()
      .mockImplementation((_target, _b, _name, folder) => `target/node/${folder}`),
  };

  const service = new NemesisConfigurationService(
    logger as any,
    params as any,
    { hexToUint8: vi.fn().mockReturnValue(Uint8Array.from([0xab, 0xcd])) } as any,
    fileSystemService as any,
    transactionPort as any
  );

  return { service, logger, fileSystemService, transactionPort, params };
};

describe('NemesisConfigurationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createNemesis=true かつ upgrade=true の場合は生成せず終了すること', async () => {
    const { service, logger, fileSystemService } = createService();
    vi.spyOn(ConfigurationUtils, 'shouldCreateNemesis').mockReturnValue(true);

    await service.resolveNemesis({ preset: 'testnet' } as any, {} as any, true);

    expect(logger.info).toHaveBeenCalledWith(
      'アップグレード時は Nemesis データを生成できません...'
    );
    expect(fileSystemService.deleteFolder).not.toHaveBeenCalled();
  });

  it('createNemesis=true かつ upgrade=false の場合は Nemesis 生成を実行すること', async () => {
    const { service, fileSystemService } = createService();
    vi.spyOn(ConfigurationUtils, 'shouldCreateNemesis').mockReturnValue(true);
    const generateSpy = vi
      .spyOn(service as any, 'generateNemesisConfig')
      .mockResolvedValue(undefined);

    await service.resolveNemesis({ preset: 'testnet', nemesis: {} } as any, {} as any, false);

    expect(fileSystemService.deleteFolder).toHaveBeenCalledWith('target/nemesis/seed');
    expect(generateSpy).toHaveBeenCalledTimes(1);
  });

  it('カスタム nemesisSeedFolder が指定されている場合はその seed をコピーすること', async () => {
    const { service, fileSystemService } = createService();
    vi.spyOn(ConfigurationUtils, 'shouldCreateNemesis').mockReturnValue(false);

    await service.resolveNemesis(
      { preset: 'testnet', nemesisSeedFolder: './custom-seed' } as any,
      {} as any,
      false
    );

    expect(fileSystemService.copyDir).toHaveBeenCalledWith(
      '/work/custom-seed',
      'target/nemesis/seed'
    );
  });

  it('yaml プリセットで seed が未指定の場合は KnownError を投げること', async () => {
    const { service } = createService();
    vi.spyOn(ConfigurationUtils, 'shouldCreateNemesis').mockReturnValue(false);
    vi.spyOn(YamlUtils, 'isYamlFile').mockReturnValue(true);

    await expect(
      service.resolveNemesis({ preset: 'custom.yaml' } as any, {} as any, false)
    ).rejects.toThrow(
      "プリセット custom.yaml の seed が見つかりません。'nemesisSeedFolder' を指定してください。"
    );
  });

  it('ビルトイン seed が存在する場合はコピーすること', async () => {
    const { service, fileSystemService } = createService();
    vi.spyOn(ConfigurationUtils, 'shouldCreateNemesis').mockReturnValue(false);
    vi.spyOn(YamlUtils, 'isYamlFile').mockReturnValue(false);
    vi.mocked(existsSync).mockReturnValue(true);

    await service.resolveNemesis({ preset: 'testnet' } as any, {} as any, false);

    expect(fileSystemService.copyDir).toHaveBeenCalled();
  });

  it('ビルトイン seed が存在しない場合はエラーを投げること', async () => {
    const { service } = createService();
    vi.spyOn(ConfigurationUtils, 'shouldCreateNemesis').mockReturnValue(false);
    vi.spyOn(YamlUtils, 'isYamlFile').mockReturnValue(false);
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(
      service.resolveNemesis({ preset: 'testnet' } as any, {} as any, false)
    ).rejects.toThrow('seed を見つけられませんでした。');
  });

  it('copyNemesis は node がある場合に seed をノード配下へコピーすること', async () => {
    const { service, fileSystemService } = createService();

    await service.copyNemesis({ node: { name: 'api-node' } } as any);

    expect(fileSystemService.mkdir).toHaveBeenCalledWith('target/node/data');
    expect(fileSystemService.copyDir).toHaveBeenCalledWith(
      'target/nemesis/seed',
      'target/node/seed'
    );
  });

  it('copyNemesis は node がない場合でもエラーにならないこと', async () => {
    const { service, fileSystemService } = createService();

    await service.copyNemesis({} as any);

    expect(fileSystemService.copyDir).not.toHaveBeenCalled();
  });

  it('アップグレード時は genesis 更新ログを出して built-in seed をコピーすること', async () => {
    const { service, logger, fileSystemService } = createService();
    vi.spyOn(ConfigurationUtils, 'shouldCreateNemesis').mockReturnValue(false);
    vi.spyOn(YamlUtils, 'isYamlFile').mockReturnValue(false);
    vi.mocked(existsSync).mockReturnValue(true);

    await service.resolveNemesis({ preset: 'testnet' } as any, {} as any, true);

    expect(logger.info).toHaveBeenCalledWith('アップグレードに伴い genesis を更新します。');
    expect(fileSystemService.copyDir).toHaveBeenCalled();
  });

  it('requireNemesisConfig は nemesis 未定義時にエラーを投げること', () => {
    const { service } = createService();

    expect(() => (service as any).requireNemesisConfig({})).toThrow('nemesis が未定義です。');
  });

  it('resolveNemesisNodes は除外指定時に空配列を返すこと', () => {
    const { service } = createService();

    const result = (service as any).resolveNemesisNodes(
      { node: { excludeFromNemesis: true } },
      { node: { name: 'api-node' } }
    );

    expect(result).toEqual([]);
  });

  it('resolveNemesisNodes は node が無い場合に空配列を返すこと', () => {
    const { service } = createService();

    const result = (service as any).resolveNemesisNodes({ node: {} }, {});

    expect(result).toEqual([]);
  });

  it('resolveNemesisNodes は有効 node を1件返すこと', () => {
    const { service } = createService();
    const node = { name: 'api-node' };

    const result = (service as any).resolveNemesisNodes({ node: {} }, { node });

    expect(result).toEqual([node]);
  });

  it('createNodeTransactions は node の鍵種別に応じた作成関数を呼び分けること', async () => {
    const { service } = createService();
    const vrfSpy = vi.spyOn(service as any, 'createVrfTransaction').mockResolvedValue(undefined);
    const remoteSpy = vi
      .spyOn(service as any, 'createAccountKeyLinkTransaction')
      .mockResolvedValue(undefined);
    const votingSpy = vi
      .spyOn(service as any, 'createVotingKeyTransactions')
      .mockResolvedValue(undefined);

    await (service as any).createNodeTransactions(
      'tx-dir',
      { node: {}, networkType: 152, nemesisGenerationHashSeed: 'AA' },
      {
        node: {
          name: 'api-node',
          main: { publicKey: 'MAIN' },
          vrf: { publicKey: 'VRF' },
          remote: { publicKey: 'REMOTE' },
          voting: [{ publicKey: 'VOTE', startEpoch: 1, endEpoch: 1 }],
        },
      }
    );

    expect(vrfSpy).toHaveBeenCalledTimes(1);
    expect(remoteSpy).toHaveBeenCalledTimes(1);
    expect(votingSpy).toHaveBeenCalledTimes(1);
  });

  it('storePresetTransactions は重複ハッシュをスキップすること', async () => {
    const { service, logger, transactionPort } = createService();
    const storeSpy = vi.spyOn(service as any, 'storeTransaction').mockResolvedValue(undefined);
    transactionPort.computeTransactionHash
      .mockReturnValueOnce('HASH')
      .mockReturnValueOnce('HASH')
      .mockReturnValueOnce('HASH-2');

    await (service as any).storePresetTransactions(
      'tx-dir',
      { nemesisGenerationHashSeed: 'SEED', networkType: 152 },
      { a: 'PAYLOAD-A', b: 'PAYLOAD-B', c: 'PAYLOAD-C' }
    );

    expect(storeSpy).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('storePresetTransactions は未指定時に何もしないこと', async () => {
    const { service } = createService();
    const storeSpy = vi.spyOn(service as any, 'storeTransaction').mockResolvedValue(undefined);

    await (service as any).storePresetTransactions(
      'tx-dir',
      { networkType: 152 } as any,
      undefined
    );

    expect(storeSpy).not.toHaveBeenCalled();
  });

  it('generateNemesisConfig はテンプレート生成と nemgen 実行を呼び出すこと', async () => {
    const { service } = createService();
    vi.spyOn(service as any, 'createNodeTransactions').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'storePresetTransactions').mockResolvedValue(undefined);
    const templateSpy = vi
      .spyOn(HandlebarsUtils, 'generateConfiguration')
      .mockResolvedValue(undefined as any);
    const nemgenSpy = vi.spyOn(NemgenService.prototype, 'run').mockResolvedValue(undefined as any);

    await (service as any).generateNemesisConfig(
      {
        nemesis: { transactionsDirectory: 'transactions' },
        transactionsDirectory: 'transactions',
      },
      {}
    );

    expect(templateSpy).toHaveBeenCalledTimes(1);
    expect(nemgenSpy).toHaveBeenCalledTimes(1);
  });

  it('createVrfTransaction は VRF キー未設定時にエラーを投げること', async () => {
    const { service } = createService();

    await expect(
      (service as any).createVrfTransaction('tx-dir', { networkType: 152 } as any, {
        name: 'api-node',
        main: { publicKey: 'MAIN' },
      })
    ).rejects.toThrow('VRF キーが生成されている必要があります。');
  });

  it('createVrfTransaction は Main キー未設定時にエラーを投げること', async () => {
    const { service } = createService();

    await expect(
      (service as any).createVrfTransaction('tx-dir', { networkType: 152 } as any, {
        name: 'api-node',
        vrf: { publicKey: 'VRF' },
      })
    ).rejects.toThrow('Main キーが生成されている必要があります。');
  });

  it('createVrfTransaction は payload を保存すること', async () => {
    const { service, transactionPort, params } = createService();
    const storeSpy = vi.spyOn(service as any, 'storeTransaction').mockResolvedValue(undefined);

    await (service as any).createVrfTransaction(
      'tx-dir',
      { networkType: 152, nemesisGenerationHashSeed: 'SEED' },
      { name: 'api-node', main: { publicKey: 'MAIN' }, vrf: { publicKey: 'VRF' } }
    );

    expect(params.accountResolver.resolveAccount).toHaveBeenCalledTimes(1);
    expect(transactionPort.createVrfKeyLinkDescriptor).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith('tx-dir', 'vrf_api-node', 'AA');
  });

  it('createAccountKeyLinkTransaction は Remote キー未設定時にエラーを投げること', async () => {
    const { service } = createService();

    await expect(
      (service as any).createAccountKeyLinkTransaction('tx-dir', { networkType: 152 } as any, {
        name: 'api-node',
        main: { publicKey: 'MAIN' },
      })
    ).rejects.toThrow('Remote キーが生成されている必要があります。');
  });

  it('createAccountKeyLinkTransaction は payload を保存すること', async () => {
    const { service, transactionPort } = createService();
    const storeSpy = vi.spyOn(service as any, 'storeTransaction').mockResolvedValue(undefined);

    await (service as any).createAccountKeyLinkTransaction(
      'tx-dir',
      { networkType: 152, nemesisGenerationHashSeed: 'SEED' },
      { name: 'api-node', main: { publicKey: 'MAIN' }, remote: { publicKey: 'REMOTE' } }
    );

    expect(transactionPort.createAccountKeyLinkDescriptor).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith('tx-dir', 'remote_api-node', 'AA');
  });

  it('createVotingKeyTransactions は voting ファイルごとに保存処理を行うこと', async () => {
    const { service, transactionPort } = createService();
    const storeSpy = vi.spyOn(service as any, 'storeTransaction').mockResolvedValue(undefined);

    await (service as any).createVotingKeyTransactions(
      'tx-dir',
      { networkType: 152, nemesisGenerationHashSeed: 'SEED' },
      {
        name: 'api-node',
        main: { publicKey: 'MAIN' },
        voting: [
          { publicKey: 'VOTE1', startEpoch: 1, endEpoch: 1 },
          { publicKey: 'VOTE2', startEpoch: 2, endEpoch: 2 },
        ],
      }
    );

    expect(transactionPort.createVotingKeyLinkDescriptor).toHaveBeenCalledTimes(2);
    expect(storeSpy).toHaveBeenCalledTimes(2);
  });

  it('storeTransaction は writeFile に変換済みバイト列を書き込むこと', async () => {
    const { service } = createService();
    const outputDir = mkdtempSync(join(tmpdir(), 'sb-nemesis-store-'));

    try {
      await (service as any).storeTransaction(outputDir, 'name', 'ABCD');
      const actual = readFileSync(join(outputDir, 'name.bin'));
      expect([...actual]).toEqual([0xab, 0xcd]);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('resolvePresetNemesisSeedFolder は未指定時に undefined を返すこと', () => {
    const { service } = createService();

    const result = (service as any).resolvePresetNemesisSeedFolder({});

    expect(result).toBeUndefined();
  });
});
