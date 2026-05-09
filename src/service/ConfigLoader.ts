/*
 * Copyright 2022 Fernando Boucquez
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import {
  Addresses,
  ConfigAccount,
  ConfigPreset,
  CustomPreset,
  NodePreset,
} from '../model/index.js';
import { GeneratedAccount, PublicAccountInfo } from '../sdk/index.js';
import { Constants } from '../utils/Constants.js';
import { Utils } from '../utils/Utils.js';
import { Password, YamlUtils } from '../utils/YamlUtils.js';
import { Assembly, defaultAssembly } from './ConfigTypes.js';

/**
 * アドレスファイルおよびプリセットファイルの読み込み・解決を担当するサービスクラス。
 * プリセットのマージ・テンプレート展開・既存設定の読み込みを行う。
 */
export class ConfigLoader {
  /** プリセット情報のログ出力済みフラグ（重複ログを抑制するためのグローバルフラグ） */
  public static presetInfoLogged = false;

  /**
   * @param logger ログ出力インターフェース
   */
  constructor(private readonly logger: Logger) {}

  /**
   * カスタムプリセットファイルを読み込む。
   * パスが指定されない場合は空オブジェクトを返す。
   *
   * @param customPreset カスタムプリセットファイルパス
   * @param password 復号パスワード
   * @returns 読み込んだカスタムプリセット
   * @throws KnownError ファイルが存在しない場合
   */
  public loadCustomPreset(customPreset: string | undefined, password: Password): CustomPreset {
    if (!customPreset) return {};
    if (!existsSync(customPreset)) {
      throw new KnownError(
        `カスタムプリセット '${customPreset}' が存在しません。--customPreset <customPresetFileLocation> を正しく指定したか確認してください。`
      );
    }
    return YamlUtils.loadYaml(customPreset, password);
  }

  /**
   * アセンブリプリセットファイルを読み込む。
   *
   * @param preset プリセット名
   * @param assembly アセンブリ名
   * @param workingDir 作業ディレクトリ
   * @returns アセンブリプリセット
   * @throws KnownError アセンブリが無効な場合
   */
  public static loadAssembly(preset: string, assembly: string, workingDir: string): CustomPreset {
    const fileLocation = join(
      Constants.ROOT_FOLDER,
      'presets',
      'assemblies',
      `assembly-${assembly}.yaml`
    );
    const errorMessage = `アセンブリ '${assembly}' はプリセット '${preset}' では使用できません。--preset <preset> --assembly <assembly> の指定を確認してください。`;
    return this.loadBundledPreset(assembly, fileLocation, workingDir, errorMessage);
  }

  /**
   * ネットワークプリセットファイルを読み込む。
   *
   * @param preset プリセット名
   * @param workingDir 作業ディレクトリ
   * @returns ネットワークプリセット
   * @throws KnownError プリセットが存在しない場合
   */
  public static loadNetworkPreset(preset: string, workingDir: string): CustomPreset {
    const fileLocation = join(Constants.ROOT_FOLDER, 'presets', preset, `network.yaml`);
    const errorMessage = `プリセット '${preset}' が存在しません。--preset <preset> の指定を確認してください。`;
    return this.loadBundledPreset(preset, fileLocation, workingDir, errorMessage);
  }

  /**
   * バンドルまたはファイルシステム上のプリセットを読み込む内部ヘルパー。
   * YAML ファイルパスが渡された場合はファイルシステムから、
   * それ以外はバンドルされたパスから読み込む。
   */
  private static loadBundledPreset(
    presetFile: string,
    bundledLocation: string,
    workingDir: string,
    errorMessage: string
  ): CustomPreset {
    if (YamlUtils.isYamlFile(presetFile)) {
      const assemblyFile = Utils.resolveWorkingDirPath(workingDir, presetFile);
      if (!existsSync(assemblyFile)) {
        throw new KnownError(errorMessage);
      }
      return YamlUtils.loadYaml(assemblyFile, false);
    }
    if (existsSync(bundledLocation)) {
      return YamlUtils.loadYaml(bundledLocation, false);
    }
    throw new KnownError(errorMessage);
  }

