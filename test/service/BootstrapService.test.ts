import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { BootstrapService } from '../../src/service/BootstrapService.js';

/**
 * BootstrapService クラスのユニットテスト。
 * 各サービスへの委譲動作を検証する。
 * 依存するサービスはモックで置き換えて、BootstrapService 自体の動作のみを検証する。
 */
describe('BootstrapService', () => {
  const logger = LoggerFactory.getLogger(LogType.Silent);

  describe('コンストラクタ', () => {
    it('logger を引数としてインスタンスを生成できること', () => {
      const service = new BootstrapService(logger);

      expect(service).toBeDefined();
    });
  });

  describe('メソッドの委譲テスト（モック）', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('config メソッドが ConfigService.run に委譲すること', async () => {
      const mockResult = { presetData: {}, addresses: {} };
      const { ConfigService } = await import('../../src/service/ConfigService.js');
      vi.spyOn(ConfigService.prototype, 'run').mockResolvedValue(mockResult as any);

      const service = new BootstrapService(logger);
      const result = await service.config({ target: 'target' } as any);

      expect(result).toEqual(mockResult);
      vi.restoreAllMocks();
    });

    it('compose メソッドが ComposeService.run に委譲すること', async () => {
      const mockCompose = { services: {} };
      const { ComposeService } = await import('../../src/service/ComposeService.js');
      vi.spyOn(ComposeService.prototype, 'run').mockResolvedValue(mockCompose as any);

      const service = new BootstrapService(logger);
      const result = await service.compose(
        { target: 'target' } as any,
        { preset: 'testnet' } as any
      );

      expect(result).toEqual(mockCompose);
      vi.restoreAllMocks();
    });

    it('link メソッドが LinkService.run に委譲すること', async () => {
      const { LinkService } = await import('../../src/service/LinkService.js');
      const runSpy = vi.spyOn(LinkService.prototype, 'run').mockResolvedValue(undefined);
      const presetData = { preset: 'testnet' } as any;
      const addresses = { node: { name: 'api-node' } } as any;

      const service = new BootstrapService(logger);
      await service.link(
        { target: 'target', url: 'http://localhost:3000', unlink: false },
        presetData,
        addresses
      );

      expect(runSpy).toHaveBeenCalledWith(presetData, addresses);
      vi.restoreAllMocks();
    });

    it('modifyMultisig メソッドが ModifyMultisigService.run に委譲すること', async () => {
      const { ModifyMultisigService } = await import('../../src/service/ModifyMultisigService.js');
      const runSpy = vi.spyOn(ModifyMultisigService.prototype, 'run').mockResolvedValue(undefined);
      const presetData = { preset: 'testnet' } as any;
      const addresses = { node: { name: 'api-node' } } as any;

      const service = new BootstrapService(logger);
      await service.modifyMultisig(
        { target: 'target', url: 'http://localhost:3000' },
        presetData,
        addresses
      );

      expect(runSpy).toHaveBeenCalledWith(presetData, addresses);
      vi.restoreAllMocks();
    });

    it('run メソッドが RunService.run に委譲すること', async () => {
      const { RunService } = await import('../../src/service/RunService.js');
      const runSpy = vi.spyOn(RunService.prototype, 'run').mockResolvedValue(undefined);

      const service = new BootstrapService(logger);
      await service.run({ target: 'target' } as any);

      expect(runSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('resolveConfigPreset メソッドが ConfigService.resolveConfigPreset に委譲すること', async () => {
      const mockPreset = { preset: 'bootstrap' };
      const { ConfigService } = await import('../../src/service/ConfigService.js');
      vi.spyOn(ConfigService.prototype, 'resolveConfigPreset').mockReturnValue(mockPreset as any);

      const service = new BootstrapService(logger);
      const result = service.resolveConfigPreset({ target: 'target' } as any);

      expect(result).toEqual(mockPreset);
      vi.restoreAllMocks();
    });

    it('resetData メソッドが RunService.resetData に委譲すること', async () => {
      const { RunService } = await import('../../src/service/RunService.js');
      vi.spyOn(RunService.prototype, 'resetData').mockResolvedValue(undefined);

      const service = new BootstrapService(logger);
      await service.resetData({ target: 'target' });

      vi.restoreAllMocks();
    });

    it('checkHealth メソッドが RunService.checkHealth に委譲すること', async () => {
      const { RunService } = await import('../../src/service/RunService.js');
      vi.spyOn(RunService.prototype, 'checkHealth').mockResolvedValue(undefined);

      const service = new BootstrapService(logger);
      await service.checkHealth({ target: 'target' });

      vi.restoreAllMocks();
    });

    it('stop メソッドが RunService.stop に委譲すること', async () => {
      const { RunService } = await import('../../src/service/RunService.js');
      vi.spyOn(RunService.prototype, 'stop').mockResolvedValue(undefined);

      const service = new BootstrapService(logger);
      await service.stop({ target: 'target' } as any);

      vi.restoreAllMocks();
    });

    it('start メソッドが config→compose→run を順に実行すること', async () => {
      const service = new BootstrapService(logger);
      const configResult = { presetData: { preset: 'testnet' }, addresses: {} } as any;
      const configSpy = vi.spyOn(service, 'config').mockResolvedValue(configResult);
      const composeSpy = vi.spyOn(service, 'compose').mockResolvedValue({} as any);
      const runSpy = vi.spyOn(service, 'run').mockResolvedValue(undefined);

      const result = await service.start({ target: 'target' } as any);

      expect(result).toEqual(configResult);
      expect(configSpy).toHaveBeenCalledTimes(1);
      expect(composeSpy).toHaveBeenCalledWith({ target: 'target' }, configResult.presetData);
      expect(runSpy).toHaveBeenCalledWith({ target: 'target' });
      vi.restoreAllMocks();
    });

    it('clean メソッドが FileSystemService.deleteFolder に委譲すること', async () => {
      const { FileSystemService } = await import('../../src/service/FileSystemService.js');
      const deleteSpy = vi
        .spyOn(FileSystemService.prototype, 'deleteFolder')
        .mockImplementation(() => undefined as any);

      const service = new BootstrapService(logger);
      service.clean({ target: 'target' });

      expect(deleteSpy).toHaveBeenCalledWith('target');
      vi.restoreAllMocks();
    });

    it('verify メソッドが VerifyService.run に委譲すること', async () => {
      const { VerifyService } = await import('../../src/service/VerifyService.js');
      const runSpy = vi.spyOn(VerifyService.prototype, 'run').mockResolvedValue(undefined);

      const service = new BootstrapService(logger);
      await service.verify();

      expect(runSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('pack メソッドが PackService.run に委譲すること', async () => {
      const { PackService } = await import('../../src/service/PackService.js');
      const packResult = { zipFile: 'test.zip' } as any;
      const runSpy = vi.spyOn(PackService.prototype, 'run').mockResolvedValue(packResult);

      const service = new BootstrapService(logger);
      const result = await service.pack({ target: 'target' } as any);

      expect(result).toEqual(packResult);
      expect(runSpy).toHaveBeenCalledWith({ target: 'target' });
      vi.restoreAllMocks();
    });

    it('renewCertificates メソッドが RenewCertificatesService.run に委譲すること', async () => {
      const { RenewCertificatesService } =
        await import('../../src/service/RenewCertificatesService.js');
      const runSpy = vi.spyOn(RenewCertificatesService.prototype, 'run').mockResolvedValue(true);

      const service = new BootstrapService(logger);
      const result = await service.renewCertificates({
        target: 'target',
        password: 'pwd' as any,
        user: 'root',
        force: false,
      });

      expect(result).toBe(true);
      expect(runSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('updateVotingKeys メソッドが VotingKeysUpdateService.run に委譲すること', async () => {
      const { VotingKeysUpdateService } =
        await import('../../src/service/VotingKeysUpdateService.js');
      const runSpy = vi.spyOn(VotingKeysUpdateService.prototype, 'run').mockResolvedValue(true);

      const service = new BootstrapService(logger);
      const result = await service.updateVotingKeys({ target: 'target', user: 'root' });

      expect(result).toBe(true);
      expect(runSpy).toHaveBeenCalledWith({ target: 'target', user: 'root' });
      vi.restoreAllMocks();
    });

    it('encryptFile/decryptFile が CryptoFileService に委譲すること', async () => {
      const { CryptoFileService } = await import('../../src/service/CryptoFileService.js');
      const encryptSpy = vi
        .spyOn(CryptoFileService.prototype, 'encryptFile')
        .mockResolvedValue('encrypted.yaml');
      const decryptSpy = vi
        .spyOn(CryptoFileService.prototype, 'decryptFile')
        .mockResolvedValue('decrypted.yaml');

      const service = new BootstrapService(logger);
      const encryptResult = await service.encryptFile({ file: 'a.yaml', target: 'target' } as any);
      const decryptResult = await service.decryptFile({
        file: 'a.enc.yaml',
        target: 'target',
      } as any);

      expect(encryptResult).toBe('encrypted.yaml');
      expect(decryptResult).toBe('decrypted.yaml');
      expect(encryptSpy).toHaveBeenCalled();
      expect(decryptSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });
});
