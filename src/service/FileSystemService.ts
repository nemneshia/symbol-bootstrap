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
import { existsSync, lstatSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { chmod, copyFile, mkdir as mkdirAsync, open, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { Constants } from '../utils/Constants.js';
import { Utils } from '../utils/Utils.js';

/**
 * ファイルシステム操作をまとめたサービス。
 * 設定生成時に使用するフォルダー検証、コピー、削除、ダウンロードなどを担当する。
 */
export class FileSystemService {
  /**
   * @param logger ログ出力インターフェース
   */
  constructor(private readonly logger: Logger) {}

  /**
   * 指定パスが存在するフォルダーかを検証する。
   */
  public validateFolder(workingDirFullPath: string): void {
    if (!existsSync(workingDirFullPath)) {
      throw new Error(`${workingDirFullPath} フォルダーが存在しません`);
    }
    if (!lstatSync(workingDirFullPath).isDirectory()) {
      throw new Error(`${workingDirFullPath} はフォルダーではありません`);
    }
  }

  /**
   * seed フォルダー配下の必須ファイルを検証する。
   */
  public validateSeedFolder(nemesisSeedFolder: string, message: string): void {
    this.validateFolder(nemesisSeedFolder);

    const seedData = join(nemesisSeedFolder, '00000', '00001.dat');
    if (!existsSync(seedData)) {
      throw new KnownError(`ファイル ${seedData} が存在しません。${message}`);
    }

    const seedIndex = join(nemesisSeedFolder, 'index.dat');
    if (!existsSync(seedIndex)) {
      throw new KnownError(`ファイル ${seedIndex} が存在しません。${message}`);
    }
  }

  /**
   * ファイルが存在する場合のみ削除する。
   */
  public deleteFile(file: string): void {
    if (existsSync(file) && lstatSync(file).isFile()) {
      unlinkSync(file);
    }
  }

  /**
   * フォルダーを再帰的に作成する。
   */
  public async mkdir(path: string): Promise<void> {
    await mkdirAsync(path, { recursive: true });
  }

  /**
   * 指定ファイルの親フォルダーを作成する。
   */
  public async mkdirParentFolder(fileName: string): Promise<void> {
    const parentFolder = dirname(fileName);
    if (parentFolder) {
      await this.mkdir(parentFolder);
    }
  }

  /**
   * ディレクトリーを再帰的にコピーする。
   * `excludeFiles` は除外、`includeFiles` は許可リストとして扱う。
   */
  public async copyDir(
    copyFrom: string,
    copyTo: string,
    excludeFiles: string[] = [],
    includeFiles: string[] = []
  ): Promise<void> {
    await this.mkdir(copyTo);
    const entries = await readdir(copyFrom, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const fromPath = join(copyFrom, entry.name);
        const toPath = join(copyTo, entry.name);

        if (entry.isDirectory()) {
          await this.copyDir(fromPath, toPath, excludeFiles, includeFiles);
          return;
        }

        if (!entry.isFile() || !this.shouldCopyEntry(entry.name, excludeFiles, includeFiles)) {
          return;
        }

        await copyFile(fromPath, toPath);
      })
    );
  }

  /**
   * フォルダーを再帰削除する。
   */
  public deleteFolder(folder: string, excludeFiles: string[] = []): void {
    if (existsSync(folder)) {
      this.logger.info(`フォルダーを削除します: ${folder}`);
    }
    this.deleteFolderRecursive(folder, new Set(excludeFiles));
  }

  /**
   * `excludePaths` に含まれる絶対パスを残し、それ以外を再帰削除する。
   */
  private deleteFolderRecursive(folder: string, excludePaths: Set<string>): void {
    if (!existsSync(folder)) {
      return;
    }

    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const currentPath = join(folder, entry.name);
      if (excludePaths.has(currentPath)) {
        this.logger.info(`ファイル ${currentPath} は削除対象から除外しました。`);
        continue;
      }

      if (entry.isDirectory()) {
        this.deleteFolderRecursive(currentPath, excludePaths);
        continue;
      }

      if (entry.isFile()) {
        unlinkSync(currentPath);
      }
    }

    // excludePaths に残留ファイルがある場合はフォルダーが空にならないため削除しない
    if (!readdirSync(folder).length) {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  /**
   * 指定フォルダー配下のファイルを再帰的に収集する。
   */
  public getFilesRecursively(originalPath: string): string[] {
    const files: string[] = [];
    this.collectFilesRecursively(originalPath, files);
    return files;
  }

  /**
   * ファイルを再帰的に収集して `acc` に追加する。
   *
   * @param dirPath 探索対象ディレクトリパス
   * @param acc 収集先配列
   */
  private collectFilesRecursively(dirPath: string, acc: string[]): void {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const currentPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        this.collectFilesRecursively(currentPath, acc);
      } else if (entry.isFile()) {
        acc.push(currentPath);
      }
    }
  }

  /**
   * `target` 配下の基準パスを返す。
   */
  public getTargetFolder(target: string, absolute: boolean, ...paths: string[]): string {
    return absolute ? join(process.cwd(), target, ...paths) : join(target, ...paths);
  }

  /** ノード配下パスを返す。 */
  public getTargetNodesFolder(target: string, absolute: boolean, ...paths: string[]): string {
    return this.getTargetFolder(target, absolute, ...paths);
  }

  /** ゲートウェイ配下パスを返す。 */
  public getTargetGatewayFolder(target: string, absolute: boolean, ...paths: string[]): string {
    return this.getTargetFolder(target, absolute, ...paths);
  }

  /** Nemesis 配下パスを返す。 */
  public getTargetNemesisFolder(target: string, absolute: boolean, ...paths: string[]): string {
    return this.getTargetFolder(target, absolute, Constants.targetNemesisFolder, ...paths);
  }

  /** データベース配下パスを返す。 */
  public getTargetDatabasesFolder(target: string, absolute: boolean, ...paths: string[]): string {
    return this.getTargetFolder(target, absolute, Constants.targetDatabasesFolder, ...paths);
  }

  /**
   * URL（http/https またはローカルファイル）からファイルを解決する。
   */
  public async download(
    url: string,
    dest: string
  ): Promise<{
    downloaded: boolean;
    fileLocation: string;
  }> {
    const isHttpRequest =
      url.toLowerCase().startsWith('https:') || url.toLowerCase().startsWith('http:');

    if (!isHttpRequest) {
      return this.resolveLocalFile(url);
    }

    const destinationSize = this.resolveDestinationSize(dest);
    this.logger.info(`リモートファイルを確認中: ${url}`);
    return this.downloadRemoteFile(url, dest, destinationSize);
  }

  /**
   * 保存先ファイルが存在する場合はそのサイズを返し、存在しない場合は `-1` を返す。
   *
   * @param dest 保存先ファイルパス
   * @returns ファイルサイズ（バイト）または `-1`
   */
  private resolveDestinationSize(dest: string): number {
    return existsSync(dest) ? statSync(dest).size : -1;
  }

  /**
   * ファイルまたはフォルダー配下に対して再帰的に chmod を適用する。
   */
  public async chmodRecursive(path: string, mode: string | number): Promise<void> {
    const info = await stat(path);
    if (info.isFile()) {
      await chmod(path, mode);
      return;
    }

    if (!info.isDirectory()) {
      return;
    }

    const entries = await readdir(path, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => this.chmodRecursive(join(path, entry.name), mode))
    );
  }

  /**
   * ローカルファイルをダウンロード結果形式へ正規化して返す。
   *
   * @param filePath ローカルファイルパス
   * @returns ダウンロード不要の結果
   */
  private resolveLocalFile(filePath: string): { downloaded: false; fileLocation: string } {
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      throw new Error(`ローカルファイル ${filePath} が存在しません`);
    }
    return {
      downloaded: false,
      fileLocation: filePath,
    };
  }

  /**
   * エントリー名がコピー対象かどうかを判定する。
   *
   * @param entryName コピー対象のエントリー名
   * @param excludeFiles 除外ファイル名一覧
   * @param includeFiles 許可ファイル名一覧
   * @returns コピー対象の場合は `true`
   */
  private shouldCopyEntry(
    entryName: string,
    excludeFiles: string[],
    includeFiles: string[]
  ): boolean {
    const isExcluded = excludeFiles.includes(entryName);
    const isIncluded = includeFiles.length === 0 || includeFiles.includes(entryName);
    return !isExcluded && isIncluded;
  }

  /**
   * HTTP(S) URL からファイルをダウンロードする。
   *
   * 既存ファイルとサイズが同じ場合はダウンロードをスキップする。
   * Node.js 20+ の組み込み `fetch` API と `fs/promises` の `open` を使用して
   * ストリーミング書き込みを行う。
   *
   * @param url ダウンロード元 URL
   * @param dest 保存先ファイルパス
   * @param destinationSize 既存保存先ファイルサイズ。未存在時は `-1`
   * @returns ダウンロード結果
   */
  private async downloadRemoteFile(
    url: string,
    dest: string,
    destinationSize: number
  ): Promise<{ downloaded: boolean; fileLocation: string }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`サーバー応答エラー: ${response.status} ${response.statusText || ''}`.trim());
    }

    const total = parseInt(response.headers.get('content-length') ?? '0', 10);
    if (total === destinationSize) {
      this.logger.info(`ファイル ${dest} は ${url} と同じ内容のため、ダウンロードは不要です。`);
      return { downloaded: false, fileLocation: dest };
    }

    this.deleteFile(dest);
    this.logger.info(`ファイルをダウンロード中: ${url}。しばらく時間がかかる場合があります。`);

    let received = 0;
    let fileHandle: import('node:fs/promises').FileHandle | undefined;
    try {
      fileHandle = await open(dest, 'wx');
      const reader = response.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await fileHandle.write(value);
        received += value.length;
        this.logDownloadProgress(received, total);
      }
      return { downloaded: true, fileLocation: dest };
    } catch (error) {
      this.deleteFile(dest);
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === 'EEXIST'
      ) {
        throw new Error('ファイルは既に存在します', { cause: error });
      }
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      await fileHandle?.close();
    }
  }

  /**
   * ダウンロード進捗を 1 行で表示する。
   *
   * @param received 受信済みバイト数
   * @param total 総バイト数
   */
  private logDownloadProgress(received: number, total: number): void {
    const percentage = total > 0 ? ((received * 100) / total).toFixed(2) : '0.00';
    const message = `${percentage}% | ${received} bytes downloaded out of ${total} bytes.`;
    Utils.logSameLineMessage(message);
  }
}
