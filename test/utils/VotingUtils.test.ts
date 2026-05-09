import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import { SymbolCryptoAdapter } from '../../src/sdk/adapters/SymbolCryptoAdapter.js';
import { VotingUtils } from '../../src/utils/VotingUtils.js';

/**
 * VotingUtils クラスのユニットテスト。
 * 投票キーファイルの生成・読み込みロジックを検証する。
 */
describe('VotingUtils', () => {
  const cryptoPort = new SymbolCryptoAdapter();
  let votingUtils: VotingUtils;

  beforeEach(() => {
    votingUtils = new VotingUtils(VotingUtils.nobleImplementation, cryptoPort);
  });

  describe('insert', () => {
    it('Uint8Array にデータを挿入してインデックスを進めること', () => {
      const result = new Uint8Array(10);
      const value = new Uint8Array([1, 2, 3]);

      const newIndex = votingUtils.insert(result, value, 0);

      expect(newIndex).toBe(3);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(3);
    });

    it('オフセットを指定してデータを挿入できること', () => {
      const result = new Uint8Array(10);
      const value = new Uint8Array([5, 6]);

      const newIndex = votingUtils.insert(result, value, 5);

      expect(newIndex).toBe(7);
      expect(result[5]).toBe(5);
      expect(result[6]).toBe(6);
    });
  });

  describe('createVotingFile と readVotingFile', () => {
    it('投票キーファイルを作成して読み込めること（ラウンドトリップ）', async () => {
      // 32バイトの秘密鍵（テスト用固定値）
      const secretKey = 'A'.repeat(64);
      const startEpoch = 1;
      const endEpoch = 3;

      // テスト用の固定秘密鍵（3エポック分）
      const testPrivateKeys = Array.from({ length: 3 }, (_, i) => new Uint8Array(32).fill(i + 1));

      const fileData = await votingUtils.createVotingFile(
        secretKey,
        startEpoch,
        endEpoch,
        testPrivateKeys
      );

      expect(fileData).toBeInstanceOf(Uint8Array);

      const account = votingUtils.readVotingFile(fileData);

      expect(account.startEpoch).toBe(startEpoch);
      expect(account.endEpoch).toBe(endEpoch);
      expect(account.publicKey).toBeTruthy();
      expect(account.publicKey).toHaveLength(64); // 32バイトの16進文字列
    });

    it('不正なサイズの投票ファイルを読み込むとエラーをスローすること', () => {
      const invalidData = new Uint8Array(10); // 正しくないサイズ

      expect(() => votingUtils.readVotingFile(invalidData)).toThrow(
        '投票キーファイル形式が不正です'
      );
    });

    it('無効なサイズの秘密鍵でエラーをスローすること', async () => {
      const secretKey = 'A'.repeat(64);
      const startEpoch = 1;
      const endEpoch = 2;

      // 不正なサイズの秘密鍵（31バイト）
      const invalidPrivateKeys = [new Uint8Array(31), new Uint8Array(32)];

      await expect(
        votingUtils.createVotingFile(secretKey, startEpoch, endEpoch, invalidPrivateKeys)
      ).rejects.toThrow('秘密鍵サイズが不正です');
    });
  });

  describe('loadVotingFiles', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'sb-voting-test-'));
    });

    afterEach(() => {
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('存在しないフォルダーを指定した場合は空配列を返すこと', () => {
      const result = votingUtils.loadVotingFiles(join(tmpDir, 'nonexistent'));

      expect(result).toEqual([]);
    });

    it('投票キーファイルがないフォルダーを指定した場合は空配列を返すこと', () => {
      const emptyDir = join(tmpDir, 'empty');
      mkdirSync(emptyDir);

      const result = votingUtils.loadVotingFiles(emptyDir);

      expect(result).toEqual([]);
    });

    it('private_key_tree*.dat ファイルのみを読み込むこと', async () => {
      const votingDir = join(tmpDir, 'voting');
      mkdirSync(votingDir);

      // 有効な投票キーファイルを作成する
      const secretKey = 'A'.repeat(64);
      const testPrivateKeys = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2)];
      const fileData = await votingUtils.createVotingFile(secretKey, 1, 2, testPrivateKeys);
      writeFileSync(join(votingDir, 'private_key_tree1.dat'), fileData);

      // 無視されるべきファイルも作成する
      writeFileSync(join(votingDir, 'other_file.txt'), 'ignored');
      writeFileSync(join(votingDir, 'some.dat'), 'also ignored');

      const result = votingUtils.loadVotingFiles(votingDir);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('private_key_tree1.dat');
      expect(result[0].startEpoch).toBe(1);
      expect(result[0].endEpoch).toBe(2);
    });

    it('複数の投票キーファイルを startEpoch でソートして返すこと', async () => {
      const votingDir = join(tmpDir, 'voting-multi');
      mkdirSync(votingDir);

      const secretKey = 'B'.repeat(64);

      // エポック 10-11 と エポック 1-2 を逆順で作成する
      const fileData1 = await votingUtils.createVotingFile(secretKey, 10, 11, [
        new Uint8Array(32).fill(1),
        new Uint8Array(32).fill(2),
      ]);
      const fileData2 = await votingUtils.createVotingFile(secretKey, 1, 2, [
        new Uint8Array(32).fill(3),
        new Uint8Array(32).fill(4),
      ]);

      writeFileSync(join(votingDir, 'private_key_tree2.dat'), fileData1);
      writeFileSync(join(votingDir, 'private_key_tree1.dat'), fileData2);

      const result = votingUtils.loadVotingFiles(votingDir);

      expect(result).toHaveLength(2);
      // startEpoch でソートされること
      expect(result[0].startEpoch).toBe(1);
      expect(result[1].startEpoch).toBe(10);
    });
  });

  describe('tweetNaClImplementation', () => {
    it('互換別名実装でも投票ファイルを作成・読み込みできること', async () => {
      const tweetNaClUtils = new VotingUtils(VotingUtils.tweetNaClImplementation, cryptoPort);
      const secretKey = 'C'.repeat(64);
      const testPrivateKeys = [new Uint8Array(32).fill(5)];

      const fileData = await tweetNaClUtils.createVotingFile(secretKey, 5, 5, testPrivateKeys);
      const account = tweetNaClUtils.readVotingFile(fileData);

      expect(account.startEpoch).toBe(5);
      expect(account.endEpoch).toBe(5);
    });
  });

  describe('implementations', () => {
    it('noble 実装と互換別名実装の2つが定義されていること', () => {
      expect(VotingUtils.implementations).toHaveLength(2);
      expect(VotingUtils.implementations[0].name).toBe('Noble');
      expect(VotingUtils.implementations[1].name).toBe('Noble (Legacy Alias)');
    });
  });
});
