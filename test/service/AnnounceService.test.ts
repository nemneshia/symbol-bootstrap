import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnounceService, TransactionFactory } from '../../src/service/AnnounceService.js';
import { TransactionUtils } from '../../src/utils/TransactionUtils.js';

const confirmMock = vi.fn();
const passwordMock = vi.fn();

vi.mock('@clack/prompts', () => ({
  confirm: (options: unknown) => confirmMock(options),
  password: (options: unknown) => passwordMock(options),
  isCancel: (value: unknown) => value === 'cancel',
}));

type Fixture = ReturnType<typeof createFixture>;

const createFixture = () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const accountResolver = {
    resolveAccount: vi.fn().mockResolvedValue({
      privateKey: 'RESOLVED_MAIN_PRIV',
      publicKey: 'MAIN_PUBLIC',
      address: 'ADDR_MAIN_PUBLIC',
    }),
  };

  const cryptoPort = {
    getAddressFromPublicKey: vi.fn((publicKey: string) => `ADDR_${publicKey}`),
    createAccountFromPrivateKey: vi.fn((privateKey: string) => ({
      privateKey,
      publicKey: privateKey,
      address: `ADDR_${privateKey}`,
    })),
  };

  const transactionPort = {
    getNetworkConfig: vi.fn().mockResolvedValue({
      epochAdjustment: 1,
      currencyMosaicId: 'CURRENCY',
      currencyDivisibility: 6,
      minFeeMultiplier: 100,
      generationHashSeed: 'ABCDEF',
      latestFinalizedBlockEpoch: 123,
      networkIdentifier: 152,
    }),
    getAccountInfo: vi.fn().mockImplementation(async (_url: string, address: string) => ({
      address,
      mosaics: [{ id: 'CURRENCY', amount: 100n }],
    })),
    isMultisigModification: vi.fn().mockReturnValue(false),
    announceSimple: vi.fn().mockResolvedValue(true),
    announceAggregateComplete: vi.fn().mockResolvedValue(true),
    announceAggregateBonded: vi.fn().mockResolvedValue(true),
    createSelfTransferDescriptor: vi.fn().mockReturnValue({ type: 'transfer_transaction_v1' }),
  };

  const networkPort = {
    getMultisigInfo: vi.fn().mockResolvedValue(undefined),
  };

  const service = new AnnounceService(
    logger as any,
    accountResolver as any,
    {} as any,
    cryptoPort as any,
    transactionPort as any
  );
  service.setNetworkPort(networkPort as any);

  const presetData: any = {
    networkType: 152,
    nemesisGenerationHashSeed: 'ABCDEF',
    node: {
      mainPrivateKey: 'MAIN_PRIVATE',
    },
  };

  const addresses: any = {
    node: {
      name: 'api-node',
      main: {
        publicKey: 'MAIN_PUBLIC',
      },
    },
  };

  const transactionFactory: TransactionFactory = {
    createTransactions: vi.fn().mockResolvedValue([{ type: 'transfer_transaction_v1' }]),
  };

  return {
    logger,
    service,
    accountResolver,
    cryptoPort,
    transactionPort,
    networkPort,
    presetData,
    addresses,
    transactionFactory,
  };
};

const announce = async (fixture: Fixture): Promise<void> => {
  vi.spyOn(TransactionUtils, 'getBestUrl').mockResolvedValue('http://resolved-node:3000');
  await fixture.service.announce(
    'http://provided-node:3000/',
    undefined,
    false,
    true,
    'target',
    fixture.presetData,
    fixture.addresses,
    fixture.transactionFactory,
    '10'
  );
};

