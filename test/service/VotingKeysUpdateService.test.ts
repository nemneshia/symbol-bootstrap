import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NetworkType } from '../../src/sdk/index.js';
import { ConfigLoader } from '../../src/service/ConfigLoader.js';
import { ExistingConfigurationService } from '../../src/service/ExistingConfigurationService.js';
import { RemoteNodeService } from '../../src/service/RemoteNodeService.js';
import { VotingKeysUpdateService } from '../../src/service/VotingKeysUpdateService.js';
import { VotingService } from '../../src/service/VotingService.js';
import { CryptoUtils } from '../../src/utils/CryptoUtils.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

const createPreset = (overrides: Record<string, unknown> = {}) =>
  ({
    privateKeySecurityMode: 'ENCRYPT',
    node: {
      name: 'api-node',
      voting: true,
      harvesting: true,
      api: true,
      excludeFromNemesis: false,
    },
    ...overrides,
  }) as any;

const createAddresses = (overrides: Record<string, unknown> = {}) =>
  ({
    version: 1,
    networkType: NetworkType.TEST_NET,
    nemesisGenerationHashSeed: 'ABC',
    node: {
      name: 'api-node',
      friendlyName: 'api-node',
      roles: 'Peer',
      main: { address: 'TALICE', publicKey: 'A'.repeat(64) },
      transport: { address: 'TBALICE', publicKey: 'B'.repeat(64) },
    },
    ...overrides,
  }) as any;

/**
 * VotingKeysUpdateService の更新フロー分岐を検証するユニットテスト。
 */
describe('VotingKeysUpdateService', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();

    vi.spyOn(ExistingConfigurationService.prototype, 'loadOrThrow').mockReturnValue({
      presetData: createPreset(),
      addresses: createAddresses(),
    } as any);
    vi.spyOn(CryptoUtils, 'getPrivateKeySecurityMode').mockReturnValue('ENCRYPT' as any);
    vi.spyOn(CryptoUtils, 'removePrivateKeysAccordingToSecurityMode').mockImplementation(
      (addresses) => addresses as any
    );
    vi.spyOn(RemoteNodeService.prototype, 'resolveCurrentFinalizationEpoch').mockResolvedValue(55);
    vi.spyOn(VotingService.prototype, 'run').mockResolvedValue(true);
    vi.spyOn(ConfigLoader.prototype, 'getGeneratedAddressLocation').mockReturnValue(
      'target/addresses.yaml'
    );
    vi.spyOn(YamlUtils, 'writeYaml').mockResolvedValue(undefined);
  });

  it('node preset が存在しない場合は false を返すこと', async () => {
    vi.spyOn(ExistingConfigurationService.prototype, 'loadOrThrow').mockReturnValueOnce({
      presetData: createPreset({ node: undefined }),
      addresses: createAddresses(),
    } as any);
    const service = new VotingKeysUpdateService(logger as any);

    const result = await service.run({ target: 'target', user: 'user' });

    expect(result).toBe(false);
    expect(VotingService.prototype.run).not.toHaveBeenCalled();
    expect(YamlUtils.writeYaml).not.toHaveBeenCalled();
  });

  it('node account が存在しない場合は例外を送出すること', async () => {
    vi.spyOn(ExistingConfigurationService.prototype, 'loadOrThrow').mockReturnValueOnce({
      presetData: createPreset(),
      addresses: createAddresses({ node: undefined }),
    } as any);
    const service = new VotingKeysUpdateService(logger as any);

    await expect(service.run({ target: 'target', user: 'user' })).rejects.toThrow(
      'addresses に node が存在しません。'
    );
  });

  it('finalizationEpoch が指定された場合はその値を優先すること', async () => {
    const service = new VotingKeysUpdateService(logger as any);

    await service.run({ target: 'target', user: 'user', finalizationEpoch: 99 });

    expect(RemoteNodeService.prototype.resolveCurrentFinalizationEpoch).not.toHaveBeenCalled();
    expect(VotingService.prototype.run).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      99,
      true,
      false
    );
  });

  it('finalizationEpoch が未指定の場合は RemoteNodeService から解決すること', async () => {
    const service = new VotingKeysUpdateService(logger as any);

    await service.run({ target: 'target', user: 'user' });

    expect(RemoteNodeService.prototype.resolveCurrentFinalizationEpoch).toHaveBeenCalled();
    expect(VotingService.prototype.run).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      55,
      true,
      false
    );
  });

  it('投票キー更新が発生しない場合は addresses を保存しないこと', async () => {
    vi.spyOn(VotingService.prototype, 'run').mockResolvedValueOnce(false);
    const service = new VotingKeysUpdateService(logger as any);

    const result = await service.run({ target: 'target', user: 'user' });

    expect(result).toBe(false);
    expect(YamlUtils.writeYaml).not.toHaveBeenCalled();
  });

  it('投票キー更新が発生した場合は addresses を再保存すること', async () => {
    const service = new VotingKeysUpdateService(logger as any);

    const result = await service.run({ target: 'target', user: 'user' });

    expect(result).toBe(true);
    expect(CryptoUtils.removePrivateKeysAccordingToSecurityMode).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1 }),
      'ENCRYPT'
    );
    expect(YamlUtils.writeYaml).toHaveBeenCalledWith(
      'target/addresses.yaml',
      expect.objectContaining({ version: 1 }),
      undefined
    );
  });
});
