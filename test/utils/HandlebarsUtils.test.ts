import { afterEach, describe, expect, it } from 'vitest';

import { mkdtempSync } from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HandlebarsUtils } from '../../src/utils/HandlebarsUtils.js';

/**
 * HandlebarsUtils クラスのユニットテスト。
 * Handlebars ヘルパー関数とテンプレートレンダリング機能を検証する。
 */
describe('HandlebarsUtils', () => {
  const tempDirs: string[] = [];

  const createTempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'sb-handlebars-test-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fsPromises.rm(dir, { recursive: true, force: true }))
    );
  });

  describe('generateConfiguration', () => {
    it('mustache をレンダリングし、通常ファイルをコピーし、再帰ディレクトリも処理すること', async () => {
      const sourceDir = createTempDir();
      const outputDir = createTempDir();

      await fsPromises.mkdir(join(sourceDir, 'nested'), { recursive: true });
      await fsPromises.writeFile(join(sourceDir, 'plain.txt'), 'RAW_CONTENT', 'utf8');
      await fsPromises.writeFile(
        join(sourceDir, 'template.txt.mustache'),
        'Hello {{name}}',
        'utf8'
      );
      await fsPromises.writeFile(
        join(sourceDir, 'config.json.mustache'),
        '{"name":"{{name}}","value":1}',
        'utf8'
      );
      await fsPromises.writeFile(
        join(sourceDir, 'nested', 'inner.mustache'),
        'Nested {{name}}',
        'utf8'
      );

      await HandlebarsUtils.generateConfiguration({ name: 'Alice' }, sourceDir, outputDir);

      const plain = await fsPromises.readFile(join(outputDir, 'plain.txt'), 'utf8');
      const rendered = await fsPromises.readFile(join(outputDir, 'template.txt'), 'utf8');
      const renderedJson = await fsPromises.readFile(join(outputDir, 'config.json'), 'utf8');
      const nested = await fsPromises.readFile(join(outputDir, 'nested', 'inner'), 'utf8');

      expect(plain).toBe('RAW_CONTENT');
      expect(rendered).toBe('Hello Alice');
      expect(JSON.parse(renderedJson)).toEqual({ name: 'Alice', value: 1 });
      expect(nested).toBe('Nested Alice');

      const mode = (await fsPromises.stat(join(outputDir, 'template.txt'))).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('excludeFiles で除外されたファイルは生成しないこと', async () => {
      const sourceDir = createTempDir();
      const outputDir = createTempDir();

      await fsPromises.writeFile(join(sourceDir, 'skip.txt.mustache'), 'SKIP', 'utf8');
      await fsPromises.writeFile(join(sourceDir, 'keep.txt.mustache'), 'KEEP', 'utf8');

      await HandlebarsUtils.generateConfiguration({}, sourceDir, outputDir, ['skip.txt'], []);

      await expect(fsPromises.readFile(join(outputDir, 'skip.txt'), 'utf8')).rejects.toThrow();
      await expect(fsPromises.readFile(join(outputDir, 'keep.txt'), 'utf8')).resolves.toBe('KEEP');
    });

    it('includeFiles 指定時は許可されたファイルのみ生成すること', async () => {
      const sourceDir = createTempDir();
      const outputDir = createTempDir();

      await fsPromises.writeFile(join(sourceDir, 'allowed.txt.mustache'), 'OK', 'utf8');
      await fsPromises.writeFile(join(sourceDir, 'blocked.txt.mustache'), 'NG', 'utf8');

      await HandlebarsUtils.generateConfiguration({}, sourceDir, outputDir, [], ['allowed.txt']);

      await expect(fsPromises.readFile(join(outputDir, 'allowed.txt'), 'utf8')).resolves.toBe('OK');
      await expect(fsPromises.readFile(join(outputDir, 'blocked.txt'), 'utf8')).rejects.toThrow();
    });
  });

  describe('toAmount', () => {
    it("3桁区切り（'）で整形すること", () => {
      expect(HandlebarsUtils.toAmount(1000000)).toBe("1'000'000");
    });

    it('1000未満は区切りなしで返すこと', () => {
      expect(HandlebarsUtils.toAmount(999)).toBe('999');
    });

    it('文字列入力でも正しく処理すること', () => {
      expect(HandlebarsUtils.toAmount('1000000')).toBe("1'000'000");
    });

    it('すでに区切り文字を含む文字列は正規化すること', () => {
      expect(HandlebarsUtils.toAmount("1'000")).toBe("1'000");
    });

    it('整数でない文字列でエラーをスローすること', () => {
      expect(() => HandlebarsUtils.toAmount('abc')).toThrow("'abc' is not a valid integer");
    });

    it('小数点を含む文字列でエラーをスローすること', () => {
      expect(() => HandlebarsUtils.toAmount('1.5')).toThrow();
    });
  });

  describe('toHex', () => {
    it('16進文字列を 0x プレフィックスと 4桁区切りで整形すること', () => {
      const result = HandlebarsUtils.toHex('DEADBEEF12345678');

      expect(result).toMatch(/^0x/);
      expect(result).toContain("'");
    });

    it('空文字の場合は空文字を返すこと', () => {
      expect(HandlebarsUtils.toHex('')).toBe('');
    });

    it('null/undefined の場合は空文字を返すこと', () => {
      expect(HandlebarsUtils.toHex(null as any)).toBe('');
    });
  });

  describe('toSimpleHex', () => {
    it('0x プレフィックスと区切り文字を除去すること', () => {
      expect(HandlebarsUtils.toSimpleHex("0x1234'5678")).toBe('12345678');
    });

    it('空文字の場合は空文字を返すこと', () => {
      expect(HandlebarsUtils.toSimpleHex('')).toBe('');
    });
  });

  describe('toJson', () => {
    it('オブジェクトをインデント付き JSON 文字列に変換すること', () => {
      const obj = { key: 'value', num: 42 };
      const result = HandlebarsUtils.toJson(obj);

      // インデントが付いた JSON 文字列であること
      expect(result).toContain('\n');
      expect(JSON.parse(result)).toEqual(obj);
    });
  });

  describe('splitCsv', () => {
    it('CSV 文字列を配列に分割すること', () => {
      const result = HandlebarsUtils.splitCsv('a,b,c');

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('前後の空白をトリムすること', () => {
      const result = HandlebarsUtils.splitCsv(' a , b , c ');

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('空要素を除去すること', () => {
      const result = HandlebarsUtils.splitCsv('a,,b');

      expect(result).toEqual(['a', 'b']);
    });

    it('空文字の場合は空配列を返すこと', () => {
      expect(HandlebarsUtils.splitCsv('')).toEqual([]);
    });

    it('null の場合は空配列を返すこと', () => {
      expect(HandlebarsUtils.splitCsv(null as any)).toEqual([]);
    });
  });

  describe('computerMemory', () => {
    it('搭載メモリの指定パーセンテージを返すこと', () => {
      // os.totalmem() に対するパーセンテージを計算するため、正の数であることを確認
      const result = HandlebarsUtils.computerMemory(50);

      expect(result).toBeGreaterThan(0);
    });

    it('0% の場合は 0 を返すこと', () => {
      expect(HandlebarsUtils.computerMemory(0)).toBe(0);
    });
  });

  describe('formatJson', () => {
    it('有効な JSON 文字列を整形すること', () => {
      const input = '{"key":"value","num":42}';
      const result = HandlebarsUtils.formatJson(input);

      expect(JSON.parse(result)).toEqual({ key: 'value', num: 42 });
    });

    it('無効な JSON 文字列でエラーをスローすること', () => {
      expect(() => HandlebarsUtils.formatJson('not json')).toThrow();
    });
  });

  describe('runTemplate', () => {
    it('Handlebars テンプレートを正しくレンダリングすること', () => {
      const template = 'Hello, {{name}}!';
      const context = { name: 'World' };

      const result = HandlebarsUtils.runTemplate(template, context);

      expect(result).toBe('Hello, World!');
    });

    it('未定義変数は空文字として展開すること', () => {
      const template = 'Hello, {{undefinedVar}}!';
      const context = {};

      const result = HandlebarsUtils.runTemplate(template, context);

      expect(result).toBe('Hello, !');
    });

    it('不正なテンプレートでエラーをスローすること', () => {
      // 未閉じのヘルパーは Handlebars がエラーをスローする
      expect(() => HandlebarsUtils.runTemplate('{{#if}}unclosed', {})).toThrow();
    });

    it('toAmount ヘルパーがテンプレート内で使用できること', () => {
      // Handlebars はデフォルトでシングルクォートを HTML エスケープするため、
      // 3 つのブレース {{{ }}} でエスケープを無効化する必要がある
      const template = '{{{toAmount value}}}';
      const context = { value: 1000000 };

      const result = HandlebarsUtils.runTemplate(template, context);

      expect(result).toBe("1'000'000");
    });

    it('toHex ヘルパーがテンプレート内で使用できること', () => {
      const template = '{{toHex hexValue}}';
      const context = { hexValue: 'DEADBEEF' };

      const result = HandlebarsUtils.runTemplate(template, context);

      expect(result).toMatch(/^0x/);
    });

    it('add ヘルパー: 数値同士を加算できること', () => {
      expect(HandlebarsUtils.runTemplate('{{add a b}}', { a: 2, b: 3 })).toBe('5');
    });

    it('add ヘルパー: 文字列同士を連結できること', () => {
      expect(HandlebarsUtils.runTemplate('{{add a b}}', { a: 'ab', b: 'cd' })).toBe('abcd');
    });

    it('add ヘルパー: 型が混在する場合は空文字を返すこと', () => {
      expect(HandlebarsUtils.runTemplate('{{add a b}}', { a: 1, b: 'x' })).toBe('');
    });

    it('minus ヘルパー: 数値同士を減算できること', () => {
      expect(HandlebarsUtils.runTemplate('{{minus a b}}', { a: 5, b: 2 })).toBe('3');
    });

    it('minus ヘルパー: 第一引数が数値でない場合はエラーになること', () => {
      expect(() => HandlebarsUtils.runTemplate('{{minus a b}}', { a: 'x', b: 2 })).toThrow(
        'expected the first argument to be a number'
      );
    });

    it('minus ヘルパー: 第二引数が数値でない場合はエラーになること', () => {
      expect(() => HandlebarsUtils.runTemplate('{{minus a b}}', { a: 2, b: 'x' })).toThrow(
        'expected the second argument to be a number'
      );
    });

    it('splitCsv ヘルパーがテンプレート内で配列展開できること', () => {
      const template = '{{#each (splitCsv csv)}}{{this}} {{/each}}';
      const result = HandlebarsUtils.runTemplate(template, { csv: 'a, b, c' });
      expect(result.trim()).toBe('a b c');
    });

    it('toJson ヘルパーがテンプレート内で使用できること', () => {
      const template = '{{{toJson value}}}';
      const result = HandlebarsUtils.runTemplate(template, { value: { a: 1 } });
      expect(JSON.parse(result)).toEqual({ a: 1 });
    });

    it('computerMemory ヘルパーがテンプレート内で使用できること', () => {
      const template = '{{computerMemory ratio}}';
      const result = Number(HandlebarsUtils.runTemplate(template, { ratio: 50 }));
      expect(result).toBeGreaterThan(0);
    });

    it('toSeconds ヘルパーがテンプレート内で使用できること', () => {
      const template = '{{toSeconds duration}}';
      const result = Number(HandlebarsUtils.runTemplate(template, { duration: '1m' }));
      expect(result).toBe(60);
    });
  });

  describe('toSeconds', () => {
    it('サーバー時間表記を秒に変換すること', () => {
      expect(HandlebarsUtils.toSeconds('10m')).toBe(600);
    });
  });
});
