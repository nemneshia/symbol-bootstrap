import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CertificatePair } from '../../src/model/index.js';
import {
  CertificateConfigPreset,
  CertificateService,
  RenewMode,
} from '../../src/service/CertificateService.js';
import { YamlUtils } from '../../src/utils/YamlUtils.js';

const key = (c: string): string => c.repeat(64);

const createLoggerMock = () => {
  const logger: any = {
    error: vi.fn().mockImplementation(() => logger),
    warn: vi.fn().mockImplementation(() => logger),
    info: vi.fn().mockImplementation(() => logger),
    debug: vi.fn().mockImplementation(() => logger),
  };
  return logger;
};

const createPreset = (): CertificateConfigPreset => ({
  networkType: 152 as any,
  symbolServerImage: 'symbol-server:latest',
  caCertificateExpirationInDays: 3650,
  nodeCertificateExpirationInDays: 375,
  certificateExpirationWarningInDays: 30,
});

const createProvidedCertificates = (): { main: CertificatePair; transport: CertificatePair } => ({
  main: { privateKey: key('A'), publicKey: key('C') },
  transport: { privateKey: key('B'), publicKey: key('D') },
});

describe('CertificateService', () => {
  let logger: any;
  let accountResolver: any;
  let service: CertificateService;
  let tempDir: string;

  beforeEach(() => {
    logger = createLoggerMock();
    accountResolver = { resolveAccount: vi.fn() };
    service = new CertificateService(
      logger,
      accountResolver,
      { target: 'target', user: 'current' },
      { randomHex: vi.fn().mockReturnValue('f'.repeat(38)) } as any
    );
    tempDir = mkdtempSync(join(tmpdir(), 'sb-cert-test-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('run', () => {
    it('shouldGenerate=true の場合は新規作成を実行して true を返すこと', async () => {
      vi.spyOn(service as any, 'shouldGenerateCertificate').mockResolvedValue(true);
      const createSpy = vi.spyOn(service as any, 'createCertificate').mockResolvedValue(undefined);

      const result = await service.run(
        createPreset(),
        'node-0',
        'node-0.example.test',
        createProvidedCertificates(),
        RenewMode.WHEN_REQUIRED,
        tempDir,
        '001122'
      );

      expect(result).toBe(true);
      expect(createSpy).toHaveBeenCalledWith(
        false,
        expect.anything(),
        tempDir,
        'node-0',
        'node-0.example.test',
        expect.anything(),
        join(tempDir, 'metadata.yaml'),
        '001122'
      );
    });

    it('期限内かつ ONLY_WARNING の場合は更新せず false を返すこと', async () => {
      vi.spyOn(service as any, 'shouldGenerateCertificate').mockResolvedValue(false);
      vi.spyOn(service, 'willCertificateExpire').mockResolvedValue({
        willExpire: false,
        expirationDate: 'Jan  1 00:00:00 2030 GMT',
      });
      const createSpy = vi.spyOn(service as any, 'createCertificate').mockResolvedValue(undefined);

      const result = await service.run(
        createPreset(),
        'node-0',
        'node-0.example.test',
        createProvidedCertificates(),
        RenewMode.ONLY_WARNING,
        tempDir
      );

      expect(result).toBe(false);
      expect(createSpy).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });

    it('期限切れ予兆かつ WHEN_REQUIRED の場合は更新して true を返すこと', async () => {
      vi.spyOn(service as any, 'shouldGenerateCertificate').mockResolvedValue(false);
      vi.spyOn(service, 'willCertificateExpire').mockResolvedValue({
        willExpire: true,
        expirationDate: 'Jan  1 00:00:00 2026 GMT',
      });
      const createSpy = vi.spyOn(service as any, 'createCertificate').mockResolvedValue(undefined);

      const result = await service.run(
        createPreset(),
        'node-0',
        'node-0.example.test',
        createProvidedCertificates(),
        RenewMode.WHEN_REQUIRED,
        tempDir
      );

      expect(result).toBe(true);
      expect(createSpy).toHaveBeenCalledWith(
        true,
        expect.anything(),
        tempDir,
        'node-0',
        'node-0.example.test',
        expect.anything(),
        join(tempDir, 'metadata.yaml'),
        undefined
      );
    });

    it('ALWAYS の場合は期限内でも更新して true を返すこと', async () => {
      vi.spyOn(service as any, 'shouldGenerateCertificate').mockResolvedValue(false);
      vi.spyOn(service, 'willCertificateExpire').mockResolvedValue({
        willExpire: false,
        expirationDate: 'Jan  1 00:00:00 2030 GMT',
      });
      vi.spyOn(service as any, 'createCertificate').mockResolvedValue(undefined);

      const result = await service.run(
        createPreset(),
        'node-0',
        'node-0.example.test',
        createProvidedCertificates(),
        RenewMode.ALWAYS,
        tempDir
      );

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('ONLY_WARNING かつ期限切れ予兆の場合は警告ログを出すこと', async () => {
      vi.spyOn(service as any, 'shouldGenerateCertificate').mockResolvedValue(false);
      vi.spyOn(service, 'willCertificateExpire').mockResolvedValue({
        willExpire: true,
        expirationDate: 'Jan  1 00:00:00 2026 GMT',
      });
      vi.spyOn(service as any, 'createCertificate').mockResolvedValue(undefined);

      const result = await service.run(
        createPreset(),
        'node-0',
        'node-0.example.test',
        createProvidedCertificates(),
        RenewMode.ONLY_WARNING,
        tempDir
      );

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('shouldGenerateCertificate', () => {
    it('metadata が存在しない場合は true を返すこと', async () => {
      const result = await (service as any).shouldGenerateCertificate(
        join(tempDir, 'metadata.yaml'),
        createProvidedCertificates()
      );

      expect(result).toBe(true);
    });

    it('metadata が一致する場合は false を返すこと', async () => {
      const metadataPath = join(tempDir, 'metadata.yaml');
      const certs = createProvidedCertificates();
      await YamlUtils.writeYaml(
        metadataPath,
        {
          version: 1,
          mainPublicKey: certs.main.publicKey,
          transportPublicKey: certs.transport.publicKey,
        },
        undefined
      );

      const result = await (service as any).shouldGenerateCertificate(metadataPath, certs);

      expect(result).toBe(false);
    });

    it('metadata が不一致の場合は true を返すこと', async () => {
      const metadataPath = join(tempDir, 'metadata.yaml');
      const certs = createProvidedCertificates();
      await YamlUtils.writeYaml(
        metadataPath,
        { version: 1, mainPublicKey: key('E'), transportPublicKey: certs.transport.publicKey },
        undefined
      );

      const result = await (service as any).shouldGenerateCertificate(metadataPath, certs);

      expect(result).toBe(true);
    });

    it('metadata の読み込みに失敗した場合は true を返すこと', async () => {
      const metadataPath = join(tempDir, 'metadata.yaml');
      await YamlUtils.writeTextFile(metadataPath, 'not: valid: yaml');

      const result = await (service as any).shouldGenerateCertificate(
        metadataPath,
        createProvidedCertificates()
      );

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('createCertificate', () => {
    it('正常時は metadata.yaml を書き込むこと', async () => {
      const preset = createPreset();
      const certs = createProvidedCertificates();
      accountResolver.resolveAccount
        .mockResolvedValueOnce({
          privateKey: certs.main.privateKey,
          publicKey: certs.main.publicKey,
        })
        .mockResolvedValueOnce({
          privateKey: certs.transport.privateKey,
          publicKey: certs.transport.publicKey,
        });

      vi.spyOn(service as any, 'runOpenSslCommand').mockResolvedValue({
        stdout:
          `priv:${certs.main.privateKey}\n` +
          `pub:${certs.main.publicKey}\n` +
          `Certificate\n` +
          `priv:${certs.transport.privateKey}\n` +
          `pub:${certs.transport.publicKey}\n` +
          `Certificate\n` +
          'Certificate Created',
        stderr: '',
      });

      await (service as any).createCertificate(
        false,
        preset,
        tempDir,
        'node-0',
        'localhost',
        certs,
        join(tempDir, 'metadata.yaml'),
        '00112233'
      );

      const metadata = YamlUtils.loadYaml(join(tempDir, 'metadata.yaml'), false);
      expect(metadata.mainPublicKey).toBe(certs.main.publicKey);
      expect(metadata.transportPublicKey).toBe(certs.transport.publicKey);
      expect(metadata.version).toBe(1);
    });

    it('OpenSSL出力に Certificate Created が無い場合はエラーにすること', async () => {
      const preset = createPreset();
      const certs = createProvidedCertificates();
      accountResolver.resolveAccount.mockResolvedValue({
        privateKey: certs.main.privateKey,
        publicKey: certs.main.publicKey,
      });
      vi.spyOn(service as any, 'runOpenSslCommand').mockResolvedValue({
        stdout: 'failed',
        stderr: 'err',
      });

      await expect(
        (service as any).createCertificate(
          true,
          preset,
          tempDir,
          'node-0',
          'localhost',
          certs,
          join(tempDir, 'metadata.yaml')
        )
      ).rejects.toThrow('証明書の作成に失敗しました。ログを確認してください。');
    });

    it('抽出証明書が2件でない場合はエラーにすること', async () => {
      const preset = createPreset();
      const certs = createProvidedCertificates();
      accountResolver.resolveAccount.mockResolvedValue({
        privateKey: certs.main.privateKey,
        publicKey: certs.main.publicKey,
      });
      vi.spyOn(service as any, 'runOpenSslCommand').mockResolvedValue({
        stdout: 'Certificate Created',
        stderr: '',
      });
      vi.spyOn(CertificateService, 'getCertificates').mockReturnValue([
        { privateKey: key('A'), publicKey: key('B') },
      ]);

      await expect(
        (service as any).createCertificate(
          true,
          preset,
          tempDir,
          'node-0',
          'localhost',
          certs,
          join(tempDir, 'metadata.yaml')
        )
      ).rejects.toThrow('証明書の作成に失敗しました。2 件作成されるべきところ、実際は 1');
    });
  });

  describe('willCertificateExpire', () => {
    it('期限切れ予兆時に willExpire=true を返すこと', async () => {
      vi.spyOn(service as any, 'runOpenSslCommand').mockResolvedValue({
        stdout: 'notAfter=Jan  1 00:00:00 2026 GMT\nCertificate will expire',
        stderr: '',
      });

      const result = await service.willCertificateExpire('image', '/tmp', 'node.crt.pem', 30);

      expect(result).toEqual({
        willExpire: true,
        expirationDate: 'Jan  1 00:00:00 2026 GMT',
      });
    });

    it('期限内時に willExpire=false を返すこと', async () => {
      vi.spyOn(service as any, 'runOpenSslCommand').mockResolvedValue({
        stdout: 'notAfter=Jan  1 00:00:00 2030 GMT\nCertificate will not expire',
        stderr: '',
      });

      const result = await service.willCertificateExpire('image', '/tmp', 'node.crt.pem', 30);

      expect(result).toEqual({
        willExpire: false,
        expirationDate: 'Jan  1 00:00:00 2030 GMT',
      });
    });

    it('有効期限文字列を抽出できない場合はエラーにすること', async () => {
      vi.spyOn(service as any, 'runOpenSslCommand').mockResolvedValue({
        stdout: 'Certificate will expire',
        stderr: 'err',
      });

      await expect(
        service.willCertificateExpire('image', '/tmp', 'node.crt.pem', 30)
      ).rejects.toThrow('失効日を解決できませんでした');
    });

    it('判定メッセージが無い場合はエラーにすること', async () => {
      vi.spyOn(service as any, 'runOpenSslCommand').mockResolvedValue({
        stdout: 'notAfter=Jan  1 00:00:00 2030 GMT\nUNKNOWN',
        stderr: 'err',
      });

      await expect(
        service.willCertificateExpire('image', '/tmp', 'node.crt.pem', 30)
      ).rejects.toThrow('node.crt.pem 証明書の有効期限を検証できません。ログを確認してください。');
    });
  });

  describe('runOpenSslCommand', () => {
    it('RuntimeService へ docker 実行パラメータを正しく渡すこと', async () => {
      const runtimeService: any = (service as any).runtimeService;
      vi.spyOn(runtimeService, 'resolveDockerUserFromParam').mockResolvedValue('1000:1000');
      vi.spyOn(runtimeService, 'runImageUsingExec').mockResolvedValue({ stdout: 'ok', stderr: '' });

      const result = await (service as any).runOpenSslCommand(
        'symbol:latest',
        'bash createNodeCertificates.sh',
        tempDir,
        true
      );

      expect(result).toEqual({ stdout: 'ok', stderr: '' });
      expect(runtimeService.runImageUsingExec).toHaveBeenCalledWith({
        image: 'symbol:latest',
        userId: '1000:1000',
        workdir: '/data',
        cmds: ['bash', 'createNodeCertificates.sh'],
        binds: [expect.stringContaining(`${tempDir}:/data:rw`)],
        ignoreErrors: true,
      });
    });
  });

  describe('static helpers', () => {
    it('getCertificates は OpenSSL 出力から2件の鍵を抽出できること', () => {
      const certs = createProvidedCertificates();
      const output =
        `priv:${certs.main.privateKey}\n` +
        `pub:${certs.main.publicKey}\n` +
        `Certificate\n` +
        `priv:${certs.transport.privateKey}\n` +
        `pub:${certs.transport.publicKey}\n` +
        `Certificate\n`;

      const result = CertificateService.getCertificates(output);

      expect(result).toEqual([
        { privateKey: certs.main.privateKey, publicKey: certs.main.publicKey },
        { privateKey: certs.transport.privateKey, publicKey: certs.transport.publicKey },
      ]);
    });

    it('getCertificates は鍵長が不正な場合にエラーを投げること', () => {
      expect(() => CertificateService.getCertificates('priv:1234\npub:5678\nCertificate')).toThrow(
        'SSL Certificate key cannot be loaded'
      );
    });

    it('toAns1 は prefix + lowercase privateKey を返すこと', () => {
      const result = CertificateService.toAns1('AABBCC');
      expect(result).toBe('302e020100300506032b657004220420aabbcc');
    });

    it('createDerFile は DER バイナリをファイルへ書き込むこと', () => {
      const derFile = join(tempDir, 'node.der');
      CertificateService.createDerFile(key('a'), derFile);

      expect(existsSync(derFile)).toBe(true);
      expect(readFileSync(derFile).length).toBeGreaterThan(0);
    });
  });

  describe('createCertCommands', () => {
    it('renew=false の場合は CA 新規生成コマンドを含むこと', () => {
      const command = (service as any).createCertCommands(false, 3650, 375) as string;
      expect(command).toContain('openssl req -config ca.cnf');
      expect(command).toContain('Certificate Created');
    });

    it('renew=true の場合は既存CA参照コマンドを含むこと', () => {
      const command = (service as any).createCertCommands(true, 3650, 375) as string;
      expect(command).toContain('openssl x509 -in ca.crt.pem -text -noout');
    });
  });
});
