import * as net from 'net';
import { describe, expect, it } from 'vitest';

import { PortUtils } from '../../src/utils/PortUtils.js';

/**
 * PortUtils クラスのユニットテスト。
 * 実際のローカル TCP サーバーを使用して接続チェックを検証する。
 */
describe('PortUtils', () => {
  describe('isReachable', () => {
    it('稼働中のポートへの接続は true を返すこと', async () => {
      // 一時的なローカルサーバーを起動する
      const server = net.createServer();
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as net.AddressInfo;

      try {
        const result = await PortUtils.isReachable(port, '127.0.0.1');
        expect(result).toBe(true);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('閉じているポートへの接続は false を返すこと', async () => {
      // 閉じているポートに接続する（非常に短いタイムアウト）
      const result = await PortUtils.isReachable(1, '127.0.0.1', 200);

      expect(result).toBe(false);
    });

    it('到達不能なホストへの接続は false を返すこと', async () => {
      // 到達不能なアドレス（タイムアウト）
      const result = await PortUtils.isReachable(9999, '192.0.2.1', 200);

      expect(result).toBe(false);
    });
  });
});
