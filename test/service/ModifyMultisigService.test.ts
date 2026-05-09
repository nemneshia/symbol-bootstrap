import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { NetworkType } from '../../src/sdk/index.js';
import { AnnounceService } from '../../src/service/AnnounceService.js';
import { ConfigLoader } from '../../src/service/ConfigLoader.js';
import {
  ModifyMultisigParams,
  ModifyMultisigService,
} from '../../src/service/ModifyMultisigService.js';
import { TransactionUtils } from '../../src/utils/TransactionUtils.js';

const textMock = vi.fn();

vi.mock('@clack/prompts', () => ({
  text: (...args: any[]) => textMock(...args),
  isCancel: (value: unknown) => value === 'cancel',
}));

class TestableModifyMultisigService extends ModifyMultisigService {
  public validateParamsPublic(
    addressAdditions?: string[],
    addressDeletions?: string[],
    minRemovalDelta?: number,
    minApprovalDelta?: number,
    currentMultisigInfo?: any
  ): void {
    this.validateParams(
      addressAdditions,
      addressDeletions,
      minRemovalDelta,
      minApprovalDelta,
      currentMultisigInfo
    );
  }
}

const createService = (): TestableModifyMultisigService => {
  const logger = LoggerFactory.getLogger(LogType.Silent);
  const params: ModifyMultisigParams = {
    target: 'target',
    url: 'http://localhost:3000',
  };
  return new TestableModifyMultisigService(logger, params);
};

