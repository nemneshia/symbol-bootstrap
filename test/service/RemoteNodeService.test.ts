import { lookup } from 'dns/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { RemoteNodeService } from '../../src/service/RemoteNodeService.js';

vi.mock('dns/promises', () => ({
  lookup: vi.fn(),
}));

/**
 * RemoteNodeService クラスのユニットテスト。
 * ネットワークポートをモックして、エポック解決・REST URL 取得ロジックを検証する。
 */
describe('RemoteNodeService', () => {
  const logger = LoggerFactory.getLogger(LogType.Silent);

  /** モック用の INetworkPort */
  const mockNetworkPort = {
    getChainInfo: vi.fn(),
    getNodeInfo: vi.fn(),
    getNodePeers: vi.fn(),
    getNodewatchPeers: vi.fn(),
  };

  /** テスト用の最小限のプリセットデータ */
  const basePreset = {
    lastKnownNetworkEpoch: 100,
    node: undefined,
    knownRestGateways: ['http://test-node:3000'],
    knownPeers: [],
  } as any;

  const mockLookup = vi.mocked(lookup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ---------------------------------------------------------------------------
  // isConnectedToInternet
  // ---------------------------------------------------------------------------
  describe('isConnectedToInternet', () => {
    it('DNS 参照が成功した場合は true を返すこと', async () => {
      mockLookup.mockResolvedValue({ address: '142.250.0.1', family: 4 } as any);
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      expect(await service.isConnectedToInternet()).toBe(true);
    });

    it('ENOTFOUND エラーの場合は false を返すこと', async () => {
      const err = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
      mockLookup.mockRejectedValue(err);
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      expect(await service.isConnectedToInternet()).toBe(false);
    });

    it('ENOTFOUND 以外のエラーは接続あり（true）として扱うこと', async () => {
      const err = Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' });
      mockLookup.mockRejectedValue(err);
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      expect(await service.isConnectedToInternet()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // resolveCurrentFinalizationEpoch
  // ---------------------------------------------------------------------------
  describe('resolveCurrentFinalizationEpoch', () => {
    it('offline=true の場合は lastKnownNetworkEpoch を返すこと', async () => {
      const service = new RemoteNodeService(logger, basePreset, true, mockNetworkPort as any);

      const result = await service.resolveCurrentFinalizationEpoch();

      expect(result).toBe(100);
      // ネットワークへのアクセスは一切しないこと
      expect(mockNetworkPort.getChainInfo).not.toHaveBeenCalled();
    });

    it('voting ノードがない場合は lastKnownNetworkEpoch を返すこと', async () => {
      const preset = { ...basePreset, node: { voting: false } };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.resolveCurrentFinalizationEpoch();

      expect(result).toBe(100);
    });

    it('voting ノードあり & オンラインの場合は getChainInfo を呼んでエポックを返すこと', async () => {
      mockLookup.mockResolvedValue({ address: '1.1.1.1', family: 4 } as any);
      mockNetworkPort.getChainInfo.mockResolvedValue({
        height: '1000',
        finalizationEpoch: 200,
        finalizationHeight: '999',
        scoreHigh: '0',
        scoreLow: '0',
      });
      const preset = { ...basePreset, node: { voting: true } };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.resolveCurrentFinalizationEpoch();

      expect(result).toBe(200);
      expect(mockNetworkPort.getChainInfo).toHaveBeenCalledWith('http://test-node:3000');
    });

    it('インターネット未接続の場合は lastKnownNetworkEpoch を返すこと', async () => {
      const err = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
      mockLookup.mockRejectedValue(err);
      const preset = { ...basePreset, node: { voting: true } };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.resolveCurrentFinalizationEpoch();

      expect(result).toBe(100);
      expect(mockNetworkPort.getChainInfo).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getBestFinalizationEpoch
  // ---------------------------------------------------------------------------
  describe('getBestFinalizationEpoch', () => {
    it('URL が空配列の場合は undefined を返すこと', async () => {
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      const result = await service.getBestFinalizationEpoch([]);

      expect(result).toBeUndefined();
    });

    it('チェーン情報から finalizationEpoch を取得すること', async () => {
      mockNetworkPort.getChainInfo.mockResolvedValue({
        height: '1000',
        finalizationEpoch: 150,
        finalizationHeight: '999',
        scoreHigh: '0',
        scoreLow: '0',
      });

      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);
      const result = await service.getBestFinalizationEpoch(['http://test-node:3000']);

      expect(result).toBe(150);
    });

    it('チェーン情報取得が失敗した場合は undefined を返すこと', async () => {
      mockNetworkPort.getChainInfo.mockRejectedValue(new Error('接続エラー'));

      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);
      const result = await service.getBestFinalizationEpoch(['http://test-node:3000']);

      expect(result).toBeUndefined();
    });

    it('複数ノードで同じ高さの場合も正常に動作すること（等値ソート）', async () => {
      mockNetworkPort.getChainInfo.mockResolvedValue({
        height: '1000',
        finalizationEpoch: 200,
        finalizationHeight: '999',
        scoreHigh: '0',
        scoreLow: '0',
      });

      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);
      const result = await service.getBestFinalizationEpoch([
        'http://node-a:3000',
        'http://node-b:3000',
      ]);

      expect(result).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // getBestRepositoryInfo
  // ---------------------------------------------------------------------------
  describe('getBestRepositoryInfo', () => {
    it('接続成功したノードの RepositoryInfo を返すこと', async () => {
      const chainInfo = {
        height: '1000',
        finalizationEpoch: 150,
        finalizationHeight: '999',
        scoreHigh: '0',
        scoreLow: '0',
      };
      mockNetworkPort.getChainInfo.mockResolvedValue(chainInfo);
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      const result = await service.getBestRepositoryInfo('http://test-node:3000');

      expect(result).toMatchObject({ restGatewayUrl: 'http://test-node:3000', chainInfo });
    });

    it('全 URL が失敗した場合は Error を投げること', async () => {
      mockNetworkPort.getChainInfo.mockRejectedValue(new Error('接続エラー'));
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      await expect(service.getBestRepositoryInfo('http://test-node:3000')).rejects.toThrow(
        '稼働中のノードが見つかりませんでした。'
      );
    });

    it('knownRestGateways が空の場合は KnownError を投げること', async () => {
      const preset = { ...basePreset, knownRestGateways: [] };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      await expect(service.getBestRepositoryInfo(undefined)).rejects.toThrow(
        '既知ノードがありません。'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getRestUrls
  // ---------------------------------------------------------------------------
  describe('getRestUrls', () => {
    it('nodewatchUrl がない場合は knownRestGateways だけを返すこと', async () => {
      const preset = { ...basePreset, knownRestGateways: ['http://gw1:3000', 'http://gw2:3000'] };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.getRestUrls();

      expect(result).toEqual(['http://gw1:3000', 'http://gw2:3000']);
    });

    it('2 回目呼び出しはキャッシュを返し getNodes を再度呼ばないこと', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ endpoint: 'http://nw-node:3000' }],
      });
      vi.stubGlobal('fetch', mockFetch);
      const preset = { ...basePreset, nodewatchUrl: 'http://nodewatch' };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      await service.getRestUrls();
      await service.getRestUrls();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('getNodes が失敗した場合は警告ログを出して knownRestGateways を返すこと', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Nodewatch down'));
      vi.stubGlobal('fetch', mockFetch);
      const preset = {
        ...basePreset,
        nodewatchUrl: 'http://nodewatch',
        knownRestGateways: ['http://fallback:3000'],
      };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.getRestUrls();

      expect(result).toEqual(['http://fallback:3000']);
    });
  });

  // ---------------------------------------------------------------------------
  // getNodeRoles
  // ---------------------------------------------------------------------------
  describe('getNodeRoles', () => {
    it('0b001 → "Peer"', () => {
      expect(RemoteNodeService.getNodeRoles(0b001)).toBe('Peer');
    });

    it('0b010 → "Api"', () => {
      expect(RemoteNodeService.getNodeRoles(0b010)).toBe('Api');
    });

    it('0b100 → "Voting"', () => {
      expect(RemoteNodeService.getNodeRoles(0b100)).toBe('Voting');
    });

    it('0b111 → "Peer,Api,Voting"', () => {
      expect(RemoteNodeService.getNodeRoles(0b111)).toBe('Peer,Api,Voting');
    });

    it('0b000 → ""（空文字）', () => {
      expect(RemoteNodeService.getNodeRoles(0b000)).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // getPeerInfos
  // ---------------------------------------------------------------------------
  describe('getPeerInfos', () => {
    const makeNode = (overrides: object = {}) => ({
      balance: 0,
      endpoint: 'http://peer-node:3000',
      finalizedEpoch: 1,
      finalizedHash: 'abc',
      finalizedHeight: 1,
      finalizedPoint: 1,
      geoLocation: { city: '', continent: '', country: '', isp: '', lat: 0, lon: 0, region: '' },
      height: 100,
      isHealthy: true,
      isSslEnabled: false,
      mainPublicKey: 'AABBCC',
      name: 'peer1',
      nodePublicKey: 'DD',
      restVersion: '2.4.0',
      roles: 0b001,
      version: '1.0',
      host: '1.2.3.4',
      port: 7900,
      ...overrides,
    });

    it('offline=true の場合は knownPeers をそのまま返すこと', async () => {
      const knownPeer = {
        publicKey: 'KNOWN',
        endpoint: { host: 'k', port: 7900 },
        metadata: { name: 'k', roles: 'Peer' },
      };
      const preset = { ...basePreset, knownPeers: [knownPeer], nodewatchUrl: 'http://nw' };
      const service = new RemoteNodeService(logger, preset, true, mockNetworkPort as any);

      const result = await service.getPeerInfos();

      expect(result).toEqual([knownPeer]);
    });

    it('nodewatchUrl がない場合は knownPeers をそのまま返すこと', async () => {
      const knownPeer = {
        publicKey: 'KNOWN',
        endpoint: { host: 'k', port: 7900 },
        metadata: { name: 'k', roles: 'Peer' },
      };
      const preset = { ...basePreset, knownPeers: [knownPeer] };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.getPeerInfos();

      expect(result).toEqual([knownPeer]);
    });

    it('正常フロー: Nodewatch から取得→補完→PeerInfo を返すこと', async () => {
      const node = makeNode();
      const mockFetch = vi
        .fn()
        // getNodes
        .mockResolvedValueOnce({ ok: true, json: async () => [node] })
        // enrichNodesWithHostInfo /node/info
        .mockResolvedValueOnce({ ok: true, json: async () => ({ host: '1.2.3.4', port: 7900 }) });
      vi.stubGlobal('fetch', mockFetch);
      const preset = { ...basePreset, nodewatchUrl: 'http://nodewatch/' };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.getPeerInfos();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        publicKey: 'AABBCC',
        endpoint: { host: '1.2.3.4', port: 7900 },
        metadata: { name: 'peer1', roles: 'Peer' },
      });
    });

    it('Nodewatch 取得失敗 → 警告ログ + knownPeers を返すこと', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Nodewatch down'));
      vi.stubGlobal('fetch', mockFetch);
      const knownPeer = {
        publicKey: 'KNOWN',
        endpoint: { host: 'k', port: 7900 },
        metadata: { name: 'k', roles: 'Peer' },
      };
      const preset = { ...basePreset, knownPeers: [knownPeer], nodewatchUrl: 'http://nodewatch/' };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.getPeerInfos();

      expect(result).toEqual([knownPeer]);
    });

    it('/node/info fetch が例外を投げる場合は警告ログを出して続行すること', async () => {
      const node = makeNode();
      const mockFetch = vi
        .fn()
        // getNodes
        .mockResolvedValueOnce({ ok: true, json: async () => [node] })
        // enrichNodesWithHostInfo /node/info → throws
        .mockRejectedValueOnce(new Error('network error'));
      vi.stubGlobal('fetch', mockFetch);
      const preset = { ...basePreset, nodewatchUrl: 'http://nodewatch/' };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      // host/port は node.host/port（makeNode のデフォルト値）がそのまま残るので PeerInfo は返る
      const result = await service.getPeerInfos();

      expect(result).toHaveLength(1);
    });

    it('endpoint が空のノードは /node/info を問い合わせないこと（isHealthy=true でも）', async () => {
      const nodeNoEndpoint = makeNode({ endpoint: '', host: undefined, port: undefined });
      const mockFetch = vi
        .fn()
        // getNodes
        .mockResolvedValueOnce({ ok: true, json: async () => [nodeNoEndpoint] });
      vi.stubGlobal('fetch', mockFetch);
      const preset = { ...basePreset, nodewatchUrl: 'http://nodewatch/' };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.getPeerInfos();

      // host/port が補完されないのでフィルタアウトされる
      expect(result).toHaveLength(0);
      // /node/info は呼ばれていない
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('/node/info が ok=false の場合は host/port を補完しないこと', async () => {
      const node = makeNode({ host: undefined, port: undefined });
      const mockFetch = vi
        .fn()
        // getNodes
        .mockResolvedValueOnce({ ok: true, json: async () => [node] })
        // enrichNodesWithHostInfo /node/info → ok=false
        .mockResolvedValueOnce({ ok: false });
      vi.stubGlobal('fetch', mockFetch);
      const preset = { ...basePreset, nodewatchUrl: 'http://nodewatch/' };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.getPeerInfos();

      // host/port が補完されないのでフィルタアウトされる
      expect(result).toHaveLength(0);
    });

    it('mainPublicKey が欠けているノードは PeerInfo に変換されないこと', async () => {
      const nodeNoPubKey = makeNode({ mainPublicKey: '' });
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [nodeNoPubKey] })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ host: '1.2.3.4', port: 7900 }) });
      vi.stubGlobal('fetch', mockFetch);
      const preset = { ...basePreset, nodewatchUrl: 'http://nodewatch/' };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const result = await service.getPeerInfos();

      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // resolveRestUrlsForServices
  // ---------------------------------------------------------------------------
  describe('resolveRestUrlsForServices', () => {
    it('gateways あり → URL を正規化して返すこと', async () => {
      const preset = {
        ...basePreset,
        knownRestGateways: ['http://gw:3000'],
        gateway: { apiNodeName: 'node1', host: 'my-gateway' },
        node: { name: 'node1', host: 'fallback-host' },
      };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      const { restNodes, defaultNode } = await service.resolveRestUrlsForServices();

      expect(restNodes).toContain('http://my-gateway:3000');
      expect(defaultNode).toBe('http://my-gateway:3000');
    });

    it('REST ノードが 0 件の場合は Error を投げること', async () => {
      const preset = {
        ...basePreset,
        knownRestGateways: [],
        gateway: undefined,
      };
      const service = new RemoteNodeService(logger, preset, false, mockNetworkPort as any);

      await expect(service.resolveRestUrlsForServices()).rejects.toThrow(
        'REST ノードを解決できませんでした。'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getNodes
  // ---------------------------------------------------------------------------
  describe('getNodes', () => {
    it('正常レスポンス → NodewatchPeer[] を返すこと', async () => {
      const nodes = [{ endpoint: 'http://p1:3000', isHealthy: true }];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => nodes }));
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      const result = await service.getNodes('http://nodewatch', 10, 'random');

      expect(result).toEqual(nodes);
    });

    it('HTTP エラー → Error を投げること', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      await expect(service.getNodes('http://nodewatch', 10, 'random')).rejects.toThrow('500');
    });

    it('配列でないレスポンス → Error を投げること', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
      );
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      await expect(service.getNodes('http://nodewatch', 10, 'random')).rejects.toThrow(
        'レスポンス本文が不正です'
      );
    });

    it('URL にスラッシュがなくても正しく URL を構築すること', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
      vi.stubGlobal('fetch', mockFetch);
      const service = new RemoteNodeService(logger, basePreset, false, mockNetworkPort as any);

      await service.getNodes('http://nodewatch', 5, 'desc');

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('http://nodewatch/api/symbol/nodes/peer');
      expect(calledUrl).toContain('limit=5');
      expect(calledUrl).toContain('order=desc');
    });
  });
});
