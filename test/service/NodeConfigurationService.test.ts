import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyFileSync } from 'node:fs';
import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { PeerInfo } from '../../src/model/index.js';
import { CertificateService } from '../../src/service/CertificateService.js';
import { NodeConfigurationService } from '../../src/service/NodeConfigurationService.js';
import { VotingService } from '../../src/service/VotingService.js';
import { ConfigurationUtils } from '../../src/utils/ConfigurationUtils.js';
import { HandlebarsUtils } from '../../src/utils/HandlebarsUtils.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return { ...actual, copyFileSync: vi.fn() };
});

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  chmod: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/utils/HandlebarsUtils.js', () => ({
  HandlebarsUtils: {
    generateConfiguration: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/utils/ConfigurationUtils.js', () => ({
  ConfigurationUtils: {
    resolveRoles: vi.fn().mockReturnValue('Peer'),
    shouldCreateNemesis: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../../src/service/CertificateService.js', () => ({
  CertificateService: vi.fn().mockImplementation(function (this: any) {
    this.run = vi.fn().mockResolvedValue(undefined);
    return this;
  }),
  RenewMode: { ONLY_WARNING: 0 },
}));

vi.mock('../../src/service/VotingService.js', () => ({
  VotingService: vi.fn().mockImplementation(function (this: any) {
    this.run = vi.fn().mockResolvedValue(false);
    return this;
  }),
}));

