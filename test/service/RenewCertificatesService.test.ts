import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SymbolCryptoAdapter } from '../../src/sdk/index.js';
import { CertificateService, RenewMode } from '../../src/service/CertificateService.js';
import { ExistingConfigurationService } from '../../src/service/ExistingConfigurationService.js';
import { RenewCertificatesService } from '../../src/service/RenewCertificatesService.js';

describe('RenewCertificatesService', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;

  const createLoadResult = (overrides: Record<string, unknown> = {}) =>
    ({
      presetData: {
        networkType: 152,
        dockerComposeProjectName: 'proj',
        node: {
          name: 'api-node',
          mainPrivateKey: 'MAIN_PK',
          transportPrivateKey: 'TRANSPORT_PK',
        },
      },
      addresses: {
        node: {
          main: { address: 'TMAIN', publicKey: 'A'.repeat(64) },
          transport: { address: 'TTRANSPORT', publicKey: 'B'.repeat(64) },
        },
      },
      ...overrides,
    }) as any;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('node preset が無い場合は false を返すこと', async () => {
    vi.spyOn(ExistingConfigurationService.prototype, 'load').mockReturnValue(
      createLoadResult({ presetData: { networkType: 152, node: undefined } })
    );
    const runSpy = vi.spyOn(CertificateService.prototype, 'run').mockResolvedValue(true);

    const service = new RenewCertificatesService(logger);
    const result = await service.run({
      target: 'target',
      user: 'current',
      password: 'pw',
      force: false,
    });

    expect(result).toBe(false);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('addresses.node が無い場合は例外を投げること', async () => {
    vi.spyOn(ExistingConfigurationService.prototype, 'load').mockReturnValue(
      createLoadResult({ addresses: { node: undefined } })
    );

    const service = new RenewCertificatesService(logger);

    await expect(
      service.run({ target: 'target', user: 'current', password: 'pw', force: false })
    ).rejects.toThrow('addresses の index に node が存在しません。');
  });

  it('force=true の場合は RenewMode.ALWAYS を使うこと', async () => {
    vi.spyOn(ExistingConfigurationService.prototype, 'load').mockReturnValue(createLoadResult());
    vi.spyOn(SymbolCryptoAdapter.prototype, 'createAccountFromPrivateKey').mockImplementation(
      (pk: string) =>
        ({
          address: pk === 'MAIN_PK' ? 'TMAIN' : 'TTRANSPORT',
          publicKey: `${pk}_PUB`,
          privateKey: pk,
        }) as any
    );
    const runSpy = vi.spyOn(CertificateService.prototype, 'run').mockResolvedValue(true);

    const service = new RenewCertificatesService(logger);
    const result = await service.run({
      target: 'target',
      user: 'current',
      password: 'pw',
      force: true,
    });

    expect(result).toBe(true);
    expect(runSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Symbol Node',
      '',
      expect.objectContaining({
        main: expect.objectContaining({ address: 'TMAIN' }),
        transport: expect.objectContaining({ address: 'TTRANSPORT' }),
      }),
      RenewMode.ALWAYS
    );
  });

  it('秘密鍵アドレス不一致時は config 側アカウントを使うこと', async () => {
    vi.spyOn(ExistingConfigurationService.prototype, 'load').mockReturnValue(createLoadResult());
    vi.spyOn(SymbolCryptoAdapter.prototype, 'createAccountFromPrivateKey').mockReturnValue({
      address: 'DIFFERENT',
      publicKey: 'X'.repeat(64),
      privateKey: 'X'.repeat(64),
    } as any);
    const runSpy = vi.spyOn(CertificateService.prototype, 'run').mockResolvedValue(false);

    const service = new RenewCertificatesService(logger);
    const result = await service.run({
      target: 'target',
      user: 'current',
      password: 'pw',
      force: false,
    });

    expect(result).toBe(false);
    const passedCertificates = runSpy.mock.calls[0][3] as any;
    expect(passedCertificates.main.address).toBe('TMAIN');
    expect(passedCertificates.transport.address).toBe('TTRANSPORT');
    expect(runSpy.mock.calls[0][2]).toBe('');
    expect(runSpy.mock.calls[0][4]).toBe(RenewMode.WHEN_REQUIRED);
  });
});
