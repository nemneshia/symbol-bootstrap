import { Logger } from '../logger/index.js';
import { Addresses, ConfigPreset, NodeAccount, NodePreset } from '../model/index.js';
import { SymbolCryptoAdapter, SymbolNetworkAdapter } from '../sdk/index.js';
import { Constants } from '../utils/Constants.js';
import { CryptoUtils } from '../utils/CryptoUtils.js';
import { YamlUtils } from '../utils/YamlUtils.js';
import { ConfigLoader } from './ConfigLoader.js';
import { ExistingConfigurationService } from './ExistingConfigurationService.js';
import { RemoteNodeService } from './RemoteNodeService.js';
import { VotingService } from './VotingService.js';

export interface VotingKeysUpdateServiceParams {
  target: string;
  user: string;
  finalizationEpoch?: number;
}

interface LoadedVotingContext {
  presetData: ConfigPreset;
  addresses: Addresses;
  privateKeySecurityMode: ReturnType<typeof CryptoUtils.getPrivateKeySecurityMode>;
}

/**
 * updateVotingKeys コマンドの投票キー更新フローを担当するサービス。
 */
export class VotingKeysUpdateService {
  private readonly configLoader: ConfigLoader;

  constructor(private readonly logger: Logger) {
    this.configLoader = new ConfigLoader(logger);
  }

  /**
   * 投票キーファイルを必要時のみ更新し、更新があれば addresses.yaml を再保存する。
   * @returns 1件以上の投票キーが更新された場合 true
   */
  public async run(params: VotingKeysUpdateServiceParams): Promise<boolean> {
    const context = this.loadContext(params.target);

    if (!context.presetData.node) {
      return false;
    }
    const nodePreset = context.presetData.node;

    const nodeAccount = context.addresses.node;
    if (!nodeAccount) {
      throw new Error(`addresses に node が存在しません。`);
    }

    const finalizationEpoch = await this.resolveFinalizationEpoch(
      params.finalizationEpoch,
      context.presetData
    );
    const votingKeyUpdated = await this.updateVotingKey(
      params,
      context.presetData,
      nodePreset,
      nodeAccount,
      finalizationEpoch
    );

    if (!votingKeyUpdated) {
      return false;
    }

    await this.saveAddresses(params.target, context.addresses, context.privateKeySecurityMode);
    return true;
  }

  /**
   * 既存設定と addresses を読み込み、秘密鍵保護モードを解決する。
   */
  private loadContext(target: string): LoadedVotingContext {
    const password = false;
    const { presetData, addresses } = new ExistingConfigurationService(this.logger).loadOrThrow(
      {
        target,
        password,
        workingDir: Constants.defaultWorkingDir,
      },
      `ノードの preset を読み込めません。--target の指定を確認し、必要であれば 'config' コマンドを --upgrade 付きで再実行してください。詳細: `
    );

    const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(
      presetData.privateKeySecurityMode
    );

    return { presetData, addresses, privateKeySecurityMode };
  }

  /**
   * 現在の最終化エポックを解決する。
   */
  private async resolveFinalizationEpoch(
    requestedFinalizationEpoch: number | undefined,
    presetData: ConfigPreset
  ): Promise<number> {
    if (requestedFinalizationEpoch !== undefined) {
      return requestedFinalizationEpoch;
    }

    const networkPort = new SymbolNetworkAdapter();
    return await new RemoteNodeService(
      this.logger,
      presetData,
      false,
      networkPort
    ).resolveCurrentFinalizationEpoch();
  }

  /**
   * 投票キーファイルの更新処理を実行する。
   */
  private async updateVotingKey(
    params: VotingKeysUpdateServiceParams,
    presetData: ConfigPreset,
    nodePreset: NodePreset,
    nodeAccount: NodeAccount,
    finalizationEpoch: number
  ): Promise<boolean> {
    const cryptoPort = new SymbolCryptoAdapter();
    return await new VotingService(
      this.logger,
      {
        target: params.target,
        user: params.user,
      },
      cryptoPort
    ).run(presetData, nodeAccount, nodePreset, finalizationEpoch, true, false);
  }

  /**
   * 更新後の addresses を保存する。
   */
  private async saveAddresses(
    target: string,
    addresses: Addresses,
    privateKeySecurityMode: ReturnType<typeof CryptoUtils.getPrivateKeySecurityMode>
  ): Promise<void> {
    const addressesLocation = this.configLoader.getGeneratedAddressLocation(target);
    await YamlUtils.writeYaml(
      addressesLocation,
      CryptoUtils.removePrivateKeysAccordingToSecurityMode(addresses, privateKeySecurityMode),
      undefined
    );
  }
}
