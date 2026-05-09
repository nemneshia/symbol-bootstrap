import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigLoader } from '../../src/service/ConfigLoader.js';
import { ExistingConfigurationService } from '../../src/service/ExistingConfigurationService.js';

describe('ExistingConfigurationService', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('load は既存 preset と addresses を読み込み再構成して返すこと', () => {
    const oldPreset = { networkType: 152 } as any;
    const rebuiltPreset = { networkType: 104 } as any;
    const addresses = { node: { name: 'api-node' } } as any;

    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockReturnValue(oldPreset);
    vi.spyOn(ConfigLoader.prototype, 'createPresetData').mockReturnValue(rebuiltPreset);
    vi.spyOn(ConfigLoader.prototype, 'loadExistingAddresses').mockReturnValue(addresses);

    const service = new ExistingConfigurationService(logger);
    const result = service.load({
      target: 'target',
      password: 'password',
      customPreset: 'custom.yml',
    });

    expect(result.presetData).toBe(rebuiltPreset);
    expect(result.addresses).toBe(addresses);
    expect(ConfigLoader.prototype.createPresetData).toHaveBeenCalledWith(
      expect.objectContaining({ oldPresetData: oldPreset, customPreset: 'custom.yml' })
    );
  });

  it('load は workingDir 指定時にその値を createPresetData へ渡すこと', () => {
    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockReturnValue({} as any);
    vi.spyOn(ConfigLoader.prototype, 'createPresetData').mockReturnValue({} as any);
    vi.spyOn(ConfigLoader.prototype, 'loadExistingAddresses').mockReturnValue({} as any);

    const service = new ExistingConfigurationService(logger);
    service.load({ target: 'target', password: 'password', workingDir: '/tmp/custom' });

    expect(ConfigLoader.prototype.createPresetData).toHaveBeenCalledWith(
      expect.objectContaining({ workingDir: '/tmp/custom' })
    );
  });

  it('loadOrThrow は文脈付きメッセージで再送出すること', () => {
    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockImplementation(() => {
      throw new Error('read failed');
    });
    const service = new ExistingConfigurationService(logger);

    expect(() =>
      service.loadOrThrow({ target: 'target', password: 'pw' }, '設定読み込み失敗: ')
    ).toThrow('設定読み込み失敗: read failed');
  });
});
