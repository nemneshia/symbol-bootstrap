import { dirname, join } from 'path';

import { existsSync } from 'node:fs';

import { Logger } from '../logger/index.js';
import { SymbolCryptoAdapter, SymbolNetworkAdapter } from '../sdk/index.js';
import { CryptoUtils } from '../utils/CryptoUtils.js';
import { Password, YamlUtils } from '../utils/YamlUtils.js';
import { ZipItem, ZipUtils } from '../utils/ZipUtils.js';
import { ComposeService } from './ComposeService.js';
import { ConfigService } from './ConfigService.js';
import { ConfigParams } from './ConfigTypes.js';
import { FileSystemService } from './FileSystemService.js';

export interface PackServiceResult {
  targetZip: string;
}

/**
 * pack コマンドの設定生成・compose 生成・zip 化処理を担当するサービス。
 */
export class PackService {
  private readonly cryptoPort = new SymbolCryptoAdapter();
  private readonly networkPort = new SymbolNetworkAdapter();
  private readonly fileSystemService: FileSystemService;

  constructor(private readonly logger: Logger) {
    this.fileSystemService = new FileSystemService(logger);
  }

  /**
   * 対象フォルダーを構成し、秘密鍵を除去したプリセットを同梱して zip を作成する。
   */
  public async run(params: ConfigParams): Promise<PackServiceResult> {
    const targetZip = this.resolveTargetZipOrThrow(params.target);
    await this.generateConfigurationFiles(params);

    const configWithoutPrivateKeysFile = this.resolveTemporaryPresetPath(targetZip);
    this.fileSystemService.deleteFile(configWithoutPrivateKeysFile);

    try {
      await this.writePresetWithoutPrivateKeys(
        configWithoutPrivateKeysFile,
        params.customPreset,
        params.password
      );

      await new ZipUtils(this.logger).zip(
        targetZip,
        this.buildZipItems(params.target, configWithoutPrivateKeysFile)
      );
      return { targetZip };
    } finally {
      this.fileSystemService.deleteFile(configWithoutPrivateKeysFile);
    }
  }

  /**
   * 出力先 ZIP ファイルのパスを解決し、既存ファイルがある場合は例外を送出する。
   */
  private resolveTargetZipOrThrow(targetFolder: string): string {
    const targetZip = join(dirname(targetFolder), 'symbol-node.zip');
    if (existsSync(targetZip)) {
      throw new Error(
        `出力先 ZIP ファイル ${targetZip} は既に存在します。再パッケージ前に削除してください。`
      );
    }
    return targetZip;
  }

  /**
   * config / compose を順に実行し、ZIP化対象ファイルを生成する。
   */
  private async generateConfigurationFiles(params: ConfigParams): Promise<void> {
    const configResult = await new ConfigService(
      this.logger,
      params,
      this.cryptoPort,
      this.networkPort
    ).run();
    await new ComposeService(this.logger, params).run(configResult.presetData);
  }

  /**
   * 秘密鍵除去済みプリセットを書き込む一時ファイルのパスを返す。
   */
  private resolveTemporaryPresetPath(targetZip: string): string {
    return join(dirname(targetZip), '.symbol-bootstrap-pack-temp.yaml');
  }

  /**
   * ZIP 化対象の入力一覧を作成する。
   */
  private buildZipItems(targetFolder: string, sanitizedPresetPath: string): ZipItem[] {
    return [
      {
        from: targetFolder,
        to: 'target',
        directory: true,
      },
      {
        from: sanitizedPresetPath,
        to: 'config-only-custom-preset.yaml',
        directory: false,
      },
    ];
  }

  /**
   * カスタムプリセットから秘密鍵を除去した YAML を一時ファイルへ書き出す。
   */
  private async writePresetWithoutPrivateKeys(
    file: string,
    customPreset: string | undefined,
    password: Password
  ): Promise<void> {
    if (customPreset) {
      await YamlUtils.writeYaml(
        file,
        CryptoUtils.removePrivateKeys(YamlUtils.loadYaml(customPreset, password)),
        password
      );
      return;
    }
    await YamlUtils.writeYaml(file, {}, password);
  }
}
