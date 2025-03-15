import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';

import { TrendingRepo, CLIOptions } from './types';
import {
  fetchGitHubTrending,
  fetchReadme,
  summarizeReadme,
} from './utils/scraper';
import { generateRSSFeed } from './utils/rss';
import {
  loadFromCache,
  saveToCache,
  generateCacheKey,
  loadPromptsFromCSV,
  loadConfig,
} from './utils/helpers';
import { logger } from './utils/logger';

// ソースオプションのインターフェイスを追加
interface SourceOptions extends Partial<CLIOptions> {
  baseUrl?: string;
}

/**
 * 単一のソースからRSSフィードを生成する
 */
export async function processSource(options: SourceOptions = {}) {
  try {
    // デフォルト値とマージ
    const config: CLIOptions = {
      language: options.language || 'python',
      timeRange: options.timeRange || 'daily',
      outputPath: options.outputPath || './github-trending.xml',
      cacheDir: options.cacheDir || './.cache',
      cacheExpiry: options.cacheExpiry || 3600000, // 1時間
      useCache: options.useCache !== undefined ? options.useCache : true,
      maxReadmeLength: options.maxReadmeLength || 20000,
      logLevel: options.logLevel || 'INFO',
      enableFileLogging: options.enableFileLogging || false,
      parallel: options.parallel !== undefined ? options.parallel : true,
      maxParallelRequests: options.maxParallelRequests || 5,
    };

    // デフォルトURLまたはカスタムURL
    const baseUrl = options.baseUrl || 'https://github.com/trending';

    logger.info(
      `Processing source with language=${config.language}, timeRange=${config.timeRange}, baseUrl=${baseUrl}`
    );

    // キャッシュキーを生成
    const cacheKey = generateCacheKey(
      config.language,
      config.timeRange,
      baseUrl
    );

    // キャッシュからデータを取得または新しくスクレイピング
    let repos: TrendingRepo[];
    if (config.useCache) {
      const cachedRepos = loadFromCache(
        cacheKey,
        config.cacheExpiry,
        config.cacheDir
      );
      if (cachedRepos) {
        repos = cachedRepos;
        logger.info(
          `Using cached data for ${config.language} (${config.timeRange})`
        );
      } else {
        repos = await fetchGitHubTrending(
          config.timeRange,
          config.language,
          baseUrl
        );
        saveToCache(cacheKey, repos, config.cacheDir);
      }
    } else {
      repos = await fetchGitHubTrending(
        config.timeRange,
        config.language,
        baseUrl
      );
    }

    logger.info(`Fetched ${repos.length} trending repositories`);

    return { repos, config, baseUrl };
  } catch (error: any) {
    logger.error(`Error processing source: ${error.message}`);
    throw error;
  }
}

/**
 * メイン関数 - GitHub トレンドを取得して RSS に変換
 */
