import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RemoteNodeService } from '../../src/service/RemoteNodeService.js';
import { TransactionUtils } from '../../src/utils/TransactionUtils.js';

vi.mock('../../src/service/RemoteNodeService.js');

/**
 * TransactionUtils クラスのユニットテスト。
 * RemoteNodeService や INetworkPort をモックして REST URL 解決をテストする。
 */
describe('TransactionUtils', () => {
  /** モック用の RemoteNodeService */
  const mockRemoteNodeService = {
    getBestRepositoryInfo: vi.fn(),
  };

  /** モック用の INetworkPort */
  const mockNetworkPort = {
    getMultisigInfo: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBestUrl', () => {
    it('RemoteNodeService から最適な REST URL を返すこと', async () => {
      mockRemoteNodeService.getBestRepositoryInfo.mockResolvedValue({
        restGatewayUrl: 'http://best-node:3000',
      });

      const result = await TransactionUtils.getBestUrl(mockRemoteNodeService as any, undefined);

      expect(result).toBe('http://best-node:3000');
      expect(mockRemoteNodeService.getBestRepositoryInfo).toHaveBeenCalledWith(undefined);
    });

    it('指定した URL を渡して getBestRepositoryInfo を呼ぶこと', async () => {
      mockRemoteNodeService.getBestRepositoryInfo.mockResolvedValue({
        restGatewayUrl: 'http://specified-node:3000',
      });

      const result = await TransactionUtils.getBestUrl(
        mockRemoteNodeService as any,
        'http://specified-node:3000'
      );

      expect(result).toBe('http://specified-node:3000');
      expect(mockRemoteNodeService.getBestRepositoryInfo).toHaveBeenCalledWith(
        'http://specified-node:3000'
      );
    });
  });

  describe('getMultisigInfo', () => {
    it('マルチシグ情報を取得できること', async () => {
      const expectedInfo = {
        multisigAddress: 'TADDRESS',
        cosignatoryAddresses: ['ADDR1', 'ADDR2'],
        minApproval: 2,
        minRemoval: 1,
      };
      mockNetworkPort.getMultisigInfo.mockResolvedValue(expectedInfo);

      const result = await TransactionUtils.getMultisigInfo(
        mockNetworkPort as any,
        'http://node:3000',
        'TADDRESS'
      );

      expect(result).toEqual(expectedInfo);
      expect(mockNetworkPort.getMultisigInfo).toHaveBeenCalledWith('http://node:3000', 'TADDRESS');
    });

    it('エラーが発生した場合は undefined を返すこと', async () => {
      mockNetworkPort.getMultisigInfo.mockRejectedValue(new Error('接続エラー'));

      const result = await TransactionUtils.getMultisigInfo(
        mockNetworkPort as any,
        'http://node:3000',
        'TADDRESS'
      );

      expect(result).toBeUndefined();
    });
  });

  describe('getBestUrlLegacy', () => {
    it('RemoteNodeService を内部生成して最適な REST URL を返すこと', async () => {
      const mockGetBestRepositoryInfo = vi.fn().mockResolvedValue({
        restGatewayUrl: 'http://legacy-node:3000',
      });
      vi.mocked(RemoteNodeService).mockImplementation(
        class {
          getBestRepositoryInfo = mockGetBestRepositoryInfo;
        } as any
      );

      const result = await TransactionUtils.getBestUrlLegacy(
        {} as any,
        {} as any,
        'http://legacy-node:3000',
        mockNetworkPort as any
      );

      expect(result).toBe('http://legacy-node:3000');
      expect(mockGetBestRepositoryInfo).toHaveBeenCalledWith('http://legacy-node:3000');
    });

    it('url=undefined を渡すと getBestRepositoryInfo に undefined が渡ること', async () => {
      const mockGetBestRepositoryInfo = vi.fn().mockResolvedValue({
        restGatewayUrl: 'http://auto-node:3000',
      });
      vi.mocked(RemoteNodeService).mockImplementation(
        class {
          getBestRepositoryInfo = mockGetBestRepositoryInfo;
        } as any
      );

      const result = await TransactionUtils.getBestUrlLegacy(
        {} as any,
        {} as any,
        undefined,
        mockNetworkPort as any
      );

      expect(result).toBe('http://auto-node:3000');
      expect(mockGetBestRepositoryInfo).toHaveBeenCalledWith(undefined);
    });
  });
});
