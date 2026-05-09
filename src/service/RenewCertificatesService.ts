import { Logger } from '../logger/index.js';
import { CertificatePair, ConfigAccount } from '../model/index.js';
import { ICryptoPort, SymbolCryptoAdapter } from '../sdk/index.js';
import { Password } from '../utils/YamlUtils.js';
import { BootstrapAccountResolver } from './BootstrapAccountResolver.js';
import { CertificateService, RenewMode } from './CertificateService.js';
import { ExistingConfigurationService } from './ExistingConfigurationService.js';

export interface RenewCertificatesServiceParams {
  target: string;
  password: Password;
  customPreset?: string;
  user: string;
  force: boolean;
}

/**
 * renewCertificates コマンドの証明書更新フローを担当するサービス。
 */
export class RenewCertificatesService {
  constructor(private readonly logger: Logger) {}

  /**
   * ノード証明書の更新要否を判定し、必要なノードのみ更新する。
   * @returns 1件以上の証明書が更新された場合 true
   */
  public async run(params: RenewCertificatesServiceParams): Promise<boolean> {
    const { cryptoPort, certificateService } = this.createDependencies(params);
    const { presetData, addresses } = new ExistingConfigurationService(this.logger).load({
      target: params.target,
      password: params.password,
      customPreset: params.customPreset,
    });
    const renewMode = params.force ? RenewMode.ALWAYS : RenewMode.WHEN_REQUIRED;

    if (!presetData.node) {
      return false;
    }
    const nodePreset = presetData.node;
    const nodeAccount = addresses.node;
    if (!nodeAccount) {
      throw new Error(`addresses の index に node が存在しません。`);
    }
    const providedCertificates = {
      main: this.resolveAccount(
        cryptoPort,
        presetData.networkType,
        nodeAccount.main,
        nodePreset.mainPrivateKey
      ),
      transport: this.resolveAccount(
        cryptoPort,
        presetData.networkType,
        nodeAccount.transport,
        nodePreset.transportPrivateKey
      ),
    };

    return certificateService.run(
      presetData,
      presetData.node?.friendlyName ?? 'Symbol Node',
      presetData.node?.host ?? '',
      providedCertificates,
      renewMode
    );
  }

  private createDependencies(params: RenewCertificatesServiceParams): {
    cryptoPort: ICryptoPort;
    certificateService: CertificateService;
  } {
    const cryptoPort: ICryptoPort = new SymbolCryptoAdapter();
    const accountResolver = new BootstrapAccountResolver(this.logger, cryptoPort);
    const certificateService = new CertificateService(
      this.logger,
      accountResolver,
      {
        target: params.target,
        user: params.user,
      },
      cryptoPort
    );
    return { cryptoPort, certificateService };
  }

  /**
   * 設定値と指定秘密鍵の一致を検証して、使用する証明書アカウントを解決する。
   */
  private resolveAccount(
    cryptoPort: ICryptoPort,
    networkType: number,
    configAccount: ConfigAccount,
    providedPrivateKey: string | undefined
  ): CertificatePair {
    if (!providedPrivateKey) {
      return configAccount;
    }
    const account = cryptoPort.createAccountFromPrivateKey(providedPrivateKey, networkType);
    if (account.address === configAccount.address) {
      return account;
    }
    return configAccount;
  }
}
