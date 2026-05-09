import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { ComposeService } from '../../src/service/ComposeService.js';
import { ConfigService } from '../../src/service/ConfigService.js';
import { FileSystemService } from '../../src/service/FileSystemService.js';
import { PackService } from '../../src/service/PackService.js';
import { CryptoUtils } from '../../src/utils/CryptoUtils.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';
import { ZipUtils } from '../../src/utils/ZipUtils.js';

const { existsSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: ((path: any) => {
      const text = String(path);
      if (text.endsWith('symbol-node.zip')) {
        return existsSyncMock(path);
      }
      return actual.existsSync(path);
    }) as typeof actual.existsSync,
  };
});

const logger = LoggerFactory.getLogger(LogType.Silent);

const createParams = (): any => ({
  target: 'target/bootstrap',
  customPreset: '/tmp/custom-preset.yaml',
  password: false,
});

describe('PackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(false);
    vi.spyOn(ConfigService.prototype, 'run').mockResolvedValue({
      presetData: { preset: 'test' },
    } as any);
    vi.spyOn(ComposeService.prototype, 'run').mockResolvedValue({ services: {} } as any);
    vi.spyOn(FileSystemService.prototype, 'deleteFile').mockImplementation(() => undefined);
    vi.spyOn(YamlUtils, 'loadYaml').mockReturnValue({ foo: 'bar', privateKey: 'hidden' } as any);
    vi.spyOn(CryptoUtils, 'removePrivateKeys').mockReturnValue({ foo: 'bar' } as any);
    vi.spyOn(YamlUtils, 'writeYaml').mockResolvedValue(undefined);
    vi.spyOn(ZipUtils.prototype, 'zip').mockResolvedValue(undefined);
  });

  it('既存 ZIP がある場合は例外を送出すること', async () => {
    existsSyncMock.mockReturnValue(true);
    const service = new PackService(logger);

    await expect(service.run(createParams())).rejects.toThrow('既に存在します');
    expect(ConfigService.prototype.run).not.toHaveBeenCalled();
    expect(ZipUtils.prototype.zip).not.toHaveBeenCalled();
  });

  it('config -> compose -> zip を実行し、targetZip を返すこと', async () => {
    const service = new PackService(logger);
    const params = createParams();

    const result = await service.run(params);

    expect(ConfigService.prototype.run).toHaveBeenCalledOnce();
    expect(ComposeService.prototype.run).toHaveBeenCalledWith({ preset: 'test' });
    expect(ZipUtils.prototype.zip).toHaveBeenCalledOnce();

    const [targetZip, zipItems] = vi.mocked(ZipUtils.prototype.zip).mock.calls[0];
    expect(targetZip).toContain('symbol-node.zip');
    expect(zipItems).toEqual([
      {
        from: 'target/bootstrap',
        to: 'target',
        directory: true,
      },
      {
        from: expect.stringContaining('.symbol-bootstrap-pack-temp.yaml'),
        to: 'config-only-custom-preset.yaml',
        directory: false,
      },
    ]);
    expect(result.targetZip).toContain('symbol-node.zip');
  });

  it('customPreset がある場合は読み込み後に秘密鍵を除去して書き込むこと', async () => {
    const service = new PackService(logger);

    await service.run(createParams());

    expect(YamlUtils.loadYaml).toHaveBeenCalledWith('/tmp/custom-preset.yaml', false);
    expect(CryptoUtils.removePrivateKeys).toHaveBeenCalledWith({
      foo: 'bar',
      privateKey: 'hidden',
    });
    expect(YamlUtils.writeYaml).toHaveBeenCalledWith(
      expect.stringContaining('.symbol-bootstrap-pack-temp.yaml'),
      { foo: 'bar' },
      false
    );
  });

  it('customPreset がない場合は空オブジェクトを書き込むこと', async () => {
    const service = new PackService(logger);
    const params = createParams();
    params.customPreset = undefined;

    await service.run(params);

    expect(YamlUtils.loadYaml).not.toHaveBeenCalled();
    expect(CryptoUtils.removePrivateKeys).not.toHaveBeenCalled();
    expect(YamlUtils.writeYaml).toHaveBeenCalledWith(
      expect.stringContaining('.symbol-bootstrap-pack-temp.yaml'),
      {},
      false
    );
  });

  it('zip 失敗時でも finally で一時ファイルを削除すること', async () => {
    vi.spyOn(ZipUtils.prototype, 'zip').mockRejectedValueOnce(new Error('zip failure'));
    const service = new PackService(logger);

    await expect(service.run(createParams())).rejects.toThrow('zip failure');

    const deleteCalls = vi.mocked(FileSystemService.prototype.deleteFile).mock.calls;
    const tempPathCalls = deleteCalls.filter(([path]) =>
      String(path).includes('.symbol-bootstrap-pack-temp.yaml')
    );
    expect(tempPathCalls.length).toBe(2);
  });
});
