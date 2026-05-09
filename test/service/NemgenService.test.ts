import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as fs from 'node:fs';

import { FileSystemService } from '../../src/service/FileSystemService.js';
import { NemgenService } from '../../src/service/NemgenService.js';
import { RuntimeService } from '../../src/service/RuntimeService.js';

describe('NemgenService', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as any;

  const params = { target: 'target', user: 'current' } as any;
  const preset = {
    networkIdentifier: 'testnet',
    symbolServerImage: 'symbol-server:latest',
    catapultAppFolder: '/symbol-workdir',
    node: { name: 'api-node' },
  } as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    logger.debug.mockClear();

    vi.spyOn(FileSystemService.prototype, 'getTargetNemesisFolder').mockReturnValue('/tmp/nemesis');
    vi.spyOn(FileSystemService.prototype, 'getTargetNodesFolder').mockReturnValue(
      '/tmp/node/server-config'
    );
    vi.spyOn(FileSystemService.prototype, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(FileSystemService.prototype, 'validateFolder').mockImplementation(() => {});
    vi.spyOn(FileSystemService.prototype, 'deleteFolder').mockImplementation(() => {});

    vi.spyOn(fs.promises, 'copyFile').mockResolvedValue(undefined as any);
    vi.spyOn(RuntimeService.prototype, 'resolveDockerUserFromParam').mockResolvedValue('1000:1000');
  });

  it('node が未定義の場合は例外を投げること', async () => {
    const service = new NemgenService(logger, params);

    await expect(service.run({ ...preset, node: undefined })).rejects.toThrow(
      'nemgen 実行時は preset に node を定義する必要があります。'
    );
  });

  it('正常実行時は nemgen seed を削除して完了ログを出すこと', async () => {
    vi.spyOn(RuntimeService.prototype, 'runImageUsingExec').mockResolvedValue({
      stdout: 'ok',
      stderr: '',
    });

    const service = new NemgenService(logger, params);
    await service.run(preset);

    expect(fs.promises.copyFile).toHaveBeenCalled();
    expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalledWith(
      '/tmp/nemesis/seed/testnet'
    );
    expect(logger.info).toHaveBeenCalledWith('Nemgen を実行しました。');
  });

  it('stdout に <error> が含まれる場合は失敗すること', async () => {
    vi.spyOn(RuntimeService.prototype, 'runImageUsingExec').mockResolvedValue({
      stdout: '<error> failed',
      stderr: '',
    });

    const service = new NemgenService(logger, params);

    await expect(service.run(preset)).rejects.toThrow(
      'Nemgen の実行に失敗しました。ログを確認してください。'
    );
  });

  it('docker 実行が例外を投げた場合にログを出して失敗すること', async () => {
    vi.spyOn(RuntimeService.prototype, 'runImageUsingExec').mockRejectedValue({
      message: 'exec failed',
      stdout: 'stdout text',
      stderr: 'stderr text',
    });

    const service = new NemgenService(logger, params);

    await expect(service.run(preset)).rejects.toThrow(
      'Nemgen の実行に失敗しました。ログを確認してください。'
    );
    expect(logger.error).toHaveBeenCalledWith('exec failed');
    expect(logger.info).toHaveBeenCalledWith('stdout text');
    expect(logger.error).toHaveBeenCalledWith('stderr text');
  });
});
