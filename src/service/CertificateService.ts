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
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { Logger } from '../logger/index.js';
import { CertificatePair } from '../model/index.js';
import { GeneratedAccount, ICryptoPort, NetworkType, SymbolCryptoAdapter } from '../sdk/index.js';
import { Constants } from '../utils/Constants.js';
import { HandlebarsUtils } from '../utils/HandlebarsUtils.js';
import { Utils } from '../utils/Utils.js';
import { YamlUtils } from '../utils/YamlUtils.js';
import { AccountResolver, KeyName } from './AccountResolver.js';
import { FileSystemService } from './FileSystemService.js';
import { RuntimeService } from './RuntimeService.js';

export interface CertificateParams {
  readonly target: string;
  readonly user?: string;
}

export interface CertificateMetadata {
  readonly transportPublicKey: string;
  readonly mainPublicKey: string;
  readonly version: number;
}

export interface NodeCertificates {
  main: CertificatePair;
  transport: CertificatePair;
}

export interface CertificateConfigPreset {
  networkType: NetworkType;
  symbolServerImage: string;
  caCertificateExpirationInDays: number;
  nodeCertificateExpirationInDays: number;
  certificateExpirationWarningInDays: number;
}

export enum RenewMode {
  ONLY_WARNING,
  WHEN_REQUIRED,
  ALWAYS,
}

/**
 * ノード証明書の生成・更新・期限確認を担当するサービス。
 */
export class CertificateService {
  public static NODE_CERTIFICATE_FILE_NAME = 'node.crt.pem';
  public static CA_CERTIFICATE_FILE_NAME = 'ca.crt.pem';
  private static readonly METADATA_VERSION = 1;
  private readonly fileSystemService: FileSystemService;
  private readonly runtimeService: RuntimeService;

  constructor(
    private readonly logger: Logger,
    private readonly accountResolver: AccountResolver,
    protected readonly params: CertificateParams,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter()
  ) {
    this.runtimeService = new RuntimeService(this.logger);
    this.fileSystemService = new FileSystemService(logger);
  }

  /**
   * 証明書メタデータと有効期限を評価し、必要に応じて証明書を生成または更新する。
   * @returns 証明書を新規作成または更新した場合は true
   */
  public async run(
    presetData: CertificateConfigPreset,
    name: string,
    host: string,
    providedCertificates: NodeCertificates,
    renewMode: RenewMode,
    customCertFolder?: string,
    randomSerial?: string
  ): Promise<boolean> {
    const certFolder =
      customCertFolder ||
      this.fileSystemService.getTargetNodesFolder(this.params.target, false, 'node', 'cert');
    const metadataFile = join(certFolder, 'metadata.yaml');
    if (!(await this.shouldGenerateCertificate(metadataFile, providedCertificates))) {
      const willExpireReport = await this.willCertificateExpire(
        presetData.symbolServerImage,
        certFolder,
        CertificateService.NODE_CERTIFICATE_FILE_NAME,
        presetData.certificateExpirationWarningInDays
      );
      const shouldRenew =
        (willExpireReport.willExpire && renewMode === RenewMode.WHEN_REQUIRED) ||
        renewMode === RenewMode.ALWAYS;
      const logWarning =
        (willExpireReport.willExpire && renewMode === RenewMode.ONLY_WARNING) ||
        (!willExpireReport.willExpire && renewMode === RenewMode.ALWAYS);

      const message = this.resolveRenewMessage(
        willExpireReport.willExpire,
        renewMode,
        name,
        presetData.certificateExpirationWarningInDays,
        willExpireReport.expirationDate
      );
      if (logWarning) this.logger.warn(message);
      else this.logger.info(message);

      if (shouldRenew) {
        await this.createCertificate(
          true,
          presetData,
          certFolder,
          name,
          host,
          providedCertificates,
          metadataFile,
          randomSerial
        );
      }
      return shouldRenew;
    } else {
      await this.createCertificate(
        false,
        presetData,
        certFolder,
        name,
        host,
        providedCertificates,
        metadataFile,
        randomSerial
      );
      return true;
    }
  }

