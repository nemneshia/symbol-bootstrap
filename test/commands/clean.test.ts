import { confirm } from '@clack/prompts';
import { Command } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BootstrapService, CommandUtils } from '../../src/service/index.js';

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: (value: unknown) => value === 'cancel',
}));

describe('Clean command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('確認を拒否すると clean を呼ばないこと', async () => {
    const cleanSpy = vi
      .spyOn(BootstrapService.prototype, 'clean')
      .mockImplementation(() => undefined as any);
    const parseSpy = vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: { target: 'target', logger: 'silent', yes: false },
    } as any);
    const bannerSpy = vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const { default: Clean } = await import('../../src/commands/clean.js');
    await new Clean().run();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: false,
        message: '対象フォルダ target を削除してもよいですか？',
      })
    );
    expect(cleanSpy).not.toHaveBeenCalled();
    expect(parseSpy).toHaveBeenCalled();
    expect(bannerSpy).toHaveBeenCalled();
  });

  it('--yes 指定時は確認せず clean を呼ぶこと', async () => {
    const cleanSpy = vi
      .spyOn(BootstrapService.prototype, 'clean')
      .mockImplementation(() => undefined as any);
    const parseSpy = vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: { target: 'target', logger: 'silent', yes: true },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);

    const { default: Clean } = await import('../../src/commands/clean.js');
    await new Clean().run();

    expect(confirm).not.toHaveBeenCalled();
    expect(cleanSpy).toHaveBeenCalledWith({ target: 'target', logger: 'silent', yes: true });
    expect(parseSpy).toHaveBeenCalled();
  });
});