  /**
   * 共有プリセット（`presets/shared.yaml`）を読み込む。
   *
   * @returns 共有プリセット
   */
  public static loadSharedPreset(): CustomPreset {
    return YamlUtils.loadYaml(
      join(Constants.ROOT_FOLDER, 'presets', 'shared.yaml'),
      false
    ) as ConfigPreset;
  }
  /**
   * 複数のプリセットをディープマージして1つのプリセットオブジェクトを返す。
   *
   * `inflation`・`knownRestGateways`・`knownPeers` は deepMerge では配列が結合されてしまうため、
   * 後ろから検索して空でない最初の値で上書きする。
   *
   * @param object ベースとなるプリセット
   * @param otherArgs 上書きするプリセット群（後ろが優先）
   * @returns マージ済みプリセット
   */
  public mergePresets<T extends CustomPreset>(
    object: T | undefined,
    ...otherArgs: (CustomPreset | undefined)[]
  ): T {
    const presets = [object, ...otherArgs];
    const presetData = Utils.deepMerge({}, ...presets) as T;

    // 配列型フィールドは deepMerge で結合されるため、空でない末尾の値で上書きする
    const reversed = [...presets].reverse();
    const inflation = reversed.find(
      (p) => p?.inflation && Object.keys(p.inflation).length > 0
    )?.inflation;
    const knownRestGateways = reversed.find(
      (p) => (p?.knownRestGateways?.length ?? 0) > 0
    )?.knownRestGateways;
    const knownPeers = reversed.find((p) => (p?.knownPeers?.length ?? 0) > 0)?.knownPeers;

    if (inflation) presetData.inflation = inflation;
    if (knownRestGateways) presetData.knownRestGateways = knownRestGateways;
    if (knownPeers) presetData.knownPeers = knownPeers;
    return presetData;
  }

  /**
   * 各プリセット・アセンブリ・カスタムプリセットをマージして最終的な ConfigPreset を生成する。
   *
   * 処理順序:
   * 1. プリセット名・アセンブリ名を解決する
   * 2. shared / network / assembly の各プリセットを読み込む
   * 3. カスタムプリセットとマージして最終プリセットを生成する
   * 4. ノードのデフォルト設定を動的に適用して返す
   *
   * @param params 生成パラメーター
   * @returns 生成された ConfigPreset
   * @throws KnownError プリセット名・アセンブリ名が解決できない場合
   */
  public createPresetData(params: {
    workingDir: string;
    password: Password;
    preset?: string;
    assembly?: string;
    customPreset?: string;
    customPresetObject?: CustomPreset;
    oldPresetData?: ConfigPreset;
  }): ConfigPreset {
    const customPresetFileObject = this.loadCustomPreset(params.customPreset, params.password);
    const preset = this.resolvePreset(params, customPresetFileObject);
    const assembly = this.resolveAssembly(params, customPresetFileObject, preset);

    const sharedPreset = ConfigLoader.loadSharedPreset();
    const networkPreset = ConfigLoader.loadNetworkPreset(preset, params.workingDir);
    const assemblyPreset = ConfigLoader.loadAssembly(preset, assembly, params.workingDir);

    // カスタムプリセットの優先順位: ファイル < オブジェクト。どちらも空なら旧プリセットのキャッシュを使用する
    const providedCustomPreset = this.mergePresets(
      customPresetFileObject,
      params.customPresetObject
    );
    const resolvedCustomPreset =
      Object.keys(providedCustomPreset).length > 0
        ? providedCustomPreset
        : (params.oldPresetData?.customPresetCache ?? {});

    const presetData = this.mergePresets(
      sharedPreset,
      networkPreset,
      assemblyPreset,
      resolvedCustomPreset
    ) as ConfigPreset;

    this.logPresetInfo(preset, assembly, params.customPreset);

    if (!presetData.networkType) {
      throw new Error(
        'ネットワークタイプを解決できませんでした。--preset の指定を確認してください。'
      );
    }
    ConfigLoader.presetInfoLogged = true;

    return {
      ...presetData,
      version: 1,
      preset,
      assembly,
      node: this.dynamicDefaultNodeConfiguration(presetData.node),
      customPresetCache: resolvedCustomPreset,
    };
  }

  /**
   * パラメーターおよびフォールバック値からプリセット名を解決する。
   * 解決できない場合は KnownError をスローする。
   */
  private resolvePreset(
    params: { preset?: string; customPresetObject?: CustomPreset; oldPresetData?: ConfigPreset },
    customPresetFileObject: CustomPreset
  ): string {
    const preset =
      params.preset ??
      params.customPresetObject?.preset ??
      customPresetFileObject?.preset ??
      params.oldPresetData?.preset;
    if (!preset) {
      throw new KnownError(
        'ターゲットフォルダーの内容から preset 値を解決できませんでした。config/start 実行時に --preset を指定してください。'
      );
    }
    return preset;
  }