describe('AnnounceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    confirmMock.mockReset();
    passwordMock.mockReset();
  });

  it('node preset がない場合は何もせず終了すること', async () => {
    const fixture = createFixture();
    fixture.presetData.node = undefined;

    await announce(fixture);

    expect(fixture.logger.info).toHaveBeenCalledWith(
      'アナウンス対象のトランザクションはありません...'
    );
    expect(fixture.transactionPort.getNetworkConfig).not.toHaveBeenCalled();
  });

  it('generation hash が一致しない場合はエラーを投げること', async () => {
    const fixture = createFixture();
    fixture.transactionPort.getNetworkConfig.mockResolvedValue({
      epochAdjustment: 1,
      currencyMosaicId: 'CURRENCY',
      currencyDivisibility: 6,
      minFeeMultiplier: 100,
      generationHashSeed: 'DIFFERENT',
      latestFinalizedBlockEpoch: 123,
      networkIdentifier: 152,
    });

    await expect(announce(fixture)).rejects.toThrow('接続先ネットワークが誤っています');
  });

  it('node account がない場合はエラーを投げること', async () => {
    const fixture = createFixture();
    fixture.addresses.node = undefined;

    await expect(announce(fixture)).rejects.toThrow('CA/Main アカウントが必要です。');
  });

  it('署名アカウント情報が取得できない場合はエラーログを出して終了すること', async () => {
    const fixture = createFixture();
    fixture.transactionPort.getAccountInfo.mockResolvedValue(undefined);

    await announce(fixture);

    expect(fixture.logger.error).toHaveBeenCalledTimes(1);
    expect(fixture.transactionPort.announceSimple).not.toHaveBeenCalled();
  });

  it('descriptor が空の場合はアナウンスしないこと', async () => {
    const fixture = createFixture();
    (fixture.transactionFactory.createTransactions as any).mockResolvedValue([]);

    await announce(fixture);

    expect(fixture.logger.info).toHaveBeenCalledWith(
      'ノード api-node に対してアナウンスするトランザクションはありません。'
    );
    expect(fixture.transactionPort.announceSimple).not.toHaveBeenCalled();
  });

  it('単一 descriptor かつ通常トランザクションは announceSimple を使うこと', async () => {
    const fixture = createFixture();

    await announce(fixture);

    expect(fixture.transactionPort.announceSimple).toHaveBeenCalledTimes(1);
    expect(fixture.transactionPort.announceAggregateComplete).not.toHaveBeenCalled();
    expect(fixture.transactionPort.announceAggregateBonded).not.toHaveBeenCalled();
  });

  it('単一 descriptor がマルチシグ変更なら aggregate bonded を使うこと', async () => {
    const fixture = createFixture();
    const descriptor = {
      type: 'multisig_account_modification_transaction_v1',
      addressAdditions: ['ADDR_A', 'ADDR_B'],
      minApprovalDelta: 1,
    };
    (fixture.transactionFactory.createTransactions as any).mockResolvedValue([descriptor]);
    fixture.transactionPort.isMultisigModification.mockReturnValue(true);

    await announce(fixture);

    expect(fixture.transactionPort.announceAggregateBonded).toHaveBeenCalledTimes(1);
    expect(fixture.transactionPort.announceSimple).not.toHaveBeenCalled();
  });

  it('descriptor が複数の場合は aggregate complete を使うこと', async () => {
    const fixture = createFixture();
    (fixture.transactionFactory.createTransactions as any).mockResolvedValue([
      { type: 'transfer_transaction_v1' },
      { type: 'transfer_transaction_v1' },
    ]);

    await announce(fixture);

    expect(fixture.transactionPort.announceAggregateComplete).toHaveBeenCalledTimes(1);
    expect(fixture.transactionPort.announceSimple).not.toHaveBeenCalled();
  });

  it('サービスプロバイダー指定時は aggregate bonded で送信すること', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValue('COSIGNER_PRIVATE');
    fixture.networkPort.getMultisigInfo
      .mockResolvedValueOnce({
        isMultisig: true,
        minApproval: 1,
        minRemoval: 1,
        cosignatoryAddresses: ['ADDR_COSIGNER_PRIVATE'],
      })
      .mockResolvedValueOnce(undefined);
    fixture.transactionPort.getAccountInfo.mockImplementation(
      async (_url: string, address: string) => ({
        address,
        mosaics: [{ id: 'CURRENCY', amount: 100n }],
      })
    );

    vi.spyOn(TransactionUtils, 'getBestUrl').mockResolvedValue('http://resolved-node:3000');
    await fixture.service.announce(
      'http://provided-node:3000/',
      1000,
      false,
      true,
      'target',
      fixture.presetData,
      fixture.addresses,
      fixture.transactionFactory,
      '10',
      'SERVICE_PROVIDER_PUBLIC'
    );

    expect(fixture.transactionPort.createSelfTransferDescriptor).toHaveBeenCalledTimes(1);
    expect(fixture.transactionPort.announceAggregateBonded).toHaveBeenCalledTimes(1);
  });

  it('ready=false かつ confirm=false の場合は shouldAnnounce が false を返すこと', async () => {
    const fixture = createFixture();
    confirmMock.mockResolvedValue(false);

    const result = await fixture.service.shouldAnnounce('説明', false, 'api-node');

    expect(result).toBe(false);
    expect(fixture.logger.info).toHaveBeenCalledWith(
      'ノード[api-node] のトランザクションをスキップします'
    );
  });

  it('マルチシグで残高のあるコサイナーが見つからない場合は送信しないこと', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValue('COSIGNER_PRIVATE');
    fixture.networkPort.getMultisigInfo.mockResolvedValue({
      isMultisig: true,
      minApproval: 1,
      minRemoval: 1,
      cosignatoryAddresses: ['ADDR_COSIGNER_PRIVATE'],
    });
    fixture.transactionPort.getAccountInfo.mockImplementation(
      async (_url: string, address: string) => ({
        address,
        mosaics: [{ id: 'CURRENCY', amount: address === 'ADDR_COSIGNER_PRIVATE' ? 0n : 100n }],
      })
    );

    await announce(fixture);

    expect(fixture.logger.info).toHaveBeenCalledWith(
      'アナウンスに十分な残高を持つコサイナーがいません。'
    );
    expect(fixture.transactionPort.announceAggregateComplete).not.toHaveBeenCalled();
    expect(fixture.transactionPort.announceAggregateBonded).not.toHaveBeenCalled();
  });

  it('サービスプロバイダーが非マルチシグの場合は resolver で署名者を解決すること', async () => {
    const fixture = createFixture();
    fixture.networkPort.getMultisigInfo.mockResolvedValue(undefined);

    vi.spyOn(TransactionUtils, 'getBestUrl').mockResolvedValue('http://resolved-node:3000');
    await fixture.service.announce(
      'http://provided-node:3000/',
      undefined,
      false,
      true,
      'target',
      fixture.presetData,
      fixture.addresses,
      fixture.transactionFactory,
      '10',
      'SERVICE_PROVIDER_PUBLIC'
    );

    expect(fixture.accountResolver.resolveAccount).toHaveBeenCalledTimes(1);
    expect(fixture.transactionPort.announceAggregateBonded).toHaveBeenCalledTimes(1);
  });

  it('ready=true の場合は confirm を呼ばずに true を返すこと', async () => {
    const fixture = createFixture();

    const result = await fixture.service.shouldAnnounce('説明', true, 'api-node');

    expect(result).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('confirm が cancel の場合は false を返すこと', async () => {
    const fixture = createFixture();
    confirmMock.mockResolvedValue('cancel');

    const result = await fixture.service.shouldAnnounce('説明', false, 'api-node');

    expect(result).toBe(false);
    expect(fixture.logger.info).toHaveBeenCalledWith(
      'ノード[api-node] のトランザクションをスキップします'
    );
  });

  it('promptAccounts は一致しない秘密鍵入力を再試行できること', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValueOnce('WRONG').mockResolvedValueOnce('GOOD_KEY');
    fixture.cryptoPort.createAccountFromPrivateKey
      .mockReturnValueOnce({
        privateKey: 'WRONG',
        publicKey: 'WRONG',
        address: 'ADDR_WRONG',
      })
      .mockReturnValueOnce({
        privateKey: 'GOOD_KEY',
        publicKey: 'GOOD_KEY',
        address: 'ADDR_GOOD_KEY',
      });

    const result = await (fixture.service as any).promptAccounts(152, ['ADDR_GOOD_KEY'], 1);

    expect(result).toHaveLength(1);
    expect(fixture.logger.info).toHaveBeenCalledWith('秘密鍵を再入力してください...');
  });

  it('promptAccounts は最小承認数に達したら終了すること', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValue('GOOD_KEY');
    fixture.cryptoPort.createAccountFromPrivateKey.mockReturnValue({
      privateKey: 'GOOD_KEY',
      publicKey: 'GOOD_KEY',
      address: 'ADDR_GOOD_KEY',
    });

    const result = await (fixture.service as any).promptAccounts(
      152,
      ['ADDR_GOOD_KEY', 'ADDR_ANOTHER'],
      1
    );

    expect(result).toHaveLength(1);
    expect(fixture.logger.info).toHaveBeenCalledWith(
      '最小承認数 1 に到達しました。アグリゲートコンプリートトランザクションを作成できます。'
    );
  });

  it('promptAccounts は confirm=false で追加入力を終了すること', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValue('GOOD_KEY');
    confirmMock.mockResolvedValue(false);
    fixture.cryptoPort.createAccountFromPrivateKey.mockReturnValue({
      privateKey: 'GOOD_KEY',
      publicKey: 'GOOD_KEY',
      address: 'ADDR_GOOD_KEY',
    });

    const result = await (fixture.service as any).promptAccounts(
      152,
      ['ADDR_GOOD_KEY', 'ADDR_ANOTHER'],
      2
    );

    expect(result).toHaveLength(1);
  });

  it('promptAccounts は confirm=true で追加入力に進むこと', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValueOnce('KEY_1').mockResolvedValueOnce('KEY_2');
    confirmMock.mockResolvedValue(true);
    fixture.cryptoPort.createAccountFromPrivateKey
      .mockReturnValueOnce({
        privateKey: 'KEY_1',
        publicKey: 'KEY_1',
        address: 'ADDR_KEY_1',
      })
      .mockReturnValueOnce({
        privateKey: 'KEY_2',
        publicKey: 'KEY_2',
        address: 'ADDR_KEY_2',
      });

    const result = await (fixture.service as any).promptAccounts(
      152,
      ['ADDR_KEY_1', 'ADDR_KEY_2'],
      2
    );

    expect(result).toHaveLength(2);
    expect(fixture.logger.info).toHaveBeenCalledWith('追加の秘密鍵を入力してください....');
  });

  it('getBestCosigner は accountInfo 取得失敗時に undefined を返すこと', async () => {
    const fixture = createFixture();
    fixture.transactionPort.getAccountInfo.mockRejectedValue(new Error('network error'));

    const result = await (fixture.service as any).getBestCosigner(
      [{ privateKey: 'A', publicKey: 'A', address: 'ADDR_A' }],
      'http://resolved-node:3000',
      'CURRENCY'
    );

    expect(result).toBeUndefined();
  });

  it('promptSecret は cancel 入力を undefined として扱うこと', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValue('cancel');

    const result = await (fixture.service as any).promptSecret('秘密鍵入力');

    expect(result).toBeUndefined();
  });

  it('toPromptValidation は boolean false を文字列メッセージへ変換すること', () => {
    const fixture = createFixture();

    const validate = (fixture.service as any).toPromptValidation(() => false);

    expect(validate('value')).toBe('入力値が不正です。');
  });

  it('announceUsingServiceProvider は account 未設定なら即時 return すること', async () => {
    const fixture = createFixture();

    await (fixture.service as any).announceUsingServiceProvider({
      serviceProviderAccount: undefined,
    });

    expect(fixture.transactionPort.announceAggregateBonded).not.toHaveBeenCalled();
  });

  it('残高不足の署名アカウントはエラーログを出して終了すること', async () => {
    const fixture = createFixture();
    fixture.transactionPort.getAccountInfo.mockResolvedValue({
      address: 'ADDR_MAIN_PUBLIC',
      mosaics: [{ id: 'CURRENCY', amount: 0n }],
    });

    await announce(fixture);

    expect(fixture.logger.error).toHaveBeenCalledTimes(1);
    expect(fixture.transactionPort.announceSimple).not.toHaveBeenCalled();
  });

  it('メインアカウントが未作成の場合でも descriptor があれば送信できること', async () => {
    const fixture = createFixture();
    fixture.transactionPort.getAccountInfo.mockImplementation(
      async (_url: string, address: string) => {
        if (address === 'ADDR_MAIN_PUBLIC') {
          return undefined;
        }
        return {
          address,
          mosaics: [{ id: 'CURRENCY', amount: 100n }],
        };
      }
    );

    vi.spyOn(TransactionUtils, 'getBestUrl').mockResolvedValue('http://resolved-node:3000');
    await fixture.service.announce(
      'http://provided-node:3000/',
      undefined,
      false,
      false,
      'target',
      fixture.presetData,
      fixture.addresses,
      {
        createTransactions: vi.fn().mockImplementation(async (params: any) => {
          expect(params.mainAccountInfo).toBeUndefined();
          return [{ type: 'transfer_transaction_v1' }];
        }),
      },
      '10',
      'SERVICE_PROVIDER_PUBLIC'
    );

    expect(fixture.transactionPort.announceAggregateBonded).toHaveBeenCalledTimes(1);
  });

  it('サービスプロバイダーマルチシグで有効コサイナーがない場合は終了すること', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValue('COSIGNER_PRIVATE');
    fixture.networkPort.getMultisigInfo
      .mockResolvedValueOnce({
        isMultisig: true,
        minApproval: 1,
        minRemoval: 1,
        cosignatoryAddresses: ['ADDR_COSIGNER_PRIVATE'],
      })
      .mockResolvedValueOnce(undefined);
    fixture.transactionPort.getAccountInfo.mockImplementation(
      async (_url: string, address: string) => ({
        address,
        mosaics: [{ id: 'CURRENCY', amount: address === 'ADDR_COSIGNER_PRIVATE' ? 0n : 100n }],
      })
    );

    vi.spyOn(TransactionUtils, 'getBestUrl').mockResolvedValue('http://resolved-node:3000');
    await fixture.service.announce(
      'http://provided-node:3000/',
      undefined,
      false,
      true,
      'target',
      fixture.presetData,
      fixture.addresses,
      fixture.transactionFactory,
      '10',
      'SERVICE_PROVIDER_PUBLIC'
    );

    expect(fixture.transactionPort.announceAggregateBonded).not.toHaveBeenCalled();
  });

  it('メインアカウントがマルチシグで minApproval を満たす場合は aggregateComplete を使うこと', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValueOnce('COSIGNER_A').mockResolvedValueOnce('COSIGNER_B');
    confirmMock.mockResolvedValue(true);
    fixture.networkPort.getMultisigInfo.mockResolvedValue({
      isMultisig: true,
      minApproval: 2,
      minRemoval: 1,
      cosignatoryAddresses: ['ADDR_COSIGNER_A', 'ADDR_COSIGNER_B'],
    });

    await announce(fixture);

    expect(fixture.transactionPort.announceAggregateComplete).toHaveBeenCalledTimes(1);
  });

  it('メインアカウントがマルチシグで minApproval 未満の場合は aggregateBonded を使うこと', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValue('COSIGNER_A');
    confirmMock.mockResolvedValue(false);
    fixture.networkPort.getMultisigInfo.mockResolvedValue({
      isMultisig: true,
      minApproval: 2,
      minRemoval: 1,
      cosignatoryAddresses: ['ADDR_COSIGNER_A', 'ADDR_COSIGNER_B'],
    });

    await announce(fixture);

    expect(fixture.transactionPort.announceAggregateBonded).toHaveBeenCalledTimes(1);
  });

  it('preset の mainPrivateKey が一致する場合は resolver を使わないこと', async () => {
    const fixture = createFixture();
    fixture.cryptoPort.createAccountFromPrivateKey.mockReturnValue({
      privateKey: 'MAIN_PRIVATE',
      publicKey: 'MAIN_PUBLIC',
      address: 'ADDR_MAIN_PUBLIC',
    });

    await announce(fixture);

    expect(fixture.accountResolver.resolveAccount).not.toHaveBeenCalled();
  });

  it('toPromptValidation は true と文字列結果をそのまま変換できること', () => {
    const fixture = createFixture();
    const validateTrue = (fixture.service as any).toPromptValidation(() => true);
    const validateString = (fixture.service as any).toPromptValidation(() => 'error message');

    expect(validateTrue('abc')).toBeUndefined();
    expect(validateString('abc')).toBe('error message');
  });

  it('promptSecret の validate は入力値を大文字化して検証すること', async () => {
    const fixture = createFixture();
    passwordMock.mockImplementation(async (options: any) => {
      expect(options.validate('a'.repeat(64))).toBeUndefined();
      return 'VALUE';
    });

    const result = await (fixture.service as any).promptSecret('message');

    expect(result).toBe('VALUE');
  });

  it('promptAccounts は空入力時に再入力案内を出すこと', async () => {
    const fixture = createFixture();
    passwordMock.mockResolvedValueOnce('cancel').mockResolvedValueOnce('GOOD_KEY');
    fixture.cryptoPort.createAccountFromPrivateKey.mockReturnValue({
      privateKey: 'GOOD_KEY',
      publicKey: 'GOOD_KEY',
      address: 'ADDR_GOOD_KEY',
    });

    const result = await (fixture.service as any).promptAccounts(152, ['ADDR_GOOD_KEY'], 1);

    expect(result).toHaveLength(1);
    expect(fixture.logger.info).toHaveBeenCalledWith('秘密鍵を入力してください....');
  });

  it('getMultisigBestCosigner はコサイナー未入力なら undefined を返すこと', async () => {
    const fixture = createFixture();
    vi.spyOn(fixture.service as any, 'promptAccounts').mockResolvedValue([]);

    const result = await (fixture.service as any).getMultisigBestCosigner(
      1,
      ['ADDR_A'],
      [],
      'account',
      152,
      'CURRENCY',
      'http://resolved-node:3000'
    );

    expect(result).toBeUndefined();
  });

  it('SIGINT リスナーは process.exit(400) を呼び出すこと', async () => {
    const fixture = createFixture();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    await announce(fixture);
    process.emit('SIGINT');

    expect(exitSpy).toHaveBeenCalledWith(400);
  });
});
