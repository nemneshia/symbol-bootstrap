import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chmodSync, existsSync } from 'node:fs';

import { CertificateService } from '../../src/service/CertificateService.js';
import { ConfigLoader } from '../../src/service/ConfigLoader.js';
import { FileSystemService } from '../../src/service/FileSystemService.js';
import { RunService } from '../../src/service/RunService.js';
import { RuntimeService } from '../../src/service/RuntimeService.js';
import { AsyncUtils } from '../../src/utils/AsyncUtils.js';
import { PortUtils } from '../../src/utils/PortUtils.js';
import { Utils } from '../../src/utils/Utils.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    chmodSync: vi.fn(actual.chmodSync),
  };
});

describe('RunService', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
  const networkPort = {
    getNodeInfo: vi.fn(),
    getNodeHealth: vi.fn(),
  } as any;
  const existsSyncMock = vi.mocked(existsSync);
  const chmodSyncMock = vi.mocked(chmodSync);

  const createService = (params: Record<string, unknown> = {}) =>
    new RunService(
      logger,
      {
        target: 'target',
        detached: false,
        build: false,
        checkHealth: false,
        pullImages: false,
        timeout: 1000,
        ...params,
      } as any,
      networkPort,
      {} as any
    );

  beforeEach(() => {
    vi.restoreAllMocks();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    logger.debug.mockClear();
    networkPort.getNodeInfo.mockReset();
    networkPort.getNodeHealth.mockReset();

    existsSyncMock.mockReturnValue(true);
    chmodSyncMock.mockImplementation(() => undefined);

    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockReturnValue({
      node: {
        name: 'api-node',
      },
      dockerComposeProjectName: 'proj',
      symbolServerImage: 'symbol-server:latest',
      certificateExpirationWarningInDays: 30,
      gateway: { name: 'gateway' },
    } as any);

    vi.spyOn(FileSystemService.prototype, 'getTargetNodesFolder').mockReturnValue(
      '/tmp/nodes/api-node'
    );
    vi.spyOn(FileSystemService.prototype, 'getTargetGatewayFolder').mockReturnValue(
      '/tmp/gateway/logs'
    );
    vi.spyOn(FileSystemService.prototype, 'getTargetDatabasesFolder').mockReturnValue(
      '/tmp/databases'
    );
    vi.spyOn(FileSystemService.prototype, 'deleteFolder').mockImplementation(() => {});
    vi.spyOn(FileSystemService.prototype, 'mkdir').mockResolvedValue(undefined);

    vi.spyOn(RuntimeService.prototype, 'spawn').mockResolvedValue('ok');
    vi.spyOn(RuntimeService.prototype, 'exec').mockResolvedValue({
      stdout: 'api-node\n',
      stderr: '',
    });
    vi.spyOn(RuntimeService.prototype, 'pullImage').mockResolvedValue(undefined);

    vi.spyOn(AsyncUtils, 'sleep').mockResolvedValue(undefined);
    vi.spyOn(AsyncUtils, 'poll').mockResolvedValue(true);
    vi.spyOn(PortUtils, 'isReachable').mockResolvedValue(true);

    vi.spyOn(YamlUtils, 'loadYaml').mockResolvedValue({
      services: {
        apiNode: {
          container_name: 'api-node',
          ports: ['3000:3000'],
          command: '/symbol-workdir/rest start',
          volumes: ['../databases:/db'],
          image: 'symbol-server:latest',
        },
      },
    } as any);
    vi.spyOn(YamlUtils, 'readTextFile').mockResolvedValue('services: {}');
    vi.spyOn(YamlUtils, 'fromYaml').mockReturnValue({
      services: {
        apiNode: {
          container_name: 'api-node',
          ports: ['3000:3000'],
          command: '/symbol-workdir/rest start',
        },
      },
    } as any);
  });

  it('run は引数を組み立てて起動すること', async () => {
    const service = createService({
      detached: true,
      build: true,
      args: ['--scale api=2'],
      checkHealth: true,
    });
    const beforeRunSpy = vi.spyOn(service as any, 'beforeRun');
    const basicRunSpy = vi.spyOn(service as any, 'basicRun').mockResolvedValue('ok');
    const checkHealthSpy = vi.spyOn(service, 'checkHealth').mockResolvedValue(undefined);

    await service.run();

    expect(beforeRunSpy).toHaveBeenCalledWith(
      expect.arrayContaining(['up', '--remove-orphans', '--detach', '--build', '--scale', 'api=2']),
      false
    );
    expect(basicRunSpy).toHaveBeenCalled();
    expect(checkHealthSpy).toHaveBeenCalled();
  });

  it('run は resetData=true の場合に先にリセットすること', async () => {
    const service = createService({ resetData: true });
    const resetSpy = vi.spyOn(service, 'resetData').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'beforeRun').mockResolvedValue(true);
    vi.spyOn(service as any, 'basicRun').mockResolvedValue('ok');

    await service.run();

    expect(resetSpy).toHaveBeenCalled();
  });

  it('checkHealth は compose が無い場合に終了すること', async () => {
    existsSyncMock.mockReturnValue(false);
    const service = createService();

    await service.checkHealth();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Docker compose target/docker/compose.yaml が存在しないため、サービス状態を確認できません。'
      )
    );
  });

  it('checkHealth は証明書期限NGなら例外を投げること', async () => {
    const service = createService();
    vi.spyOn(service as any, 'checkCertificates').mockResolvedValue(false);

    await expect(service.checkHealth()).rejects.toThrow(
      '証明書の有効期限が近づいています。ログを確認してください。'
    );
  });

  it('checkHealth は poll が false なら例外を投げること', async () => {
    vi.spyOn(AsyncUtils, 'poll').mockResolvedValue(false);
    const service = createService();
    vi.spyOn(service as any, 'checkCertificates').mockResolvedValue(true);

    await expect(service.checkHealth()).rejects.toThrow('ネットワークが起動しませんでした。');
  });

  it('checkHealth は起動済みなら稼働中ログを出すこと', async () => {
    const service = createService();
    vi.spyOn(service as any, 'checkCertificates').mockResolvedValue(true);
    vi.spyOn(AsyncUtils, 'poll').mockResolvedValue(true);

    await service.checkHealth();

    expect(logger.info).toHaveBeenCalledWith('ネットワークは稼働中です。');
  });

  it('runOneCheck は light REST も検証すること', async () => {
    const service = createService();
    vi.spyOn(RuntimeService.prototype, 'exec').mockResolvedValue({
      stdout: 'api-node\n',
      stderr: '',
    });
    networkPort.getNodeInfo.mockResolvedValue({});

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
        command: '/symbol-workdir/rest start-light',
      },
    ]);

    expect(result).toBe(true);
    expect(networkPort.getNodeInfo).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('runOneCheck はコンテナ未起動なら false を返すこと', async () => {
    const service = createService();
    vi.spyOn(RuntimeService.prototype, 'exec').mockResolvedValue({ stdout: '', stderr: '' });

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
      },
    ]);

    expect(result).toBe(false);
  });

  it('runOneCheck はポート未開放なら false を返すこと', async () => {
    const service = createService();
    vi.spyOn(PortUtils, 'isReachable').mockResolvedValue(false);

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
      },
    ]);

    expect(result).toBe(false);
  });

  it('runOneCheck は REST 対象外のサービスを成功扱いすること', async () => {
    const service = createService();

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
        command: 'start-other',
      },
    ]);

    expect(result).toBe(true);
  });

  it('runOneCheck は light REST 例外時に false を返すこと', async () => {
    const service = createService();
    networkPort.getNodeInfo.mockRejectedValue(new Error('not ready'));

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
        command: '/symbol-workdir/rest start-light',
      },
    ]);

    expect(result).toBe(false);
  });

  it('runOneCheck は API/DB が Down の場合 false を返すこと', async () => {
    const service = createService();
    networkPort.getNodeHealth.mockResolvedValue({ apiNodeStatus: 'Down', dbStatus: 'Up' });

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
        command: '/symbol-workdir/rest start',
      },
    ]);

    expect(result).toBe(false);
  });

  it('runOneCheck は DB が Down の場合 false を返すこと', async () => {
    const service = createService();
    networkPort.getNodeHealth.mockResolvedValue({ apiNodeStatus: 'Up', dbStatus: 'Down' });

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
        command: '/symbol-workdir/rest start',
      },
    ]);

    expect(result).toBe(false);
  });

  it('runOneCheck は REST 例外時に false を返すこと', async () => {
    const service = createService();
    networkPort.getNodeHealth.mockRejectedValue(new Error('health pending'));

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
        command: '/symbol-workdir/rest start',
      },
    ]);

    expect(result).toBe(false);
  });

  it('runOneCheck は REST 正常時に true を返すこと', async () => {
    const service = createService();
    networkPort.getNodeHealth.mockResolvedValue({ apiNodeStatus: 'Up', dbStatus: 'Up' });

    const result = await (service as any).runOneCheck([
      {
        container_name: 'api-node',
        ports: ['3000:3000'],
        command: '/symbol-workdir/rest start',
      },
    ]);

    expect(result).toBe(true);
  });

  it('beforeRun は compose が無く ignore=true なら false を返すこと', async () => {
    existsSyncMock.mockReturnValue(false);
    const service = createService();

    const result = await (service as any).beforeRun(['stop'], true);

    expect(result).toBe(false);
  });

  it('beforeRun は compose が無く ignore=false なら例外を投げること', async () => {
    existsSyncMock.mockReturnValue(false);
    const service = createService();

    await expect((service as any).beforeRun(['up'], false)).rejects.toThrow(
      'Docker compose target/docker/compose.yaml が存在しないため実行できません'
    );
  });

  it('beforeRun は root 実行時に databases ボリュームへ chmod すること', async () => {
    vi.spyOn(Utils, 'isRoot').mockReturnValue(true);
    existsSyncMock.mockImplementation((path) => path === 'target/docker/compose.yaml');
    const service = createService();

    await (service as any).beforeRun(['up'], false);

    expect(chmodSyncMock).toHaveBeenCalledWith('target/databases', '777');
  });

  it('beforeRun は pullImages=true の場合にイメージを pull すること', async () => {
    const pullSpy = vi.spyOn(RuntimeService.prototype, 'pullImage').mockResolvedValue(undefined);
    const service = createService({ pullImages: true });

    await (service as any).beforeRun(['up'], false);

    expect(pullSpy).toHaveBeenCalledWith('symbol-server:latest');
  });

  it('checkCertificates は node 未定義なら true を返すこと', async () => {
    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockReturnValue({
      node: undefined,
    } as any);
    const service = createService();

    await expect((service as any).checkCertificates()).resolves.toBe(true);
  });

  it('checkCertificates は期限切れ予兆があれば false を返すこと', async () => {
    vi.spyOn(CertificateService.prototype, 'willCertificateExpire').mockResolvedValue({
      willExpire: true,
      expirationDate: 'Jan 1 2030',
    });
    const service = createService();

    await expect((service as any).checkCertificates()).resolves.toBe(false);
  });

  it('checkCertificates は期限に余裕があれば true を返すこと', async () => {
    vi.spyOn(CertificateService.prototype, 'willCertificateExpire').mockResolvedValue({
      willExpire: false,
      expirationDate: 'Jan 1 2032',
    });
    const service = createService();

    await expect((service as any).checkCertificates()).resolves.toBe(true);
  });

  it('resetData は node/gateway/database フォルダーを整理すること', async () => {
    const service = createService();

    await service.resetData();

    expect(FileSystemService.prototype.deleteFolder).toHaveBeenCalled();
    expect(FileSystemService.prototype.mkdir).toHaveBeenCalled();
  });

  it('stop は beforeRun=true の時だけ basicRun を実行すること', async () => {
    const service = createService();
    const beforeRunSpy = vi.spyOn(service as any, 'beforeRun').mockResolvedValue(true);
    const basicRunSpy = vi.spyOn(service as any, 'basicRun').mockResolvedValue('ok');

    await service.stop();

    expect(beforeRunSpy).toHaveBeenCalledWith(['stop'], true);
    expect(basicRunSpy).toHaveBeenCalledWith(['stop']);
  });

  it('stop は beforeRun=false の時に basicRun を実行しないこと', async () => {
    const service = createService();
    vi.spyOn(service as any, 'beforeRun').mockResolvedValue(false);
    const basicRunSpy = vi.spyOn(service as any, 'basicRun').mockResolvedValue('ok');

    await service.stop();

    expect(basicRunSpy).not.toHaveBeenCalled();
  });

  it('basicRun は dockerComposeProjectName 未指定時に -p を付与しないこと', async () => {
    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockReturnValue({
      dockerComposeProjectName: undefined,
    } as any);
    const spawnSpy = vi.spyOn(RuntimeService.prototype, 'spawn').mockResolvedValue('ok');
    const service = createService();

    await (service as any).basicRun(['up']);

    expect(spawnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['compose', '-f', 'target/docker/compose.yaml', 'up'] })
    );
  });

  it('basicRun は dockerComposeProjectName 指定時に -p を付与すること', async () => {
    vi.spyOn(ConfigLoader.prototype, 'loadExistingPresetData').mockReturnValue({
      dockerComposeProjectName: 'proj',
    } as any);
    const spawnSpy = vi.spyOn(RuntimeService.prototype, 'spawn').mockResolvedValue('ok');
    const service = createService();

    await (service as any).basicRun(['up']);

    expect(spawnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['compose', '-f', 'target/docker/compose.yaml', '-p', 'proj', 'up'],
      })
    );
  });

  it('pullImages は重複イメージを1回だけ pull すること', async () => {
    const pullSpy = vi.spyOn(RuntimeService.prototype, 'pullImage').mockResolvedValue(undefined);
    const service = createService();

    await (service as any).pullImages({
      services: {
        a: { container_name: 'a', image: 'image-a' },
        b: { container_name: 'b', image: 'image-a' },
        c: { container_name: 'c', image: 'image-c' },
      },
    });

    expect(pullSpy).toHaveBeenCalledTimes(2);
  });
});
