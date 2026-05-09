import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppVersionService,
  AppVersionVerifyAction,
  DockerRunVerifyAction,
  SudoRunVerifyAction,
  VerifyService,
} from '../../src/service/VerifyService.js';
import { Utils } from '../../src/utils/Utils.js';

describe('VerifyService', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    logger.debug.mockClear();
  });

  describe('AppVersionService', () => {
    it('バージョン文字列を抽出できること', () => {
      const service = new AppVersionService({ exec: vi.fn() } as any);

      expect(service.loadVersion('Docker version 24.0.7, build afdd53b')).toBe('24.0.7');
      expect(service.loadVersion('v18')).toBe('18.0.0');
      expect(service.loadVersion('not found')).toBeUndefined();
    });

    it('コマンド出力を使ってバージョンを抽出すること', async () => {
      const runtimeService = {
        exec: vi.fn().mockResolvedValue({ stdout: 'v20.11.1', stderr: '' }),
      };
      const service = new AppVersionService(runtimeService as any);

      await expect(service.loadVersionFromCommand('node -v')).resolves.toBe('20.11.1');
      expect(runtimeService.exec).toHaveBeenCalledWith('node -v');
    });

    it('最低バージョン未満の場合に recommendation を返すこと', async () => {
      const service = new AppVersionService({ exec: vi.fn() } as any);

      const line = await service.verifyInstalledApp(
        async () => '19.0.0',
        'NodeVersion',
        '20.0.0',
        'https://nodejs.org'
      );

      expect(line.recommendation).toContain('At least version 20.0.0 is required.');
      expect(line.message).toBe('19.0.0');
    });

    it('バージョンが見つからない場合に recommendation を返すこと', async () => {
      const service = new AppVersionService({ exec: vi.fn() } as any);

      const line = await service.verifyInstalledApp(
        async () => undefined,
        'Docker Version',
        '20.10.13',
        'https://docs.docker.com'
      );

      expect(line.message).toBe('Version could not be found!');
      expect(line.recommendation).toBeTruthy();
    });

    it('バージョン取得時の例外を recommendation として返すこと', async () => {
      const service = new AppVersionService({ exec: vi.fn() } as any);

      const line = await service.verifyInstalledApp(
        async () => {
          throw new Error('boom');
        },
        'Docker Version',
        '20.10.13',
        'https://docs.docker.com'
      );

      expect(line.message).toContain('Error: boom');
      expect(line.recommendation).toContain('At least version 20.10.13 is required.');
    });

    it('最低バージョンが不正な場合はエラー行を返すこと', async () => {
      const service = new AppVersionService({ exec: vi.fn() } as any);

      const line = await service.verifyInstalledApp(
        async () => '1.0.0',
        'NodeVersion',
        'invalid',
        'https://nodejs.org'
      );

      expect(line.message).toContain('最低バージョン');
      expect(line.recommendation).toBeTruthy();
    });
  });

  describe('AppVersionVerifyAction', () => {
    it('version が指定されている場合は直接検証すること', async () => {
      const service = {
        verifyInstalledApp: vi.fn().mockResolvedValue({ header: 'NodeVersion', message: '20.0.0' }),
        loadVersionFromCommand: vi.fn(),
      } as any;
      const action = new AppVersionVerifyAction(service, {
        header: 'NodeVersion',
        version: '20.0.0',
        recommendationUrl: 'https://nodejs.org',
        expectedVersion: '20.0.0',
      });

      await action.verify();

      expect(service.verifyInstalledApp).toHaveBeenCalled();
      expect(service.loadVersionFromCommand).not.toHaveBeenCalled();
    });

    it('command が指定されている場合はコマンドで検証すること', async () => {
      const service = new AppVersionService({
        exec: vi.fn().mockResolvedValue({ stdout: 'Docker version 24.0.0' }),
      } as any);
      const action = new AppVersionVerifyAction(service, {
        header: 'Docker Version',
        command: 'docker --version',
        recommendationUrl: 'https://docs.docker.com',
        expectedVersion: '20.10.13',
      });

      const line = await action.verify();

      expect(line.message).toBe('24.0.0');
      expect(line.recommendation).toBeUndefined();
      expect(action.shouldRun([])).toBe(true);
    });

    it('version と command が未指定の場合はエラー行を返すこと', async () => {
      const service = new AppVersionService({ exec: vi.fn() } as any);
      const action = new AppVersionVerifyAction(service, {
        header: 'X',
        recommendationUrl: 'https://example.com',
        expectedVersion: '1.0.0',
      });

      const line = await action.verify();

      expect(line.message).toContain('version または command');
      expect(line.recommendation).toBeTruthy();
    });
  });

  describe('DockerRunVerifyAction', () => {
    it('Docker Version がOKの場合のみ実行対象になること', () => {
      const action = new DockerRunVerifyAction(logger, { exec: vi.fn() } as any);

      expect(action.shouldRun([{ header: 'Docker Version', message: '24.0.0' }])).toBe(true);
      expect(
        action.shouldRun([{ header: 'Docker Version', message: '19.0.0', recommendation: 'x' }])
      ).toBe(false);
    });

    it('hello-world 出力がある場合は成功すること', async () => {
      const action = new DockerRunVerifyAction(logger, {
        exec: vi.fn().mockResolvedValue({ stdout: 'Hello from Docker!', stderr: '' }),
      } as any);

      const line = await action.verify();

      expect(line.recommendation).toBeUndefined();
    });

    it('hello-world 出力が無い場合は recommendation を返すこと', async () => {
      const action = new DockerRunVerifyAction(logger, {
        exec: vi.fn().mockResolvedValue({ stdout: 'permission denied', stderr: '' }),
      } as any);

      const line = await action.verify();

      expect(line.recommendation).toContain('確認してください');
    });

    it('docker 実行時例外も recommendation に変換すること', async () => {
      const action = new DockerRunVerifyAction(logger, {
        exec: vi.fn().mockRejectedValue(new Error('permission denied')),
      } as any);

      const line = await action.verify();

      expect(line.message).toContain('permission denied');
      expect(line.recommendation).toBeTruthy();
    });
  });

  describe('SudoRunVerifyAction', () => {
    it('Linux かつ root の場合に recommendation を返すこと', async () => {
      vi.spyOn(Utils, 'isWindows').mockReturnValue(false);
      vi.spyOn(Utils, 'isRoot').mockReturnValue(true);

      const action = new SudoRunVerifyAction();
      const line = await action.verify();

      expect(action.shouldRun([])).toBe(true);
      expect(line.recommendation).toContain('sudo');
    });

    it('Windows の場合はスキップされること', () => {
      vi.spyOn(Utils, 'isWindows').mockReturnValue(true);

      const action = new SudoRunVerifyAction();

      expect(action.shouldRun([])).toBe(false);
    });

    it('非 root の場合は OK メッセージを返すこと', async () => {
      vi.spyOn(Utils, 'isRoot').mockReturnValue(false);
      const action = new SudoRunVerifyAction();

      const line = await action.verify();

      expect(line.recommendation).toBeUndefined();
      expect(line.message).toContain('sudo ユーザーではありません');
    });
  });

  describe('VerifyService 本体', () => {
    it('createReport は shouldRun=true のアクションのみ実行すること', async () => {
      const service = new VerifyService(logger);
      const first = {
        shouldRun: vi.fn().mockReturnValue(true),
        verify: vi.fn().mockResolvedValue({ header: 'A', message: 'ok' }),
      };
      const second = { shouldRun: vi.fn().mockReturnValue(false), verify: vi.fn() };
      service.actions.splice(0, service.actions.length, first as any, second as any);

      const report = await service.createReport();

      expect(report.lines).toHaveLength(1);
      expect(first.verify).toHaveBeenCalled();
      expect(second.verify).not.toHaveBeenCalled();
    });

    it('validateReport は recommendation があると例外を投げること', () => {
      const service = new VerifyService(logger);

      expect(() =>
        service.validateReport({
          platform: 'x',
          lines: [{ header: 'Docker', message: 'error', recommendation: 'fix me' }],
        })
      ).toThrow('レポートを確認してください');
    });

    it('validateReport は recommendation が無ければ例外を投げないこと', () => {
      const service = new VerifyService(logger);

      expect(() =>
        service.validateReport({
          platform: 'x',
          lines: [{ header: 'Docker', message: 'ok' }],
        })
      ).not.toThrow();
    });

    it('logReport は recommendation 行を error ログで出力すること', () => {
      const service = new VerifyService(logger);

      service.logReport({
        platform: 'Linux',
        lines: [
          { header: 'Node', message: '20.0.0' },
          { header: 'Docker', message: '19.0.0', recommendation: 'upgrade' },
        ],
      });

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Node - OK'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Docker - エラー'));
    });

    it('run はレポートを出力して検証すること', async () => {
      const service = new VerifyService(logger);
      vi.spyOn(service, 'createReport').mockResolvedValue({
        platform: 'Linux',
        lines: [{ header: 'Node', message: '20.0.0' }],
      });
      const logSpy = vi.spyOn(service, 'logReport');
      const validateSpy = vi.spyOn(service, 'validateReport');

      await service.run();

      expect(logSpy).toHaveBeenCalled();
      expect(validateSpy).toHaveBeenCalled();
    });
  });
});