  /**
   * 期限状態と更新モードからログメッセージを組み立てる。
   */
  private resolveRenewMessage(
    willExpire: boolean,
    renewMode: RenewMode,
    name: string,
    certificateExpirationWarningInDays: number,
    expirationDate: string
  ): string {
    const nodeCertFileName = CertificateService.NODE_CERTIFICATE_FILE_NAME;
    if (willExpire) {
      if (renewMode === RenewMode.WHEN_REQUIRED || renewMode === RenewMode.ALWAYS) {
        return `The ${nodeCertFileName} certificate for node ${name} will expire in less than ${certificateExpirationWarningInDays} days on ${expirationDate}. Renewing...`;
      }
      return `The ${nodeCertFileName} certificate for node ${name} will expire in less than ${certificateExpirationWarningInDays} days on ${expirationDate}. You need to renew it.`;
    }

    if (renewMode === RenewMode.ALWAYS) {
      return `The ${nodeCertFileName} certificate for node ${name} will expire on ${expirationDate}, renewing anyway...`;
    }

    return `The ${nodeCertFileName} certificate for node ${name} will expire on ${expirationDate}. No need to renew it yet.`;
  }

  /**
   * OpenSSL 実行に必要な入力を作成し、証明書を生成する。
   */
  private async createCertificate(
    renew: boolean,
    presetData: CertificateConfigPreset,
    certFolder: string,
    name: string,
    host: string,
    providedCertificates: NodeCertificates,
    metadataFile: string,
    randomSerial?: string
  ): Promise<void> {
    const copyFrom = join(Constants.ROOT_FOLDER, 'config', 'cert');
    const networkType = presetData.networkType;

    const { mainAccount, transportAccount } = await this.resolveCertificateAccounts(
      networkType,
      providedCertificates,
      name
    );

    if (!renew) {
      this.fileSystemService.deleteFolder(certFolder);
    }

    await this.prepareCertificateWorkspace(
      certFolder,
      copyFrom,
      name,
      host,
      mainAccount.privateKey,
      transportAccount.privateKey,
      randomSerial
    );

    const command = this.createCertCommands(
      renew,
      presetData.caCertificateExpirationInDays,
      presetData.nodeCertificateExpirationInDays
    );
    await YamlUtils.writeTextFile(join(certFolder, 'createNodeCertificates.sh'), command);

    const { stdout, stderr } = await this.runOpenSslCommand(
      presetData.symbolServerImage,
      'bash createNodeCertificates.sh',
      certFolder,
      false
    );
    const certificates = this.validateAndExtractCertificates(stdout, stderr);
    this.logger.info(
      renew ? `ノード ${name} の証明書を更新しました。` : `ノード ${name} の証明書を作成しました。`
    );

    this.validateCertificates(
      certificates,
      mainAccount.privateKey,
      transportAccount.privateKey,
      providedCertificates
    );

    const metadata: CertificateMetadata = {
      version: CertificateService.METADATA_VERSION,
      transportPublicKey: providedCertificates.transport.publicKey,
      mainPublicKey: providedCertificates.main.publicKey,
    };
    await YamlUtils.writeYaml(metadataFile, metadata, undefined);
  }

  /** 証明書生成に必要な Main/Transport アカウントを解決する。 */
  private async resolveCertificateAccounts(
    networkType: NetworkType,
    providedCertificates: NodeCertificates,
    name: string
  ): Promise<{ mainAccount: GeneratedAccount; transportAccount: GeneratedAccount }> {
    const mainAccount = await this.accountResolver.resolveAccount(
      networkType,
      providedCertificates.main,
      KeyName.Main,
      name,
      'generating the server CA certificates',
      'Should not generate!'
    );
    const transportAccount = await this.accountResolver.resolveAccount(
      networkType,
      providedCertificates.transport,
      KeyName.Transport,
      name,
      'generating the server Node certificates',
      'Should not generate!'
    );
    return { mainAccount, transportAccount };
  }

  /** OpenSSL 実行前に必要なテンプレート・鍵ファイル・シリアルファイルを準備する。 */
  private async prepareCertificateWorkspace(
    certFolder: string,
    copyFrom: string,
    name: string,
    host: string,
    mainPrivateKey: string,
    transportPrivateKey: string,
    randomSerial?: string
  ): Promise<void> {
    await this.fileSystemService.mkdir(certFolder);
    const ip = await Utils.resolveHost(host);
    await HandlebarsUtils.generateConfiguration({ name, host, ip }, copyFrom, certFolder, []);

    CertificateService.createDerFile(mainPrivateKey, join(certFolder, 'ca.der'));
    CertificateService.createDerFile(transportPrivateKey, join(certFolder, 'node.der'));

    await YamlUtils.writeTextFile(
      join(certFolder, 'serial.dat'),
      (randomSerial?.trim() || this.cryptoPort.randomHex(19)).toLowerCase() + '\n'
    );
  }

