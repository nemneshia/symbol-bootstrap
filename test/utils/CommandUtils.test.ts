import { confirm, password } from '@clack/prompts';
import cfonts from 'cfonts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandUtils } from '../../src/utils/CommandUtils.js';

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  password: vi.fn(),
  isCancel: (value: unknown) => value === 'cancel',
}));

vi.mock('cfonts', () => ({
  default: {
    render: vi.fn(() => ({ string: 'banner' })),
  },
}));

/**
 * CommandUtils クラスのユニットテスト。
 * パスワード解決、バリデーション、表示関連の振る舞いを検証する。
 */
describe('CommandUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showBanner', () => {
    it('cfonts で生成したバナー文字列を出力すること', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      CommandUtils.showBanner();

      expect(cfonts.render).toHaveBeenCalledWith(
        'symbol-bootstrap',
        expect.objectContaining({
          font: 'tiny',
          align: 'left',
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('banner');
    });
  });

  describe('isValidPassword', () => {
    it('undefined の場合は true を返すこと（パスワード未設定は許可）', () => {
      expect(CommandUtils.isValidPassword(undefined)).toBe(true);
    });

    it('空文字の場合は true を返すこと', () => {
      expect(CommandUtils.isValidPassword('')).toBe(true);
    });

    it('4文字以上の場合は true を返すこと', () => {
      expect(CommandUtils.isValidPassword('pass')).toBe(true);
      expect(CommandUtils.isValidPassword('password123')).toBe(true);
      expect(CommandUtils.isValidPassword('1234')).toBe(true);
    });

    it('4文字未満の場合はエラーメッセージを返すこと', () => {
      const result = CommandUtils.isValidPassword('ab');

      expect(result).toContain('パスワードは 4 文字以上必要です');
      expect(result).toContain('2');
    });

    it('3文字の場合はエラーメッセージを返すこと', () => {
      const result = CommandUtils.isValidPassword('abc');

      expect(result).toContain('パスワードは 4 文字以上必要です');
    });
  });

  describe('isValidPrivateKey', () => {
    it('有効な64文字の16進文字列の場合は true を返すこと', () => {
      // 64文字の16進文字列（256ビット秘密鍵）
      const validKey = 'A'.repeat(64);
      const result = CommandUtils.isValidPrivateKey(validKey);

      expect(result).toBe(true);
    });

    it('64文字未満の場合はエラーメッセージを返すこと', () => {
      const result = CommandUtils.isValidPrivateKey('A'.repeat(32));

      expect(result).toContain('秘密鍵が不正です');
      expect(result).toContain('64 桁の 16 進文字列');
    });

    it('64文字超の場合はエラーメッセージを返すこと', () => {
      const result = CommandUtils.isValidPrivateKey('A'.repeat(65));

      expect(result).toContain('秘密鍵が不正です');
    });

    it('16進文字列でない場合はエラーメッセージを返すこと', () => {
      const result = CommandUtils.isValidPrivateKey('Z'.repeat(64));

      expect(result).toContain('秘密鍵が不正です');
    });
  });

  describe('formatAccount', () => {
    const mockAccount = {
      address: 'TABC123DEF456',
      publicKey: '1234567890ABCDEF',
    };

    it('デフォルトではアドレスを角括弧で囲むこと', () => {
      const result = CommandUtils.formatAccount(mockAccount as any);

      expect(result).toBe('[アドレス: TABC123DEF456]');
    });

    it('wrapped=false の場合は角括弧なしで返すこと', () => {
      const result = CommandUtils.formatAccount(mockAccount as any, false);

      expect(result).toBe('アドレス: TABC123DEF456');
    });
  });

  describe('passwordPromptDefaultMessage', () => {
    it('パスワードプロンプトのデフォルトメッセージが定義されていること', () => {
      expect(CommandUtils.passwordPromptDefaultMessage).toBeTruthy();
      expect(typeof CommandUtils.passwordPromptDefaultMessage).toBe('string');
    });
  });

  describe('resolvePassword', () => {
    it('パスワード未指定かつ noPassword=false の場合はプロンプト結果を返すこと', async () => {
      const logger = { warn: vi.fn(), info: vi.fn() };
      vi.mocked(password).mockResolvedValueOnce('from-prompt');

      const result = await CommandUtils.resolvePassword(
        logger as any,
        undefined,
        false,
        'パスワードを入力してください',
        true
      );

      expect(result).toBe('from-prompt');
      expect(password).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'パスワードを入力してください',
          mask: '*',
        })
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it('noPassword=true の場合は undefined を返すこと', async () => {
      const logger = { warn: vi.fn(), info: vi.fn() };

      const result = await CommandUtils.resolvePassword(
        logger as any,
        undefined,
        true,
        'パスワードを入力してください',
        true
      );

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('プロンプトで空文字が返った場合は undefined を返して警告すること', async () => {
      const logger = { warn: vi.fn(), info: vi.fn() };
      vi.mocked(password).mockResolvedValueOnce('');

      const result = await CommandUtils.resolvePassword(
        logger as any,
        undefined,
        false,
        'msg',
        true
      );

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('パスワードが提供された場合はそのまま返すこと', async () => {
      const logger = { warn: vi.fn(), info: vi.fn() };

      const result = await CommandUtils.resolvePassword(
        logger as any,
        'mypassword',
        false,
        'パスワードを入力してください',
        true
      );

      expect(result).toBe('mypassword');
      expect(logger.info).toHaveBeenCalled();
    });

    it('noPassword=true かつ log=false の場合は warn を呼ばないこと', async () => {
      const logger = { warn: vi.fn(), info: vi.fn() };

      await CommandUtils.resolvePassword(
        logger as any,
        undefined,
        true,
        'パスワードを入力してください',
        false
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('プロンプトで空文字が返っても log=false なら警告しないこと', async () => {
      const logger = { warn: vi.fn(), info: vi.fn() };
      vi.mocked(password).mockResolvedValueOnce('');

      const result = await CommandUtils.resolvePassword(
        logger as any,
        undefined,
        false,
        'msg',
        false
      );

      expect(result).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('confirmDangerousAction', () => {
    it('confirm=true の場合は true を返すこと', async () => {
      vi.mocked(confirm).mockResolvedValueOnce(true);

      const result = await CommandUtils.confirmDangerousAction('削除してもよいですか？');

      expect(result).toBe(true);
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '削除してもよいですか？',
          initialValue: false,
        })
      );
    });

    it('confirm=false の場合は false を返すこと', async () => {
      vi.mocked(confirm).mockResolvedValueOnce(false);

      const result = await CommandUtils.confirmDangerousAction('削除してもよいですか？');

      expect(result).toBe(false);
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          initialValue: false,
        })
      );
    });

    it('confirm が cancel の場合は false を返すこと', async () => {
      vi.mocked(confirm).mockResolvedValueOnce('cancel' as any);

      const result = await CommandUtils.confirmDangerousAction('削除してもよいですか？');

      expect(result).toBe(false);
    });
  });

  describe('getPasswordFlag', () => {
    it('有効な入力は parse でそのまま返すこと', async () => {
      const flag = CommandUtils.getPasswordFlag('description');

      await expect(flag.parse?.('valid-password', {} as any, {} as any)).resolves.toBe(
        'valid-password'
      );
    });

    it('無効な入力は parse でエラーになること', async () => {
      const flag = CommandUtils.getPasswordFlag('description');

      await expect(flag.parse?.('abc', {} as any, {} as any)).rejects.toThrow(
        '--password が不正です'
      );
    });
  });
});
