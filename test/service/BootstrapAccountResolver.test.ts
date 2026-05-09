import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { NetworkType } from '../../src/sdk/index.js';
import { KeyName } from '../../src/service/AccountResolver.js';

const passwordMock = vi.fn();

vi.mock('@clack/prompts', () => ({
  password: (...args: any[]) => passwordMock(...args),
  isCancel: (value: unknown) => value === 'cancel',
}));

describe('BootstrapAccountResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('account が undefined かつ generateErrorMessage ありなら KnownError を投げること', async () => {
    const { BootstrapAccountResolver } =
      await import('../../src/service/BootstrapAccountResolver.js');
    const resolver = new BootstrapAccountResolver(LoggerFactory.getLogger(LogType.Silent), {
      generateAccount: vi.fn(),
    } as any);

    await expect(
      resolver.resolveAccount(
        NetworkType.TEST_NET,
        undefined,
        KeyName.Main,
        'api-node',
        '操作',
        '生成禁止'
      )
    ).rejects.toThrow('生成禁止');
  });

  it('privateKey が存在する account は createAccountFromPrivateKey を返すこと', async () => {
    const restored = { publicKey: 'PUB', privateKey: 'PVT', address: 'TADDR' };
    const cryptoPort = {
      createAccountFromPrivateKey: vi.fn().mockReturnValue(restored),
    };
    const { BootstrapAccountResolver } =
      await import('../../src/service/BootstrapAccountResolver.js');
    const resolver = new BootstrapAccountResolver(
      LoggerFactory.getLogger(LogType.Silent),
      cryptoPort as any
    );

    const result = await resolver.resolveAccount(
      NetworkType.TEST_NET,
      { publicKey: 'PUB', privateKey: 'PVT' } as any,
      KeyName.Main,
      'api-node',
      '操作',
      undefined
    );

    expect(result).toEqual(restored);
    expect(cryptoPort.createAccountFromPrivateKey).toHaveBeenCalledWith(
      'PVT',
      NetworkType.TEST_NET
    );
  });

  it('account が undefined かつ generateErrorMessage なしなら新規生成すること', async () => {
    const generated = { publicKey: 'PUB', privateKey: 'PVT', address: 'TADDR' };
    const cryptoPort = {
      generateAccount: vi.fn().mockReturnValue(generated),
    };
    const { BootstrapAccountResolver } =
      await import('../../src/service/BootstrapAccountResolver.js');
    const resolver = new BootstrapAccountResolver(
      LoggerFactory.getLogger(LogType.Silent),
      cryptoPort as any
    );

    const result = await resolver.resolveAccount(
      NetworkType.TEST_NET,
      undefined,
      KeyName.Main,
      'api-node',
      '操作',
      undefined
    );

    expect(result).toEqual(generated);
    expect(cryptoPort.generateAccount).toHaveBeenCalledWith(NetworkType.TEST_NET);
  });

  it('プロンプト入力で空文字・不一致鍵を経て正しい鍵で解決できること', async () => {
    const expected = {
      publicKey: 'A'.repeat(64),
      address: 'TEXPECTED',
      privateKey: 'C'.repeat(64),
    };

    const cryptoPort = {
      getAddressFromPublicKey: vi.fn().mockReturnValue('TADDRESS'),
      createAccountFromPrivateKey: vi
        .fn()
        .mockReturnValueOnce({ publicKey: 'B'.repeat(64), address: 'TWRONG' })
        .mockReturnValueOnce(expected),
    };

    passwordMock
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('D'.repeat(64))
      .mockResolvedValueOnce('C'.repeat(64));

    const { BootstrapAccountResolver } =
      await import('../../src/service/BootstrapAccountResolver.js');
    const resolver = new BootstrapAccountResolver(
      LoggerFactory.getLogger(LogType.Silent),
      cryptoPort as any
    );
    const account = { publicKey: 'A'.repeat(64) } as any;

    const result = await resolver.resolveAccount(
      NetworkType.TEST_NET,
      account,
      KeyName.Main,
      'api-node',
      '操作',
      undefined
    );

    expect(result).toEqual(expected);
    expect(account.privateKey).toBe('C'.repeat(64));
    expect(passwordMock).toHaveBeenCalledTimes(3);
    expect(cryptoPort.createAccountFromPrivateKey).toHaveBeenCalledTimes(2);
  });

  it('秘密鍵入力をキャンセルした場合は KnownError を投げること', async () => {
    passwordMock.mockResolvedValueOnce('cancel');

    const { BootstrapAccountResolver } =
      await import('../../src/service/BootstrapAccountResolver.js');
    const resolver = new BootstrapAccountResolver(LoggerFactory.getLogger(LogType.Silent), {
      getAddressFromPublicKey: vi.fn().mockReturnValue('TADDRESS'),
      createAccountFromPrivateKey: vi.fn(),
    } as any);

    await expect(
      resolver.resolveAccount(
        NetworkType.TEST_NET,
        { publicKey: 'A'.repeat(64) } as any,
        KeyName.Main,
        'api-node',
        '操作',
        undefined
      )
    ).rejects.toThrow('秘密鍵入力をキャンセルしました。');
  });

  it('空入力は再入力を促し、キャンセルとは区別されること', async () => {
    passwordMock.mockResolvedValueOnce('').mockResolvedValueOnce('cancel');

    const { BootstrapAccountResolver } =
      await import('../../src/service/BootstrapAccountResolver.js');
    const resolver = new BootstrapAccountResolver(LoggerFactory.getLogger(LogType.Silent), {
      getAddressFromPublicKey: vi.fn().mockReturnValue('TADDRESS'),
      createAccountFromPrivateKey: vi.fn(),
    } as any);

    await expect(
      resolver.resolveAccount(
        NetworkType.TEST_NET,
        { publicKey: 'A'.repeat(64) } as any,
        KeyName.Main,
        'api-node',
        '操作',
        undefined
      )
    ).rejects.toThrow('秘密鍵入力をキャンセルしました。');

    expect(passwordMock).toHaveBeenCalledTimes(2);
  });
});
