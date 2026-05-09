import { confirm } from '@clack/prompts';
import { Command } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BootstrapService, CommandUtils } from '../../src/service/index.js';

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: (value: unknown) => value === 'cancel',
}));

describe('Run command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('--resetData かつ確認拒否時は run を呼ばないこと', async () => {
    const runSpy = vi.spyOn(BootstrapService.prototype, 'run').mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: { target: 'target', logger: 'silent', yes: false, resetData: true },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const { default: Run } = await import('../../src/commands/run.js');
    await new Run().run();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: false,
        message: '起動前に対象フォルダ target のデータを削除してもよいですか？',
      })
    );
    expect(runSpy).not.toHaveBeenCalled();
    expect(parseSpy).toHaveBeenCalled();
  });

  it('--resetData なしでは確認せず run を呼ぶこと', async () => {
    const runSpy = vi.spyOn(BootstrapService.prototype, 'run').mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: { target: 'target', logger: 'silent', yes: false, resetData: false },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);

    const { default: Run } = await import('../../src/commands/run.js');
    await new Run().run();

    expect(confirm).not.toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledWith({
      target: 'target',
      logger: 'silent',
      yes: false,
      resetData: false,
    });
    expect(parseSpy).toHaveBeenCalled();
  });

  it('--yes 指定時は確認せず run を呼ぶこと', async () => {
    const runSpy = vi.spyOn(BootstrapService.prototype, 'run').mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(Command.prototype as any, 'parse').mockResolvedValue({
      flags: { target: 'target', logger: 'silent', yes: true, resetData: true },
    } as any);
    vi.spyOn(CommandUtils, 'showBanner').mockImplementation(() => undefined);

    const { default: Run } = await import('../../src/commands/run.js');
    await new Run().run();

    expect(confirm).not.toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledWith({
      target: 'target',
      logger: 'silent',
      yes: true,
      resetData: true,
    });
    expect(parseSpy).toHaveBeenCalled();
  });
});