  /**
   * パラメーターおよびフォールバック値からアセンブリ名を解決する。
   * 解決できない場合は KnownError をスローする。
   */
  private resolveAssembly(
    params: { assembly?: string; customPresetObject?: CustomPreset; oldPresetData?: ConfigPreset },
    customPresetFileObject: CustomPreset,
    preset: string
  ): string {
    const assembly =
      params.assembly ??
      params.customPresetObject?.assembly ??
      customPresetFileObject?.assembly ??
      params.oldPresetData?.assembly ??
      defaultAssembly[preset];
    if (!assembly) {
      throw new KnownError(
        `プリセット ${preset} では assembly（-a, --assembly オプション）が必要です。指定可能な値: ${Object.keys(Assembly).join(', ')}`
      );
    }
    return assembly;
  }

  /**
   * プリセット情報をログ出力する。重複出力を防ぐため `presetInfoLogged` フラグを確認する。
   */
  private logPresetInfo(preset: string, assembly: string, customPreset: string | undefined): void {
    if (ConfigLoader.presetInfoLogged) return;
    this.logger.info(`プリセット '${preset}' から設定を生成します`);
    this.logger.info(`アセンブリ '${assembly}' を使用します`);
    if (customPreset) {
      this.logger.info(`カスタムプリセットファイル '${customPreset}' を使用します`);
    }
  }

  /**
   * ノード設定にロール別のデフォルト設定を動的に適用して返す。
   *
   * @param node ノードプリセット（省略時は undefined）
   * @returns デフォルト設定が適用されたノードプリセット
   */
  public dynamicDefaultNodeConfiguration(node?: Partial<NodePreset>): NodePreset | undefined {
    if (!node) {
      return undefined;
    }
    return { ...this.getDefaultConfiguration(node), ...node } as NodePreset;
  }

  /**
   * ノードのロール（api / harvesting / peer）に応じたデフォルト設定を返す。
   *
   * - api + harvesting: フルノード設定（syncsource・各種拡張すべて有効）
   * - api のみ: API ノード設定（syncsource を無効化）
   * - peer のみ: ピアノード設定（mongo・zeromq 無効、autoSyncCleanup 有効）
   */
  private getDefaultConfiguration(node: Partial<NodePreset>): Partial<NodePreset> {
    if (node.harvesting && node.api) {
      // フルノード（API + ハーベスティング）
      return {
        syncsource: true,
        filespooling: true,
        partialtransaction: true,
        addressextraction: true,
        mongo: true,
        zeromq: true,
        enableAutoSyncCleanup: false,
      };
    }
    if (node.api) {
      // API ノード（ハーベスティングなし）
      return {
        syncsource: false,
        filespooling: true,
        partialtransaction: true,
        addressextraction: true,
        mongo: true,
        zeromq: true,
        enableAutoSyncCleanup: false,
      };
    }
    // ピアノード（ハーベスティングあり/なし共通）
    return {
      syncsource: true,
      filespooling: false,
      partialtransaction: false,
      addressextraction: false,

      zeromq: false,
      enableAutoSyncCleanup: true,
    };
  }

