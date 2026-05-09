import { describe, expect, it } from 'vitest';

import { Constants } from '../../src/utils/Constants.js';

/**
 * Constants クラスのユニットテスト。
 * グローバル定数の値と ROOT_FOLDER 解決ロジックを検証する。
 */
describe('Constants', () => {
  describe('フォルダ名定数', () => {
    it('defaultTargetFolder が "target" であること', () => {
      expect(Constants.defaultTargetFolder).toBe('target');
    });

    it('targetDatabasesFolder が "database" であること', () => {
      expect(Constants.targetDatabasesFolder).toBe('database');
    });

    it('targetNemesisFolder が "nemesis" であること', () => {
      expect(Constants.targetNemesisFolder).toBe('nemesis');
    });
  });

  describe('その他の定数', () => {
    it('defaultWorkingDir が "." であること', () => {
      expect(Constants.defaultWorkingDir).toBe('.');
    });

    it('CURRENT_USER が "current" であること', () => {
      expect(Constants.CURRENT_USER).toBe('current');
    });

    it('VERSION が定義されていること', () => {
      // バージョン文字列は semver 形式 (x.y.z) であること
      expect(Constants.VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('ROOT_FOLDER', () => {
    it('ROOT_FOLDER が定義されていること', () => {
      expect(Constants.ROOT_FOLDER).toBeDefined();
      expect(typeof Constants.ROOT_FOLDER).toBe('string');
    });

    it('ROOT_FOLDER が絶対パスであること', () => {
      expect(Constants.ROOT_FOLDER).toMatch(/^\//);
    });

    it('resolveRootFolder が同じ値を返すこと', () => {
      expect(Constants.resolveRootFolder()).toBe(Constants.ROOT_FOLDER);
    });
  });
});
