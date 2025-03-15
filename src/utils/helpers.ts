import fs from 'fs';
import path from 'path';
import { TrendingRepo, ConfigFile } from '../types';
import { logger } from './logger';

/**
 * HTML エスケープ用のヘルパー関数
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * キャッシュディレクトリが存在しない場合は作成する
 */
export function ensureCacheDirectory(cacheDir: string = '.cache'): void {
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      logger.info(`Created cache directory: ${cacheDir}`);
    }
  } catch (error: any) {
    logger.warn(`Failed to create cache directory: ${error.message}`);
  }
}

/**
 * JSONデータをキャッシュに保存する
 */
export function saveToCache(
  key: string,
  data: TrendingRepo[],
  cacheDir: string = '.cache'
): void {
  try {
    ensureCacheDirectory(cacheDir);
    const filePath = path.join(cacheDir, `${key}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
    logger.info(`Saved data to cache: ${filePath}`);
  } catch (error: any) {
    logger.warn(`Failed to save to cache: ${error.message}`);
  }
}

/**
 * キャッシュからデータを読み込む
 */
export function loadFromCache(
  key: string,
  maxAge: number = 3600000, // デフォルトは1時間
  cacheDir: string = '.cache'
): TrendingRepo[] | null {
  try {
    const filePath = path.join(cacheDir, `${key}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const cache = JSON.parse(content);

    // キャッシュが古いかチェック
    if (Date.now() - cache.timestamp > maxAge) {
      logger.info(`Cache expired for key: ${key}`);
      return null;
    }

    logger.info(`Loaded data from cache: ${filePath}`);
    return cache.data;
  } catch (error: any) {
    logger.warn(`Failed to load from cache: ${error.message}`);
    return null;
  }
}

/**
 * CSVファイルからプロンプトを読み込む
 */
export function loadPromptsFromCSV(
  filePath: string
): { prompt: string; ref?: string }[] {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');

    // ヘッダー行を取得し、列のインデックスを決定
    const header = lines[0].split(',');
    const promptIndex = header.findIndex(
      (col) => col.trim().toLowerCase() === 'prompt'
    );
    const refIndex = header.findIndex(
      (col) => col.trim().toLowerCase() === 'ref'
    );

    if (promptIndex === -1) {
      throw new Error('CSV file must contain a "prompt" column');
    }

    const prompts = [];

    // ヘッダーをスキップして2行目から処理
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map((col) => col.trim());

      const prompt = columns[promptIndex];
      const ref = refIndex !== -1 ? columns[refIndex] : undefined;

      if (prompt) {
        prompts.push({ prompt, ref });
      }
    }

    logger.info(`Loaded ${prompts.length} prompts from CSV: ${filePath}`);
    return prompts;
  } catch (error: any) {
    logger.error(`Error loading prompts from CSV: ${error.message}`);
    return [];
  }
}

/**
 * キャッシュキーを生成する
 */
export function generateCacheKey(
  language: string,
  timeRange: string,
  baseUrl?: string
): string {
  if (baseUrl) {
    // URLをサニタイズして安全なファイル名にする
    const sanitizedUrl = baseUrl.replace(/[^a-zA-Z0-9]/g, '_');
    return `trending_${language}_${timeRange}_${sanitizedUrl}`;
  }
  return `trending_${language}_${timeRange}`;
}

/**
 * 設定ファイルを読み込む
 */
export function loadConfig(configPath: string): ConfigFile {
  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content) as ConfigFile;

    // 必須フィールドの検証
    if (!config.global) {
      config.global = {
        cacheDir: './.cache',
        cacheExpiry: 3600000,
        useCache: true,
        maxReadmeLength: 20000,
        logLevel: 'INFO',
        enableFileLogging: false,
        parallel: true,
        maxParallelRequests: 5,
      };
    }

    if (!Array.isArray(config.sources) || config.sources.length === 0) {
      throw new Error(
        'Config file must contain at least one source in the "sources" array'
      );
    }

    // 各ソースの必須フィールドを検証
    config.sources.forEach((source, index) => {
      if (!source.name) {
        throw new Error(
          `Source at index ${index} is missing required field 'name'`
        );
      }
      if (source.language === undefined || source.language === null) {
        throw new Error(
          `Source '${source.name}' is missing required field 'language'`
        );
      }
      if (!source.timeRange) {
        throw new Error(
          `Source '${source.name}' is missing required field 'timeRange'`
        );
      }
      if (!source.outputPath) {
        throw new Error(
          `Source '${source.name}' is missing required field 'outputPath'`
        );
      }
    });

    logger.info(
      `Loaded config file: ${configPath} with ${config.sources.length} sources`
    );
    return config;
  } catch (error: any) {
    logger.error(`Error loading config file: ${error.message}`);
    throw error;
  }
}
