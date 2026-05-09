import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NetworkType } from '../../src/sdk/types/NetworkType.js';
import { DefaultAccountResolver, KeyName } from '../../src/service/AccountResolver.js';

/**
 * DefaultAccountResolver クラスのユニットテスト。
 * アカウント解決ロジック（新規生成・既存鍵からの復元）を検証する。
 */
describe('DefaultAccountResolver', () => {
  const PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
  let resolver: DefaultAccountResolver;

  /** モック用の ICryptoPort */
  const mockCryptoPort = {
    generateAccount: vi.fn(),
    createAccountFromPrivateKey: vi.fn(),
    createPublicAccount: vi.fn(),
    getAddressFromPublicKey: vi.fn(),
    createAddressFromRawAddress: vi.fn(),
    createMosaicId: vi.fn(),
    randomBytes: vi.fn(),
    randomHex: vi.fn(),
    hexToUint8: vi.fn(),
    uint8ToHex: vi.fn(),
    numberToUint8Array: vi.fn(),
    uintArray8ToNumber: vi.fn(),
    isHexString: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    parseServerDurationToSeconds: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new DefaultAccountResolver(mockCryptoPort as any);
  });

  describe('resolveAccount', () => {
    it('account が undefined の場合、generateErrorMessage がなければ新規生成すること', async () => {
      const newAccount = { privateKey: PRIVATE_KEY, publicKey: 'PUB', address: 'TADDR' };
      mockCryptoPort.generateAccount.mockReturnValue(newAccount);

      const result = await resolver.resolveAccount(
        NetworkType.TEST_NET,
        undefined,
        KeyName.Main,
        'node1',
        'テスト操作',
        undefined // generateErrorMessage なし → 新規生成
      );

      expect(result).toEqual(newAccount);
      expect(mockCryptoPort.generateAccount).toHaveBeenCalledWith(NetworkType.TEST_NET);
    });

    it('account が undefined で generateErrorMessage がある場合、エラーをスローすること', async () => {
      const errorMessage = 'アカウントが必要です';

      await expect(
        resolver.resolveAccount(
          NetworkType.TEST_NET,
          undefined,
          KeyName.Main,
          'node1',
          'テスト操作',
          errorMessage
        )
      ).rejects.toThrow(errorMessage);
    });

    it('privateKey を持つ account から秘密鍵でアカウントを復元すること', async () => {
      const restoredAccount = { privateKey: PRIVATE_KEY, publicKey: 'PUB', address: 'TADDR' };
      mockCryptoPort.createAccountFromPrivateKey.mockReturnValue(restoredAccount);

      const result = await resolver.resolveAccount(
        NetworkType.TEST_NET,
        { privateKey: PRIVATE_KEY, publicKey: 'PUB' } as any,
        KeyName.Main,
        'node1',
        'テスト操作',
        undefined
      );

      expect(result).toEqual(restoredAccount);
      expect(mockCryptoPort.createAccountFromPrivateKey).toHaveBeenCalledWith(
        PRIVATE_KEY,
        NetworkType.TEST_NET
      );
    });

    it('account に privateKey がない場合、エラーをスローすること', async () => {
      await expect(
        resolver.resolveAccount(
          NetworkType.TEST_NET,
          { publicKey: 'PUB' } as any, // privateKey なし
          KeyName.Main,
          'node1',
          'テスト操作',
          undefined
        )
      ).rejects.toThrow('秘密鍵が指定されていません。');
    });
  });

  describe('generateNewAccount', () => {
    it('指定ネットワークの新規アカウントを生成すること', () => {
      const newAccount = { privateKey: PRIVATE_KEY, publicKey: 'PUB', address: 'TADDR' };
      mockCryptoPort.generateAccount.mockReturnValue(newAccount);

      const result = resolver.generateNewAccount(NetworkType.TEST_NET);

      expect(result).toEqual(newAccount);
      expect(mockCryptoPort.generateAccount).toHaveBeenCalledWith(NetworkType.TEST_NET);
    });
  });
});