export async function main(options: SourceOptions = {}) {
  try {
    // ログレベルを設定
    process.env.LOG_LEVEL = options.logLevel || 'INFO';
    process.env.ENABLE_FILE_LOGGING = String(
      options.enableFileLogging || false
    );

    // 設定ファイルが指定されている場合は読み込む
    if (options.configPath) {
      logger.info(`Loading config file: ${options.configPath}`);
      const configFile = loadConfig(options.configPath);

      // 各ソースを処理
      const results = [];
      for (const source of configFile.sources) {
        try {
          logger.info(`Processing source: ${source.name}`);
          const sourceOptions: SourceOptions = {
            language: source.language,
            timeRange: source.timeRange,
            outputPath: source.outputPath,
            baseUrl: source.baseUrl,
            ...configFile.global,
            ...options, // CLIオプションは設定ファイルより優先
          };

          const { repos, config, baseUrl } = await processSource(sourceOptions);

          // READMEを並行または連続で取得
          if (config.parallel) {
            logger.info(
              `Fetching READMEs in parallel with max ${config.maxParallelRequests} concurrent requests`
            );
            const limit = pLimit(config.maxParallelRequests);

            const tasks = repos.map((repo, index) =>
              limit(async () => {
                try {
                  logger.info(
                    `[${index + 1}/${repos.length}] Fetching README for ${
                      repo.name
                    }`
                  );
                  const readme = await fetchReadme(repo.name);
                  repos[index].readme = summarizeReadme(
                    readme,
                    config.maxReadmeLength
                  );
                  logger.info(
                    `[${index + 1}/${
                      repos.length
                    }] Successfully fetched README for ${repo.name}`
                  );
                } catch (error) {
                  logger.warn(
                    `[${index + 1}/${repos.length}] Error fetching README for ${
                      repo.name
                    }: ${error}`
                  );
                  repos[index].readme =
                    'README could not be fetched due to an error.';
                }
              })
            );

            await Promise.all(tasks);
          } else {
            logger.info('Fetching READMEs sequentially');
            for (let i = 0; i < repos.length; i++) {
              try {
                logger.info(
                  `[${i + 1}/${repos.length}] Fetching README for ${
                    repos[i].name
                  }`
                );
                const readme = await fetchReadme(repos[i].name);
                repos[i].readme = summarizeReadme(
                  readme,
                  config.maxReadmeLength
                );
                logger.info(
                  `[${i + 1}/${repos.length}] Successfully fetched README for ${
                    repos[i].name
                  }`
                );
              } catch (error) {
                logger.warn(
                  `[${i + 1}/${repos.length}] Error fetching README for ${
                    repos[i].name
                  }: ${error}`
                );
                repos[i].readme =
                  'README could not be fetched due to an error.';
              }
            }
          }

          // タイトルと説明を設定
          const timeRangeText =
            config.timeRange === 'daily'
              ? 'Today'
              : config.timeRange === 'weekly'
                ? 'This Week'
                : 'This Month';
          const languageText = config.language ? ` for ${config.language}` : '';
          const title = `GitHub Trending ${timeRangeText}${languageText} - ${source.name}`;
          const description = `The most popular GitHub repositories ${timeRangeText.toLowerCase()}${languageText}.`;

          // RSS フィードを生成
          const feed = generateRSSFeed(repos, title, description);

          // 出力ディレクトリが存在しない場合は作成
          const outputDir = path.dirname(config.outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            logger.info(`Created output directory: ${outputDir}`);
          }

          // 結果を出力
          const rssContent = feed.rss2();

          // ファイルに保存
          fs.writeFileSync(config.outputPath, rssContent);
          logger.info(`RSS feed saved to ${config.outputPath}`);

          results.push({
            source: source.name,
            feed,
            repos,
            outputPath: config.outputPath,
          });
        } catch (error: any) {
          logger.error(
            `Error processing source ${source.name}: ${error.message}`
          );
          // エラーが発生しても他のソースの処理を続行
        }
      }

      return { sources: results };
    } else {
      // 単一ソースの通常処理
      const { repos, config, baseUrl } = await processSource(options);

      // READMEを並行または連続に取得
      if (config.parallel) {
        logger.info(
          `Fetching READMEs in parallel with max ${config.maxParallelRequests} concurrent requests`
        );
        const limit = pLimit(config.maxParallelRequests);

        const tasks = repos.map((repo, index) =>
          limit(async () => {
            try {
              logger.info(
                `[${index + 1}/${repos.length}] Fetching README for ${
                  repo.name
                }`
              );
              const readme = await fetchReadme(repo.name);
              repos[index].readme = summarizeReadme(
                readme,
                config.maxReadmeLength
              );
              logger.info(
                `[${index + 1}/${
                  repos.length
                }] Successfully fetched README for ${repo.name}`
              );
            } catch (error) {
              logger.warn(
                `[${index + 1}/${repos.length}] Error fetching README for ${
                  repo.name
                }: ${error}`
              );
              repos[index].readme =
                'README could not be fetched due to an error.';
            }
          })
        );

        await Promise.all(tasks);
      } else {
        logger.info('Fetching READMEs sequentially');
        for (let i = 0; i < repos.length; i++) {
          try {
            logger.info(
              `[${i + 1}/${repos.length}] Fetching README for ${repos[i].name}`
            );
            const readme = await fetchReadme(repos[i].name);
            repos[i].readme = summarizeReadme(readme, config.maxReadmeLength);
            logger.info(
              `[${i + 1}/${repos.length}] Successfully fetched README for ${
                repos[i].name
              }`
            );
          } catch (error) {
            logger.warn(
              `[${i + 1}/${repos.length}] Error fetching README for ${
                repos[i].name
              }: ${error}`
            );
            repos[i].readme = 'README could not be fetched due to an error.';
          }
        }
      }

      // タイトルと説明を設定
      const timeRangeText =
        config.timeRange === 'daily'
          ? 'Today'
          : config.timeRange === 'weekly'
            ? 'This Week'
            : 'This Month';
      const languageText = config.language ? ` for ${config.language}` : '';
      const title = `GitHub Trending ${timeRangeText}${languageText}`;
      const description = `The most popular GitHub repositories ${timeRangeText.toLowerCase()}${languageText}.`;

      // RSS フィードを生成
      const feed = generateRSSFeed(repos, title, description);

      // 出力ディレクトリが存在しない場合は作成
      const outputDir = path.dirname(config.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        logger.info(`Created output directory: ${outputDir}`);
      }

      // 結果を出力
      const rssContent = feed.rss2();

      // ファイルに保存
      fs.writeFileSync(config.outputPath, rssContent);
      logger.info(`RSS feed saved to ${config.outputPath}`);

      return {
        feed,
        repos,
        rssContent,
      };
    }
  } catch (error: any) {
    logger.error(`Error in main function: ${error.message}`);
    throw error;
  }
}

