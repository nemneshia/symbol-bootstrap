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
import { createDecipheriv, pbkdf2Sync } from 'crypto';

import { KnownError } from '../errors/KnownError.js';
import { PrivateKeySecurityMode } from '../model/index.js';
import { SymbolCryptoAdapter } from '../sdk/index.js';

const _cryptoAdapter = new SymbolCryptoAdapter();

/**
 * 秘密鍵の暗号化・復号化・セキュリティモード管理を担当するユーティリティクラス。
 * encrypt / decrypt / encryptedCount の再帰トラバーサルは traverseAndTransform に集約している。
 */
export class CryptoUtils {
  /** 旧形式の暗号化プレフィックス */
  private static readonly ENCRYPT_PREFIX = 'ENCRYPTED:';
  /** 新形式 V2 の暗号化プレフィックス */
  private static readonly ENCRYPT_PREFIX_V2 = 'ENCRYPTED_V2:';
  /** 暗号化対象フィールド名のリスト */
  private static readonly ENCRYPTABLE_KEYS = [
    'privateKey',
    'restSSLKeyBase64',
    'privateFileContent',
  ];

  /**
   * 値を再帰的にトラバースし、暗号化可能フィールドを暗号化する。
   */
  public static encrypt(value: any, password: string, fieldName?: string): any {
    return CryptoUtils.traverseAndTransform(
      value,
      (v, fn) => {
        if (CryptoUtils.isEncryptableKeyField(v, fn)) {
          return CryptoUtils.ENCRYPT_PREFIX_V2 + _cryptoAdapter.encrypt(v, password);
        }
        return v;
      },
      fieldName
    );
  }

  /**
   * セキュリティモード文字列を PrivateKeySecurityMode 列挙型に変換する。
   */
  public static getPrivateKeySecurityMode(value: string | undefined): PrivateKeySecurityMode {
    if (!value) {
      return PrivateKeySecurityMode.ENCRYPT;
    }
    const securityModes = Object.values(PrivateKeySecurityMode) as PrivateKeySecurityMode[];
    const securityMode = securityModes.find((p) => p.toLowerCase() == value.toLowerCase());
    if (securityMode) {
      return securityMode;
    }
    throw new KnownError(
      `${value} は有効な Security Mode ではありません。次のいずれかを指定してください: ${securityModes.join(', ')}`
    );
  }

  /**
   * セキュリティモードに応じて、対象の秘密鍵フィールドを削除する。
   */
  public static removePrivateKeysAccordingToSecurityMode(
    value: any,
    securityMode: PrivateKeySecurityMode
  ): any {
    if (securityMode === PrivateKeySecurityMode.PROMPT_MAIN) {
      return this.removePrivateKeys(value, ['main', 'voting']);
    }
    if (securityMode === PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT) {
      return this.removePrivateKeys(value, ['main', 'transport', 'voting']);
    }
    if (securityMode === PrivateKeySecurityMode.PROMPT_ALL) {
      return this.removePrivateKeys(value);
    }
    return this.removePrivateKeys(value, ['voting']);
  }

