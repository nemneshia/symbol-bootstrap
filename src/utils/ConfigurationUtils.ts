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
  /**
   * 公開鍵・秘密鍵のペアから {@link ConfigAccount} を生成する。
   *
   * - 秘密鍵が存在する場合は秘密鍵から完全なアカウントを復元する。
   * - 秘密鍵がない場合は公開鍵のみの情報でアカウントを構築する。
   * - どちらも指定されていない場合は `undefined` を返す。
   *
   * @note メソッド名の "Fom" はタイポだが後方互換のため維持している。
   */
  public static toConfigAccountFomKeys(
    networkType: NetworkType,
    publicKey: string | undefined,
    privateKey: string | undefined,
    cryptoPort: ICryptoPort
  ): ConfigAccount | undefined {
    const account = this.toAccount(networkType, publicKey, privateKey, cryptoPort);
    return account ? this.toConfigAccount(account) : undefined;
  }

  /**
   * 公開鍵または秘密鍵からアカウント情報を取得する。
   *
   * - 秘密鍵が指定されている場合：秘密鍵からアカウントを復元する。
   *   公開鍵も同時に指定された場合はキーペアの整合性を検証し、不一致であれば例外を投げる。
   * - 秘密鍵がなく公開鍵のみの場合：公開鍵のみのアカウントを返す。
   * - どちらも指定されていない場合：`undefined` を返す。
   *
   * @throws {Error} 秘密鍵から導出した公開鍵と指定された公開鍵が一致しない場合。
   */
  public static toAccount(
    networkType: NetworkType,
    publicKey: string | undefined,
    privateKey: string | undefined,
    cryptoPort: ICryptoPort
  ): { publicKey: string; address: string; privateKey?: string } | undefined {
    if (privateKey) {
      const account = cryptoPort.createAccountFromPrivateKey(privateKey, networkType);
      if (publicKey && account.publicKey.toUpperCase() !== publicKey.toUpperCase()) {
        throw new Error('指定された公開鍵と秘密鍵の組み合わせが不正です。');
      }
      return account;
    }
    if (publicKey) {
      return cryptoPort.createPublicAccount(publicKey, networkType);
    }
    return undefined;
  }

  /**
   * 内部アカウント形式を {@link ConfigAccount} に変換する。
   *
   * 秘密鍵が存在する場合はそれを含めた完全な形式を返す。
   * 秘密鍵がない場合は公開鍵とアドレスのみを返す。
   */
  public static toConfigAccount(account: {
    publicKey: string;
    address: string;
    privateKey?: string;
  }): ConfigAccount {
    const { publicKey, address, privateKey } = account;
    return privateKey ? { privateKey, publicKey, address } : { publicKey, address };
  }

  /**
   * ノードプリセットからロール文字列を解決する。
   *
   * プリセットに `roles` フィールドが直接指定されている場合はその値を優先する。
   * 指定がない場合は `syncsource` / `api` / `voting` フラグから自動生成する。
   *
   * @example
   * // フラグから生成する場合
   * resolveRoles({ syncsource: true, api: true }) // => "Peer,Api"
   */
  public static resolveRoles(nodePreset: NodePreset): string {
    if (nodePreset.roles) {
      return nodePreset.roles;
    }
    // 各フラグとロール名のマッピング
    const roleMap: [keyof NodePreset, string][] = [
      ['syncsource', 'Peer'],
      ['api', 'Api'],
      ['voting', 'Voting'],
    ];
    return roleMap
      .filter(([flag]) => nodePreset[flag])
      .map(([, role]) => role)
      .join(',');
  }

  /**
   * Nemesis ブロックを新規生成すべきかどうかを判定する。
   *
   * 以下の条件をすべて満たす場合に `true` を返す:
   * 1. プリセットで `nemesis: true` が設定されている。
   * 2. `nemesisSeedFolder` が指定されていない（既存シードを使わない）。
   * 3. プリセットが YAML ファイル指定、またはバンドル済みシードフォルダが存在しない。
   */
  public static shouldCreateNemesis(presetData: ConfigPreset): boolean {
    return (
      presetData.nemesis &&
      !presetData.nemesisSeedFolder &&
      (YamlUtils.isYamlFile(presetData.preset) ||
        !existsSync(join(Constants.ROOT_FOLDER, 'presets', presetData.preset, 'seed')))
    );
  }
}