// CLI エントリーポイント
if (import.meta.url.startsWith('file:') && Bun.main && import.meta.url.includes(Bun.main)) {
  const program = new Command();

  program
    .name('github-trend-rss')
    .description('Generate RSS feed from GitHub Trending repositories')
    .version('1.0.0')

    .option('-l, --language <language>', 'Programming language', 'python')
    .option(
      '-t, --time-range <timeRange>',
      'Time range (daily, weekly, monthly)',
      'daily'
    )
    .option(
      '-o, --output <path>',
      'Output path for the RSS feed',
      './github-trending.xml'
    )
    .option('--no-cache', 'Disable cache')
    .option('--cache-dir <path>', 'Cache directory', './.cache')
    .option('--cache-expiry <ms>', 'Cache expiry in milliseconds', '3600000')
    .option('--max-readme-length <length>', 'Maximum README length', '20000')
    .option(
      '--log-level <level>',
      'Log level (DEBUG, INFO, WARN, ERROR)',
      'INFO'
    )
    .option('--enable-file-logging', 'Enable file logging')
    .option('--no-parallel', 'Disable parallel README fetching')
    .option(
      '--max-parallel-requests <number>',
      'Maximum number of parallel requests',
      '5'
    )
    .option('--config <path>', 'Path to config file')
    .option('--csv <path>', 'Path to CSV file with prompts')

    .action(async (options) => {
      try {
        console.log("Starting GitHub Trend RSS with options:", JSON.stringify(options, null, 2));
        
        if (options.config) {
          console.log(`Using config file: ${options.config}`);
          await main({ configPath: options.config });
        } else if (options.csv) {
          const prompts = loadPromptsFromCSV(options.csv);
          console.log(`Loaded ${prompts.length} prompts from CSV file`);
          logger.info(`Loaded ${prompts.length} prompts from CSV file`);

          for (let i = 0; i < prompts.length; i++) {
            console.log(
              `Processing prompt ${i + 1}/${prompts.length}: ${
                prompts[i].prompt
              }`
            );
            logger.info(
              `Processing prompt ${i + 1}/${prompts.length}: ${
                prompts[i].prompt
              }`
            );
            // ここにプロンプトを処理するコードを追加
          }
        } else {
          console.log(`Using direct CLI options (language: ${options.language}, timeRange: ${options.timeRange})`);
          await main({
            language: options.language,
            timeRange: options.timeRange,
            outputPath: options.output,
            cacheDir: options.cacheDir,
            cacheExpiry: parseInt(options.cacheExpiry),
            useCache: options.cache,
            maxReadmeLength: parseInt(options.maxReadmeLength),
            logLevel: options.logLevel,
            enableFileLogging: options.enableFileLogging,
            parallel: options.parallel,
            maxParallelRequests: parseInt(options.maxParallelRequests),
          });
        }
        console.log("GitHub Trend RSS completed successfully");
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
