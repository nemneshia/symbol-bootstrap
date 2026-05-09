import { describe, expect, it } from 'vitest';

import { KnownError } from '../../src/errors/KnownError.js';
import { NetworkType } from '../../src/sdk/types/NetworkType.js';
import { Utils } from '../../src/utils/Utils.js';

/**
 * Utils クラスのユニットテスト。
 * 汎用ユーティリティメソッドの動作を検証する。
 */
describe('Utils', () => {
  describe('secureString', () => {
    it('64文字の16進数をHIDDEN_KEYに置換すること', () => {
      const input =
        '--secret=9F9D35D4BFA630012F074AAE11CF12191105EBA1435036FEF6AFAD8088918A62 --startEpoch=1';
      const result = Utils.secureString(input);

      expect(result).toBe('--secret=HIDDEN_KEY --startEpoch=1');
    });

    it('複数の64文字16進数をすべて置換すること', () => {
      const key1 = '0'.repeat(64);
      const key2 = 'A'.repeat(64);
      const input = `key1=${key1} key2=${key2}`;

      const result = Utils.secureString(input);

      expect(result).toBe('key1=HIDDEN_KEY key2=HIDDEN_KEY');
    });

    it('63文字以下の16進数は置換しないこと', () => {
      const shortHex = 'A'.repeat(63);
      const input = `short=${shortHex}`;

      const result = Utils.secureString(input);

      // 63文字は対象外なので変換されない
      expect(result).toBe(input);
    });

    it('64文字より長い16進数も置換すること', () => {
      const longHex = 'A'.repeat(65);
      const result = Utils.secureString(longHex);

      // 内部の64文字が置換され、残り1文字が残る
      expect(result).toContain('HIDDEN_KEY');
    });

    it('16進数を含まない文字列はそのまま返すこと', () => {
      const input = 'hello world 123';
      const result = Utils.secureString(input);

      expect(result).toBe(input);
    });
  });

  describe('validateIsDefined', () => {
    it('定義済みの値に対してエラーをスローしないこと', () => {
      expect(() => Utils.validateIsDefined('value', 'error')).not.toThrow();
      expect(() => Utils.validateIsDefined(0, 'error')).not.toThrow();
      expect(() => Utils.validateIsDefined(false, 'error')).not.toThrow();
      expect(() => Utils.validateIsDefined({}, 'error')).not.toThrow();
    });

    it('undefined に対してエラーをスローすること', () => {
      expect(() => Utils.validateIsDefined(undefined, 'undefinedエラー')).toThrow(
        'undefinedエラー'
      );
    });

    it('null に対してエラーをスローすること', () => {
      expect(() => Utils.validateIsDefined(null, 'nullエラー')).toThrow('nullエラー');
    });

    it('エラーメッセージが指定したメッセージと一致すること', () => {
      const errorMessage = 'カスタムエラーメッセージ';
      expect(() => Utils.validateIsDefined(undefined, errorMessage)).toThrow(errorMessage);
    });
  });

  describe('validateIsTrue', () => {
    it('true に対してエラーをスローしないこと', () => {
      expect(() => Utils.validateIsTrue(true, 'error')).not.toThrow();
    });

    it('false に対してエラーをスローすること', () => {
      expect(() => Utils.validateIsTrue(false, 'falseエラー')).toThrow('falseエラー');
    });
  });

  describe('validatePassword', () => {
    it('4文字以上のパスワードをそのまま返すこと', () => {
      expect(Utils.validatePassword('abcd')).toBe('abcd');
      expect(Utils.validatePassword('1234567890')).toBe('1234567890');
    });

    it('3文字以下のパスワードで KnownError をスローすること', () => {
      expect(() => Utils.validatePassword('abc')).toThrowError(KnownError);
    });

    it('空文字で KnownError をスローすること', () => {
      expect(() => Utils.validatePassword('')).toThrowError(KnownError);
    });

    it('エラーメッセージに "Password is too short" が含まれること', () => {
      try {
        Utils.validatePassword('abc');
        expect.fail('KnownError がスローされるべきでした');
      } catch (e) {
        expect(Utils.getMessage(e)).toContain('Password is too short');
      }
    });

    it('ちょうど4文字のパスワードは受け入れること', () => {
      expect(Utils.validatePassword('1234')).toBe('1234');
    });
  });

  describe('getNetworkIdentifier', () => {
    it('MAIN_NET で "mainnet" を返すこと', () => {
      expect(Utils.getNetworkIdentifier(NetworkType.MAIN_NET)).toBe('mainnet');
    });

    it('TEST_NET で "testnet" を返すこと', () => {
      expect(Utils.getNetworkIdentifier(NetworkType.TEST_NET)).toBe('testnet');
    });
  });

  describe('getNetworkName', () => {
    it('MAIN_NET で "mainnet" を返すこと', () => {
      expect(Utils.getNetworkName(NetworkType.MAIN_NET)).toBe('mainnet');
    });

    it('TEST_NET で "testnet" を返すこと', () => {
      expect(Utils.getNetworkName(NetworkType.TEST_NET)).toBe('testnet');
    });
  });

  describe('resolveWorkingDirPath', () => {
    it('相対パスを作業ディレクトリと結合すること', () => {
      const result = Utils.resolveWorkingDirPath('/workdir', 'config.yml');

      expect(result).toBe('/workdir/config.yml');
    });

    it('絶対パスはそのまま返すこと', () => {
      const absolutePath = '/etc/config.yml';
      const result = Utils.resolveWorkingDirPath('/workdir', absolutePath);

      expect(result).toBe(absolutePath);
    });
  });

  describe('pruneEmpty', () => {
    it('undefined プロパティを削除すること', () => {
      const obj = { a: 1, b: undefined, c: 'test' };
      const result = Utils.pruneEmpty(obj);

      expect(result).toEqual({ a: 1, c: 'test' });
    });

    it('null プロパティを削除すること', () => {
      const obj = { a: 1, b: null };
      const result = Utils.pruneEmpty(obj);

      expect(result).toEqual({ a: 1 });
    });

    it('空のオブジェクトプロパティを削除すること', () => {
      const obj = { a: 1, b: {} };
      const result = Utils.pruneEmpty(obj);

      expect(result).toEqual({ a: 1 });
    });

    it('空の配列プロパティを削除すること', () => {
      const obj = { a: 1, b: [] };
      const result = Utils.pruneEmpty(obj);

      expect(result).toEqual({ a: 1 });
    });

    it('NaN プロパティを削除すること', () => {
      const obj = { a: 1, b: NaN };
      const result = Utils.pruneEmpty(obj);

      expect(result).toEqual({ a: 1 });
    });

    it('元のオブジェクトを変更しないこと（イミュータブル）', () => {
      const original = { a: 1, b: undefined };
      Utils.pruneEmpty(original);

      // 元オブジェクトは変更されない
      expect(original.b).toBeUndefined();
    });

    it('ネストされたオブジェクトも再帰的に処理すること', () => {
      const obj = { a: { b: undefined, c: 1 } };
      const result = Utils.pruneEmpty(obj);

      expect(result).toEqual({ a: { c: 1 } });
    });
  });

  describe('getMessage', () => {
    it('Error オブジェクトからメッセージを取得すること', () => {
      const error = new Error('テストエラー');
      expect(Utils.getMessage(error)).toBe('テストエラー');
    });

    it('文字列をそのまま返すこと', () => {
      expect(Utils.getMessage('エラー文字列')).toBe('エラー文字列');
    });
  });

  describe('deepMerge', () => {
    it('オブジェクトをディープマージすること', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { d: 3 }, e: 4 };

      const result = Utils.deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
    });

    it('後の引数が前の引数のスカラー値を上書きすること', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 99 };

      const result = Utils.deepMerge(target, source);

      expect(result.b).toBe(99);
    });

    it('元のオブジェクトを変更しないこと', () => {
      const target = { a: 1 };
      const source = { b: 2 };

      Utils.deepMerge(target, source);

      expect((target as any).b).toBeUndefined();
    });

    it('ソースが存在しない場合はターゲットをそのまま返すこと', () => {
      const target = { a: 1 };
      const result = Utils.deepMerge(target);

      expect(result).toEqual({ a: 1 });
    });

    it('undefined の値はマージをスキップすること', () => {
      const target = { a: 1 };
      const source = { a: undefined };

      const result = Utils.deepMerge(target, source);

      // undefined はスキップされるため元の値が保持される
      expect(result.a).toBe(1);
    });
  });

  describe('sampleSize', () => {
    it('指定した件数の要素を返すこと', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = Utils.sampleSize(arr, 3);

      expect(result).toHaveLength(3);
    });

    it('元の配列の要素のみを含むこと', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = Utils.sampleSize(arr, 3);

      result.forEach((item) => expect(arr).toContain(item));
    });

    it('重複要素を含まないこと', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = Utils.sampleSize(arr, 5);

      const unique = new Set(result);
      expect(unique.size).toBe(5);
    });

    it('元の配列を変更しないこと', () => {
      const arr = [1, 2, 3];
      Utils.sampleSize(arr, 2);

      expect(arr).toEqual([1, 2, 3]);
    });

    it('n が配列長より大きい場合、配列全体を返すこと', () => {
      const arr = [1, 2, 3];
      const result = Utils.sampleSize(arr, 10);

      expect(result).toHaveLength(3);
    });
  });

  describe('uniqBy', () => {
    it('キー関数で重複を排除すること', () => {
      const arr = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' },
      ];
      const result = Utils.uniqBy(arr, (item) => item.id);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('重複がない場合は全要素を返すこと', () => {
      const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = Utils.uniqBy(arr, (item) => item.id);

      expect(result).toHaveLength(3);
    });

    it('最初に出現した要素が残ること', () => {
      const arr = [
        { id: 1, name: 'first' },
        { id: 1, name: 'second' },
      ];
      const result = Utils.uniqBy(arr, (item) => item.id);

      expect(result[0].name).toBe('first');
    });
  });

  describe('isWindows', () => {
    it('ブール値を返すこと', () => {
      const result = Utils.isWindows();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isRoot', () => {
    it('ブール値を返すこと', () => {
      const result = Utils.isRoot();
      expect(typeof result).toBe('boolean');
    });
  });
});
