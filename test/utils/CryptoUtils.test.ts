import { describe, expect, it } from 'vitest';

import { PrivateKeySecurityMode } from '../../src/model/index.js';
import { SymbolCryptoAdapter } from '../../src/sdk/index.js';
import { CryptoUtils } from '../../src/utils/CryptoUtils.js';

/**
 * CryptoUtils クラスのユニットテスト。
 * 秘密鍵の暗号化・復号化・セキュリティモード管理を検証する。
 */
describe('CryptoUtils', () => {
  const adapter = new SymbolCryptoAdapter();
  const PASSWORD = 'test_password_1234';
  const PRIVATE_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  describe('encrypt / decrypt のラウンドトリップ', () => {
    it('privateKey フィールドを暗号化・復号化できること', () => {
      const obj = { privateKey: PRIVATE_KEY };

      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);
      const decrypted = CryptoUtils.decrypt(encrypted, PASSWORD);

      expect(decrypted.privateKey.toUpperCase()).toBe(PRIVATE_KEY.toUpperCase());
    });

    it('restSSLKeyBase64 フィールドを暗号化・復号化できること', () => {
      const value = 'restSSLbase64value==';
      const obj = { restSSLKeyBase64: value };

      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);
      const decrypted = CryptoUtils.decrypt(encrypted, PASSWORD);

      expect(decrypted.restSSLKeyBase64).toBe(value);
    });

    it('privateFileContent フィールドを暗号化・復号化できること', () => {
      const value = '-----BEGIN PRIVATE KEY-----\ncontent\n-----END PRIVATE KEY-----';
      const obj = { privateFileContent: value };

      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);
      const decrypted = CryptoUtils.decrypt(encrypted, PASSWORD);

      expect(decrypted.privateFileContent).toBe(value);
    });

    it('暗号化対象外のフィールドは変更しないこと', () => {
      const obj = { address: 'TADDRESS123', otherField: 'value' };

      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);

      // address は暗号化対象外なので変更されない
      expect(encrypted.address).toBe('TADDRESS123');
      expect(encrypted.otherField).toBe('value');
    });

    it('ネストされたオブジェクト内の privateKey も暗号化すること', () => {
      const obj = { node: { main: { privateKey: PRIVATE_KEY } } };

      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);

      expect(encrypted.node.main.privateKey).toMatch(/^ENCRYPTED_V2:/);
    });

    it('配列内の privateKey も暗号化すること', () => {
      const obj = { accounts: [{ privateKey: PRIVATE_KEY }] };

      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);
      const decrypted = CryptoUtils.decrypt(encrypted, PASSWORD);

      expect(decrypted.accounts[0].privateKey.toUpperCase()).toBe(PRIVATE_KEY.toUpperCase());
    });

    it('異なるパスワードで復号化するとエラーになること', () => {
      const obj = { privateKey: PRIVATE_KEY };
      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);

      expect(() => CryptoUtils.decrypt(encrypted, 'wrong_password')).toThrow(
        '値を復号できませんでした。'
      );
    });
  });

  describe('encrypt', () => {
    it('暗号化後の privateKey が ENCRYPTED_V2: プレフィックスを持つこと', () => {
      const obj = { privateKey: PRIVATE_KEY };

      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);

      expect(encrypted.privateKey).toMatch(/^ENCRYPTED_V2:/);
    });

    it('null 値はそのまま返すこと', () => {
      const result = CryptoUtils.encrypt(null, PASSWORD);
      expect(result).toBeNull();
    });

    it('undefined 値はそのまま返すこと', () => {
      const result = CryptoUtils.encrypt(undefined, PASSWORD);
      expect(result).toBeUndefined();
    });
  });

  describe('decrypt', () => {
    it('ENCRYPTED_V2: プレフィックスの値を復号化すること', () => {
      const encrypted = 'ENCRYPTED_V2:' + adapter.encrypt(PRIVATE_KEY, PASSWORD);

      const result = CryptoUtils.decrypt({ privateKey: encrypted }, PASSWORD);

      expect(result.privateKey.toUpperCase()).toBe(PRIVATE_KEY.toUpperCase());
    });

    it('プレフィックスのない平文値はそのまま返すこと', () => {
      const obj = { privateKey: 'not_encrypted_value' };

      // 平文値はそのまま返るはず（パスワード不一致エラーではない）
      const result = CryptoUtils.decrypt(obj, PASSWORD);

      expect(result.privateKey).toBe('not_encrypted_value');
    });
  });

  describe('encryptedCount', () => {
    it('暗号化済みフィールドの数を正確にカウントすること', () => {
      const obj = { privateKey: PRIVATE_KEY };
      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);

      expect(CryptoUtils.encryptedCount(encrypted)).toBe(1);
    });

    it('複数の暗号化済みフィールドをカウントすること', () => {
      const obj = {
        accounts: [{ privateKey: PRIVATE_KEY }, { privateKey: PRIVATE_KEY }],
      };
      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);

      expect(CryptoUtils.encryptedCount(encrypted)).toBe(2);
    });

    it('暗号化されていない場合は 0 を返すこと', () => {
      const obj = { address: 'TADDRESS', publicKey: 'PUBKEY' };

      expect(CryptoUtils.encryptedCount(obj)).toBe(0);
    });

    it('null / undefined に対して 0 を返すこと', () => {
      expect(CryptoUtils.encryptedCount(null)).toBe(0);
      expect(CryptoUtils.encryptedCount(undefined)).toBe(0);
    });
  });

  describe('getPrivateKeySecurityMode', () => {
    it('有効なセキュリティモード文字列を列挙型に変換すること', () => {
      expect(CryptoUtils.getPrivateKeySecurityMode('ENCRYPT')).toBe(PrivateKeySecurityMode.ENCRYPT);
      expect(CryptoUtils.getPrivateKeySecurityMode('PROMPT_MAIN')).toBe(
        PrivateKeySecurityMode.PROMPT_MAIN
      );
      expect(CryptoUtils.getPrivateKeySecurityMode('PROMPT_MAIN_TRANSPORT')).toBe(
        PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT
      );
      expect(CryptoUtils.getPrivateKeySecurityMode('PROMPT_ALL')).toBe(
        PrivateKeySecurityMode.PROMPT_ALL
      );
    });

    it('大文字小文字を区別せずに変換すること', () => {
      expect(CryptoUtils.getPrivateKeySecurityMode('encrypt')).toBe(PrivateKeySecurityMode.ENCRYPT);
    });

    it('undefined/空文字の場合はデフォルト ENCRYPT を返すこと', () => {
      expect(CryptoUtils.getPrivateKeySecurityMode(undefined)).toBe(PrivateKeySecurityMode.ENCRYPT);
      expect(CryptoUtils.getPrivateKeySecurityMode('')).toBe(PrivateKeySecurityMode.ENCRYPT);
    });

    it('不正な値でエラーをスローすること', () => {
      expect(() => CryptoUtils.getPrivateKeySecurityMode('INVALID_MODE')).toThrow(
        '有効な Security Mode ではありません'
      );
    });
  });

  describe('removePrivateKeysAccordingToSecurityMode', () => {
    const testObj = {
      main: { privateKey: PRIVATE_KEY },
      transport: { privateKey: PRIVATE_KEY },
      remote: { privateKey: PRIVATE_KEY },
    };

    it('ENCRYPT モードは voting の秘密鍵のみを削除すること', () => {
      const objWithVoting = { ...testObj, voting: { privateKey: PRIVATE_KEY } };
      const result = CryptoUtils.removePrivateKeysAccordingToSecurityMode(
        objWithVoting,
        PrivateKeySecurityMode.ENCRYPT
      );

      // voting の秘密鍵が削除され、その他は保持される
      expect(result.main.privateKey).toBeDefined();
      expect(result.voting).toEqual({});
    });

    it('PROMPT_MAIN モードは main と voting の秘密鍵を削除すること', () => {
      const objWithVoting = { ...testObj, voting: { privateKey: PRIVATE_KEY } };
      const result = CryptoUtils.removePrivateKeysAccordingToSecurityMode(
        objWithVoting,
        PrivateKeySecurityMode.PROMPT_MAIN
      );

      expect(result.main).toEqual({});
      expect(result.voting).toEqual({});
      expect(result.transport.privateKey).toBeDefined();
    });

    it('PROMPT_ALL モードはすべての秘密鍵を削除すること', () => {
      const result = CryptoUtils.removePrivateKeysAccordingToSecurityMode(
        testObj,
        PrivateKeySecurityMode.PROMPT_ALL
      );

      expect(result.main).toEqual({});
      expect(result.transport).toEqual({});
      expect(result.remote).toEqual({});
    });
  });

  describe('decryptWithUpgradeInfo', () => {
    it('通常の V2 形式では hasLegacyUpgrade が false であること', () => {
      const obj = { privateKey: PRIVATE_KEY };
      const encrypted = CryptoUtils.encrypt(obj, PASSWORD);

      const { data, hasLegacyUpgrade } = CryptoUtils.decryptWithUpgradeInfo(encrypted, PASSWORD);

      expect(data.privateKey.toUpperCase()).toBe(PRIVATE_KEY.toUpperCase());
      expect(hasLegacyUpgrade).toBe(false);
    });
  });
});
