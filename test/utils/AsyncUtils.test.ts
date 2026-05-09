import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogType } from '../../src/logger/LogType.js';
import { LoggerFactory } from '../../src/logger/LoggerFactory.js';
import { AsyncUtils } from '../../src/utils/AsyncUtils.js';

/**
 * AsyncUtils クラスのユニットテスト。
 * sleep・poll などの非同期ユーティリティの動作を検証する。
 */
describe('AsyncUtils', () => {
  const silentLogger = LoggerFactory.getLogger(LogType.Silent);

  beforeEach(() => {
    // 各テスト前に stopProcess フラグをリセットする
    AsyncUtils.stopProcess = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    AsyncUtils.stopProcess = false;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('sleep', () => {
    it('指定ミリ秒後にresolveすること', async () => {
      const sleepPromise = AsyncUtils.sleep(500);

      // 500ms 分のタイマーを進める
      await vi.advanceTimersByTimeAsync(500);

      await expect(sleepPromise).resolves.toBeUndefined();
    });

    it('stopProcess が true の場合は即座にresolveすること', async () => {
      AsyncUtils.stopProcess = true;

      const sleepPromise = AsyncUtils.sleep(10000);

      // タイマーを進めなくても resolve するはず
      await expect(sleepPromise).resolves.toBeUndefined();
    });

    it('sleep 中に stopProcess が true になった場合は早期終了すること', async () => {
      const sleepPromise = AsyncUtils.sleep(10000);

      // 100ms 進めてから stopProcess を立てる
      await vi.advanceTimersByTimeAsync(100);
      AsyncUtils.stopProcess = true;
      await vi.advanceTimersByTimeAsync(100);

      await expect(sleepPromise).resolves.toBeUndefined();
    });
  });

  describe('poll', () => {
    it('最初の呼び出しで true を返した場合、true で解決すること', async () => {
      const promiseFunction = vi.fn().mockResolvedValue(true);

      const result = await AsyncUtils.poll(silentLogger, promiseFunction, 1000, 100);

      expect(result).toBe(true);
      expect(promiseFunction).toHaveBeenCalledTimes(1);
    });

    it('ポーリング時間切れの場合、false を返すこと', async () => {
      // 常に false を返す関数
      const promiseFunction = vi.fn().mockResolvedValue(false);

      // タイマーを自動で進める
      const pollPromise = AsyncUtils.poll(silentLogger, promiseFunction, 50, 50);
      await vi.runAllTimersAsync();

      const result = await pollPromise;
      expect(result).toBe(false);
    });

    it('stopProcess が true の場合はポーリングを中断して false を返すこと', async () => {
      const promiseFunction = vi.fn().mockResolvedValue(false);
      AsyncUtils.stopProcess = true;

      const result = await AsyncUtils.poll(silentLogger, promiseFunction, 10000, 100);

      expect(result).toBe(false);
    });

    it('リトライ後に true を返した場合、true で解決すること', async () => {
      // 最初は false、2回目は true を返す
      const promiseFunction = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const pollPromise = AsyncUtils.poll(silentLogger, promiseFunction, 10000, 100);
      // sleep 分のタイマーを進める
      await vi.runAllTimersAsync();

      const result = await pollPromise;
      expect(result).toBe(true);
    });
  });
});
