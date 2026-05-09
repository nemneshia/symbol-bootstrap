import { confirm } from '@clack/prompts';
import { Command } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BootstrapService, CommandUtils } from '../../src/service/index.js';

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: (value: unknown) => value === 'cancel',
}));

describe('ResetData command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('確認を拒否すると resetData を呼ばないこと', async () => {
    const resetDataSpy = vi
      .spyOn(BootstrapService.prototype, 'resetData')
      .mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: { target: 'target', logger: 'silent', yes: false },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);
    vi.mocked(confirm).mockResolvedValueOnce('cancel' as any);

    const { default: ResetData } = await import('../../src/commands/resetData.js');
    await new ResetData().run();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: false,
        message: '対象フォルダ target のデータを削除してもよいですか？',
      })
    );
    expect(resetDataSpy).not.toHaveBeenCalled();
    expect(parseSpy).toHaveBeenCalled();
  });

  it('--yes 指定時は確認せず resetData を呼ぶこと', async () => {
    const resetDataSpy = vi
      .spyOn(BootstrapService.prototype, 'resetData')
      .mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: { target: 'target', logger: 'silent', yes: true },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);

    const { default: ResetData } = await import('../../src/commands/resetData.js');
    await new ResetData().run();

    expect(confirm).not.toHaveBeenCalled();
    expect(resetDataSpy).toHaveBeenCalledWith({ target: 'target', logger: 'silent', yes: true });
    expect(parseSpy).toHaveBeenCalled();
  });
});
