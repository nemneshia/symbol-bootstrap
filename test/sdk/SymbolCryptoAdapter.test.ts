import { expect } from 'vitest';
import { SymbolCryptoAdapter } from '../../src/sdk/index.js';
import { NetworkType } from '../../src/sdk/types/NetworkType.js';

const adapter = new SymbolCryptoAdapter();

// symbol-sdk が TEST_NET (152) アドレスに使う Base32 文字セット
const BASE32_ADDR_RE = /^[A-Z2-7]{39}$/;

// 既知の秘密鍵（決定論的テスト用）
const KNOWN_PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';

describe('SymbolCryptoAdapter', () => {
  // ---------------------------------------------------------------
  describe('generateAccount', () => {
    it('MAIN_NET で GeneratedAccount の形状を持つオブジェクトを返す', () => {
      const account = adapter.generateAccount(NetworkType.MAIN_NET);
      expect(account.privateKey).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(account.publicKey).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(account.address).toMatch(/^N/);
    });

    it('TEST_NET で GeneratedAccount の形状を持つオブジェクトを返す', () => {
      const account = adapter.generateAccount(NetworkType.TEST_NET);
      expect(account.privateKey).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(account.publicKey).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(account.address).toMatch(/^T/);
    });

    it('呼ぶたびに異なるアカウントを生成する（乱数性）', () => {
      const a1 = adapter.generateAccount(NetworkType.TEST_NET);
      const a2 = adapter.generateAccount(NetworkType.TEST_NET);
      expect(a1.privateKey).not.eq(a2.privateKey);
    });
  });

  // ---------------------------------------------------------------
  describe('createAccountFromPrivateKey', () => {
    it('既知の秘密鍵から TEST_NET アカウントを決定論的に生成する', () => {
      const account = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      expect(account.privateKey.toUpperCase()).eq(KNOWN_PRIVATE_KEY.toUpperCase());
      expect(account.publicKey).toMatch(/^[0-9A-Fa-f]{64}$/);
      expect(account.address).toMatch(/^T/);
    });

    it('既知の秘密鍵から MAIN_NET アカウントを決定論的に生成する', () => {
      const account = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.MAIN_NET);
      expect(account.privateKey.toUpperCase()).eq(KNOWN_PRIVATE_KEY.toUpperCase());
      expect(account.address).toMatch(/^N/);
    });

    it('同じ秘密鍵から常に同一の結果を返す（冪等性）', () => {
      const a1 = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const a2 = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      expect(a1).deep.eq(a2);
    });
  });

  // ---------------------------------------------------------------
  describe('createPublicAccount', () => {
    it('公開鍵からアドレスを導出する (TEST_NET)', () => {
      const generated = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const publicAccount = adapter.createPublicAccount(generated.publicKey, NetworkType.TEST_NET);
      expect(publicAccount.publicKey).eq(generated.publicKey);
      expect(publicAccount.address).eq(generated.address);
    });

    it('公開鍵からアドレスを導出する (MAIN_NET)', () => {
      const generated = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.MAIN_NET);
      const publicAccount = adapter.createPublicAccount(generated.publicKey, NetworkType.MAIN_NET);
      expect(publicAccount.publicKey).eq(generated.publicKey);
      expect(publicAccount.address).eq(generated.address);
    });
  });

  // ---------------------------------------------------------------
  describe('getAddressFromPublicKey', () => {
    it('TEST_NET の公開鍵からアドレスを返す', () => {
      const generated = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const address = adapter.getAddressFromPublicKey(generated.publicKey, NetworkType.TEST_NET);
      expect(address).eq(generated.address);
    });

    it('MAIN_NET の公開鍵からアドレスを返す', () => {
      const generated = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.MAIN_NET);
      const address = adapter.getAddressFromPublicKey(generated.publicKey, NetworkType.MAIN_NET);
      expect(address).eq(generated.address);
    });
  });

  // ---------------------------------------------------------------
  describe('createAddressFromRawAddress', () => {
    it('生アドレス（plain 形式）を渡して同一アドレスが返る（ラウンドトリップ）', () => {
      const generated = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const address = adapter.createAddressFromRawAddress(generated.address);
      expect(address).eq(generated.address);
    });

    it('MAIN_NET アドレスのラウンドトリップ', () => {
      const generated = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.MAIN_NET);
      const address = adapter.createAddressFromRawAddress(generated.address);
      expect(address).eq(generated.address);
    });
  });

  // ---------------------------------------------------------------
  describe('createMosaicId', () => {
    it('16 文字の 16 進数文字列を返す', () => {
      const { address } = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const id = adapter.createMosaicId(0, address);
      expect(id).toMatch(/^[0-9A-Fa-f]{16}$/);
    });

    it('同一引数で常に同一の ID を返す（決定論的）', () => {
      const { address } = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const id1 = adapter.createMosaicId(0, address);
      const id2 = adapter.createMosaicId(0, address);
      expect(id1).eq(id2);
    });

    it('nonce が異なれば異なる ID が返る', () => {
      const { address } = adapter.createAccountFromPrivateKey(KNOWN_PRIVATE_KEY, NetworkType.TEST_NET);
      const id1 = adapter.createMosaicId(0, address);
      const id2 = adapter.createMosaicId(1, address);
      expect(id1).not.eq(id2);
    });
  });

  // ---------------------------------------------------------------
  describe('randomBytes', () => {
    it('randomBytes(16) → 長さ 16 の Uint8Array', () => {
      const bytes = adapter.randomBytes(16);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toHaveLength(16);
    });

    it('randomBytes(32) → 長さ 32 の Uint8Array', () => {
      expect(adapter.randomBytes(32)).toHaveLength(32);
    });

    it('連続呼び出しで（ほぼ）異なる値を返す', () => {
      const a = adapter.randomBytes(32);
      const b = adapter.randomBytes(32);
      // 全バイトが一致する確率は天文学的に低いため比較
      expect(Buffer.from(a).toString('hex')).not.eq(Buffer.from(b).toString('hex'));
    });
  });

  // ---------------------------------------------------------------
  describe('randomHex', () => {
    it('randomHex(16) → 長さ 32（16 バイト × 2）の文字列', () => {
      const hex = adapter.randomHex(16);
      expect(hex).toHaveLength(32);
    });

    it('返値が有効な 16 進数文字列である', () => {
      const hex = adapter.randomHex(8);
      expect(adapter.isHexString(hex)).eq(true);
    });
  });

  // ---------------------------------------------------------------
  describe('hexToUint8 / uint8ToHex', () => {
    it('uint8ToHex(hexToUint8(hex)) でラウンドトリップ', () => {
      const hex = 'DEADBEEF0102030405060708090A0B0C';
      const bytes = adapter.hexToUint8(hex);
      expect(adapter.uint8ToHex(bytes)).eq(hex);
    });

    it('hexToUint8 が正しいバイト値を返す', () => {
      const bytes = adapter.hexToUint8('0102FF');
      expect(bytes[0]).eq(0x01);
      expect(bytes[1]).eq(0x02);
      expect(bytes[2]).eq(0xff);
    });

    it('uint8ToHex が大文字の 16 進数文字列を返す', () => {
      const hex = adapter.uint8ToHex(Uint8Array.from([0xde, 0xad]));
      expect(hex).eq('DEAD');
    });
  });

  // ---------------------------------------------------------------
  describe('numberToUint8Array / uintArray8ToNumber', () => {
    it('ラウンドトリップ: uintArray8ToNumber(numberToUint8Array(n, size)) === n', () => {
      expect(adapter.uintArray8ToNumber(adapter.numberToUint8Array(42, 4))).eq(42);
      expect(adapter.uintArray8ToNumber(adapter.numberToUint8Array(0, 4))).eq(0);
      expect(adapter.uintArray8ToNumber(adapter.numberToUint8Array(255, 1))).eq(255);
    });

    it('numberToUint8Array が指定サイズの Uint8Array を返す', () => {
      expect(adapter.numberToUint8Array(1, 4)).toHaveLength(4);
      expect(adapter.numberToUint8Array(1, 2)).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------
  describe('isHexString', () => {
    it('有効な 16 進数文字列で true を返す', () => {
      expect(adapter.isHexString('AABB1234')).eq(true);
      expect(adapter.isHexString('aabbccdd')).eq(true);
      expect(adapter.isHexString('00FF')).eq(true);
    });

    it('無効な文字列で false を返す', () => {
      expect(adapter.isHexString('ZZZZ')).eq(false);
      expect(adapter.isHexString('hello')).eq(false);
      expect(adapter.isHexString('XY')).eq(false);
    });

    it('expectedSize 指定時: 文字数が一致すれば true、不一致なら false', () => {
      // expectedSize は文字数（hex chars）として比較される
      expect(adapter.isHexString('AABB', 4)).eq(true); // 4 文字 === 4
      expect(adapter.isHexString('AA', 2)).eq(true); // 2 文字 === 2
      expect(adapter.isHexString('AABB', 2)).eq(false); // 4 文字 !== 2
      expect(adapter.isHexString('AABBCCDD', 4)).eq(false); // 8 文字 !== 4
    });

    it('byteCount 省略時は文字数チェックなし', () => {
      expect(adapter.isHexString('AA')).eq(true);
      expect(adapter.isHexString('AAAA')).eq(true);
    });
  });

  // ---------------------------------------------------------------
  describe('encrypt / decrypt', () => {
    it('decrypt(encrypt(value, password), password) === value（ラウンドトリップ）', () => {
      const plaintext = 'hello symbol bootstrap!';
      const password = 'my_secure_p@ssw0rd';
      const encrypted = adapter.encrypt(plaintext, password);
      expect(encrypted).not.eq(plaintext);
      const decrypted = adapter.decrypt(encrypted, password);
      expect(decrypted).eq(plaintext);
    });

    it('空文字列もラウンドトリップ可能', () => {
      const encrypted = adapter.encrypt('', 'password');
      expect(adapter.decrypt(encrypted, 'password')).eq('');
    });

    it('暗号化結果は毎回異なる（IV/salt のランダム性）', () => {
      const e1 = adapter.encrypt('test', 'password');
      const e2 = adapter.encrypt('test', 'password');
      expect(e1).not.eq(e2);
    });
  });

  // ---------------------------------------------------------------
  describe('parseServerDurationToSeconds', () => {
    it("'30s' → 30 秒", () => {
      expect(adapter.parseServerDurationToSeconds('30s')).eq(30);
    });

    it("'1m' → 60 秒", () => {
      expect(adapter.parseServerDurationToSeconds('1m')).eq(60);
    });

    it("'1h' → 3600 秒", () => {
      expect(adapter.parseServerDurationToSeconds('1h')).eq(3600);
    });

    it("'1d' → 86400 秒", () => {
      expect(adapter.parseServerDurationToSeconds('1d')).eq(86400);
    });

    it("'1h30m' → 5400 秒", () => {
      expect(adapter.parseServerDurationToSeconds('1h30m')).eq(5400);
    });

    it("'2h30m15s' → 複合フォーマットの変換", () => {
      expect(adapter.parseServerDurationToSeconds('2h30m15s')).eq(2 * 3600 + 30 * 60 + 15);
    });

    it('無効なフォーマットは例外をスロー', () => {
      expect(() => adapter.parseServerDurationToSeconds('invalid')).toThrow();
    });

    it("'0s' → 0 秒", () => {
      expect(adapter.parseServerDurationToSeconds('0s')).eq(0);
    });
  });
});
