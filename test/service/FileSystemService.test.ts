import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { FileSystemService } from '../../src/service/FileSystemService.js';
import { Utils } from '../../src/utils/Utils.js';

/**
 * FileSystemService クラスのユニットテスト。
 * ファイルシステム操作（検証・mkdir・削除・コピー）を検証する。
 * 実際の一時ディレクトリを使用してファイルI/Oをテストする。
 */
describe('FileSystemService', () => {
  const logger = LoggerFactory.getLogger(LogType.Silent);
  let service: FileSystemService;
  let tmpDir: string;

  beforeEach(() => {
    service = new FileSystemService(logger);
    // 各テスト用の一時ディレクトリを作成する
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-test-'));
  });

  afterEach(() => {
    // テスト後に一時ディレクトリを削除する
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('validateFolder', () => {
    it('存在するフォルダーを検証できること', () => {
      expect(() => service.validateFolder(tmpDir)).not.toThrow();
    });

    it('存在しないパスでエラーをスローすること', () => {
      const nonExistent = join(tmpDir, 'nonexistent');

      expect(() => service.validateFolder(nonExistent)).toThrow('フォルダーが存在しません');
    });

    it('ディレクトリでなくファイルを指定した場合にエラーをスローすること', () => {
      const filePath = join(tmpDir, 'test.txt');
      writeFileSync(filePath, 'content');

      expect(() => service.validateFolder(filePath)).toThrow('はフォルダーではありません');
    });
  });

  describe('validateSeedFolder', () => {
    it('必須ファイルが揃ったシードフォルダーを検証できること', () => {
      // 必須ファイルを作成する
      const seedDir = join(tmpDir, 'seed');
      const subDir = join(seedDir, '00000');
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, '00001.dat'), '');
      writeFileSync(join(seedDir, 'index.dat'), '');

      expect(() => service.validateSeedFolder(seedDir, 'メッセージ')).not.toThrow();
    });

    it('00001.dat が欠けている場合に KnownError をスローすること', async () => {
      const { KnownError } = await import('../../src/errors/KnownError.js');
      const seedDir = join(tmpDir, 'seed-missing-dat');
      const subDir = join(seedDir, '00000');
      mkdirSync(subDir, { recursive: true });
      // 00001.dat は作成しない

      expect(() => service.validateSeedFolder(seedDir, 'エラーメッセージ')).toThrow(KnownError);
    });

    it('index.dat が欠けている場合に KnownError をスローすること', async () => {
      const { KnownError } = await import('../../src/errors/KnownError.js');
      const seedDir = join(tmpDir, 'seed-missing-index');
      const subDir = join(seedDir, '00000');
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, '00001.dat'), '');
      // index.dat は作成しない

      expect(() => service.validateSeedFolder(seedDir, 'エラーメッセージ')).toThrow(KnownError);
    });
  });

  describe('deleteFile', () => {
    it('存在するファイルを削除できること', () => {
      const filePath = join(tmpDir, 'toDelete.txt');
      writeFileSync(filePath, 'content');

      service.deleteFile(filePath);

      expect(existsSync(filePath)).toBe(false);
    });

    it('存在しないファイルを指定してもエラーをスローしないこと', () => {
      const nonExistent = join(tmpDir, 'nonexistent.txt');

      expect(() => service.deleteFile(nonExistent)).not.toThrow();
    });

    it('ディレクトリを指定しても削除しないこと', () => {
      const subDir = join(tmpDir, 'subdir');
      mkdirSync(subDir);

      // ディレクトリに対しては何もしない
      service.deleteFile(subDir);

      expect(existsSync(subDir)).toBe(true);
    });
  });

  describe('mkdir', () => {
    it('新しいディレクトリを作成できること', async () => {
      const newDir = join(tmpDir, 'new-dir');

      await service.mkdir(newDir);

      expect(existsSync(newDir)).toBe(true);
    });

    it('既に存在するディレクトリに対してエラーをスローしないこと', async () => {
      await expect(service.mkdir(tmpDir)).resolves.not.toThrow();
    });

    it('ネストしたディレクトリを再帰的に作成できること', async () => {
      const nestedDir = join(tmpDir, 'a', 'b', 'c');

      await service.mkdir(nestedDir);

      expect(existsSync(nestedDir)).toBe(true);
    });
  });

  describe('mkdirParentFolder', () => {
    it('ファイルの親ディレクトリを作成できること', async () => {
      const filePath = join(tmpDir, 'new-dir', 'file.txt');

      await service.mkdirParentFolder(filePath);

      expect(existsSync(join(tmpDir, 'new-dir'))).toBe(true);
    });
  });

  describe('copyDir', () => {
    it('ディレクトリを別の場所にコピーできること', async () => {
      const srcDir = join(tmpDir, 'src');
      const destDir = join(tmpDir, 'dest');
      mkdirSync(srcDir);
      writeFileSync(join(srcDir, 'file1.txt'), 'content1');
      writeFileSync(join(srcDir, 'file2.txt'), 'content2');

      await service.copyDir(srcDir, destDir);

      expect(existsSync(join(destDir, 'file1.txt'))).toBe(true);
      expect(existsSync(join(destDir, 'file2.txt'))).toBe(true);
    });

    it('除外リストのファイルはコピーしないこと', async () => {
      const srcDir = join(tmpDir, 'src-exclude');
      const destDir = join(tmpDir, 'dest-exclude');
      mkdirSync(srcDir);
      writeFileSync(join(srcDir, 'include.txt'), 'content');
      writeFileSync(join(srcDir, 'exclude.txt'), 'content');

      await service.copyDir(srcDir, destDir, ['exclude.txt']);

      expect(existsSync(join(destDir, 'include.txt'))).toBe(true);
      expect(existsSync(join(destDir, 'exclude.txt'))).toBe(false);
    });

    it('サブディレクトリを再帰的にコピーすること', async () => {
      const srcDir = join(tmpDir, 'src-nested');
      const destDir = join(tmpDir, 'dest-nested');
      const subDir = join(srcDir, 'subdir');
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, 'nested.txt'), 'nested content');

      await service.copyDir(srcDir, destDir);

      expect(existsSync(join(destDir, 'subdir', 'nested.txt'))).toBe(true);
    });

    it('許可リストがある場合は含まれるファイルだけコピーすること', async () => {
      const srcDir = join(tmpDir, 'src-include');
      const destDir = join(tmpDir, 'dest-include');
      mkdirSync(srcDir);
      writeFileSync(join(srcDir, 'include.txt'), 'content');
      writeFileSync(join(srcDir, 'skip.txt'), 'content');

      await service.copyDir(srcDir, destDir, [], ['include.txt']);

      expect(existsSync(join(destDir, 'include.txt'))).toBe(true);
      expect(existsSync(join(destDir, 'skip.txt'))).toBe(false);
    });
  });

  describe('deleteFolder', () => {
    it('フォルダーを再帰的に削除できること', () => {
      const dirToDelete = join(tmpDir, 'to-delete');
      mkdirSync(dirToDelete);
      writeFileSync(join(dirToDelete, 'file.txt'), 'content');

      service.deleteFolder(dirToDelete);

      expect(existsSync(dirToDelete)).toBe(false);
    });

    it('ネストしたサブディレクトリも再帰的に削除できること', () => {
      const dirToDelete = join(tmpDir, 'to-delete-nested');
      const nestedDir = join(dirToDelete, 'nested');
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, 'file.txt'), 'content');

      service.deleteFolder(dirToDelete);

      expect(existsSync(dirToDelete)).toBe(false);
    });

    it('存在しないフォルダーを削除してもエラーをスローしないこと', () => {
      const nonExistent = join(tmpDir, 'nonexistent');

      expect(() => service.deleteFolder(nonExistent)).not.toThrow();
    });

    it('除外ファイルを絶対パスで指定した場合、そのファイルは残すこと', () => {
      const dirToDelete = join(tmpDir, 'to-delete-with-exclude');
      mkdirSync(dirToDelete);
      const keepFilePath = join(dirToDelete, 'keep.txt');
      const deleteFilePath = join(dirToDelete, 'delete.txt');
      writeFileSync(keepFilePath, 'keep');
      writeFileSync(deleteFilePath, 'delete');

      // excludeFiles は絶対パスで指定する必要がある（実装は currentPath と比較する）
      service.deleteFolder(dirToDelete, [keepFilePath]);

      // delete.txt は削除されるが keep.txt は残る
      expect(existsSync(deleteFilePath)).toBe(false);
      expect(existsSync(keepFilePath)).toBe(true);
    });
  });

  describe('getFilesRecursively', () => {
    it('サブディレクトリを含むファイル一覧を再帰的に返すこと', () => {
      const rootDir = join(tmpDir, 'files');
      const nestedDir = join(rootDir, 'nested');
      mkdirSync(nestedDir, { recursive: true });
      const file1 = join(rootDir, 'a.txt');
      const file2 = join(nestedDir, 'b.txt');
      writeFileSync(file1, 'a');
      writeFileSync(file2, 'b');

      const result = service.getFilesRecursively(rootDir);

      expect(result.sort()).toEqual([file1, file2].sort());
    });
  });

  describe('target folder helpers', () => {
    it('relative path を返せること', () => {
      expect(service.getTargetFolder('target', false, 'a', 'b')).toBe(join('target', 'a', 'b'));
    });

    it('node / gateway / nemesis / database 配下のパスを返せること', () => {
      expect(service.getTargetNodesFolder('target', false, 'node')).toBe(join('target', 'node'));
      expect(service.getTargetGatewayFolder('target', false, 'gateway')).toContain(
        join('target', 'gateway')
      );
      expect(service.getTargetNemesisFolder('target', false)).toContain(join('target', 'nemesis'));
      expect(service.getTargetDatabasesFolder('target', false, 'db')).toContain(
        join('target', 'database', 'db')
      );
    });
  });

  describe('download', () => {
    it('ローカルファイルをそのまま返すこと', async () => {
      const localFile = join(tmpDir, 'source.txt');
      writeFileSync(localFile, 'content');

      await expect(service.download(localFile, join(tmpDir, 'dest.txt'))).resolves.toEqual({
        downloaded: false,
        fileLocation: localFile,
      });
    });

    it('ローカルファイルが存在しない場合はエラーをスローすること', async () => {
      await expect(
        service.download(join(tmpDir, 'missing.txt'), join(tmpDir, 'dest.txt'))
      ).rejects.toThrow('が存在しません');
    });

    it('HTTP URL の場合はリモートダウンロード処理へ委譲すること', async () => {
      const downloadRemoteFileSpy = vi
        .spyOn(service as any, 'downloadRemoteFile')
        .mockResolvedValue({ downloaded: true, fileLocation: 'dest.txt' });

      const result = await service.download('https://example.com/file.txt', 'dest.txt');

      expect(result).toEqual({ downloaded: true, fileLocation: 'dest.txt' });
      expect(downloadRemoteFileSpy).toHaveBeenCalledWith(
        'https://example.com/file.txt',
        'dest.txt',
        -1
      );
    });

    it('保存先が既にある HTTP URL では既存サイズを渡して委譲すること', async () => {
      const dest = join(tmpDir, 'dest.txt');
      writeFileSync(dest, 'abc');
      const downloadRemoteFileSpy = vi
        .spyOn(service as any, 'downloadRemoteFile')
        .mockResolvedValue({ downloaded: false, fileLocation: dest });

      const result = await service.download('https://example.com/file.txt', dest);

      expect(result).toEqual({ downloaded: false, fileLocation: dest });
      expect(downloadRemoteFileSpy).toHaveBeenCalledWith('https://example.com/file.txt', dest, 3);
    });
  });

  describe('download private helpers', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /**
     * fetch レスポンスのモックを生成するヘルパー。
     */
    const createFetchResponse = (status = 200, contentLength = '0', body = '') => {
      const chunks: Uint8Array[] = body ? [Buffer.from(body)] : [];
      let chunkIndex = 0;
      const reader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIndex < chunks.length) {
            return { done: false, value: chunks[chunkIndex++] };
          }
          return { done: true, value: undefined };
        }),
      };
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Not Found',
        headers: { get: (key: string) => (key === 'content-length' ? contentLength : null) },
        body: { getReader: () => reader },
      };
    };

    it('ダウンロード先が最新ならダウンロードをスキップすること', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse(200, '4')));

      const result = await (service as any).downloadRemoteFile(
        'https://example.com/file.txt',
        'dest.txt',
        4
      );

      expect(result).toEqual({ downloaded: false, fileLocation: 'dest.txt' });
    });

    it('リモートファイルをダウンロードできること', async () => {
      const progressSpy = vi.spyOn(Utils, 'logSameLineMessage').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse(200, '4', 'data')));
      const dest = join(tmpDir, 'downloaded.txt');

      await expect(
        (service as any).downloadRemoteFile('https://example.com/file.txt', dest, -1)
      ).resolves.toEqual({ downloaded: true, fileLocation: dest });
      expect(progressSpy).toHaveBeenCalledWith('100.00% | 4 bytes downloaded out of 4 bytes.');
      expect(statSync(dest).size).toBe(4);
    });

    it('保存先が既に存在する場合は File already exists をスローすること', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse(200, '4')));
      const dest = join(tmpDir, 'existing.txt');
      writeFileSync(dest, 'old');
      // deleteFile をモックして削除を抑制し、EEXIST を再現する
      vi.spyOn(service, 'deleteFile').mockImplementation(() => {});

      await expect(
        (service as any).downloadRemoteFile('https://example.com/file.txt', dest, -1)
      ).rejects.toThrow('ファイルは既に存在します');
    });

    it('HTTP ステータスが 200 以外ならエラーをスローすること', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse(404, '0')));

      await expect(
        (service as any).downloadRemoteFile('https://example.com/file.txt', 'dest.txt', -1)
      ).rejects.toThrow('サーバー応答エラー: 404 Not Found');
    });

    it('進捗表示は total が 0 のとき 0.00% を表示すること', () => {
      const progressSpy = vi.spyOn(Utils, 'logSameLineMessage').mockImplementation(() => {});

      (service as any).logDownloadProgress(10, 0);

      expect(progressSpy).toHaveBeenCalledWith('0.00% | 10 bytes downloaded out of 0 bytes.');
    });
  });

  describe('chmodRecursive', () => {
    it('ファイルとサブディレクトリ配下に chmod を再帰適用すること', async () => {
      const rootDir = join(tmpDir, 'chmod-target');
      const nestedDir = join(rootDir, 'nested');
      const file1 = join(rootDir, 'a.txt');
      const file2 = join(nestedDir, 'b.txt');
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(file1, 'a');
      writeFileSync(file2, 'b');

      await service.chmodRecursive(rootDir, 0o644);

      expect(statSync(file1).mode & 0o777).toBe(0o644);
      expect(statSync(file2).mode & 0o777).toBe(0o644);
    });
  });
});
