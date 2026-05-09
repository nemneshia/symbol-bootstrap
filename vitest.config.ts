import { defineConfig } from 'vitest/config';

/** ユニットテスト専用の vitest 設定 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    fileParallelism: true,
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      include: ['src/**/*.ts'],
      exclude: [
        // CLI コマンド層（oclif ラッパー）はユニットテスト対象外
        'src/commands/**',
        'src/help.ts',
        // index.ts は re-export のみ
        'src/**/index.ts',
        // ネットワーク・トランザクション SDK（e2e テスト対象）
        'src/sdk/adapters/SymbolNetworkAdapter.ts',
        'src/sdk/adapters/SymbolTransactionAdapter.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