  /** OpenSSL 実行結果から証明書作成の成功を検証し、抽出した証明書ペアを返す。 */
  private validateAndExtractCertificates(stdout: string, stderr: string): CertificatePair[] {
    if (!stdout.includes('Certificate Created')) {
      this.logger.info(Utils.secureString(stdout));
      this.logger.error(Utils.secureString(stderr));
      throw new Error('証明書の作成に失敗しました。ログを確認してください。');
    }

    const certificates = CertificateService.getCertificates(stdout);
    if (certificates.length !== 2) {
      throw new Error(
        '証明書の作成に失敗しました。2 件作成されるべきところ、実際は ' + certificates.length
      );
    }
    return certificates;
  }

  /** 生成された証明書ペアの秘密鍵/公開鍵が期待値と一致することを検証する。 */
  private validateCertificates(
    certificates: CertificatePair[],
    mainPrivateKey: string,
    transportPrivateKey: string,
    providedCertificates: NodeCertificates
  ): void {
    const caCertificate = certificates[0];
    const nodeCertificate = certificates[1];

    Utils.validateIsTrue(caCertificate.privateKey === mainPrivateKey, 'Invalid ca private key');
    Utils.validateIsTrue(
      caCertificate.publicKey === providedCertificates.main.publicKey,
      'Invalid ca public key'
    );
    Utils.validateIsTrue(
      nodeCertificate.privateKey === transportPrivateKey,
      'Invalid Node private key'
    );
    Utils.validateIsTrue(
      nodeCertificate.publicKey === providedCertificates.transport.publicKey,
      'Invalid Node public key'
    );
  }

  /**
   * 既存メタデータと提供鍵を比較し、再生成が必要かを判定する。
   */
  private async shouldGenerateCertificate(
    metadataFile: string,
    providedCertificates: NodeCertificates
  ): Promise<boolean> {
    if (!existsSync(metadataFile)) {
      return true;
    }
    try {
      const metadata = YamlUtils.loadYaml(metadataFile, false) as CertificateMetadata;
      return (
        metadata.mainPublicKey !== providedCertificates.main.publicKey ||
        metadata.transportPublicKey !== providedCertificates.transport.publicKey ||
        metadata.version !== CertificateService.METADATA_VERSION
      );
    } catch (e) {
      this.logger.warn(
        `ファイル ${metadataFile} からノード証明書メタデータを読み込めません。詳細: ${Utils.getMessage(e)}`,
        e
      );
      return true;
    }
  }

  /**
   * 証明書作成用の OpenSSL スクリプト文字列を生成する。
   */
  private createCertCommands(
    renew: boolean,
    caCertificateExpirationInDays: number,
    nodeCertificateExpirationInDays: number
  ): string {
    const createCaCertificate = renew
      ? `openssl x509 -in ${CertificateService.CA_CERTIFICATE_FILE_NAME} -text -noout`
      : `# CA証明書を生成して自己署名する
    openssl req -config ca.cnf -keyform PEM -key ca.key.pem -new -x509 -days ${caCertificateExpirationInDays} -out ${CertificateService.CA_CERTIFICATE_FILE_NAME} -extensions x509_v3
    openssl x509 -in ${CertificateService.CA_CERTIFICATE_FILE_NAME} -text -noout
    `;
    return `set -e

export OPENSSL_CONF=/usr/lib/ssl/openssl.cnf

# 旧ファイルを掃除する
rm -rf new_certs
rm -f index.txt*

mkdir new_certs
chmod 700 new_certs
touch index.txt.attr
touch index.txt

# CA秘密鍵を生成する
cat ca.der | openssl pkey -inform DER -outform PEM -out ca.key.pem
openssl pkey -inform pem -in ca.key.pem -text -noout
openssl pkey -in ca.key.pem -pubout -out ca.pubkey.pem

${createCaCertificate}

# ノード秘密鍵を生成する
cat node.der | openssl pkey -inform DER -outform PEM -out node.key.pem
openssl pkey -inform pem -in node.key.pem -text -noout

# CSRを生成する
openssl req -config node.cnf -key node.key.pem -new -out node.csr.pem
openssl req -text -noout -verify -in node.csr.pem

### ここからはファイル生成後に実行される
# CA側処理

# ノード証明書へ署名する
openssl ca -batch -config ca.cnf -days ${nodeCertificateExpirationInDays} -notext -in node.csr.pem -out ${CertificateService.NODE_CERTIFICATE_FILE_NAME} -extensions x509_v3_node
openssl verify -CAfile ${CertificateService.CA_CERTIFICATE_FILE_NAME} ${CertificateService.NODE_CERTIFICATE_FILE_NAME}

# 最後にフルチェーン証明書を作成する
cat ${CertificateService.NODE_CERTIFICATE_FILE_NAME} ${CertificateService.CA_CERTIFICATE_FILE_NAME} > node.full.crt.pem

rm createNodeCertificates.sh
rm ca.key.pem
rm ca.der
rm node.der
rm node.csr.pem
rm *.cnf
rm index.txt*
rm serial.dat*
rm -rf new_certs

echo "Certificate Created"
`;
  }

