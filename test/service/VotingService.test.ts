import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NetworkType } from '../../src/sdk/index.js';
import { FileSystemService } from '../../src/service/FileSystemService.js';
import {
  CatapultVotingKeyFileProvider,
  NativeVotingKeyFileProvider,
} from '../../src/service/VotingKeyFileProvider.js';
import { VotingService } from '../../src/service/VotingService.js';
import { VotingUtils } from '../../src/utils/VotingUtils.js';

const createPreset = (overrides: Record<string, unknown> = {}) =>
  ({
    networkType: NetworkType.TEST_NET,
    lastKnownNetworkEpoch: 1,
    autoUpdateVotingKeys: true,
    votingKeysDirectory: 'votingkeys',
    votingKeyDesiredFutureLifetime: 10,
    votingKeyDesiredLifetime: 20,
    useExperimentalNativeVotingKeyGeneration: false,
    symbolServerImage: 'symbol/server:latest',
    catapultAppFolder: '/catapult',
    ...overrides,
  }) as any;

const createNodeAccount = () =>
  ({
    name: 'api-node',
    friendlyName: 'api-node',
    roles: 'Peer',
    main: { address: 'TALICE', publicKey: 'A'.repeat(64) },
    transport: { address: 'TBALICE', publicKey: 'B'.repeat(64) },
  }) as any;

const createNodePreset = (voting: boolean) =>
  ({
    name: 'api-node',
    harvesting: true,
    api: true,
    voting,
    excludeFromNemesis: false,
  }) as any;

/**
 * VotingService の主要分岐を網羅するユニットテスト。
 */
