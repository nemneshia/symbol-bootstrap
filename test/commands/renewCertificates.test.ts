import { Command, Config } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnownError } from '../../src/errors/KnownError.js';
import { BootstrapService, CommandUtils } from '../../src/service/index.js';

describe('RenewCertificates command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('秘密鍵入力キャンセル時は正常終了すること', async () => {
    vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: {
        target: 'target',
        logger: 'silent',
        password: undefined,
        noPassword: true,
        customPreset: undefined,
        user: 'current',
        force: false,
      },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);
    vi.spyOn(CommandUtils, 'resolvePassword').mockResolvedValue(undefined);
    vi.spyOn(BootstrapService.prototype, 'renewCertificates').mockRejectedValue(
      new KnownError('秘密鍵入力をキャンセルしました。')
    );

    const { default: RenewCert } = await import('../../src/commands/renewCert.js');

    await expect(new RenewCert([], {} as Config).run()).resolves.toBeUndefined();
  });

  it('キャンセル以外のエラーは再送出すること', async () => {
    vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: {
        target: 'target',
        logger: 'silent',
        password: undefined,
        noPassword: true,
        customPreset: undefined,
        user: 'current',
        force: false,
      },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);
    vi.spyOn(CommandUtils, 'resolvePassword').mockResolvedValue(undefined);
    vi.spyOn(BootstrapService.prototype, 'renewCertificates').mockRejectedValue(
      new Error('unexpected')
    );

    const { default: RenewCert } = await import('../../src/commands/renewCert.js');

    await expect(new RenewCert([], {} as Config).run()).rejects.toThrow('unexpected');
  });
});