  /**
   * 証明書の有効期限を確認し、警告日数以内に失効するかを返す。
   */
  public async willCertificateExpire(
    symbolServerImage: string,
    certFolder: string,
    certificateFileName: string,
    certificateExpirationWarningInDays: number
  ): Promise<{ willExpire: boolean; expirationDate: string }> {
    const command = `openssl x509 -enddate -noout -in ${certificateFileName} -checkend ${
      certificateExpirationWarningInDays * 24 * 60 * 60
    }`;
    const { stdout, stderr } = await this.runOpenSslCommand(
      symbolServerImage,
      command,
      certFolder,
      true
    );
    const expirationDate = stdout.match('notAfter\\=(.*)\\n')?.[1];
    if (!expirationDate) {
      this.logger.info(Utils.secureString(stdout));
      this.logger.error(Utils.secureString(stderr));
      throw new Error(
        `${certificateFileName} 証明書の有効期限を検証できません。失効日を解決できませんでした。ログを確認してください。`
      );
    }
    if (stdout.includes('Certificate will expire')) {
      return {
        willExpire: true,
        expirationDate: expirationDate,
      };
    }
    if (stdout.includes('Certificate will not expire')) {
      return {
        willExpire: false,
        expirationDate: expirationDate,
      };
    }
    this.logger.info(Utils.secureString(stdout));
    this.logger.error(Utils.secureString(stderr));
    throw new Error(
      `${certificateFileName} 証明書の有効期限を検証できません。ログを確認してください。`
    );
  }

  /**
   * Docker 上で OpenSSL コマンドを実行する。
   */
  private async runOpenSslCommand(
    symbolServerImage: string,
    cmd: string,
    certFolder: string,
    ignoreErrors: boolean
  ): Promise<{
    stdout: string;
    stderr: string;
  }> {
    const binds = [`${resolve(certFolder)}:/data:rw`];
    return this.runtimeService.runImageUsingExec({
      image: symbolServerImage,
      userId: await this.runtimeService.resolveDockerUserFromParam(this.params.user),
      workdir: '/data',
      cmds: cmd.split(' '),
      binds,
      ignoreErrors,
    });
  }

  /**
   * OpenSSL 出力から証明書の秘密鍵/公開鍵を抽出する。
   */
  public static getCertificates(stdout: string): CertificatePair[] {
    const from = 'priv:';
    const middle = 'pub:';
    const to = 'Certificate';

    return this.findAllIndexes(stdout, from).map((index) => {
      const privateKey = this.extractCertificateKey(
        stdout.substring(index + from.length, stdout.indexOf(middle, index))
      );
      const publicKey = this.extractCertificateKey(
        stdout.substring(stdout.indexOf(middle, index) + middle.length, stdout.indexOf(to, index))
      );
      return { privateKey: privateKey, publicKey: publicKey };
    });
  }

  /** 文字列内に含まれる部分文字列の全インデックスを返す。 */
  private static findAllIndexes(text: string, substring: string): number[] {
    const indexes = [];
    let i = -1;
    while ((i = text.indexOf(substring, i + 1)) >= 0) indexes.push(i);
    return indexes;
  }

  /** OpenSSL 出力断片から 64 文字の HEX キーを抽出する。 */
  private static extractCertificateKey(subtext: string): string {
    const key = subtext
      .trim()
      .split(':')
      .map((m) => m.trim())
      .join('');
    if (!key || key.length !== 64) {
      throw Error(
        `SSL Certificate key cannot be loaded from the openssl script. Output: \n${subtext}`
      );
    }
    return key.toUpperCase();
  }

  /**
   * Ed25519 秘密鍵を DER 形式へ変換して保存する。
   */
  public static createDerFile(privateKey: string, file: string): void {
    writeFileSync(file, new SymbolCryptoAdapter().hexToUint8(this.toAns1(privateKey)));
  }

  /**
   * Ed25519 秘密鍵を ASN.1 HEX 文字列へ変換する。
   */
  public static toAns1(privateKey: string): string {
    const prefix = '302e020100300506032b657004220420';
    return `${prefix}${privateKey.toLowerCase()}`;
  }
}
