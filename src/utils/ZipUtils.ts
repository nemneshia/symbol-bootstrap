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
import * as archiverModule from 'archiver';
import { Archiver, ArchiverError } from 'archiver';
import StreamZip from 'node-stream-zip';

import { WriteStream, createWriteStream } from 'node:fs';

import { Logger } from '../logger/index.js';
import { Utils } from './Utils.js';

/** ZIP 圧縮/解凍操作の対象アイテムを表すインターフェース */
export interface ZipItem {
  from: string;
  directory: boolean;
  to: string;
  blacklist?: string[];
}

type ZipArchiveConstructor = new (options: unknown) => Archiver;
const ZipArchive = (archiverModule as unknown as { ZipArchive: ZipArchiveConstructor }).ZipArchive;
const zipCompressionLevel = 9;

/**
 * ZIP ファイルの圧縮・解凍を担当するユーティリティクラス。
 */
export class ZipUtils {
  constructor(private readonly logger: Logger) {}

  /**
   * 指定したアイテムを ZIP ファイルに圧縮する。
   *
   * @param destination 出力先の ZIP ファイルパス
   * @param items 圧縮対象アイテムのリスト
   */
  public async zip(destination: string, items: ZipItem[]): Promise<void> {
    const output = createWriteStream(destination);
    const archive = new ZipArchive({ zlib: { level: zipCompressionLevel } });
    archive.pipe(output);
    this.addItemsToArchive(archive, items);
    this.registerProgressHandler(archive);
    return this.waitForArchiveCompletion(archive, output, destination);
  }

  /**
   * アーカイブにアイテムを追加し、進捗イベントハンドラを設定する。
   *
   * @param archive アーカイブインスタンス
   * @param items 追加対象アイテムのリスト
   */
  private addItemsToArchive(archive: Archiver, items: ZipItem[]): void {
    for (const item of items) {
      if (item.directory) {
        archive.directory(item.from, item.to, (entry) =>
          this.shouldSkipEntry(item.blacklist, entry.name) ? false : entry
        );
      } else {
        archive.file(item.from, { name: item.to });
      }
    }
  }

  /**
   * 進捗ログを 1 行更新で出力するハンドラを登録する。
   */
  private registerProgressHandler(archive: Archiver): void {
    archive.on('progress', (progress) => {
      Utils.logSameLineMessage(`${progress.entries.processed} entries zipped!`);
    });
  }

  /**
   * ZIP 化対象から除外すべきエントリーかを判定する。
   */
  private shouldSkipEntry(blacklist: string[] | undefined, entryName: string): boolean {
    return blacklist?.includes(entryName) ?? false;
  }

  /**
   * アーカイブ完了・警告・エラーイベントを監視し、完了時に resolve する Promise を返す。
   * 内部で `archive.finalize()` を呼び出す。
   *
   * @param archive アーカイブインスタンス
   * @param output 出力ストリーム
   * @param destination 出力先の ZIP ファイルパス
   */
  private waitForArchiveCompletion(
    archive: Archiver,
    output: WriteStream,
    destination: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      output.on('close', () => {
        this.logger.info('');
        this.logger.info(
          `ZIP ファイル '${destination}' (${Math.floor(archive.pointer() / 1024)} KB) を作成しました。`
        );
        resolve();
      });

      archive.on('warning', (err: ArchiverError) => {
        if (err.code === 'ENOENT') {
          // ファイルが見つからない場合は警告ログを出すが処理は続行する
          this.logger.info(`ZIP 作成の警告 '${destination}': ${err.message}`);
        } else {
          reject(err);
        }
      });

      archive.on('error', (err: ArchiverError) => {
        this.logger.info(`ZIP 作成のエラー '${destination}': ${err.message}`);
        reject(err);
      });

      archive.finalize();
    });
  }

  /**
   * ZIP ファイルを解凍する。
   *
   * @param zipFile 解凍元の ZIP ファイルパス
   * @param innerFolder ZIP 内の解凍対象フォルダ（`null` の場合はルート全体）
   * @param targetFolder 解凍先のディレクトリパス
   */
  public async unzip(
    zipFile: string,
    innerFolder: string | null,
    targetFolder: string
  ): Promise<void> {
    const zip = new StreamZip.async({ file: zipFile });
    this.logger.info(
      `'${innerFolder ?? 'ROOT'}' を '${targetFolder}' へ解凍中... しばらくお待ちください。`
    );
    try {
      await zip.extract(innerFolder, targetFolder);
      this.logger.info(`'${targetFolder}' への解凍が完了しました。`);
    } finally {
      await zip.close();
    }
  }
}
