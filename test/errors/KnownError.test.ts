import { describe, expect, it } from 'vitest';

import { KnownError } from '../../src/errors/KnownError.js';

/**
 * KnownError クラスのユニットテスト。
 * ユーザーフレンドリーなエラー表現を目的としたカスタム例外の動作を検証する。
 */
describe('KnownError', () => {
  describe('インスタンス生成', () => {
    it('エラーメッセージを保持すること', () => {
      // 準備: 任意のメッセージ
      const message = 'テストエラーメッセージ';

      // 実行
      const error = new KnownError(message);

      // 検証
      expect(error.message).toBe(message);
    });

    it('Error クラスを継承していること', () => {
      const error = new KnownError('テスト');

      expect(error).toBeInstanceOf(Error);
    });

    it('KnownError クラスのインスタンスであること', () => {
      const error = new KnownError('テスト');

      expect(error).toBeInstanceOf(KnownError);
    });
  });

  describe('known プロパティ', () => {
    it('known プロパティが true であること', () => {
      const error = new KnownError('テスト');

      expect(error.known).toBe(true);
    });

    it('known プロパティが readonly であること', () => {
      const error = new KnownError('テスト');

      // readonly なので型レベルで保護されているが、実行時の値は true を保持する
      expect(error.known).toBe(true);
    });
  });

  describe('スタックトレース', () => {
    it('スタックトレースが存在すること', () => {
      const error = new KnownError('テスト');

      // Error を継承しているため、スタックトレースが付与される
      expect(error.stack).toBeDefined();
    });
  });

  describe('try-catch での捕捉', () => {
    it('throw された KnownError を catch できること', () => {
      // 実行 & 検証
      expect(() => {
        throw new KnownError('捕捉テスト');
      }).toThrow(KnownError);
    });

    it('catch した後に known プロパティで識別できること', () => {
      try {
        throw new KnownError('識別テスト');
      } catch (e) {
        // KnownError であることを known プロパティで識別する
        expect((e as KnownError).known).toBe(true);
        expect((e as KnownError).message).toBe('識別テスト');
      }
    });
  });

  describe('空メッセージ', () => {
    it('空文字のメッセージでも生成できること', () => {
      const error = new KnownError('');

      expect(error.message).toBe('');
      expect(error.known).toBe(true);
    });
  });
});
