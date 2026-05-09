import { beforeEach, describe, expect, it, vi } from 'vitest';

const statMock = vi.fn();
const chmodMock = vi.fn();
const readdirMock = vi.fn();
const openMock = vi.fn();

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    stat: statMock,
    chmod: chmodMock,
    readdir: readdirMock,
    open: openMock,
  };
});

describe('FileSystemService private helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chmodRecursive はファイルでもディレクトリでもない場合に何もしないこと', async () => {
    statMock.mockResolvedValue({
      isFile: () => false,
      isDirectory: () => false,
    });

    const { FileSystemService } = await import('../../src/service/FileSystemService.js');
    const service = new FileSystemService({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any);

    await expect(service.chmodRecursive('virtual-path', 0o644)).resolves.toBeUndefined();
    expect(chmodMock).not.toHaveBeenCalled();
    expect(readdirMock).not.toHaveBeenCalled();
  });

  describe('downloadRemoteFile (fetch ベース)', () => {
    it('200 以外のレスポンスで Error をスローすること', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
      );

      const { FileSystemService } = await import('../../src/service/FileSystemService.js');
      const service = new FileSystemService({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as any);
      vi.spyOn(service, 'deleteFile').mockImplementation(() => {});

      await expect(
        (service as any).downloadRemoteFile('https://example.com/file.txt', 'dest.txt', -1)
      ).rejects.toThrow('サーバー応答エラー: 404 Not Found');

      vi.unstubAllGlobals();
    });

    it('書き込み失敗時に fileHandle.close() が呼ばれること', async () => {
      const reader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: Buffer.from('data') })
          .mockRejectedValue(new Error('write failed')),
      };
      const fileHandle = {
        write: vi.fn().mockRejectedValue(new Error('write failed')),
        close: vi.fn().mockResolvedValue(undefined),
      };
      openMock.mockResolvedValue(fileHandle);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => '100' },
          body: { getReader: () => reader },
        })
      );

      const { FileSystemService } = await import('../../src/service/FileSystemService.js');
      const service = new FileSystemService({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as any);
      vi.spyOn(service, 'deleteFile').mockImplementation(() => {});

      await expect(
        (service as any).downloadRemoteFile('https://example.com/file.txt', 'dest.txt', -1)
      ).rejects.toThrow('write failed');
      expect(fileHandle.close).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('サイズが一致する場合はダウンロードをスキップすること', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => '42' },
          body: null,
        })
      );

      const { FileSystemService } = await import('../../src/service/FileSystemService.js');
      const service = new FileSystemService({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as any);

      const result = await (service as any).downloadRemoteFile(
        'https://example.com/file.txt',
        'dest.txt',
        42
      );

      expect(result).toEqual({ downloaded: false, fileLocation: 'dest.txt' });
      expect(openMock).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
