import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { RuntimeService } from '../../src/service/RuntimeService.js';
import { Utils } from '../../src/utils/Utils.js';

const { execMock, spawnMock } = vi.hoisted(() => ({
  execMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  exec: execMock,
  spawn: spawnMock,
}));

function createLoggerMock() {
  const logger: any = {
    error: vi.fn().mockImplementation(() => logger),
    warn: vi.fn().mockImplementation(() => logger),
    info: vi.fn().mockImplementation(() => logger),
    debug: vi.fn().mockImplementation(() => logger),
  };
  return logger;
}

function createMockChildProcess(): any {
  const proc = new EventEmitter() as any;
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  return proc;
}

describe('RuntimeService', () => {
  let logger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createLoggerMock();
    (RuntimeService as any).pulledImages.length = 0;
    (RuntimeService as any).dockerUserId = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exec', () => {
    it('コマンド実行成功時に stdout を返すこと', async () => {
      execMock.mockImplementation((_command: string, callback: any) => {
        callback(null, 'ok-out', 'ok-err');
      });
      const service = new RuntimeService(logger);

      const result = await service.exec('echo test');

      expect(result.stdout).toBe('ok-out');
      expect(result.stderr).toBe('');
    });

    it('ignoreErrors=true の場合は exec 失敗時も stdout/stderr を返すこと', async () => {
      execMock.mockImplementation((_command: string, callback: any) => {
        const error: any = new Error('failed');
        error.stdout = 'failed-out';
        error.stderr = 'failed-err';
        callback(error, error.stdout, error.stderr);
      });
      const service = new RuntimeService(logger);

      const result = await service.exec('bad-cmd', true);

      expect(result.stdout).toBe('failed-out');
      expect(result.stderr).toBe('failed-err');
    });

    it('ignoreErrors=false の場合は exec 失敗時に例外を投げること', async () => {
      execMock.mockImplementation((_command: string, callback: any) => {
        const error: any = new Error('failed');
        error.stdout = 'failed-out';
        error.stderr = 'failed-err';
        callback(error, error.stdout, error.stderr);
      });
      const service = new RuntimeService(logger);

      await expect(service.exec('bad-cmd', false)).rejects.toThrow('failed');
    });

    it('promisify 結果が object の場合はそのまま返すこと', async () => {
      execMock.mockImplementation((_command: string, callback: any) => {
        callback(null, { stdout: 'obj-out', stderr: 'obj-err' });
      });
      const service = new RuntimeService(logger);

      const result = await service.exec('echo test');

      expect(result.stdout).toBe('obj-out');
      expect(result.stderr).toBe('obj-err');
    });
  });

  describe('runImageUsingExec', () => {
    it('docker run コマンドを正しく組み立てて exec に渡すこと', async () => {
      const service = new RuntimeService(logger);
      const execSpy = vi.spyOn(service, 'exec').mockResolvedValue({ stdout: 'done', stderr: '' });

      await service.runImageUsingExec({
        catapultAppFolder: '/catapult',
        image: 'symbolplatform/symbol-server:latest',
        userId: '1000:1000',
        workdir: '/work',
        cmds: ['bash', '-lc', 'echo hi'],
        binds: ['/a:/a', '/b:/b'],
        ignoreErrors: true,
      });

      expect(execSpy).toHaveBeenCalledTimes(1);
      const runCommand = execSpy.mock.calls[0][0];
      expect(runCommand).toContain('docker run --rm');
      expect(runCommand).toContain('-u 1000:1000');
      expect(runCommand).toContain('--workdir=/work');
      expect(runCommand).toContain('--env LD_LIBRARY_PATH=/catapult/lib:/catapult/deps');
      expect(runCommand).toContain('-v /a:/a -v /b:/b');
      expect(runCommand).toContain('symbolplatform/symbol-server:latest');
      expect(runCommand).toContain('"bash" "-lc" "echo hi"');
      expect(runCommand).not.toContain('  ');
      expect(execSpy.mock.calls[0][1]).toBe(true);
    });

    it('任意オプション未指定時も余計な空白なしで docker run を組み立てること', async () => {
      const service = new RuntimeService(logger);
      const execSpy = vi.spyOn(service, 'exec').mockResolvedValue({ stdout: 'done', stderr: '' });

      await service.runImageUsingExec({
        image: 'symbolplatform/symbol-server:latest',
        cmds: ['echo', 'hello'],
        binds: [],
      });

      const runCommand = execSpy.mock.calls[0][0];
      expect(runCommand).toBe('docker run --rm symbolplatform/symbol-server:latest "echo" "hello"');
      expect(execSpy.mock.calls[0][1]).toBeUndefined();
    });
  });

  describe('spawn', () => {
    it('useLogger=true の場合に stdout/stderr を収集し close=0 で resolve すること', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockReturnValue(proc);
      const service = new RuntimeService(logger);

      const resultPromise = service.spawn({
        command: 'cmd',
        args: ['arg1'],
        useLogger: true,
        logPrefix: 'PFX ',
      });

      proc.stdout.write('hello\n');
      proc.stderr.write('warning\n');
      proc.emit('close', 0);

      const result = await resultPromise;

      expect(result).toContain('hello');
      expect(result).toContain('warning');
      expect(logger.info).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('useLogger=false の場合は固定メッセージを返し console に出力すること', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockReturnValue(proc);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const service = new RuntimeService(logger);

      const resultPromise = service.spawn({
        command: 'cmd',
        args: [],
        useLogger: false,
        logPrefix: 'PFX ',
      });

      proc.stdout.write('line1\n');
      proc.stderr.write('line2\n');
      proc.emit('close', 0);

      const result = await resultPromise;

      expect(result).toBe('Check console for output....');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('close が非0のとき reject すること', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockReturnValue(proc);
      const service = new RuntimeService(logger);

      const resultPromise = service.spawn({
        command: 'cmd',
        args: [],
        useLogger: true,
      });

      proc.stderr.write('failed\n');
      proc.emit('close', 1);

      await expect(resultPromise).rejects.toThrow('Process closed with code 1');
    });

    it('error イベント発生時に warn ログへ記録されること', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockReturnValue(proc);
      const service = new RuntimeService(logger);

      const resultPromise = service.spawn({
        command: 'cmd',
        args: [],
        useLogger: true,
      });

      proc.emit('error', new Error('spawn failed'));
      proc.emit('close', 0);

      await resultPromise;
      expect(logger.warn).toHaveBeenCalled();
    });

    it('SIGINT を受け取った場合は close を待たずに resolve すること', async () => {
      const proc = createMockChildProcess();
      spawnMock.mockReturnValue(proc);
      const service = new RuntimeService(logger);

      const resultPromise = service.spawn({
        command: 'cmd',
        args: [],
        useLogger: true,
      });

      const sigintHandler = process.listeners('SIGINT').at(-1) as (() => void) | undefined;
      expect(sigintHandler).toBeDefined();
      sigintHandler?.();

      const result = await resultPromise;
      expect(result).toBe('');

      if (sigintHandler) {
        process.off('SIGINT', sigintHandler);
      }
    });
  });

  describe('pullImage', () => {
    it('初回 pull 成功時にイメージをキャッシュすること', async () => {
      const service = new RuntimeService(logger);
      const spawnSpy = vi.spyOn(service, 'spawn').mockResolvedValue('line1\nstatus: downloaded\n');

      await service.pullImage('img:1.0');

      expect(spawnSpy).toHaveBeenCalledTimes(1);
      expect((RuntimeService as any).pulledImages).toContain('img:1.0');
    });

    it('同一イメージの2回目以降は pull をスキップすること', async () => {
      const service = new RuntimeService(logger);
      const spawnSpy = vi.spyOn(service, 'spawn').mockResolvedValue('ok\n');

      await service.pullImage('img:1.0');
      await service.pullImage('img:1.0');

      expect(spawnSpy).toHaveBeenCalledTimes(1);
    });

    it('pull 失敗時は例外を投げず警告ログを出すこと', async () => {
      const service = new RuntimeService(logger);
      vi.spyOn(service, 'spawn').mockRejectedValue(new Error('network error'));

      await expect(service.pullImage('img:1.0')).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('getDockerUserGroup', () => {
    it('Windows の場合は root:root を返すこと', async () => {
      vi.spyOn(Utils, 'isWindows').mockReturnValue(true);
      const service = new RuntimeService(logger);

      const result = await service.getDockerUserGroup();

      expect(result).toBe('root:root');
    });

    it('Linux の場合は uid:gid を返してキャッシュすること', async () => {
      vi.spyOn(Utils, 'isWindows').mockReturnValue(false);
      vi.spyOn(process, 'getuid').mockReturnValue(1234 as any);
      vi.spyOn(process, 'getgid').mockReturnValue(5678 as any);
      const service = new RuntimeService(logger);

      const first = await service.getDockerUserGroup();
      const second = await service.getDockerUserGroup();

      expect(first).toBe('1234:5678');
      expect(second).toBe('1234:5678');
    });

    it('uid=0 の場合は警告エラーログを出すこと', async () => {
      vi.spyOn(Utils, 'isWindows').mockReturnValue(false);
      vi.spyOn(process, 'getuid').mockReturnValue(0 as any);
      vi.spyOn(process, 'getgid').mockReturnValue(0 as any);
      const service = new RuntimeService(logger);

      const result = await service.getDockerUserGroup();

      expect(result).toBe('0:0');
      expect(logger.error).toHaveBeenCalled();
    });

    it('uid/gid 解決で例外時は undefined を返すこと', async () => {
      vi.spyOn(Utils, 'isWindows').mockReturnValue(false);
      vi.spyOn(process, 'getuid').mockImplementation(() => {
        throw new Error('cannot resolve uid');
      });
      const service = new RuntimeService(logger);

      const result = await service.getDockerUserGroup();

      expect(result).toBeUndefined();
    });
  });

  describe('resolveDockerUserFromParam', () => {
    it('未指定または空文字の場合は undefined を返すこと', async () => {
      const service = new RuntimeService(logger);

      await expect(service.resolveDockerUserFromParam(undefined)).resolves.toBeUndefined();
      await expect(service.resolveDockerUserFromParam('')).resolves.toBeUndefined();
      await expect(service.resolveDockerUserFromParam('   ')).resolves.toBeUndefined();
    });

    it('current 指定時は getDockerUserGroup の結果を返すこと', async () => {
      const service = new RuntimeService(logger);
      vi.spyOn(service, 'getDockerUserGroup').mockResolvedValue('1000:1000');

      const result = await service.resolveDockerUserFromParam(RuntimeService.CURRENT_USER);

      expect(result).toBe('1000:1000');
    });

    it('current 以外はそのまま返すこと', async () => {
      const service = new RuntimeService(logger);

      const result = await service.resolveDockerUserFromParam('2000:3000');

      expect(result).toBe('2000:3000');
    });
  });
});
