import { restore, stub } from 'sinon';
import { ChainRoutesApi, MultisigRoutesApi, NodeRoutesApi, NodeStatusEnum } from 'symbol-openapi-typescript-fetch-client';
import { expect } from 'vitest';
import { SymbolNetworkAdapter } from '../../src/sdk/index.js';

const TEST_URL = 'http://localhost:3000';

describe('SymbolNetworkAdapter', () => {
  let adapter: SymbolNetworkAdapter;

  beforeEach(() => {
    adapter = new SymbolNetworkAdapter();
  });

  afterEach(() => {
    restore();
  });

  // ---------------------------------------------------------------
  describe('getChainInfo', () => {
    it('ChainInfoDTO を ChainInfoDto にマッピングする（height を bigint 変換）', async () => {
      stub(ChainRoutesApi.prototype, 'getChainInfo').resolves({
        height: '1000',
        scoreHigh: '10000000000',
        scoreLow: '0',
        latestFinalizedBlock: {
          finalizationEpoch: 5,
          finalizationPoint: 1,
          height: '999',
          hash: 'ABCDEF',
        },
      });

      const result = await adapter.getChainInfo(TEST_URL);
      expect(result.height).eq(1000n);
      expect(result.finalizationEpoch).eq(5);
    });

    it('大きな height 値を bigint に変換する', async () => {
      stub(ChainRoutesApi.prototype, 'getChainInfo').resolves({
        height: '9007199254740993',
        scoreHigh: '0',
        scoreLow: '0',
        latestFinalizedBlock: {
          finalizationEpoch: 999,
          finalizationPoint: 1,
          height: '9007199254740992',
          hash: '00',
        },
      });

      const result = await adapter.getChainInfo(TEST_URL);
      expect(result.height).eq(9007199254740993n);
      expect(result.finalizationEpoch).eq(999);
    });
  });

  // ---------------------------------------------------------------
  describe('getNodeInfo', () => {
    it('NodeInfoDTO の全フィールドを NodeInfoDto にマッピングする', async () => {
      stub(NodeRoutesApi.prototype, 'getNodeInfo').resolves({
        version: 0,
        publicKey: 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
        networkGenerationHashSeed: 'SEEDHASH',
        roles: 3,
        port: 7900,
        networkIdentifier: 152,
        friendlyName: 'my-test-node',
        host: '192.168.1.100',
        nodePublicKey: 'NODEPUBKEY0000000000000000000000000000000000000000000000000000000',
      });

      const result = await adapter.getNodeInfo(TEST_URL);
      expect(result.publicKey).eq('ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789');
      expect(result.host).eq('192.168.1.100');
      expect(result.friendlyName).eq('my-test-node');
      expect(result.roles).eq(3);
      expect(result.networkIdentifier).eq(152);
      expect(result.networkGenerationHashSeed).eq('SEEDHASH');
      expect(result.nodePublicKey).eq('NODEPUBKEY0000000000000000000000000000000000000000000000000000000');
    });

    it('nodePublicKey が未定義の場合は undefined をマッピングする', async () => {
      stub(NodeRoutesApi.prototype, 'getNodeInfo').resolves({
        version: 0,
        publicKey: 'PUBKEY',
        networkGenerationHashSeed: 'HASH',
        roles: 1,
        port: 7900,
        networkIdentifier: 104,
        friendlyName: 'peer-node',
        host: '10.0.0.1',
        // nodePublicKey は省略
      });

      const result = await adapter.getNodeInfo(TEST_URL);
      expect(result.nodePublicKey).eq(undefined);
    });

    it('省略可能フィールドがすべて undefined になる最小構成', async () => {
      stub(NodeRoutesApi.prototype, 'getNodeInfo').resolves({
        version: 0,
        publicKey: undefined as any,
        networkGenerationHashSeed: undefined as any,
        roles: undefined as any,
        port: 7900,
        networkIdentifier: undefined as any,
        friendlyName: undefined as any,
        host: undefined as any,
      });

      const result = await adapter.getNodeInfo(TEST_URL);
      expect(result.publicKey).eq(undefined);
      expect(result.host).eq(undefined);
      expect(result.friendlyName).eq(undefined);
      expect(result.roles).eq(undefined);
      expect(result.networkIdentifier).eq(undefined);
      expect(result.networkGenerationHashSeed).eq(undefined);
    });
  });

  // ---------------------------------------------------------------
  describe('getNodeHealth', () => {
    it('apiNode=Up, db=Up → { apiNodeStatus: Up, dbStatus: Up }', async () => {
      stub(NodeRoutesApi.prototype, 'getNodeHealth').resolves({
        status: { apiNode: NodeStatusEnum.Up, db: NodeStatusEnum.Up },
      });

      const result = await adapter.getNodeHealth(TEST_URL);
      expect(result.apiNodeStatus).eq('Up');
      expect(result.dbStatus).eq('Up');
    });

    it('apiNode=Down, db=Down → { apiNodeStatus: Down, dbStatus: Down }', async () => {
      stub(NodeRoutesApi.prototype, 'getNodeHealth').resolves({
        status: { apiNode: NodeStatusEnum.Down, db: NodeStatusEnum.Down },
      });

      const result = await adapter.getNodeHealth(TEST_URL);
      expect(result.apiNodeStatus).eq('Down');
      expect(result.dbStatus).eq('Down');
    });

    it('apiNode=Up, db=Down → 混在の場合も正しくマッピングする', async () => {
      stub(NodeRoutesApi.prototype, 'getNodeHealth').resolves({
        status: { apiNode: NodeStatusEnum.Up, db: NodeStatusEnum.Down },
      });

      const result = await adapter.getNodeHealth(TEST_URL);
      expect(result.apiNodeStatus).eq('Up');
      expect(result.dbStatus).eq('Down');
    });

    it('apiNode=Down, db=Up → 逆の混在も正しくマッピングする', async () => {
      stub(NodeRoutesApi.prototype, 'getNodeHealth').resolves({
        status: { apiNode: NodeStatusEnum.Down, db: NodeStatusEnum.Up },
      });

      const result = await adapter.getNodeHealth(TEST_URL);
      expect(result.apiNodeStatus).eq('Down');
      expect(result.dbStatus).eq('Up');
    });
  });

  // ---------------------------------------------------------------
  describe('getMultisigInfo', () => {
    it('minApproval > 0 の場合 MultisigInfoDto を返す', async () => {
      stub(MultisigRoutesApi.prototype, 'getAccountMultisig').resolves({
        multisig: {
          version: 1,
          accountAddress: 'TADDRESS',
          minApproval: 2,
          minRemoval: 1,
          cosignatoryAddresses: ['COSIG_ADDR_1', 'COSIG_ADDR_2'],
          multisigAddresses: [],
        },
      });

      const result = await adapter.getMultisigInfo(TEST_URL, 'TADDRESS');
      expect(result).not.eq(undefined);
      expect(result?.isMultisig).eq(true);
      expect(result?.minApproval).eq(2);
      expect(result?.minRemoval).eq(1);
      expect(result?.cosignatoryAddresses).deep.eq(['COSIG_ADDR_1', 'COSIG_ADDR_2']);
    });

    it('minApproval=0, minRemoval=0（非マルチシグ）の場合 undefined を返す', async () => {
      stub(MultisigRoutesApi.prototype, 'getAccountMultisig').resolves({
        multisig: {
          version: 1,
          accountAddress: 'TADDRESS',
          minApproval: 0,
          minRemoval: 0,
          cosignatoryAddresses: [],
          multisigAddresses: [],
        },
      });

      const result = await adapter.getMultisigInfo(TEST_URL, 'TADDRESS');
      expect(result).eq(undefined);
    });

    it('API がエラーをスローした場合 undefined を返す', async () => {
      stub(MultisigRoutesApi.prototype, 'getAccountMultisig').rejects(new Error('Network Error'));

      const result = await adapter.getMultisigInfo(TEST_URL, 'TADDRESS');
      expect(result).eq(undefined);
    });

    it('minApproval > 0 で minRemoval=0 の場合はマルチシグとして扱う', async () => {
      stub(MultisigRoutesApi.prototype, 'getAccountMultisig').resolves({
        multisig: {
          version: 1,
          accountAddress: 'TADDRESS',
          minApproval: 1,
          minRemoval: 0,
          cosignatoryAddresses: ['COSIG_ADDR_1'],
          multisigAddresses: [],
        },
      });

      const result = await adapter.getMultisigInfo(TEST_URL, 'TADDRESS');
      expect(result).not.eq(undefined);
      expect(result?.isMultisig).eq(true);
    });

    it('cosignatoryAddresses が正しく配列にマッピングされる（3 アドレス）', async () => {
      stub(MultisigRoutesApi.prototype, 'getAccountMultisig').resolves({
        multisig: {
          version: 1,
          accountAddress: 'TADDRESS',
          minApproval: 2,
          minRemoval: 1,
          cosignatoryAddresses: ['ADDR1', 'ADDR2', 'ADDR3'],
          multisigAddresses: [],
        },
      });

      const result = await adapter.getMultisigInfo(TEST_URL, 'TADDRESS');
      expect(result?.cosignatoryAddresses).deep.eq(['ADDR1', 'ADDR2', 'ADDR3']);
    });

    it('cosignatoryAddresses が空の場合も正しくマッピングされる', async () => {
      stub(MultisigRoutesApi.prototype, 'getAccountMultisig').resolves({
        multisig: {
          version: 1,
          accountAddress: 'TADDRESS',
          minApproval: 1,
          minRemoval: 1,
          cosignatoryAddresses: [],
          multisigAddresses: [],
        },
      });

      const result = await adapter.getMultisigInfo(TEST_URL, 'TADDRESS');
      expect(result?.cosignatoryAddresses).deep.eq([]);
    });
  });
});
