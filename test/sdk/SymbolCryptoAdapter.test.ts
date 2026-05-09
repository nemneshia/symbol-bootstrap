import { describe, expect, it } from 'vitest';

import { SymbolCryptoAdapter } from '../../src/sdk/adapters/SymbolCryptoAdapter.js';
import { NetworkType } from '../../src/sdk/types/NetworkType.js';

/**
 * SymbolCryptoAdapter クラスのユニットテスト。
 * ICryptoPort の本番実装を検証する。
 */
describe('SymbolCryptoAdapter', () => {
  const adapter = new SymbolCryptoAdapter();

  /** テスト用の既知の秘密鍵（決定論的な検証に使用）*/
  const KNOWN_PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';

  describe('generateAccount', () => {
    it('MAIN_NET でアカウントを生成できること', () => {
      const account = adapter.generateAccount(NetworkType.MAIN_NET);

      // 秘密鍵・公開鍵・アドレスが揃っていること
      expect(account.privateKey).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(account.publicKey).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(account.address).toMatch(/^N/); // メインネットは 'N' 始まり
    });

    it('TEST_NET でアカウントを生成できること', () => {
      const account = adapter.generateAccount(NetworkType.TEST_NET);

      expect(account.privateKey).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(account.address).toMatch(/^T/); // テストネットは 'T' 始まり
    });

    it('呼ぶたびに異なるアカウントを生成すること（乱数性）', () => {
      const a1 = adapter.generateAccount(NetworkType.TEST_NET);
      const a2 = adapter.generateAccount(NetworkType.TEST_NET);

      expect(a1.privateKey).not.toBe(a2.privateKey);
    });
  });

  describe('createAccountFromPrivateKey', () => {
    it('既知の秘密鍵から決定論的にアカウントを生成すること', () => {
      const account = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);

      // 秘密鍵は大文字小文字を問わず一致すること
      expect(account.privateKey.toUpperCase()).toBe(KNOWN_PRIVATE_KEY.toUpperCase());
      // テストネットのアドレスは 'T' 始まり
      expect(account.address).toMatch(/^T/);
    });

    it('同じ秘密鍵から常に同じ結果を返すこと（冪等性）', () => {
      const a1 = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const a2 = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);

      expect(a1.publicKey).toBe(a2.publicKey);
      expect(a1.address).toBe(a2.address);
    });

    it('MAIN_NET と TEST_NET でアドレスが異なること', () => {
      const mainNet = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.MAIN_NET);
      const testNet = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);

      // 同じ秘密鍵でもネットワークが違えばアドレスが異なる
      expect(mainNet.address).not.toBe(testNet.address);
      expect(mainNet.address).toMatch(/^N/);
      expect(testNet.address).toMatch(/^T/);
    });
  });

  describe('createPublicAccount', () => {
    it('秘密鍵から導出した公開鍵でアカウントを作成できること', () => {
      const full = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const publicOnly = adapter.createPublicAccount(full.publicKey, NetworkType.TEST_NET);

      // 公開鍵とアドレスは一致すること
      expect(publicOnly.publicKey).toBe(full.publicKey);
      expect(publicOnly.address).toBe(full.address);
      // privateKey は含まれないこと
      expect((publicOnly as any).privateKey).toBeUndefined();
    });
  });

  describe('getAddressFromPublicKey', () => {
    it('公開鍵からアドレスを導出できること', () => {
      const account = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const address = adapter.getAddressFromPublicKey(account.publicKey, NetworkType.TEST_NET);

      expect(address).toBe(account.address);
    });
  });

  describe('encrypt / decrypt', () => {
    it('暗号化した値を復号化できること（ラウンドトリップ）', () => {
      const original = 'テストシークレット値';
      const password = 'securePassword123';

      const encrypted = adapter.encrypt(original, password);
      const decrypted = adapter.decrypt(encrypted, password);

      expect(decrypted).toBe(original);
    });

    it('暗号化のたびに異なる暗号文を生成すること（IVのランダム性）', () => {
      const value = 'テスト値';
      const password = 'pass';

      const e1 = adapter.encrypt(value, password);
      const e2 = adapter.encrypt(value, password);

      expect(e1).not.toBe(e2);
    });

    it('異なるパスワードで復号化するとエラーになること', () => {
      const encrypted = adapter.encrypt('秘密値', 'correctPassword');

      expect(() => adapter.decrypt(encrypted, 'wrongPassword')).toThrow();
    });

    it('秘密鍵（64文字hex）のラウンドトリップが正常に動作すること', () => {
      const privateKey = KNOWN_PRIVATE_KEY.toUpperCase();
      const password = 'testPassword';

      const encrypted = adapter.encrypt(privateKey, password);
      const decrypted = adapter.decrypt(encrypted, password);

      expect(decrypted.toUpperCase()).toBe(privateKey);
    });
  });

  describe('randomBytes / randomHex', () => {
    it('指定したバイト数のランダムバイト列を返すこと', () => {
      const bytes = adapter.randomBytes(16);

      expect(bytes).toHaveLength(16);
    });

    it('指定したバイト数の16進文字列を返すこと', () => {
      const hex = adapter.randomHex(16);

      // 16バイト = 32文字の16進文字列
      expect(hex).toHaveLength(32);
      expect(hex).toMatch(/^[0-9A-Fa-f]+$/);
    });
  });

  describe('hexToUint8 / uint8ToHex', () => {
    it('16進文字列をUint8Arrayに変換できること', () => {
      const hex = 'DEADBEEF';
      const bytes = adapter.hexToUint8(hex);

      expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it('Uint8Arrayを16進文字列に変換できること', () => {
      const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const hex = adapter.uint8ToHex(bytes);

      expect(hex.toUpperCase()).toBe('DEADBEEF');
    });

    it('16進文字列のラウンドトリップが正常に動作すること', () => {
      const original = 'AABBCCDD00112233';
      const hex = adapter.uint8ToHex(adapter.hexToUint8(original));

      expect(hex.toUpperCase()).toBe(original.toUpperCase());
    });
  });

  describe('numberToUint8Array / uintArray8ToNumber', () => {
    it('数値をリトルエンディアンのUint8Arrayに変換できること', () => {
      // 256 = 0x100 → [0x00, 0x01] in little-endian (2 bytes)
      const bytes = adapter.numberToUint8Array(256, 2);

      expect(bytes[0]).toBe(0x00);
      expect(bytes[1]).toBe(0x01);
    });

    it('Uint8Arrayを数値に変換できること（リトルエンディアン）', () => {
      const bytes = new Uint8Array([0x00, 0x01]);
      const num = adapter.uintArray8ToNumber(bytes);

      expect(num).toBe(256);
    });

    it('数値変換のラウンドトリップが正常に動作すること', () => {
      const original = 12345678;
      const bytes = adapter.numberToUint8Array(original, 4);
      const restored = adapter.uintArray8ToNumber(bytes);

      expect(restored).toBe(original);
    });
  });

  describe('isHexString', () => {
    it('有効な16進文字列を正しく判定すること', () => {
      expect(adapter.isHexString('DEADBEEF')).toBe(true);
      expect(adapter.isHexString('deadbeef')).toBe(true);
      expect(adapter.isHexString('0123456789ABCDEF')).toBe(true);
    });

    it('無効な文字を含む場合は false を返すこと', () => {
      expect(adapter.isHexString('GHIJKLMN')).toBe(false);
      expect(adapter.isHexString('DEADBEEF!')).toBe(false);
    });

    it('byteCount を指定した場合、文字列長が byteCount と等しい場合のみ true を返すこと', () => {
      // 実装は value.length === byteCount で比較する（文字数 = byteCount）
      expect(adapter.isHexString('DEADBEEF', 8)).toBe(true); // 8文字の文字列、byteCount=8 → 一致
      expect(adapter.isHexString('DEADBEEF', 4)).toBe(false); // 8文字の文字列、byteCount=4 → 不一致
    });
  });

  describe('parseServerDurationToSeconds', () => {
    it('秒表記を正しく変換すること', () => {
      expect(adapter.parseServerDurationToSeconds('30s')).toBe(30);
    });

    it('分表記を正しく変換すること', () => {
      expect(adapter.parseServerDurationToSeconds('1m')).toBe(60);
      expect(adapter.parseServerDurationToSeconds('10m')).toBe(600);
    });

    it('時間表記を正しく変換すること', () => {
      expect(adapter.parseServerDurationToSeconds('1h')).toBe(3600);
    });

    it('日表記を正しく変換すること', () => {
      expect(adapter.parseServerDurationToSeconds('1d')).toBe(86400);
    });

    it('複合表記を正しく変換すること', () => {
      // 1時間30分 = 5400秒
      expect(adapter.parseServerDurationToSeconds('1h30m')).toBe(5400);
    });

    it('不正なフォーマットでエラーをスローすること', () => {
      expect(() => adapter.parseServerDurationToSeconds('')).toThrow('期間フォーマットが不正です');
      expect(() => adapter.parseServerDurationToSeconds('invalid')).toThrow(
        '期間フォーマットが不正です'
      );
    });
  });

  describe('createMosaicId', () => {
    it('正常なアドレスとナンス番号からモザイクIDを生成できること', () => {
      const account = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const mosaicId = adapter.createMosaicId(0, account.address);

      // モザイクIDは16文字の16進文字列であること
      expect(mosaicId).toMatch(/^[0-9A-Fa-f]{16}$/);
    });

    it('同じナンスとアドレスから決定論的に同じモザイクIDを生成すること', () => {
      const account = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const id1 = adapter.createMosaicId(0, account.address);
      const id2 = adapter.createMosaicId(0, account.address);

      expect(id1).toBe(id2);
    });

    it('異なるナンスから異なるモザイクIDを生成すること', () => {
      const account = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const id0 = adapter.createMosaicId(0, account.address);
      const id1 = adapter.createMosaicId(1, account.address);

      expect(id0).not.toBe(id1);
    });
  });
});