  /**
   * 指定されたブラックリスト名に応じて、対象の秘密鍵フィールドを値から削除する。
   */
  public static removePrivateKeys(value: any, blacklistNames: string[] = []): any {
    if (!value) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.removePrivateKeys(v, blacklistNames));
    }

    if (typeof value === 'object' && value !== null) {
      // ブラックリストに当てはまる秘密鍵フィールドを除外してからマップする
      const filtered = Object.fromEntries(
        Object.entries(value).filter(([name, v]) => {
          const isBlacklisted =
            !blacklistNames.length ||
            blacklistNames.find(
              (blacklistName) => name.toLowerCase().indexOf(blacklistName.toLowerCase()) > -1
            );
          return !isBlacklisted || !this.isEncryptableKeyField(v, name);
        })
      );
      return Object.fromEntries(
        Object.entries(filtered).map(([name, v]) => {
          const isBlacklisted =
            !blacklistNames.length ||
            blacklistNames.find(
              (blacklistName) => name.toLowerCase().indexOf(blacklistName.toLowerCase()) > -1
            );
          return [name, CryptoUtils.removePrivateKeys(v, isBlacklisted ? [] : blacklistNames)];
        })
      );
    }
    return value;
  }

  /**
   * 値を再帰的にトラバースし、暗号化済みフィールドを復号化する。
   * レガシー形式（ENCRYPTED:）と新形式（ENCRYPTED_V2:）の両方に対応する。
   */
  public static decrypt(value: any, password: string, fieldName?: string): any {
    return CryptoUtils.traverseAndTransform(
      value,
      (v, fn) => {
        if (!CryptoUtils.isEncryptableKeyField(v, fn)) return v;
        if (v.startsWith(CryptoUtils.ENCRYPT_PREFIX_V2)) {
          // 新形式（ENCRYPTED_V2:）: Crypto.decrypt を使用—曖昧性なし
          const encryptedValue = v.substring(CryptoUtils.ENCRYPT_PREFIX_V2.length);
          try {
            const decryptedValue = _cryptoAdapter.decrypt(encryptedValue, password);
            if (!decryptedValue) throw new Error();
            return decryptedValue;
          } catch {
            throw Error('値を復号できませんでした。');
          }
        }
        if (v.startsWith(CryptoUtils.ENCRYPT_PREFIX)) {
          // 旧プレフィックス（ENCRYPTED:）: まずレガシー形式（PBKDF2-SHA1 + AES-256-CBC）を試みる
          // 正しくないキーでも1/256の確率でPKCS7パディングチェックをパスする可能性があるため
          // Crypto.decrypt より先にレガシー形式を試みる
          const encryptedValue = v.substring(CryptoUtils.ENCRYPT_PREFIX.length);
          try {
            const decryptedValue = CryptoUtils.decryptLegacy(encryptedValue, password);
            if (decryptedValue) {
              CryptoUtils._legacyUpgradeDetected = true;
              return decryptedValue;
            }
          } catch {
            // レガシー形式でない— Crypto.decrypt をフォールバック
          }
          // フォールバック: 旧 CryptoUtils 形式（_cryptoAdapter.encrypt で保存された ENCRYPTED: プレフィックス）
          try {
            const decryptedValue = _cryptoAdapter.decrypt(encryptedValue, password);
            if (decryptedValue) {
              CryptoUtils._legacyUpgradeDetected = true;
              return decryptedValue;
            }
          } catch {
            // fall through
          }
          throw Error('値を復号できませんでした。');
        }
        return v;
      },
      fieldName
    );
  }

  /**
   * 復号化し、レガシー暗号化が使われていたかの情報も返す。
   * ファイルを強化暗号化で保存し直す必要があるかどうかの判定に利用される。
   */
  public static decryptWithUpgradeInfo(
    value: any,
    password: string,
    fieldName?: string
  ): { data: any; hasLegacyUpgrade: boolean } {
    CryptoUtils._legacyUpgradeDetected = false;
    const data = this.decrypt(value, password, fieldName);
    return { data, hasLegacyUpgrade: CryptoUtils._legacyUpgradeDetected };
  }

  /** レガシー暗号化が検出されたかを示すフラグ（decrypt() によって更新される） */
  private static _legacyUpgradeDetected = false;

  /**
   * 値内の暗号化済みフィールド数をカウントする。
   */
  public static encryptedCount(value: any, fieldName?: string): number {
    if (!value) {
      return 0;
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.encryptedCount(v)).reduce((a, b) => a + b, 0);
    }

    if (typeof value === 'object' && value !== null) {
      return Object.entries(value)
        .map(([fn, v]) => this.encryptedCount(v, fn))
        .reduce((a, b) => a + b, 0);
    }
    if (
      this.isEncryptableKeyField(value, fieldName) &&
      (value.startsWith(CryptoUtils.ENCRYPT_PREFIX) ||
        value.startsWith(CryptoUtils.ENCRYPT_PREFIX_V2))
    ) {
      return 1;
    }
    return 0;
  }

  /**
   * 値が暗号化対象フィールドかどうかを判定する内部ヘルパー。
   */
  private static isEncryptableKeyField(value: any, fieldName: string | undefined) {
    return (
      typeof value === 'string' &&
      fieldName &&
      CryptoUtils.ENCRYPTABLE_KEYS.some((key) =>
        fieldName.toLowerCase().endsWith(key.toLowerCase())
      )
    );
  }

  /**
   * 値を再帰的にトラバースし、変換関数を葉ノード（非配列・非オブジェクト）に対して適用する内部メソッド。
   * encrypt / decrypt の共通トラバーサルロジックを担当する。
   * 配列要素はフィールド名なしで再帰処理し、オブジェクトは各プロパティ名をフィールド名として渡す。
   */
  private static traverseAndTransform(
    value: any,
    transform: (v: any, fieldName?: string) => any,
    fieldName?: string
  ): any {
    if (!value) return value;
    if (Array.isArray(value)) {
      // 配列要素はフィールド名なしで再帰処理
      return value.map((v) => CryptoUtils.traverseAndTransform(v, transform));
    }
    if (typeof value === 'object' && value !== null) {
      // オブジェクトは各プロパティ名をフィールド名として再帰処理
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          CryptoUtils.traverseAndTransform(v, transform, k),
        ])
      );
    }
    // 葉ノード: 変換関数を適用する
    return transform(value, fieldName);
  }

  /**
   * crypto-js 4.1.1 相当のレガシー復号化ロジック（PBKDF2-SHA1, iterations=1024, keySize=32, AES-256-CBC, PKCS7）。
   * 入力フォーマット: salt(16バイト hex) + iv(16バイト hex) + ciphertext(base64)
   */
  private static decryptLegacy(data: string, password: string): string {
    if (!data || data.length < 64) {
      throw new Error('暗号化ペイロードが不正です。');
    }
    const saltHex = data.substring(0, 32);
    const ivHex = data.substring(32, 64);
    const ciphertextBase64 = data.substring(64);

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const key = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, 1024, 32, 'sha1');

    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertextBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
