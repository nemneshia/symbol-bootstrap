import { Command } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnownError } from '../../src/errors/KnownError.js';
import { BootstrapService, CommandUtils } from '../../src/service/index.js';

describe('ModifyMultisig command', () => {
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
      },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);
    vi.spyOn(CommandUtils, 'resolvePassword').mockResolvedValue(undefined);
    vi.spyOn(BootstrapService.prototype, 'modifyMultisig').mockRejectedValue(
      new KnownError('秘密鍵入力をキャンセルしました。')
    );

    const { default: ModifyMultisig } = await import('../../src/commands/modifyMultisig.js');

    await expect(new ModifyMultisig().run()).resolves.toBeUndefined();
  });

  it('キャンセル以外のエラーは再送出すること', async () => {
    vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: {
        target: 'target',
        logger: 'silent',
        password: undefined,
        noPassword: true,
      },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);
    vi.spyOn(CommandUtils, 'resolvePassword').mockResolvedValue(undefined);
    vi.spyOn(BootstrapService.prototype, 'modifyMultisig').mockRejectedValue(
      new Error('unexpected')
    );

    const { default: ModifyMultisig } = await import('../../src/commands/modifyMultisig.js');

    await expect(new ModifyMultisig().run()).rejects.toThrow('unexpected');
  });
});
