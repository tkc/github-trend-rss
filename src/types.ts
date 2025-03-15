/**
 * トレンドリポジトリの情報を表す型
 */
export interface TrendingRepo {
  name: string;
  url: string;
  description: string;
  language: string;
  stars: string;
  forks: string;
  todayStars: string;
  readme: string;
}

/**
 * コマンドラインオプションの型
 */
export interface CLIOptions {
  language: string;
  timeRange: string;
  outputPath: string;
  cacheDir: string;
  cacheExpiry: number;
  useCache: boolean;
  maxReadmeLength: number;
  logLevel: string;
  enableFileLogging: boolean;
  parallel: boolean;
  maxParallelRequests: number;
  configPath?: string;
}

/**
 * プロンプト情報
 */
export interface PromptInfo {
  prompt: string;
  ref?: string;
}

/**
 * GitHub トレンドソース設定
 */
export interface TrendSource {
  name: string; // ソースの名前
  language: string; // プログラミング言語
  timeRange: string; // 時間範囲 (daily, weekly, monthly)
  outputPath: string; // 出力先パス
  baseUrl?: string; // デフォルト以外のURLを使用する場合
}

/**
 * 設定ファイル
 */
export interface ConfigFile {
  global: {
    cacheDir: string;
    cacheExpiry: number;
    useCache: boolean;
    maxReadmeLength: number;
    logLevel: string;
    enableFileLogging: boolean;
    parallel: boolean;
    maxParallelRequests: number;
  };
  sources: TrendSource[];
}
