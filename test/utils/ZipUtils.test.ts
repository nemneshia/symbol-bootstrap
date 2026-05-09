import * as archiverModule from 'archiver';
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { ZipUtils } from '../../src/utils/ZipUtils.js';

const getZipArchiveMock = () =>
  (archiverModule as unknown as { ZipArchive: ReturnType<typeof vi.fn> }).ZipArchive;

const { createWriteStreamMock } = vi.hoisted(() => ({
  createWriteStreamMock: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    createWriteStream: ((path: any, ...args: any[]) => {
      const text = String(path);
      if (text.endsWith('warn.zip') || text.endsWith('error.zip')) {
        return createWriteStreamMock(path);
      }
      return actual.createWriteStream(path, ...args);
    }) as typeof actual.createWriteStream,
  };
});

/**
 * archiver モジュールを vi.fn でラップし、通常テストは実装を呼び通しつつ
 * エラー系テストで mockImplementationOnce による差し替えを可能にする。
 */
vi.mock('archiver', async (importOriginal) => {
  const mod = await importOriginal<typeof import('archiver')>();
  return {
    ...mod,
    ZipArchive: vi.fn().mockImplementation(function (options: unknown) {
      return new (mod as any).ZipArchive(options);
    }),
  };
});

/**
 * ZipUtils クラスのユニットテスト。
 * 実際のファイルシステムを使用する統合テストと、
 * archiver をモックしたエラー系テストで構成する。
 */
describe('ZipUtils', () => {
  const logger = LoggerFactory.getLogger(LogType.Silent);
  let service: ZipUtils;
  let tmpDir: string;

  beforeEach(() => {
    service = new ZipUtils(logger);
    tmpDir = mkdtempSync(join(tmpdir(), 'sb-zip-test-'));
    createWriteStreamMock.mockImplementation(() => new EventEmitter() as any);
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('zip', () => {
    it('ファイルを含む ZIP を作成できること', async () => {
      // ソースファイルを作成する
      const srcFile = join(tmpDir, 'test.txt');
      writeFileSync(srcFile, 'Hello, World!');

      const zipFile = join(tmpDir, 'output.zip');

      await service.zip(zipFile, [{ from: srcFile, directory: false, to: 'test.txt' }]);

      expect(existsSync(zipFile)).toBe(true);
    });

    it('ディレクトリを含む ZIP を作成できること', async () => {
      // ソースディレクトリを作成する
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir);
      writeFileSync(join(srcDir, 'file1.txt'), 'content1');
      writeFileSync(join(srcDir, 'file2.txt'), 'content2');

      const zipFile = join(tmpDir, 'dir-output.zip');

      await service.zip(zipFile, [{ from: srcDir, directory: true, to: 'src' }]);

      expect(existsSync(zipFile)).toBe(true);
    });

    it('ブラックリストのファイルを除外して ZIP を作成できること', async () => {
      const srcDir = join(tmpDir, 'src-blacklist');
      mkdirSync(srcDir);
      writeFileSync(join(srcDir, 'include.txt'), 'include');
      writeFileSync(join(srcDir, 'exclude.txt'), 'exclude');

      const zipFile = join(tmpDir, 'blacklist-output.zip');

      await service.zip(zipFile, [
        {
          from: srcDir,
          directory: true,
          to: 'src',
          blacklist: ['exclude.txt'],
        },
      ]);

      expect(existsSync(zipFile)).toBe(true);
    });

    it('存在しないファイルの ENOENT 警告は無視して resolve すること', async () => {
      // archiver は ENOENT 警告を発火した後も ZIP 作成を継続する
      const nonExistentFile = join(tmpDir, 'ghost.txt');
      const zipFile = join(tmpDir, 'enoent.zip');

      await expect(
        service.zip(zipFile, [{ from: nonExistentFile, directory: false, to: 'ghost.txt' }])
      ).resolves.toBeUndefined();
    });

    it('非 ENOENT 警告が発生した場合は reject すること', async () => {
      // archiver のモック: finalize() 時に非 ENOENT の warning イベントを発火する
      const fakeArchive = new EventEmitter() as any;
      fakeArchive.pipe = vi.fn();
      fakeArchive.pointer = vi.fn(() => 0);
      fakeArchive.file = vi.fn();
      fakeArchive.directory = vi.fn();
      fakeArchive.finalize = vi.fn(() => {
        const err = Object.assign(new Error('unexpected warning'), { code: 'EACCES', data: {} });
        fakeArchive.emit('warning', err);
      });
      getZipArchiveMock().mockImplementationOnce(function () {
        return fakeArchive as any;
      });

      const srcFile = join(tmpDir, 'a.txt');
      writeFileSync(srcFile, 'x');
      const zipFile = join(tmpDir, 'warn.zip');

      await expect(
        service.zip(zipFile, [{ from: srcFile, directory: false, to: 'a.txt' }])
      ).rejects.toThrow('unexpected warning');
    });

    it('アーカイブエラーが発生した場合は reject すること', async () => {
      // archiver のモック: finalize() 時に error イベントを発火する
      const fakeArchive = new EventEmitter() as any;
      fakeArchive.pipe = vi.fn();
      fakeArchive.pointer = vi.fn(() => 0);
      fakeArchive.file = vi.fn();
      fakeArchive.directory = vi.fn();
      fakeArchive.finalize = vi.fn(() => {
        const err = Object.assign(new Error('archive failure'), { code: 'ERR_ARCHIVE', data: {} });
        fakeArchive.emit('error', err);
      });
      getZipArchiveMock().mockImplementationOnce(function () {
        return fakeArchive as any;
      });

      const srcFile = join(tmpDir, 'b.txt');
      writeFileSync(srcFile, 'y');
      const zipFile = join(tmpDir, 'error.zip');

      await expect(
        service.zip(zipFile, [{ from: srcFile, directory: false, to: 'b.txt' }])
      ).rejects.toThrow('archive failure');
    });
  });

  describe('unzip', () => {
    it('作成した ZIP を解凍できること（ラウンドトリップ）', async () => {
      // まず zip を作成する
      const srcFile = join(tmpDir, 'original.txt');
      writeFileSync(srcFile, 'Original content');
      const zipFile = join(tmpDir, 'roundtrip.zip');

      await service.zip(zipFile, [{ from: srcFile, directory: false, to: 'original.txt' }]);

      // 解凍する
      const destDir = join(tmpDir, 'unzipped');
      mkdirSync(destDir);
      await service.unzip(zipFile, null, destDir);

      expect(existsSync(join(destDir, 'original.txt'))).toBe(true);
    });

    it('ZIP 内のサブフォルダを指定して解凍できること', async () => {
      // サブフォルダ付きの zip を作成する
      const srcDir = join(tmpDir, 'sub');
      mkdirSync(srcDir);
      writeFileSync(join(srcDir, 'nested.txt'), 'nested content');
      const zipFile = join(tmpDir, 'nested.zip');

      await service.zip(zipFile, [{ from: srcDir, directory: true, to: 'sub' }]);

      const destDir = join(tmpDir, 'unzipped-sub');
      mkdirSync(destDir);
      await service.unzip(zipFile, 'sub', destDir);

      expect(existsSync(join(destDir, 'nested.txt'))).toBe(true);
    });

    it('無効な ZIP ファイルを解凍しようとするとエラーになること', async () => {
      const invalidZip = join(tmpDir, 'invalid.zip');
      writeFileSync(invalidZip, 'これは ZIP ではない');

      const destDir = join(tmpDir, 'should-fail');
      mkdirSync(destDir);

      await expect(service.unzip(invalidZip, null, destDir)).rejects.toThrow();
    });
  });
});