  /**
   * 秘密鍵の有無に応じて ConfigAccount を生成して返す。
   * 秘密鍵を持つアカウントは `privateKey` フィールドを含め、そうでない場合は公開情報のみ返す。
   *
   * @param account 生成済みアカウントまたは公開アカウント情報
   * @returns ConfigAccount
   */
  public static toConfig(account: GeneratedAccount | PublicAccountInfo): ConfigAccount {
    if ('privateKey' in account && account.privateKey) {
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

  /**
   * 生成済みプリセットファイルが存在する場合に読み込んで返す。
   * 存在しない場合は `undefined` を返す。
   *
   * @param target ターゲットフォルダーパス
   * @param password 復号パスワード
   * @returns ConfigPreset、またはファイル未存在の場合は `undefined`
   */
  public loadExistingPresetDataIfPreset(
    target: string,
    password: Password
  ): ConfigPreset | undefined {
    const generatedPresetLocation = this.getGeneratedPresetLocation(target);
    if (!existsSync(generatedPresetLocation)) return undefined;
    return YamlUtils.loadYaml(generatedPresetLocation, password);
  }

  /**
   * 生成済みプリセットファイルを読み込んで返す。
   * ファイルが存在しない場合はエラーをスローする。
   *
   * @param target ターゲットフォルダーパス
   * @param password 復号パスワード
   * @returns ConfigPreset
   * @throws Error ファイルが存在しない場合
   */
  public loadExistingPresetData(target: string, password: Password): ConfigPreset {
    const presetData = this.loadExistingPresetDataIfPreset(target, password);
    if (!presetData) {
      throw new Error(
        `ファイル ${this.getGeneratedPresetLocation(target)} が存在しません。'config' コマンドを実行済みか、--target の指定が正しいか確認してください。`
      );
    }
    return presetData;
  }

  /**
   * 生成済みプリセットファイルのパスを返す。
   *
   * @param target ターゲットフォルダーパス
   * @returns `{target}/preset.yaml`
   */
  public getGeneratedPresetLocation(target: string): string {
    return join(target, 'preset.yaml');
  }

  /**
   * 生成済みアドレスファイルが存在する場合に読み込んで返す。
   * レガシー暗号化が検出された場合は非同期でより強い暗号化へアップグレードする（fire-and-forget）。
   * 存在しない場合は `undefined` を返す。
   *
   * @param target ターゲットフォルダーパス
   * @param password 復号パスワード
   * @returns Addresses、またはファイル未存在の場合は `undefined`
   */
  public loadExistingAddressesIfPreset(target: string, password: Password): Addresses | undefined {
    const generatedAddressLocation = this.getGeneratedAddressLocation(target);
    if (!existsSync(generatedAddressLocation)) return undefined;

    const result = YamlUtils.loadYamlWithUpgradeInfo(generatedAddressLocation, password);
    const addresses = result.data as Addresses;

    if (result.hasLegacyUpgrade && password) {
      // 呼び出し元は同期 API のため、暗号化アップグレードは fire-and-forget で非同期に処理する
      this.upgradeEncryptionAsync(generatedAddressLocation, addresses, password);
    }

    return addresses;
  }

  /**
   * レガシー暗号化ファイルをバックアップしたうえで、より強い暗号化で上書き保存する。
   * 本メソッドは非同期かつ fire-and-forget（呼び出し元は結果を待機しない）で実行される。
   *
   * @param filePath アップグレード対象のファイルパス
   * @param addresses 書き出すアドレスデータ
   * @param password 暗号化パスワード
   */
  private upgradeEncryptionAsync(filePath: string, addresses: Addresses, password: Password): void {
    const backupPath = `${filePath}.bk`;
    this.logger.warn(
      `${filePath} でレガシー暗号化を検出しました。より強力な暗号化へアップグレードします...`
    );
    this.logger.info(`元ファイルのバックアップを ${backupPath} に作成します`);

    copyFile(filePath, backupPath)
      .then(() => {
        this.logger.info('バックアップの作成に成功しました');
        return YamlUtils.writeYaml(filePath, addresses, password);
      })
      .then(() => {
        this.logger.info(`${filePath} の暗号化アップグレードに成功しました`);
        this.logger.info(
          `元ファイルは ${backupPath} にバックアップされています（レガシー方式で暗号化）`
        );
      })
      .catch((e: Error) => {
        this.logger.error(`${filePath} の暗号化アップグレードに失敗しました: ${e.message}`);
      });
  }

  /**
   * 生成済みアドレスファイルを読み込んで返す。
   * ファイルが存在しない場合はエラーをスローする。
   *
   * @param target ターゲットフォルダーパス
   * @param password 復号パスワード
   * @returns Addresses
   * @throws Error ファイルが存在しない場合
   */
  public loadExistingAddresses(target: string, password: Password): Addresses {
    const addresses = this.loadExistingAddressesIfPreset(target, password);
    if (!addresses) {
      throw new Error(
        `ファイル ${this.getGeneratedAddressLocation(target)} が存在しません。'config' コマンドを実行済みか、--target の指定が正しいか確認してください。`
      );
    }
    return addresses;
  }

  /**
   * 生成済みアドレスファイルのパスを返す。
   *
   * @param target ターゲットフォルダーパス
   * @returns `{target}/addresses.yaml`
   */
  public getGeneratedAddressLocation(target: string): string {
    return join(target, 'addresses.yaml');
  }
}