describe('ModifyMultisigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveCosigners', () => {
    it('カンマ区切りのアドレスを trim して返すこと', async () => {
      const service = createService();
      const first = 'TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const second = 'TBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

      const result = await service.resolveCosigners(
        NetworkType.TEST_NET,
        '追加アドレス',
        `  ${first}  , ${second}  `
      );

      expect(result).toEqual([first, second]);
    });

    it('不正なアドレス形式の場合はエラーを投げること', async () => {
      const service = createService();

      await expect(
        service.resolveCosigners(NetworkType.TEST_NET, '追加アドレス', 'INVALID_ADDRESS')
      ).rejects.toThrow('アドレス INVALID_ADDRESS は不正です。');
    });

    it('cosigners 未指定時は text プロンプト結果を利用すること', async () => {
      const service = createService();
      const address = 'TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      textMock.mockResolvedValueOnce(address);

      const result = await service.resolveCosigners(NetworkType.TEST_NET, '追加アドレス');

      expect(result).toEqual([address]);
      expect(textMock).toHaveBeenCalledTimes(1);
    });

    it('private toAddresses は undefined 入力で空配列を返すこと', () => {
      const service = createService() as any;

      expect(service.toAddresses(undefined)).toEqual([]);
    });
  });

  describe('resolveDelta', () => {
    it('delta が指定されている場合はその値を返すこと', async () => {
      const service = createService();

      const result = await service.resolveDelta('delta', 7);

      expect(result).toBe(7);
      expect(textMock).not.toHaveBeenCalled();
    });

    it('delta が未指定の場合は text プロンプト結果を返すこと', async () => {
      const service = createService();
      textMock.mockResolvedValueOnce('3');

      const result = await service.resolveDelta('delta');

      expect(result).toBe(3);
      expect(textMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateParams', () => {
    const currentMultisigInfo = {
      minApproval: 2,
      minRemoval: 2,
      cosignatoryAddresses: ['TA', 'TB', 'TC'],
    };

    it('既存コサイナーを追加しようとするとエラーになること', () => {
      const service = createService();

      expect(() =>
        service.validateParamsPublic(['TA'], [], 0, 0, currentMultisigInfo as any)
      ).toThrow('コサイナーを追加できません。TA は既にコサイナーです。');
    });

    it('存在しないコサイナーを削除しようとするとエラーになること', () => {
      const service = createService();

      expect(() =>
        service.validateParamsPublic([], ['TD'], 0, 0, currentMultisigInfo as any)
      ).toThrow('コサイナーを削除できません。TD は現行コサイナーではありません。');
    });

    it('最小承認数を満たさないとエラーになること', () => {
      const service = createService();

      expect(() =>
        service.validateParamsPublic([], ['TA', 'TB'], 0, 0, currentMultisigInfo as any)
      ).toThrow('最小承認数に対してコサイナーが 1 件不足しています。');
    });

    it('最小削除承認数を満たさないとエラーになること', () => {
      const service = createService();

      expect(() =>
        service.validateParamsPublic([], ['TA', 'TB'], 1, 0, {
          minApproval: 0,
          minRemoval: 2,
          cosignatoryAddresses: ['TA', 'TB', 'TC'],
        } as any)
      ).toThrow('最小削除承認数に対してコサイナーが 2 件不足しています。');
    });

    it('コサイナーがいるのに最小承認数を 0 にするとエラーになること', () => {
      const service = createService();

      expect(() =>
        service.validateParamsPublic([], [], -2, -2, currentMultisigInfo as any)
      ).toThrow(
        'コサイナーが 3 件いる状態で、最小承認数または最小削除承認数を 0 には設定できません。'
      );
    });

    it('整合するパラメータはエラーにならないこと', () => {
      const service = createService();

      expect(() =>
        service.validateParamsPublic(['TD'], ['TA'], 0, 0, currentMultisigInfo as any)
      ).not.toThrow();
    });

    it('currentMultisigInfo 未指定でも整合パラメータはエラーにならないこと', () => {
      const service = createService();

      expect(() =>
        service.validateParamsPublic([], [], undefined, undefined, undefined)
      ).not.toThrow();
    });

    it('currentMultisigInfo ありで delta 未指定でも既存閾値を維持すること', () => {
      const service = createService();

      expect(() =>
        service.validateParamsPublic(undefined, undefined, undefined, undefined, {
          minApproval: 1,
          minRemoval: 1,
          cosignatoryAddresses: ['TA'],
        } as any)
      ).not.toThrow();
    });
  });

  describe('createTransactions', () => {
    it('トランザクション作成フローで Descriptor を1件返すこと', async () => {
      const logger = LoggerFactory.getLogger(LogType.Silent);
      const transactionPort = {
        createMultisigModificationDescriptor: vi.fn().mockReturnValue({ type: 'multisig' }),
      };
      const networkPort = {};
      const service = new ModifyMultisigService(
        logger,
        {
          target: 'target',
          url: 'http://localhost:3000/',
          addressAdditions: 'TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          addressDeletions: '',
          minApprovalDelta: 1,
          minRemovalDelta: 1,
        },
        {} as any,
        networkPort as any,
        transactionPort as any
      );
      vi.spyOn(TransactionUtils, 'getBestUrlLegacy').mockResolvedValue('http://best-url');
      vi.spyOn(TransactionUtils, 'getMultisigInfo').mockResolvedValue({
        minApproval: 0,
        minRemoval: 0,
        cosignatoryAddresses: [],
      } as any);

      const result = await service.createTransactions({
        presetData: { networkType: NetworkType.TEST_NET } as any,
        mainAccount: { address: 'TMAIN', publicKey: 'MAIN' } as any,
      } as any);

      expect(result).toHaveLength(1);
      expect(transactionPort.createMultisigModificationDescriptor).toHaveBeenCalledTimes(1);
    });

    it('useKnownRestGateways=true の場合は URL 指定なしでベストノード探索すること', async () => {
      const logger = LoggerFactory.getLogger(LogType.Silent);
      const transactionPort = {
        createMultisigModificationDescriptor: vi.fn().mockReturnValue({ type: 'multisig' }),
      };
      const getBestUrlSpy = vi
        .spyOn(TransactionUtils, 'getBestUrlLegacy')
        .mockResolvedValue('http://best-url');
      vi.spyOn(TransactionUtils, 'getMultisigInfo').mockResolvedValue({
        minApproval: 0,
        minRemoval: 0,
        cosignatoryAddresses: [],
      } as any);
      const service = new ModifyMultisigService(
        logger,
        {
          target: 'target',
          url: 'http://localhost:3000/',
          useKnownRestGateways: true,
          addressAdditions: '',
          addressDeletions: '',
          minApprovalDelta: 0,
          minRemovalDelta: 0,
        },
        {} as any,
        {} as any,
        transactionPort as any
      );

      await service.createTransactions({
        presetData: { networkType: NetworkType.TEST_NET } as any,
        mainAccount: { address: 'TMAIN', publicKey: 'MAIN' } as any,
      } as any);

      expect(getBestUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        undefined,
        expect.anything()
      );
    });
  });

  describe('run', () => {
    it('preset/addresses を引数で受けた場合も announce を呼び出すこと', async () => {
      const announceSpy = vi
        .spyOn(AnnounceService.prototype, 'announce')
        .mockResolvedValue(undefined as any);
      vi.spyOn(ConfigLoader.prototype, 'loadCustomPreset').mockReturnValue(undefined as any);
      vi.spyOn(ConfigLoader.prototype, 'mergePresets').mockImplementation(
        (preset) => preset as any
      );

      const service = new ModifyMultisigService(
        LoggerFactory.getLogger(LogType.Silent),
        {
          target: 'target',
          url: 'http://localhost:3000',
          ready: true,
          accountResolver: {} as any,
        },
        {} as any,
        {} as any
      );

      await service.run({ networkType: NetworkType.TEST_NET } as any, { node: {} } as any);

      expect(announceSpy).toHaveBeenCalledTimes(1);
    });

    it('preset/addresses 未指定時は ConfigLoader から読み込むこと', async () => {
      const announceSpy = vi
        .spyOn(AnnounceService.prototype, 'announce')
        .mockResolvedValue(undefined as any);
      const presetSpy = vi
        .spyOn(ConfigLoader.prototype, 'loadExistingPresetData')
        .mockReturnValue({ networkType: NetworkType.TEST_NET } as any);
      const addressesSpy = vi
        .spyOn(ConfigLoader.prototype, 'loadExistingAddresses')
        .mockReturnValue({ node: {} } as any);
      vi.spyOn(ConfigLoader.prototype, 'loadCustomPreset').mockReturnValue(undefined as any);
      vi.spyOn(ConfigLoader.prototype, 'mergePresets').mockImplementation(
        (preset) => preset as any
      );

      const service = new ModifyMultisigService(
        LoggerFactory.getLogger(LogType.Silent),
        {
          target: 'target',
          url: 'http://localhost:3000',
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

    it('accountResolver 未指定時でも run が実行できること', async () => {
      const announceSpy = vi
        .spyOn(AnnounceService.prototype, 'announce')
        .mockResolvedValue(undefined as any);
      vi.spyOn(ConfigLoader.prototype, 'loadCustomPreset').mockReturnValue(undefined as any);
      vi.spyOn(ConfigLoader.prototype, 'mergePresets').mockImplementation(
        (preset) => preset as any
      );

      const service = new ModifyMultisigService(
        LoggerFactory.getLogger(LogType.Silent),
        {
          target: 'target',
          url: 'http://localhost:3000',
          ready: true,
        },
        {} as any,
        {} as any
      );

      await service.run({ networkType: NetworkType.TEST_NET } as any, { node: {} } as any);

      expect(announceSpy).toHaveBeenCalledTimes(1);
    });
  });
});