describe('NodeConfigurationService', () => {
  const logger = LoggerFactory.getLogger(LogType.Silent);
  const copyFileSyncMock = vi.mocked(copyFileSync);
  const writeFileMock = vi.mocked(writeFile);
  const chmodMock = vi.mocked(chmod);
  const generateConfigMock = vi.mocked(HandlebarsUtils.generateConfiguration);
  const resolveRolesMock = vi.mocked(ConfigurationUtils.resolveRoles);
  const CertificateServiceMock = vi.mocked(CertificateService);
  const VotingServiceMock = vi.mocked(VotingService);

  // ---- ヘルパー ----

  /** 最小限のプリセットデータを生成するヘルパー */
  const makePresetData = (overrides: Record<string, unknown> = {}) => {
    const baseNode = {
      harvesting: false,
      voting: false,
      networkheight: false,
      host: 'localhost',
      friendlyName: 'test-node',
    };
    const hasExplicitNode = Object.prototype.hasOwnProperty.call(overrides, 'node');
    const presetData: any = {
      networkType: 0x98,
      peersP2PListLimit: 10,
      peersApiListLimit: 10,
      votingUnfinalizedBlocksDuration: '500m',
      nonVotingUnfinalizedBlocksDuration: '1000m',
      node: baseNode,
      nodes: [baseNode],
      ...overrides,
    };

    if (!hasExplicitNode) {
      if (Array.isArray(presetData.nodes)) {
        presetData.node = presetData.nodes[0];
      } else if (presetData.nodes === undefined) {
        presetData.node = undefined;
      }
    }
    return presetData;
  };

  /** 最小限のノードアカウントを生成するヘルパー */
  const makeNodeAccount = (overrides: Record<string, unknown> = {}) =>
    ({
      name: 'node-0',
      friendlyName: 'test-node',
      main: { publicKey: 'main-pub-key', address: 'NADDR1', privateKey: 'main-priv-key' },
      transport: {
        publicKey: 'trans-pub-key',
        address: 'NADDR2',
        privateKey: 'trans-priv-key',
      },
      vrf: { publicKey: 'vrf-pub-key', address: 'NADDR3', privateKey: 'vrf-priv-key' },
      ...overrides,
    }) as any;

  /** 最小限の addresses を生成するヘルパー */
  const makeAddresses = (nodeOverrides: Record<string, unknown> = {}) => {
    const node = makeNodeAccount(nodeOverrides);
    return {
      node,
      nodes: [node],
    };
  };

  /** PeerInfo を生成するヘルパー */
  const makePeer = (publicKey: string, roles = 'Peer'): PeerInfo => ({
    publicKey,
    endpoint: { host: `host-${publicKey}`, port: 7900 },
    metadata: { name: `node-${publicKey}`, roles },
  });

  /** FileSystemService の mock を生成するヘルパー */
  const makeFileSystemService = () => ({
    getTargetNodesFolder: vi.fn((target: string, _abs: boolean, name: string, subDir: string) =>
      join(target, name, subDir)
    ),
    mkdir: vi.fn().mockResolvedValue(undefined),
  });

  /** RemoteNodeService の mock を生成するヘルパー */
  const makeRemoteNodeService = (peers: PeerInfo[] = []) => ({
    resolveCurrentFinalizationEpoch: vi.fn().mockResolvedValue(100),
    getPeerInfos: vi.fn().mockResolvedValue(peers),
  });

  /** ConfigParams の mock を生成するヘルパー */
  const makeParams = (resolveAccountResult: Record<string, unknown> | null = null) => ({
    target: '/test/target',
    accountResolver: {
      resolveAccount: vi
        .fn()
        .mockResolvedValue(
          resolveAccountResult ?? { privateKey: 'resolved-priv-key', publicKey: 'resolved-pub-key' }
        ),
    },
  });

  /** NodeConfigurationService インスタンスを生成するヘルパー */
  const makeService = (fileSystemService = makeFileSystemService(), params = makeParams()) =>
    new NodeConfigurationService(logger, params as any, {} as any, fileSystemService as any);

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =====================
  // generateNodes
  // =====================
  describe('generateNodes', () => {
    it('nodes が空の場合はサーバー設定を生成しないこと', async () => {
      const service = makeService();
      const presetData = makePresetData({ nodes: [] });
      const addresses = { node: undefined, nodes: [] };

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      expect(generateConfigMock).not.toHaveBeenCalled();
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('nodes が undefined の場合も正常終了すること（防御的 || [] のカバー）', async () => {
      const service = makeService();
      const presetData = { ...makePresetData(), nodes: undefined };
      const addresses = { node: undefined, nodes: undefined };

      await service.generateNodes(
        presetData as any,
        addresses as any,
        makeRemoteNodeService() as any
      );

      expect(generateConfigMock).not.toHaveBeenCalled();
    });

    it('1 ノードの設定ファイルを生成すること', async () => {
      const service = makeService();
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      // サーバー設定の generateConfiguration が呼ばれること
      expect(generateConfigMock).toHaveBeenCalledTimes(1);
      const [ctx, , , excludeFiles] = generateConfigMock.mock.calls[0];
      expect((ctx as any).name).toBe('node-0');
      // harvesting=false → config-harvesting.properties が除外されること
      expect(excludeFiles).toContain('config-harvesting.properties');
      // networkheight=false → config-networkheight.properties が除外されること
      expect(excludeFiles).toContain('config-networkheight.properties');
    });

    it('peers-p2p.json と peers-api.json を writeFile で書き込むこと', async () => {
      const service = makeService();
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      const writeFileCalls = writeFileMock.mock.calls.map(([path]) => path as string);
      expect(writeFileCalls.some((p) => p.endsWith('peers-p2p.json'))).toBe(true);
      expect(writeFileCalls.some((p) => p.endsWith('peers-api.json'))).toBe(true);
    });

    it('writeFile 後に chmod 0o600 を適用すること', async () => {
      const service = makeService();
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      expect(chmodMock).toHaveBeenCalledTimes(2);
      chmodMock.mock.calls.forEach(([, mode]) => {
        expect(mode).toBe(0o600);
      });
    });

    it('自ノードの publicKey はピアリストから除外されること', async () => {
      const service = makeService();
      const selfPeer = makePeer('main-pub-key', 'Peer'); // 自ノードと同じ publicKey
      const otherPeer = makePeer('other-pub-key', 'Peer');
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(
        presetData,
        addresses,
        makeRemoteNodeService([selfPeer, otherPeer]) as any
      );

      // peers-p2p.json の JSON 内容を確認
      const p2pWriteCall = writeFileMock.mock.calls.find(([path]) =>
        (path as string).endsWith('peers-p2p.json')
      )!;
      const written = JSON.parse(p2pWriteCall[1] as string);
      expect(written.knownPeers).toHaveLength(1);
      expect(written.knownPeers[0].publicKey).toBe('other-pub-key');
    });

    it('ピアが存在しない場合に warn ログを出力すること', async () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      const service = makeService();
      // 自ノードのみ（フィルターで全除去される）
      const selfPeer = makePeer('main-pub-key', 'Peer');
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService([selfPeer]) as any);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('peers-p2p.json と peers-api.json は空です')
      );
    });

    it('ピア数がリミットを超える場合にサンプリングして上限に収めること', async () => {
      const service = makeService();
      const peers = [
        makePeer('peer-1', 'Peer'),
        makePeer('peer-2', 'Peer'),
        makePeer('peer-3', 'Peer'),
      ];
      const presetData = makePresetData({ peersP2PListLimit: 2, peersApiListLimit: 10 });
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService(peers) as any);

      const p2pWriteCall = writeFileMock.mock.calls.find(([path]) =>
        (path as string).endsWith('peers-p2p.json')
      )!;
      const written = JSON.parse(p2pWriteCall[1] as string);
      // ランダムサンプリングで limit=2 以下になること
      expect(written.knownPeers.length).toBeLessThanOrEqual(2);
    });

    it('brokerName が設定されている場合にブローカー設定を生成すること', async () => {
      const service = makeService();
      const peers = [makePeer('peer-1', 'Peer'), makePeer('peer-2', 'Api')];
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: false,
            voting: false,
            networkheight: false,
            host: 'localhost',
            friendlyName: 'test-node',
            brokerName: 'broker-0',
          },
        ],
      });
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService(peers) as any);

      // サーバー設定 + ブローカー設定 = 2 回
      expect(generateConfigMock).toHaveBeenCalledTimes(2);
      const brokerCall = generateConfigMock.mock.calls[1];
      expect((brokerCall[0] as any).addressextractionRecovery).toBe(true);
      // peers-p2p.json と peers-api.json が broker-config へコピーされること
      expect(copyFileSyncMock).toHaveBeenCalledTimes(2);
      const destPaths = copyFileSyncMock.mock.calls.map(([, dest]) => dest as string);
      expect(destPaths.some((p) => p.endsWith('peers-p2p.json'))).toBe(true);
      expect(destPaths.some((p) => p.endsWith('peers-api.json'))).toBe(true);
      // broker-config 下の正しいパスに redundant join なしでコピーされること
      expect(destPaths[0]).not.toContain('nodes/node-0/nodes');
    });

    it('VotingService.run が呼ばれること', async () => {
      const service = makeService();
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      expect(VotingServiceMock).toHaveBeenCalledTimes(1);
    });

    it('voting=true の場合は votingUnfinalizedBlocksDuration が使われること', async () => {
      const service = makeService();
      const presetData = makePresetData({
        votingUnfinalizedBlocksDuration: '300m',
        nodes: [
          {
            harvesting: false,
            voting: true,
            networkheight: false,
            host: 'localhost',
            friendlyName: 'voting-node',
          },
        ],
      });
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      const [ctx] = generateConfigMock.mock.calls[0];
      expect((ctx as any).unfinalizedBlocksDuration).toBe('300m');
    });

    it('nodePreset に friendlyName がない場合は account.friendlyName を使うこと', async () => {
      const service = makeService();
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: false,
            voting: false,
            networkheight: false,
            host: 'localhost',
            // friendlyName なし
          },
        ],
      });
      const addresses = makeAddresses({ friendlyName: 'account-friendly-name' });

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      const [ctx] = generateConfigMock.mock.calls[0];
      expect((ctx as any).friendlyName).toBe('account-friendly-name');
    });

    it('nodePreset に beneficiaryAddress がある場合はそちらを優先すること', async () => {
      const service = makeService();
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: false,
            voting: false,
            networkheight: false,
            host: 'localhost',
            friendlyName: 'test-node',
            beneficiaryAddress: 'NBENEFIT1',
          },
        ],
      });
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      const [ctx] = generateConfigMock.mock.calls[0];
      expect((ctx as any).beneficiaryAddress).toBe('NBENEFIT1');
    });
  });

  // =====================
  // generateNodeCertificates
  // =====================
  describe('generateNodeCertificates', () => {
    it('nodes が空の場合は CertificateService を呼ばないこと', async () => {
      const service = makeService();
      const presetData = makePresetData({ nodes: [] });
      const addresses = { node: undefined, nodes: [] };

      await service.generateNodeCertificates(presetData as any, addresses as any);

      expect(CertificateServiceMock).not.toHaveBeenCalled();
    });

    it('各ノードの証明書を生成すること', async () => {
      const service = makeService();
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodeCertificates(presetData as any, addresses as any);

      expect(CertificateServiceMock).toHaveBeenCalledTimes(1);
      const certInstance = CertificateServiceMock.mock.results[0].value;
      expect(certInstance.run).toHaveBeenCalledOnce();
    });

    it('複数候補があっても addresses.node のみ証明書を生成すること', async () => {
      const service = makeService(
        {
          getTargetNodesFolder: vi.fn(
            (target: string, _abs: boolean, name: string, subDir: string) =>
              join(target, name, subDir)
          ),
          mkdir: vi.fn().mockResolvedValue(undefined),
        },
        makeParams()
      );
      const presetData = makePresetData({
        nodes: [
          { harvesting: false, voting: false, host: 'host1', friendlyName: 'node-1' },
          { harvesting: false, voting: false, host: 'host2', friendlyName: 'node-2' },
        ],
      });
      const addresses = {
        node: makeNodeAccount({ name: 'node-1' }),
        nodes: [makeNodeAccount({ name: 'node-1' }), makeNodeAccount({ name: 'node-2' })],
      };

      await service.generateNodeCertificates(presetData as any, addresses as any);

      expect(CertificateServiceMock).toHaveBeenCalledTimes(1);
    });
  });

  // =====================
  // resolveHarvestingAccounts (generateNodes 経由でテスト)
  // =====================
  describe('ハーベスティングアカウントの解決', () => {
    it('harvesting=true の場合に accountResolver.resolveAccount を 2 回呼ぶこと', async () => {
      const params = makeParams();
      const service = makeService(makeFileSystemService(), params);
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: true,
            voting: false,
            networkheight: false,
            host: 'localhost',
            friendlyName: 'harvesting-node',
          },
        ],
      });
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      expect(params.accountResolver.resolveAccount).toHaveBeenCalledTimes(2);
    });

    it('harvesting=false の場合は accountResolver.resolveAccount を呼ばないこと', async () => {
      const params = makeParams();
      const service = makeService(makeFileSystemService(), params);
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      expect(params.accountResolver.resolveAccount).not.toHaveBeenCalled();
    });

    it('remote アカウントがある場合は Remote キーを使って resolveAccount を呼ぶこと', async () => {
      const params = makeParams();
      const service = makeService(makeFileSystemService(), params);
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: true,
            voting: false,
            networkheight: false,
            host: 'localhost',
            friendlyName: 'harvesting-node',
          },
        ],
      });
      const remoteAccount = {
        publicKey: 'remote-pub',
        address: 'NREMOTE',
        privateKey: 'remote-priv',
      };
      const addresses = makeAddresses({ remote: remoteAccount });

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      // 最初の resolveAccount 呼び出しの第3引数が KeyName.Remote (='Remote') であること
      const firstCall = (params.accountResolver.resolveAccount as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(firstCall[2]).toBe('Remote');
    });

    it('remote アカウントがない場合は Main キーを使って resolveAccount を呼ぶこと', async () => {
      const params = makeParams();
      const service = makeService(makeFileSystemService(), params);
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: true,
            voting: false,
            networkheight: false,
            host: 'localhost',
            friendlyName: 'harvesting-node',
          },
        ],
      });
      const addresses = makeAddresses(); // remote なし

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      const firstCall = (params.accountResolver.resolveAccount as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(firstCall[2]).toBe('Main');
    });
  });

  // =====================
  // buildNodeExcludeFiles (generateNodes 経由でテスト)
  // =====================
  describe('設定ファイルの除外判定', () => {
    it('harvesting=true の場合は config-harvesting.properties を除外しないこと', async () => {
      const params = makeParams();
      const service = makeService(makeFileSystemService(), params);
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: true,
            voting: false,
            networkheight: false,
            host: 'localhost',
            friendlyName: 'test-node',
          },
        ],
      });
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      const [, , , excludeFiles] = generateConfigMock.mock.calls[0];
      expect(excludeFiles).not.toContain('config-harvesting.properties');
    });

    it('networkheight=true の場合は config-networkheight.properties を除外しないこと', async () => {
      const params = makeParams();
      const service = makeService(makeFileSystemService(), params);
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: false,
            voting: false,
            networkheight: true,
            host: 'localhost',
            friendlyName: 'test-node',
          },
        ],
      });
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      const [, , , excludeFiles] = generateConfigMock.mock.calls[0];
      expect(excludeFiles).not.toContain('config-networkheight.properties');
    });

    it('harvesting=false かつ networkheight=false の場合は両方除外されること', async () => {
      const service = makeService();
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      const [, , , excludeFiles] = generateConfigMock.mock.calls[0];
      expect(excludeFiles).toContain('config-harvesting.properties');
      expect(excludeFiles).toContain('config-networkheight.properties');
    });
  });

  // =====================
  // generateBrokerConfig (generateNodes 経由でテスト)
  // =====================
  describe('ブローカー設定の生成', () => {
    it('brokerName なしの場合は copyFileSync を呼ばないこと', async () => {
      const service = makeService();
      const presetData = makePresetData(); // brokerName なし
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      expect(copyFileSyncMock).not.toHaveBeenCalled();
    });

    it('ブローカー設定は serverConfig と異なる brokerConfig フォルダーへ出力されること', async () => {
      const fss = makeFileSystemService();
      const service = makeService(fss);
      const peers = [makePeer('peer-1', 'Peer')];
      const presetData = makePresetData({
        nodes: [
          {
            harvesting: false,
            voting: false,
            networkheight: false,
            host: 'localhost',
            friendlyName: 'test-node',
            brokerName: 'broker-0',
          },
        ],
      });
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService(peers) as any);

      const [, , serverDest] = generateConfigMock.mock.calls[0];
      const [, , brokerDest] = generateConfigMock.mock.calls[1];
      expect(serverDest).not.toBe(brokerDest);
      expect(serverDest as string).toContain('server-config');
      expect(brokerDest as string).toContain('broker-config');
    });
  });

  // =====================
  // resolveRoles の呼び出し確認
  // =====================
  describe('ローカルピア構築', () => {
    it('ConfigurationUtils.resolveRoles を各ノード分呼ぶこと', async () => {
      const service = makeService();
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(presetData, addresses, makeRemoteNodeService() as any);

      // generateNodes 内での localPeers 構築と generateNodeConfiguration 内の resolveRoles 呼び出し
      expect(resolveRolesMock).toHaveBeenCalled();
    });

    it('外部ピアとローカルピアが重複除去されること', async () => {
      const service = makeService();
      // ローカルノードと同じ publicKey を持つ外部ピア
      const duplicatePeer = makePeer('main-pub-key', 'Peer');
      const externalPeer = makePeer('external-key', 'Peer');
      const presetData = makePresetData();
      const addresses = makeAddresses();

      await service.generateNodes(
        presetData,
        addresses,
        makeRemoteNodeService([duplicatePeer, externalPeer]) as any
      );

      // 重複除去後、自ノードは除外されるため外部ピアのみ残る
      const p2pWriteCall = writeFileMock.mock.calls.find(([path]) =>
        (path as string).endsWith('peers-p2p.json')
      )!;
      const written = JSON.parse(p2pWriteCall[1] as string);
      // 自ノード(main-pub-key)は除外されるため external-key のみ
      expect(written.knownPeers.every((p: any) => p.publicKey !== 'main-pub-key')).toBe(true);
    });
  });
});
