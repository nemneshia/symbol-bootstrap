import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnounceService } from '../../src/service/AnnounceService.js';
import { ConfigLoader } from '../../src/service/ConfigLoader.js';
import { LinkService, LinkTransactionGenericFactory } from '../../src/service/LinkService.js';
import { VotingKeyAccount } from '../../src/utils/VotingUtils.js';

const confirmMock = vi.fn();

vi.mock('@clack/prompts', () => ({
  confirm: (...args: any[]) => confirmMock(...args),
  isCancel: (value: unknown) => value === 'cancel',
}));

type Tx = { kind: string; linkAction: 'link' | 'unlink'; publicKey: string };

const createLogger = () => ({
  info: () => undefined,
  warn: () => undefined,
});

const createVoting = (
  publicKey: string,
  startEpoch: number,
  endEpoch: number
): VotingKeyAccount => ({
  publicKey,
  startEpoch,
  endEpoch,
});

const createTxFactory = (kind: string) => {
  return (account: { publicKey: string }, action: 'link' | 'unlink'): Tx => ({
    kind,
    linkAction: action,
    publicKey: account.publicKey,
  });
};

describe('LinkTransactionGenericFactory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    confirmMock.mockReset();
  });

  it('overlapsVotingAccounts は epoch が重なる場合 true を返すこと', () => {
    const a = createVoting('A'.repeat(64), 10, 20);
    const b = createVoting('B'.repeat(64), 20, 30);

    expect(LinkTransactionGenericFactory.overlapsVotingAccounts(a, b)).toBe(true);
  });

  it('overlapsVotingAccounts は epoch が離れている場合 false を返すこと', () => {
    const a = createVoting('A'.repeat(64), 10, 19);
    const b = createVoting('B'.repeat(64), 20, 30);

    expect(LinkTransactionGenericFactory.overlapsVotingAccounts(a, b)).toBe(false);
  });

  it('リンクモードで既存キーと相違する場合、unlink と link を作成すること', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      removeOldLinked: true,
    });

    const result = await factory.createGenericTransactions(
      'api-node',
      { remote: { publicKey: 'OLD_REMOTE' } },
      { remote: { publicKey: 'NEW_REMOTE' }, voting: [] },
      100,
      createTxFactory('remote'),
      createTxFactory('vrf'),
      createTxFactory('voting') as any
    );

    expect(result).toEqual([
      { kind: 'remote', linkAction: 'unlink', publicKey: 'OLD_REMOTE' },
      { kind: 'remote', linkAction: 'link', publicKey: 'NEW_REMOTE' },
    ]);
  });

  it('アンリンクモードで同一投票キーのみ unlink を作成すること', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: true,
      removeOldLinked: true,
    });

    const linkedVoting = createVoting('C'.repeat(64), 100, 120);
    const result = await factory.addVotingKeyUnlinkTransactions(
      [linkedVoting],
      [createVoting('C'.repeat(64), 100, 120), createVoting('D'.repeat(64), 121, 130)],
      'api-node',
      createTxFactory('voting') as any,
      (v) => `${v.publicKey}:${v.startEpoch}-${v.endEpoch}`
    );

    expect(result).toEqual([
      {
        kind: 'voting',
        linkAction: 'unlink',
        publicKey: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      },
    ]);
  });

  it('リンクモードで期限切れ投票キーを unlink し、有効キーを link すること', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      removeOldLinked: true,
    });

    const expired = createVoting('E'.repeat(64), 1, 5);
    const active = createVoting('F'.repeat(64), 6, 10);
    const result = await factory.addVotingKeyLinkTransactions(
      [expired],
      [active],
      'api-node',
      6,
      createTxFactory('voting') as any,
      (v) => `${v.publicKey}:${v.startEpoch}-${v.endEpoch}`
    );

    expect(result).toEqual([
      {
        kind: 'voting',
        linkAction: 'unlink',
        publicKey: 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
      },
      {
        kind: 'voting',
        linkAction: 'link',
        publicKey: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      },
    ]);
  });

  it('removeOldLinked=false の場合は不一致キーでも unlink しないこと', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      removeOldLinked: false,
    });

    const result = await factory.createGenericTransactions(
      'api-node',
      { remote: { publicKey: 'OLD_REMOTE' } },
      { remote: { publicKey: 'NEW_REMOTE' }, voting: [] },
      100,
      createTxFactory('remote'),
      createTxFactory('vrf'),
      createTxFactory('voting') as any
    );

    expect(result).toEqual([]);
  });

  it('unlink モードで既存キーがない場合は空配列を返すこと', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: true,
      removeOldLinked: true,
    });

    const result = await factory.createGenericTransactions(
      'api-node',
      {},
      { remote: { publicKey: 'NEW_REMOTE' }, voting: [] },
      100,
      createTxFactory('remote'),
      createTxFactory('vrf'),
      createTxFactory('voting') as any
    );

    expect(result).toEqual([]);
  });

  it('createLinkTransactions は同一キーの場合に何もしないこと', async () => {
    const factory: any = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      ready: true,
    });
    const txFactory = createTxFactory('remote');

    const result = await factory.createLinkTransactions(
      { publicKey: 'SAME' },
      txFactory,
      'api-node',
      'Remote',
      { publicKey: 'same' },
      (v: any) => `public key ${v.publicKey}`
    );

    expect(result).toEqual([]);
  });

  it('createUnlinkTransactions は同一キーの場合に unlink を作成すること', async () => {
    const factory: any = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: true,
      ready: true,
    });
    const txFactory = createTxFactory('remote');

    const result = await factory.createUnlinkTransactions(
      { publicKey: 'SAME' },
      txFactory,
      'api-node',
      'Remote',
      { publicKey: 'same' },
      (v: any) => `public key ${v.publicKey}`
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'remote', linkAction: 'unlink' });
  });

  it('createUnlinkTransactions は ready=true かつ不一致時に unlink すること', async () => {
    const factory: any = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: true,
      ready: true,
    });
    const txFactory = createTxFactory('remote');

    const result = await factory.createUnlinkTransactions(
      { publicKey: 'OLD' },
      txFactory,
      'api-node',
      'Remote',
      { publicKey: 'NEW' },
      (v: any) => `public key ${v.publicKey}`
    );

    expect(result).toEqual([{ kind: 'remote', linkAction: 'unlink', publicKey: 'OLD' }]);
  });

  it('createLinkTransactions は既存3件時に追加リンクを作成しないこと', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      removeOldLinked: true,
    });
    const linked = [
      createVoting('A'.repeat(64), 1, 10),
      createVoting('B'.repeat(64), 11, 20),
      createVoting('C'.repeat(64), 21, 30),
    ];

    const result = await factory.addVotingKeyLinkTransactions(
      linked,
      [createVoting('D'.repeat(64), 31, 40)],
      'api-node',
      1,
      createTxFactory('voting') as any,
      (v) => `${v.publicKey}:${v.startEpoch}-${v.endEpoch}`
    );

    expect(result).toEqual([]);
  });

  it('addVotingKeyLinkTransactions は不一致で removeOldLinked=false の場合に追加しないこと', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      removeOldLinked: false,
    });
    const linked = [createVoting('A'.repeat(64), 1, 10)];

    const result = await factory.addVotingKeyLinkTransactions(
      linked,
      [createVoting('B'.repeat(64), 1, 10)],
      'api-node',
      1,
      createTxFactory('voting') as any,
      (v) => `${v.publicKey}:${v.startEpoch}-${v.endEpoch}`
    );

    expect(result).toEqual([]);
  });

  it('createLinkTransactions は未リンク時に link を作成すること', async () => {
    const factory: any = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      ready: true,
    });

    const result = await factory.createLinkTransactions(
      undefined,
      createTxFactory('remote'),
      'api-node',
      'Remote',
      { publicKey: 'NEW' },
      (v: any) => `public key ${v.publicKey}`
    );

    expect(result).toEqual([{ kind: 'remote', linkAction: 'link', publicKey: 'NEW' }]);
  });

  it('createGenericTransactions は remote/vrf 未設定時にキーリンクを作らないこと', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      ready: true,
    });

    const result = await factory.createGenericTransactions(
      'api-node',
      {},
      { voting: [] },
      1,
      createTxFactory('remote'),
      createTxFactory('vrf'),
      createTxFactory('voting') as any
    );

    expect(result).toEqual([]);
  });

  it('createGenericTransactions は vrf キーがある場合に VRF リンクを作成すること', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      ready: true,
    });

    const result = await factory.createGenericTransactions(
      'api-node',
      {},
      { vrf: { publicKey: 'VRF_NEW' }, voting: [] },
      1,
      createTxFactory('remote'),
      createTxFactory('vrf'),
      createTxFactory('voting') as any
    );

    expect(result).toEqual([{ kind: 'vrf', linkAction: 'link', publicKey: 'VRF_NEW' }]);
  });

  it('addVotingKeyLinkTransactions は removeOldLinked=true で重複不一致キーを unlink すること', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      removeOldLinked: true,
    });

    const result = await factory.addVotingKeyLinkTransactions(
      [createVoting('A'.repeat(64), 1, 10)],
      [createVoting('B'.repeat(64), 1, 10)],
      'api-node',
      1,
      createTxFactory('voting') as any,
      (v) => `${v.publicKey}:${v.startEpoch}-${v.endEpoch}`
    );

    expect(result.map((r: any) => r.linkAction)).toEqual(['unlink', 'link']);
  });

  it('addVotingKeyUnlinkTransactions は確認拒否時に unlink を作成しないこと', async () => {
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: true,
      removeOldLinked: false,
    });

    const result = await factory.addVotingKeyUnlinkTransactions(
      [createVoting('C'.repeat(64), 100, 120)],
      [createVoting('C'.repeat(64), 100, 120)],
      'api-node',
      createTxFactory('voting') as any,
      (v) => `${v.publicKey}:${v.startEpoch}-${v.endEpoch}`
    );

    expect(result).toEqual([]);
  });

  it('ready=false の場合は confirm の結果で不一致キー unlink を実行すること', async () => {
    confirmMock.mockResolvedValueOnce(true);
    const factory = new LinkTransactionGenericFactory(createLogger() as any, {
      unlink: false,
      ready: false,
    });

    const result = await factory.createGenericTransactions(
      'api-node',
      { remote: { publicKey: 'OLD_REMOTE' } },
      { remote: { publicKey: 'NEW_REMOTE' }, voting: [] },
      1,
      createTxFactory('remote'),
      createTxFactory('vrf'),
      createTxFactory('voting') as any
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(result.map((r: any) => r.linkAction)).toEqual(['unlink', 'link']);
  });
});

