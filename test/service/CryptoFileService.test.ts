import { beforeEach, describe, expect, it, vi } from 'vitest';

import { existsSync } from 'node:fs';

import { KnownError } from '../../src/errors/KnownError.js';
import { CryptoFileService } from '../../src/service/CryptoFileService.js';
import { FileSystemService } from '../../src/service/FileSystemService.js';
import { CryptoUtils } from '../../src/utils/CryptoUtils.js';
import { Utils } from '../../src/utils/Utils.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
  };
});

describe('CryptoFileService', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
  const existsSyncMock = vi.mocked(existsSync);

  beforeEach(() => {
    vi.restoreAllMocks();
    existsSyncMock.mockImplementation((p) => p === 'source.yml');
    vi.spyOn(FileSystemService.prototype, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(YamlUtils, 'writeYaml').mockResolvedValue(undefined);
  });

  it('encryptFile は暗号化ファイルを作成すること', async () => {
    vi.spyOn(YamlUtils, 'loadYaml').mockReturnValue({ key: 'value' } as any);
    vi.spyOn(CryptoUtils, 'encryptedCount').mockReturnValue(0);
    vi.spyOn(Utils, 'validatePassword').mockReturnValue('validated-password');

    const service = new CryptoFileService(logger);
    const result = await service.encryptFile({
      source: 'source.yml',
      destination: 'dest.yml',
      password: 'pw',
    });

    expect(result).toContain('暗号化ファイル dest.yml');
    expect(FileSystemService.prototype.mkdir).toHaveBeenCalled();
    expect(YamlUtils.writeYaml).toHaveBeenCalledWith(
      'dest.yml',
      { key: 'value' },
      'validated-password'
    );
  });

  it('encryptFile は入力が既暗号化なら KnownError を投げること', async () => {
    vi.spyOn(YamlUtils, 'loadYaml').mockReturnValue({ encrypted: true } as any);
    vi.spyOn(CryptoUtils, 'encryptedCount').mockReturnValue(1);

    const service = new CryptoFileService(logger);

    await expect(
      service.encryptFile({ source: 'source.yml', destination: 'dest.yml', password: 'pw' })
    ).rejects.toBeInstanceOf(KnownError);
  });

  it('encryptFile はパスワード未指定なら KnownError を投げること', async () => {
    vi.spyOn(YamlUtils, 'loadYaml').mockReturnValue({ key: 'value' } as any);
    vi.spyOn(CryptoUtils, 'encryptedCount').mockReturnValue(0);

    const service = new CryptoFileService(logger);

    await expect(
      service.encryptFile({ source: 'source.yml', destination: 'dest.yml', password: undefined })
    ).rejects.toBeInstanceOf(KnownError);
  });

  it('decryptFile は復号ファイルを作成すること', async () => {
    vi.spyOn(YamlUtils, 'loadYaml').mockReturnValue({ key: 'value' } as any);

    const service = new CryptoFileService(logger);
    const result = await service.decryptFile({
      source: 'source.yml',
      destination: 'dest.yml',
      password: 'pw',
    });

    expect(result).toContain('復号ファイル dest.yml');
    expect(YamlUtils.writeYaml).toHaveBeenCalledWith('dest.yml', { key: 'value' }, '');
  });

  it('入力ファイルが存在しない場合は KnownError を投げること', async () => {
    existsSyncMock.mockReturnValue(false);
    const service = new CryptoFileService(logger);

    await expect(
      service.decryptFile({ source: 'missing.yml', destination: 'dest.yml', password: 'pw' })
    ).rejects.toBeInstanceOf(KnownError);
  });

  it('出力ファイルが既に存在する場合は KnownError を投げること', async () => {
    existsSyncMock.mockImplementation((p) => p === 'source.yml' || p === 'dest.yml');
    const service = new CryptoFileService(logger);

    await expect(
      service.decryptFile({ source: 'source.yml', destination: 'dest.yml', password: 'pw' })
    ).rejects.toBeInstanceOf(KnownError);
  });
});
