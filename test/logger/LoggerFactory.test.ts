import { afterEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';

/**
 * LoggerFactory クラスのユニットテスト。
 * 各ログタイプのロガー生成と不正な入力に対するエラーハンドリングを検証する。
 */
describe('LoggerFactory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLogger', () => {
    it('Silent ロガーが正常に生成されること', () => {
      const logger = LoggerFactory.getLogger(LogType.Silent);

      expect(logger).toBeDefined();
    });

    it('Console ロガーが正常に生成されること', () => {
      const logger = LoggerFactory.getLogger(LogType.Console);

      expect(logger).toBeDefined();
    });

    it('カンマ区切りで複数のログタイプを指定できること', () => {
      const logger = LoggerFactory.getLogger(`${LogType.Silent},${LogType.Console}`);

      expect(logger).toBeDefined();
    });

    it('大文字小文字を区別せずにログタイプを識別できること（小文字）', () => {
      // LogType.Silent の値 "Silent" の小文字 "silent" でも生成できること
      const logger = LoggerFactory.getLogger('silent');

      expect(logger).toBeDefined();
    });

    it('不正なログタイプを指定した場合にエラーをスローすること', () => {
      expect(() => LoggerFactory.getLogger('INVALID_TYPE')).toThrow(
        '未対応の LogType です: INVALID_TYPE'
      );
    });

    it('同じログタイプを2回要求しても同じインスタンスを返すこと（キャッシュ）', () => {
      // winston はロガーキャッシュを使うため、同じ ID なら同一オブジェクトを返す
      const logger1 = LoggerFactory.getLogger(LogType.Silent);
      const logger2 = LoggerFactory.getLogger(LogType.Silent);

      expect(logger1).toBe(logger2);
    });

    it('空白を含むカンマ区切り文字列を正しくパースすること', () => {
      const logger = LoggerFactory.getLogger(`  ${LogType.Silent}  ,  ${LogType.Console}  `);

      expect(logger).toBeDefined();
    });
  });

  describe('getLoggerFromTypes', () => {
    it('LogType の配列からロガーを生成できること', () => {
      const logger = LoggerFactory.getLoggerFromTypes([LogType.Silent]);

      expect(logger).toBeDefined();
    });

    it('空配列を指定した場合もロガーが生成されること', () => {
      const logger = LoggerFactory.getLoggerFromTypes([]);

      expect(logger).toBeDefined();
    });

    it('複数の LogType を指定できること', () => {
      const logger = LoggerFactory.getLoggerFromTypes([LogType.Silent, LogType.Console]);

      expect(logger).toBeDefined();
    });

    it('不正な LogType を含む配列でエラーをスローすること', () => {
      const invalidTypes = ['INVALID_ENUM_VALUE' as LogType];

      expect(() => LoggerFactory.getLoggerFromTypes(invalidTypes)).toThrow(
        '未対応の LogType です: INVALID_ENUM_VALUE'
      );
    });
  });

  describe('separator', () => {
    it('セパレータが "," であること', () => {
      expect(LoggerFactory.separator).toBe(',');
    });
  });
});