describe('LinkService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createTransactions は unlink を先頭にソートして返すこと', async () => {
    const transactionPort = {
      createAccountKeyLinkDescriptor: (publicKey: string, action: 'link' | 'unlink') => ({
        type: 'remote',
        linkAction: action,
        publicKey,
      }),
      createVrfKeyLinkDescriptor: (publicKey: string, action: 'link' | 'unlink') => ({
        type: 'vrf',
        linkAction: action,
        publicKey,
      }),
      createVotingKeyLinkDescriptor: (account: VotingKeyAccount, action: 'link' | 'unlink') => ({
        type: 'voting',
        linkAction: action,
        publicKey: account.publicKey,
      }),
    };
    const service = new LinkService(
      createLogger() as any,
      { target: 'target', url: 'http://localhost:3000', unlink: false, removeOldLinked: true },
      {} as any,
      {} as any,
      transactionPort as any
    );

    const transactions = await service.createTransactions({
      presetData: { networkType: 152, lastKnownNetworkEpoch: 10 } as any,
      nodeAccount: {
        name: 'api-node',
        main: { address: 'TMAIN', publicKey: 'MAIN' },
        remote: { publicKey: 'NEW_REMOTE' },
      } as any,
      mainAccountInfo: {
        supplementalPublicKeys: {
          linked: 'OLD_REMOTE',
        },
      } as any,
      networkConfig: { latestFinalizedBlockEpoch: 10 },
    } as any);

    expect(transactions.map((t: any) => t.linkAction)).toEqual(['unlink', 'link']);
  });

  it('run は AnnounceService に委譲してアナウンスを実行すること', async () => {
    const announceSpy = vi
      .spyOn(AnnounceService.prototype, 'announce')
      .mockResolvedValue(undefined as any);
    vi.spyOn(ConfigLoader.prototype, 'loadCustomPreset').mockReturnValue(undefined as any);
    vi.spyOn(ConfigLoader.prototype, 'mergePresets').mockImplementation((preset) => preset as any);

    const service = new LinkService(
      createLogger() as any,
      {
        target: 'target',
        url: 'http://localhost:3000',
        unlink: false,
        ready: true,
        accountResolver: {} as any,
      },
      {} as any,
      {} as any
    );

    await service.run({ networkType: 152 } as any, { node: { name: 'api-node' } } as any);

    expect(announceSpy).toHaveBeenCalledTimes(1);
  });

  it('run は引数未指定時に ConfigLoader から preset/addresses を読み込むこと', async () => {
    const announceSpy = vi
      .spyOn(AnnounceService.prototype, 'announce')
      .mockResolvedValue(undefined as any);
    const presetSpy = vi
      .spyOn(ConfigLoader.prototype, 'loadExistingPresetData')
      .mockReturnValue({ networkType: 152 } as any);
    const addressesSpy = vi
      .spyOn(ConfigLoader.prototype, 'loadExistingAddresses')
      .mockReturnValue({ node: { name: 'api-node' } } as any);
    vi.spyOn(ConfigLoader.prototype, 'loadCustomPreset').mockReturnValue(undefined as any);
    vi.spyOn(ConfigLoader.prototype, 'mergePresets').mockImplementation((preset) => preset as any);

    const service = new LinkService(
      createLogger() as any,
      {
        target: 'target',
        url: 'http://localhost:3000',
        unlink: false,
        ready: true,
        accountResolver: {} as any,
      },
      {} as any,
      {} as any
    );

    await service.run();

    expect(presetSpy).toHaveBeenCalledTimes(1);
    expect(addressesSpy).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledTimes(1);
  });

  it('run は accountResolver 未指定時に既定の resolver を使って実行できること', async () => {
    const announceSpy = vi
      .spyOn(AnnounceService.prototype, 'announce')
      .mockResolvedValue(undefined as any);
    vi.spyOn(ConfigLoader.prototype, 'loadCustomPreset').mockReturnValue(undefined as any);
    vi.spyOn(ConfigLoader.prototype, 'mergePresets').mockImplementation((preset) => preset as any);

    const service = new LinkService(
      createLogger() as any,
      {
        target: 'target',
        url: 'http://localhost:3000',
        unlink: true,
        ready: true,
      },
      {} as any,
      {} as any
    );

    await service.run({ networkType: 152 } as any, { node: { name: 'api-node' } } as any);

    expect(announceSpy).toHaveBeenCalledTimes(1);
  });

  it('createTransactions は networkConfig 未指定時に presetData.lastKnownNetworkEpoch を使うこと', async () => {
    const transactionPort = {
      createAccountKeyLinkDescriptor: (publicKey: string, action: 'link' | 'unlink') => ({
        type: 'remote',
        linkAction: action,
        publicKey,
      }),
      createVrfKeyLinkDescriptor: (publicKey: string, action: 'link' | 'unlink') => ({
        type: 'vrf',
        linkAction: action,
        publicKey,
      }),
      createVotingKeyLinkDescriptor: (account: VotingKeyAccount, action: 'link' | 'unlink') => ({
        type: 'voting',
        linkAction: action,
        publicKey: account.publicKey,
      }),
    };
    const service = new LinkService(
      createLogger() as any,
      { target: 'target', url: 'http://localhost:3000', unlink: false, removeOldLinked: true },
      {} as any,
      {} as any,
      transactionPort as any
    );

    const transactions = await service.createTransactions({
      presetData: { networkType: 152, lastKnownNetworkEpoch: 10 } as any,
      nodeAccount: {
        name: 'api-node',
        main: { address: 'TMAIN', publicKey: 'MAIN' },
        vrf: { publicKey: 'NEW_VRF' },
      } as any,
      mainAccountInfo: {
        supplementalPublicKeys: {
          vrf: 'OLD_VRF',
          linked: 'OLD_REMOTE',
          voting: [{ publicKey: 'V'.repeat(64), startEpoch: 1, endEpoch: 2 }],
        },
      } as any,
    } as any);

    expect(transactions.some((t: any) => t.type === 'vrf')).toBe(true);
  });
});
