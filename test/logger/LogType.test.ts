import { describe, expect, it } from 'vitest';

import { LogType, System } from '../../src/logger/LogType.js';

/**
 * LogType 列挙型と System 定数のユニットテスト。
 */
describe('LogType', () => {
  describe('列挙値', () => {
    it('Console が "Console" であること', () => {
      expect(LogType.Console).toBe('Console');
    });

    it('File が "File" であること', () => {
      expect(LogType.File).toBe('File');
    });

    it('Silent が "Silent" であること', () => {
      expect(LogType.Silent).toBe('Silent');
    });

    it('3種類のログタイプが定義されていること', () => {
      const values = Object.values(LogType);
      expect(values).toHaveLength(3);
    });
  });

  describe('System 定数', () => {
    it('Console と File を含むこと', () => {
      expect(System).toContain(LogType.Console);
      expect(System).toContain(LogType.File);
    });

    it('Silent を含まないこと（システムログはサイレントでない）', () => {
      expect(System).not.toContain(LogType.Silent);
    });

    it('2要素の配列であること', () => {
      expect(System).toHaveLength(2);
    });
  });
});
