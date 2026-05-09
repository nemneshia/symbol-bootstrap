import { describe, expect, it } from 'vitest';

import { SymbolCryptoAdapter } from '../../src/sdk/adapters/SymbolCryptoAdapter.js';
import { NetworkType } from '../../src/sdk/types/NetworkType.js';
import { ConfigurationUtils } from '../../src/utils/ConfigurationUtils.js';

/**
 * ConfigurationUtils クラスのユニットテスト。
 * アカウント変換・ロール解決・Nemesis 判定ロジックを検証する。
 */
describe('ConfigurationUtils', () => {
  const adapter = new SymbolCryptoAdapter();
  const PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';

  describe('toAccount', () => {
    it('秘密鍵からアカウントを生成できること', () => {
      const account = ConfigurationUtils.toAccount(
        NetworkType.TEST_NET,
        undefined,
        PRIVATE_KEY,
        adapter
      );

      expect(account).toBeDefined();
      expect(account?.privateKey?.toUpperCase()).toBe(PRIVATE_KEY.toUpperCase());
      expect(account?.publicKey).toBeDefined();
      expect(account?.address).toMatch(/^T/);
    });

    it('公開鍵のみでアカウント情報を返すこと', () => {
      const full = adapter.createAccountFromPrivateKey(PRIVATE_KEY, NetworkType.TEST_NET);
      const account = ConfigurationUtils.toAccount(
        NetworkType.TEST_NET,
        full.publicKey,
        undefined,
        adapter
      );

      expect(account).toBeDefined();
      expect(account?.publicKey).toBe(full.publicKey);
      // privateKey は含まれない
      expect(account?.privateKey).toBeUndefined();
    });

    it('どちらも指定しない場合は undefined を返すこと', () => {
      const account = ConfigurationUtils.toAccount(
        NetworkType.TEST_NET,
        undefined,
        undefined,
        adapter
      );

      expect(account).toBeUndefined();
    });

    it('秘密鍵と公開鍵が一致する場合は正常に返すこと', () => {
      const full = adapter.createAccountFromPrivateKey(PRIVATE_KEY, NetworkType.TEST_NET);
      const account = ConfigurationUtils.toAccount(
        NetworkType.TEST_NET,
        full.publicKey,
        PRIVATE_KEY,
        adapter
      );

      expect(account).toBeDefined();
    });

    it('秘密鍵と公開鍵が不一致の場合はエラーをスローすること', () => {
      const wrongPublicKey = 'A'.repeat(64);

      expect(() =>
        ConfigurationUtils.toAccount(NetworkType.TEST_NET, wrongPublicKey, PRIVATE_KEY, adapter)
      ).toThrow('指定された公開鍵と秘密鍵の組み合わせが不正です。');
    });
  });

  describe('toConfigAccount', () => {
    it('秘密鍵・公開鍵・アドレスを含む ConfigAccount を返すこと', () => {
      const input = { privateKey: 'PK', publicKey: 'PUB', address: 'ADDR' };
      const result = ConfigurationUtils.toConfigAccount(input);

      expect(result.privateKey).toBe('PK');
      expect(result.publicKey).toBe('PUB');
      expect(result.address).toBe('ADDR');
    });

    it('秘密鍵がない場合は公開鍵とアドレスのみを返すこと', () => {
      const input = { publicKey: 'PUB', address: 'ADDR' };
      const result = ConfigurationUtils.toConfigAccount(input);

      expect(result.publicKey).toBe('PUB');
      expect(result.address).toBe('ADDR');
      expect(result.privateKey).toBeUndefined();
    });
  });

  describe('toConfigAccountFomKeys', () => {
    it('秘密鍵から ConfigAccount を生成できること', () => {
      const result = ConfigurationUtils.toConfigAccountFomKeys(
        NetworkType.TEST_NET,
        undefined,
        PRIVATE_KEY,
        adapter
      );

      expect(result).toBeDefined();
      expect(result?.privateKey?.toUpperCase()).toBe(PRIVATE_KEY.toUpperCase());
    });

    it('どちらも指定しない場合は undefined を返すこと', () => {
      const result = ConfigurationUtils.toConfigAccountFomKeys(
        NetworkType.TEST_NET,
        undefined,
        undefined,
        adapter
      );

      expect(result).toBeUndefined();
    });
  });

  describe('resolveRoles', () => {
    it('roles フィールドが指定されている場合はその値を返すこと', () => {
      const nodePreset = { roles: 'CustomRole,Api' } as any;

      const result = ConfigurationUtils.resolveRoles(nodePreset);

      expect(result).toBe('CustomRole,Api');
    });

    it('syncsource フラグから Peer ロールを生成すること', () => {
      const nodePreset = { syncsource: true } as any;

      const result = ConfigurationUtils.resolveRoles(nodePreset);

      expect(result).toBe('Peer');
    });

    it('api フラグから Api ロールを生成すること', () => {
      const nodePreset = { api: true } as any;

      const result = ConfigurationUtils.resolveRoles(nodePreset);

      expect(result).toBe('Api');
    });

    it('voting フラグから Voting ロールを生成すること', () => {
      const nodePreset = { voting: true } as any;

      const result = ConfigurationUtils.resolveRoles(nodePreset);

      expect(result).toBe('Voting');
    });

    it('複数のフラグからカンマ区切りのロールを生成すること', () => {
      const nodePreset = { syncsource: true, api: true } as any;

      const result = ConfigurationUtils.resolveRoles(nodePreset);

      expect(result).toBe('Peer,Api');
    });

    it('すべてのフラグから 3 つのロールを生成すること', () => {
      const nodePreset = { syncsource: true, api: true, voting: true } as any;

      const result = ConfigurationUtils.resolveRoles(nodePreset);

      expect(result).toBe('Peer,Api,Voting');
    });

    it('フラグが何もない場合は空文字を返すこと', () => {
      const nodePreset = {} as any;

      const result = ConfigurationUtils.resolveRoles(nodePreset);

      expect(result).toBe('');
    });
  });
});
