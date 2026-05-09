import { beforeEach, describe, expect, it, vi } from 'vitest';

import { writeFileSync } from 'node:fs';

import { RuntimeService } from '../../src/service/RuntimeService.js';
import {
  CatapultVotingKeyFileProvider,
  NativeVotingKeyFileProvider,
} from '../../src/service/VotingKeyFileProvider.js';
import { VotingUtils } from '../../src/utils/VotingUtils.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    writeFileSync: vi.fn(actual.writeFileSync),
  };
});

const createPreset = (overrides: Record<string, unknown> = {}) =>
  ({
    networkType: 152,
    symbolServerImage: 'symbol/server:latest',
    catapultAppFolder: '/catapult',
    ...overrides,
  }) as any;

/**
 * VotingKeyFileProvider 実装の成功・失敗分岐を検証するユニットテスト。
 */
describe('VotingKeyFileProvider', () => {
  const writeFileSyncMock = vi.mocked(writeFileSync);
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    writeFileSyncMock.mockReset();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
  });

  it('Native 実装が投票ファイルを書き込み公開鍵を返すこと', async () => {
    const cryptoPort = {
      generateAccount: vi.fn().mockReturnValue({
        privateKey: 'A'.repeat(64),
        publicKey: 'B'.repeat(64),
      }),
    } as any;
    writeFileSyncMock.mockImplementation(() => undefined);
    vi.spyOn(VotingUtils.prototype, 'createVotingFile').mockResolvedValue(
      new Uint8Array([1, 2, 3])
    );

    const provider = new NativeVotingKeyFileProvider(logger as any, cryptoPort);
    const result = await provider.createVotingFile({
      presetData: createPreset(),
      votingKeysFolder: '/target/votingkeys',
      privateKeyTreeFileName: 'private_key_tree1.dat',
      votingKeyStartEpoch: 11,
      votingKeyEndEpoch: 20,
    });

    expect(result).toEqual({ publicKey: 'B'.repeat(64) });
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      '/target/votingkeys/private_key_tree1.dat',
      new Uint8Array([1, 2, 3])
    );
    expect(VotingUtils.prototype.createVotingFile).toHaveBeenCalledWith('A'.repeat(64), 11, 20);
  });

  it('Catapult 実装が docker 実行成功時に公開鍵を返すこと', async () => {
    const cryptoPort = {
      generateAccount: vi.fn().mockReturnValue({
        privateKey: 'C'.repeat(64),
        publicKey: 'D'.repeat(64),
      }),
    } as any;
    vi.spyOn(RuntimeService.prototype, 'resolveDockerUserFromParam').mockResolvedValue('1000:1000');
    vi.spyOn(RuntimeService.prototype, 'runImageUsingExec').mockResolvedValue({
      stdout: 'ok',
      stderr: '',
    });

    const provider = new CatapultVotingKeyFileProvider(logger as any, 'user', cryptoPort);
    const result = await provider.createVotingFile({
      presetData: createPreset(),
      votingKeysFolder: '/target/votingkeys',
      privateKeyTreeFileName: 'private_key_tree2.dat',
      votingKeyStartEpoch: 21,
      votingKeyEndEpoch: 30,
    });

    expect(result).toEqual({ publicKey: 'D'.repeat(64) });
    expect(RuntimeService.prototype.resolveDockerUserFromParam).toHaveBeenCalledWith('user');
    expect(RuntimeService.prototype.runImageUsingExec).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'symbol/server:latest',
        cmds: expect.arrayContaining([
          '/catapult/bin/catapult.tools.votingkey',
          '--secret=' + 'C'.repeat(64),
          '--startEpoch=21',
          '--endEpoch=30',
          '--output=/votingKeys/private_key_tree2.dat',
        ]),
      })
    );
  });

  it('Catapult 実装がエラー出力時に例外を送出すること', async () => {
    const cryptoPort = {
      generateAccount: vi.fn().mockReturnValue({
        privateKey: 'E'.repeat(64),
        publicKey: 'F'.repeat(64),
      }),
    } as any;
    vi.spyOn(RuntimeService.prototype, 'resolveDockerUserFromParam').mockResolvedValue('1000:1000');
    vi.spyOn(RuntimeService.prototype, 'runImageUsingExec').mockResolvedValue({
      stdout: '<error> failed',
      stderr: 'catapult error',
    });

    const provider = new CatapultVotingKeyFileProvider(logger as any, 'user', cryptoPort);

    await expect(
      provider.createVotingFile({
        presetData: createPreset(),
        votingKeysFolder: '/target/votingkeys',
        privateKeyTreeFileName: 'private_key_tree3.dat',
        votingKeyStartEpoch: 31,
        votingKeyEndEpoch: 40,
      })
    ).rejects.toThrow('投票キーの作成に失敗しました。ログを確認してください。');

    expect(logger.info).toHaveBeenCalledWith('<error> failed');
    expect(logger.error).toHaveBeenCalledWith('catapult error');
  });
});
