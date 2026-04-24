import { existsSync } from 'fs';
import { join } from 'path';
import { ConfigAccount, ConfigPreset, NodePreset } from '../model/index.js';
import { ICryptoPort, NetworkType } from '../sdk/index.js';
import { Constants } from './Constants.js';
import { YamlUtils } from './YamlUtils.js';

/**
 * ブートストラップ設定に関連するアカウント変換や Nemesis 判定を担当するユーティリティクラス。
 */
export class ConfigurationUtils {
  public static toConfigAccountFomKeys(
    networkType: NetworkType,
    publicKey: string | undefined,
    privateKey: string | undefined,
    cryptoPort: ICryptoPort,
  ): ConfigAccount | undefined {
    const account = this.toAccount(networkType, publicKey, privateKey, cryptoPort);
    if (!account) {
      return undefined;
    }
    return this.toConfigAccount(account);
  }

  public static toAccount(
    networkType: NetworkType,
    publicKey: string | undefined,
    privateKey: string | undefined,
    cryptoPort: ICryptoPort,
  ): { publicKey: string; address: string; privateKey?: string } | undefined {
    if (privateKey) {
      const account = cryptoPort.createAccountFromPrivateKey(privateKey, networkType);
      if (publicKey && account.publicKey.toUpperCase() != publicKey.toUpperCase()) {
        throw new Error('Invalid provided public key/private key!');
      }
      return account;
    }
    if (publicKey) {
      return cryptoPort.createPublicAccount(publicKey, networkType);
    }
    return undefined;
  }

  public static toConfigAccount(account: { publicKey: string; address: string; privateKey?: string }): ConfigAccount {
    if (account.privateKey) {
      return {
        privateKey: account.privateKey,
        publicKey: account.publicKey,
        address: account.address,
      };
    }
    return {
      publicKey: account.publicKey,
      address: account.address,
    };
  }

  public static resolveRoles(nodePreset: NodePreset): string {
    if (nodePreset.roles) {
      return nodePreset.roles;
    }
    const roles: string[] = [];
    if (nodePreset.syncsource) {
      roles.push('Peer');
    }
    if (nodePreset.api) {
      roles.push('Api');
    }
    if (nodePreset.voting) {
      roles.push('Voting');
    }
    return roles.join(',');
  }

  public static shouldCreateNemesis(presetData: ConfigPreset): boolean {
    return (
      presetData.nemesis &&
      !presetData.nemesisSeedFolder &&
      (YamlUtils.isYamlFile(presetData.preset) || !existsSync(join(Constants.ROOT_FOLDER, 'presets', presetData.preset, 'seed')))
    );
  }
}
