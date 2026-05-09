import { createCipheriv, pbkdf2Sync, randomBytes } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KnownError } from '../../src/errors/KnownError.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

/**
 * テスト用: レガシー形式（PBKDF2-SHA1 + AES-256-CBC）で暗号化した値を生成する。
 * CryptoUtils.decryptLegacy で復号化できる形式。
 */
function encryptLegacy(plaintext: string, password: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(16);
  const key = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, 1024, 32, 'sha1');
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return salt.toString('hex') + iv.toString('hex') + encrypted;
}

/**
 * YamlUtils クラスのユニットテスト。
 * YAML パース・シリアライズ・ファイル判定・暗号化/復号化のロジックを検証する。
 */
describe('YamlUtils', () => {
  let tmpDir: string;

  tmpDir = mkdtempSync(join(tmpdir(), 'sb-yaml-test-'));

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // isYamlFile
  // ---------------------------------------------------------------------------
  describe('isYamlFile', () => {
    it('.yml 拡張子を YAML ファイルと判定すること', () => {
      expect(YamlUtils.isYamlFile('config.yml')).toBe(true);
    });

    it('.yaml 拡張子を YAML ファイルと判定すること', () => {
      expect(YamlUtils.isYamlFile('config.yaml')).toBe(true);
    });

    it('大文字の .YML 拡張子を YAML ファイルと判定すること', () => {
      expect(YamlUtils.isYamlFile('config.YML')).toBe(true);
    });

    it('.json 拡張子は YAML ファイルでないと判定すること', () => {
      expect(YamlUtils.isYamlFile('config.json')).toBe(false);
    });

    it('拡張子なしの文字列は YAML ファイルでないと判定すること', () => {
      expect(YamlUtils.isYamlFile('bootstrap')).toBe(false);
    });

    it('パスの途中に .yml が含まれても末尾でなければ false を返すこと', () => {
      expect(YamlUtils.isYamlFile('config.yml.bak')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // toYaml
  // ---------------------------------------------------------------------------
  describe('toYaml', () => {
    it('オブジェクトを YAML 文字列に変換すること', () => {
      const obj = { key: 'value', num: 42 };
      const result = YamlUtils.toYaml(obj);

      expect(result).toContain('key: value');
      expect(result).toContain('num: 42');
    });

    it('ネストされたオブジェクトを変換すること', () => {
      const obj = { parent: { child: 'value' } };
      const result = YamlUtils.toYaml(obj);

      expect(result).toContain('parent:');
      expect(result).toContain('child: value');
    });

    it('配列を変換すること', () => {
      const obj = { items: [1, 2, 3] };
      const result = YamlUtils.toYaml(obj);

      expect(result).toContain('items:');
    });
  });

  // ---------------------------------------------------------------------------
  // fromYaml
  // ---------------------------------------------------------------------------
  describe('fromYaml', () => {
    it('YAML 文字列をオブジェクトにパースすること', () => {
      const yamlString = 'key: value\nnum: 42\n';
      const result = YamlUtils.fromYaml(yamlString);

      expect(result).toEqual({ key: 'value', num: 42 });
    });

    it('ネストされた YAML をパースすること', () => {
      const yamlString = 'parent:\n  child: value\n';
      const result = YamlUtils.fromYaml(yamlString);

      expect(result).toEqual({ parent: { child: 'value' } });
    });
  });

  // ---------------------------------------------------------------------------
  // toYaml ⇔ fromYaml ラウンドトリップ
  // ---------------------------------------------------------------------------
  describe('toYaml ⇔ fromYaml のラウンドトリップ', () => {
    it('オブジェクトを YAML に変換して元に戻せること', () => {
      const original = {
        nodes: [
          { name: 'node1', port: 3000 },
          { name: 'node2', port: 3001 },
        ],
        version: '2.0.0',
      };

      const yaml = YamlUtils.toYaml(original);
      const restored = YamlUtils.fromYaml(yaml);

      expect(restored).toEqual(original);
    });
  });

  // ---------------------------------------------------------------------------
  // writeYaml / loadYaml（実際のファイルシステム使用）
  // ---------------------------------------------------------------------------
  describe('writeYaml / loadYaml（実際のファイルシステム使用）', () => {
    it('writeYaml でファイルに書き込み、loadYaml で読み込めること', async () => {
      const filePath = join(tmpDir, 'test.yml');
      const data = { key: 'value', num: 42 };

      await YamlUtils.writeYaml(filePath, data, false);

      expect(existsSync(filePath)).toBe(true);

      const loaded = YamlUtils.loadYaml(filePath, false);
      expect(loaded).toEqual(data);
    });

    it('writeYaml でネストしたオブジェクトを書き込めること', async () => {
      const filePath = join(tmpDir, 'nested.yml');
      const data = { parent: { child: 'value' }, items: [1, 2, 3] };

      await YamlUtils.writeYaml(filePath, data, false);
      const loaded = YamlUtils.loadYaml(filePath, false);

      expect(loaded).toEqual(data);
    });

    it('存在しないファイルを loadYaml で読み込むとエラーをスローすること', () => {
      expect(() => YamlUtils.loadYaml(join(tmpDir, 'nonexistent.yml'), false)).toThrow();
    });

    it('password を指定して writeYaml → loadYaml のラウンドトリップが成功すること', async () => {
      const filePath = join(tmpDir, 'encrypted.yml');
      const data = { privateKey: 'ABCDEF1234567890', name: 'test-node' };
      const password = 'test-password-123';

      await YamlUtils.writeYaml(filePath, data, password);
      const loaded = YamlUtils.loadYaml(filePath, password);

      expect(loaded).toEqual(data);
    });

    it('暗号化されたファイルをパスワードなし（undefined）で読み込むと KnownError をスローすること', async () => {
      const filePath = join(tmpDir, 'encrypted-no-pw.yml');
      const data = { privateKey: 'ABCDEF1234567890' };
      const password = 'test-password-123';

      await YamlUtils.writeYaml(filePath, data, password);

      expect(() => YamlUtils.loadYaml(filePath, undefined)).toThrow(KnownError);
    });

    it('暗号化されたファイルを password=false で読み込むと KnownError をスローしないこと（チェックスキップ）', async () => {
      const filePath = join(tmpDir, 'encrypted-skip-check.yml');
      const data = { privateKey: 'ABCDEF1234567890' };
      const password = 'test-password-123';

      await YamlUtils.writeYaml(filePath, data, password);

      // password=false は暗号化チェックをスキップして生データを返す
      const loaded = YamlUtils.loadYaml(filePath, false);
      // 暗号化されたまま（復号化されていない）
      expect(loaded.privateKey).toMatch(/^ENCRYPTED/);
    });

    it('間違ったパスワードで loadYaml すると KnownError をスローすること', async () => {
      const filePath = join(tmpDir, 'encrypted-wrong-pw.yml');
      const data = { privateKey: 'ABCDEF1234567890' };

      await YamlUtils.writeYaml(filePath, data, 'correct-password');

      expect(() => YamlUtils.loadYaml(filePath, 'wrong-password')).toThrow(KnownError);
    });
  });

  // ---------------------------------------------------------------------------
  // loadYaml - レガシー暗号化アップグレード
  // ---------------------------------------------------------------------------
  describe('loadYaml - レガシー暗号化アップグレード', () => {
    it('レガシー暗号化ファイルを読み込むと .bk バックアップが作成されること', async () => {
      const filePath = join(tmpDir, 'legacy.yml');
      const password = 'test-password-legacy';
      const privateKeyValue = 'AABB1122334455667788AABB112233445566778800001111';

      // レガシー形式（ENCRYPTED: プレフィックス）で YAML ファイルを手動作成
      const legacyEncrypted = `ENCRYPTED:${encryptLegacy(privateKeyValue, password)}`;
      await YamlUtils.writeTextFile(filePath, YamlUtils.toYaml({ privateKey: legacyEncrypted }));

      const loaded = YamlUtils.loadYaml(filePath, password);

      // データが正しく復号化されること
      expect(loaded.privateKey).toBe(privateKeyValue);
      // バックアップファイルが作成されること
      expect(existsSync(`${filePath}.bk`)).toBe(true);

      // バックグラウンドの writeYaml（.then コールバック）が実行されるのを待つ
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    });

    it('レガシー暗号化ファイルで writeYaml が失敗してもエラーをスローしないこと', async () => {
      const filePath = join(tmpDir, 'legacy-write-fail.yml');
      const password = 'test-password-legacy';
      const privateKeyValue = 'AABB1122334455667788AABB112233445566778800001111';

      const legacyEncrypted = `ENCRYPTED:${encryptLegacy(privateKeyValue, password)}`;
      await YamlUtils.writeTextFile(filePath, YamlUtils.toYaml({ privateKey: legacyEncrypted }));

      // writeYaml を失敗させる（.catch ブランチをカバー）
      const writeYamlSpy = vi
        .spyOn(YamlUtils, 'writeYaml')
        .mockRejectedValueOnce(new Error('write failed'));

      // エラーはスローされず、データは正常に返ること
      const loaded = YamlUtils.loadYaml(filePath, password);
      expect(loaded.privateKey).toBe(privateKeyValue);

      // .catch コールバックが実行されるのを待つ
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      writeYamlSpy.mockRestore();
    });

    it('レガシー暗号化ファイルで copyFileSync が失敗してもエラーをスローしないこと', async () => {
      const filePath = join(tmpDir, 'legacy-copy-fail.yml');
      const password = 'test-password-legacy';
      const privateKeyValue = 'AABB1122334455667788AABB112233445566778800001111';

      const legacyEncrypted = `ENCRYPTED:${encryptLegacy(privateKeyValue, password)}`;
      await YamlUtils.writeTextFile(filePath, YamlUtils.toYaml({ privateKey: legacyEncrypted }));

      // バックアップ先パスをディレクトリとして作成しておくと copyFileSync(file→dir) が EISDIR で失敗する
      mkdirSync(`${filePath}.bk`);

      // エラーはスローされず、データは正常に返ること
      const loaded = YamlUtils.loadYaml(filePath, password);
      expect(loaded.privateKey).toBe(privateKeyValue);
    });
  });

  // ---------------------------------------------------------------------------
  // loadYamlWithUpgradeInfo
  // ---------------------------------------------------------------------------
  describe('loadYamlWithUpgradeInfo', () => {
    it('パスワードなしファイルを読み込むと hasLegacyUpgrade=false を返すこと', async () => {
      const filePath = join(tmpDir, 'plain.yml');
      const data = { key: 'value' };
      await YamlUtils.writeYaml(filePath, data, false);

      const result = YamlUtils.loadYamlWithUpgradeInfo(filePath, false);

      expect(result.data).toEqual(data);
      expect(result.hasLegacyUpgrade).toBe(false);
      expect(result.filePath).toBe(filePath);
    });

    it('新形式で暗号化されたファイルを読み込むと hasLegacyUpgrade=false を返すこと', async () => {
      const filePath = join(tmpDir, 'encrypted-new.yml');
      const data = { privateKey: 'ABCDEF1234567890' };
      const password = 'my-password';
      await YamlUtils.writeYaml(filePath, data, password);

      const result = YamlUtils.loadYamlWithUpgradeInfo(filePath, password);

      expect(result.data).toEqual(data);
      expect(result.hasLegacyUpgrade).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // writeTextFile / readTextFile / loadFileAsText
  // ---------------------------------------------------------------------------
  describe('writeTextFile / readTextFile / loadFileAsText', () => {
    it('writeTextFile でテキストを書き込み loadFileAsText で読み込めること', async () => {
      const filePath = join(tmpDir, 'text.txt');

      await YamlUtils.writeTextFile(filePath, 'hello world');
      const content = YamlUtils.loadFileAsText(filePath);

      expect(content).toBe('hello world');
    });

    it('writeTextFile で存在しない親ディレクトリも含めて作成されること', async () => {
      const filePath = join(tmpDir, 'deep', 'nested', 'dir', 'text.txt');

      await YamlUtils.writeTextFile(filePath, 'nested content');

      expect(existsSync(filePath)).toBe(true);
      expect(YamlUtils.loadFileAsText(filePath)).toBe('nested content');
    });

    it('readTextFile でテキストを非同期に読み込めること', async () => {
      const filePath = join(tmpDir, 'async.txt');
      await YamlUtils.writeTextFile(filePath, 'async content');

      const content = await YamlUtils.readTextFile(filePath);

      expect(content).toBe('async content');
    });
  });
});