describe('VotingService', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const cryptoPort = {} as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();

    vi.spyOn(FileSystemService.prototype, 'getTargetNodesFolder').mockReturnValue('/target/api');
    vi.spyOn(FileSystemService.prototype, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(FileSystemService.prototype, 'deleteFile').mockImplementation(() => {});
  });

  it('ノードの voting 設定が無効な場合は何もせず終了すること', async () => {
    vi.spyOn(VotingUtils.prototype, 'loadVotingFiles').mockReturnValue([]);
    const service = new VotingService(
      logger as any,
      { target: 'target', user: 'user' },
      cryptoPort
    );

    const result = await service.run(
      createPreset(),
      createNodeAccount(),
      createNodePreset(false),
      10,
      true,
      false
    );

    expect(result).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('投票設定が無効'));
  });

  it('投票キー寿命設定が不正な場合は例外を送出すること', async () => {
    vi.spyOn(VotingUtils.prototype, 'loadVotingFiles').mockReturnValue([]);
    const service = new VotingService(
      logger as any,
      { target: 'target', user: 'user' },
      cryptoPort
    );

    await expect(
      service.run(
        createPreset({ votingKeyDesiredFutureLifetime: 11, votingKeyDesiredLifetime: 10 }),
        createNodeAccount(),
        createNodePreset(true),
        10,
        true,
        false
      )
    ).rejects.toThrow(
      'votingKeyDesiredFutureLifetime (11) cannot be greater than votingKeyDesiredLifetime (10)'
    );
  });

  it('既存投票キーが十分先まである場合は更新しないこと', async () => {
    vi.spyOn(VotingUtils.prototype, 'loadVotingFiles').mockReturnValue([
      { filename: 'private_key_tree1.dat', publicKey: 'A'.repeat(64), startEpoch: 1, endEpoch: 40 },
    ] as any);
    const provider = { createVotingFile: vi.fn() };
    const service = new VotingService(
      logger as any,
      { target: 'target', user: 'user', votingKeyFileProvider: provider as any },
      cryptoPort
    );
    const nodeAccount = createNodeAccount();

    const result = await service.run(
      createPreset(),
      nodeAccount,
      createNodePreset(true),
      20,
      true,
      false
    );

    expect(result).toBe(false);
    expect(provider.createVotingFile).not.toHaveBeenCalled();
    expect(nodeAccount.voting).toHaveLength(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('投票ファイルは最新です'));
  });

  it('既存キーがあり自動更新を行わない場合は警告を表示して終了すること', async () => {
    vi.spyOn(VotingUtils.prototype, 'loadVotingFiles').mockReturnValue([
      { filename: 'private_key_tree1.dat', publicKey: 'A'.repeat(64), startEpoch: 1, endEpoch: 11 },
    ] as any);
    const provider = { createVotingFile: vi.fn() };
    const service = new VotingService(
      logger as any,
      { target: 'target', user: 'user', votingKeyFileProvider: provider as any },
      cryptoPort
    );

    const result = await service.run(
      createPreset({ autoUpdateVotingKeys: false }),
      createNodeAccount(),
      createNodePreset(true),
      10,
      undefined,
      false
    );

    expect(result).toBe(false);
    expect(provider.createVotingFile).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('updateVotingKeys'));
  });

  it('更新が必要な場合はプロバイダーで投票ファイルを生成し voting 情報を再読込すること', async () => {
    vi.spyOn(VotingUtils.prototype, 'loadVotingFiles')
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          filename: 'private_key_tree1.dat',
          publicKey: 'F'.repeat(64),
          startEpoch: 10,
          endEpoch: 29,
        },
      ] as any);
    const provider = {
      createVotingFile: vi.fn().mockResolvedValue({ publicKey: 'F'.repeat(64) }),
    };
    const service = new VotingService(
      logger as any,
      { target: 'target', user: 'user', votingKeyFileProvider: provider as any },
      cryptoPort
    );
    const nodeAccount = createNodeAccount();

    const result = await service.run(
      createPreset(),
      nodeAccount,
      createNodePreset(true),
      10,
      true,
      false
    );

    expect(result).toBe(true);
    expect(provider.createVotingFile).toHaveBeenCalledWith(
      expect.objectContaining({
        votingKeysFolder: '/target/api/votingkeys',
        privateKeyTreeFileName: 'private_key_tree1.dat',
        votingKeyStartEpoch: 10,
        votingKeyEndEpoch: 29,
      })
    );
    expect(nodeAccount.voting).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Voting Public Key'));
  });

  it('nemesis ブロック向け生成では手動リンク警告を出さないこと', async () => {
    vi.spyOn(VotingUtils.prototype, 'loadVotingFiles')
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const provider = {
      createVotingFile: vi.fn().mockResolvedValue({ publicKey: 'E'.repeat(64) }),
    };
    const service = new VotingService(
      logger as any,
      { target: 'target', user: 'user', votingKeyFileProvider: provider as any },
      cryptoPort
    );

    const result = await service.run(
      createPreset(),
      createNodeAccount(),
      createNodePreset(true),
      5,
      true,
      true
    );

    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('nemesis ブロックに含まれます')
    );
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Voting Public Key'));
  });

  it('experimental 有効時は Native プロバイダーを利用すること', async () => {
    vi.spyOn(VotingUtils.prototype, 'loadVotingFiles')
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const nativeSpy = vi
      .spyOn(NativeVotingKeyFileProvider.prototype, 'createVotingFile')
      .mockResolvedValue({ publicKey: 'N'.repeat(64) });
    const catapultSpy = vi.spyOn(CatapultVotingKeyFileProvider.prototype, 'createVotingFile');
    const service = new VotingService(
      logger as any,
      { target: 'target', user: 'user' },
      cryptoPort
    );

    const result = await service.run(
      createPreset({ useExperimentalNativeVotingKeyGeneration: true }),
      createNodeAccount(),
      createNodePreset(true),
      5,
      true,
      false
    );

    expect(result).toBe(true);
    expect(nativeSpy).toHaveBeenCalled();
    expect(catapultSpy).not.toHaveBeenCalled();
  });

  it('experimental 無効時は Catapult プロバイダーを利用すること', async () => {
    vi.spyOn(VotingUtils.prototype, 'loadVotingFiles')
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const nativeSpy = vi.spyOn(NativeVotingKeyFileProvider.prototype, 'createVotingFile');
    const catapultSpy = vi
      .spyOn(CatapultVotingKeyFileProvider.prototype, 'createVotingFile')
      .mockResolvedValue({ publicKey: 'C'.repeat(64) });
    const service = new VotingService(
      logger as any,
      { target: 'target', user: 'user' },
      cryptoPort
    );

    const result = await service.run(
      createPreset({ useExperimentalNativeVotingKeyGeneration: false }),
      createNodeAccount(),
      createNodePreset(true),
      5,
      true,
      false
    );

    expect(result).toBe(true);
    expect(catapultSpy).toHaveBeenCalled();
    expect(nativeSpy).not.toHaveBeenCalled();
  });
});
