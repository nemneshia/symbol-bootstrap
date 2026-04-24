/**
 * 既知エラー。致命的でない、ユーザーフレンドリーなエラー処理を行うカスタム例外クラス。
 * この例外が捕捉された場合、スタックトレースを表示せずメッセージのみを出力する。
 */
export class KnownError extends Error {
  public readonly known = true;
}
