import { parseHTML } from 'linkedom';
import { TrendingRepo } from '../types';
import { logger } from './logger';

/**
 * GitHub トレンドページから情報を取得する
 */
export async function fetchGitHubTrending(
  timeRange: string = 'daily',
  language: string = 'python',
  baseUrl: string = 'https://github.com/trending'
): Promise<TrendingRepo[]> {
  let url = baseUrl;

  if (language) {
    url += `/${encodeURIComponent(language)}`;
  }

  if (timeRange && ['daily', 'weekly', 'monthly'].includes(timeRange)) {
    url += `?since=${timeRange}`;
  }

  logger.info(`Fetching trending repositories from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GitHub-Trend-RSS-Generator/1.0',
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch GitHub trending page: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();
    return parseTrendingRepos(html);
  } catch (error: any) {
    logger.error(`Error fetching GitHub trending: ${error.message}`);
    throw error;
  }
}

/**
 * HTML から必要な情報を抽出する
 */
export function parseTrendingRepos(html: string): TrendingRepo[] {
  try {
    const { document } = parseHTML(html);
    const repos: TrendingRepo[] = [];

    // リポジトリ一覧を取得
    const repoElements = document.querySelectorAll('article.Box-row');

    if (repoElements.length === 0) {
      logger.warn(
        'No repository elements found in the HTML. The GitHub page structure might have changed.'
      );
    }

    repoElements.forEach((repo) => {
      try {
        // リポジトリ名とURL
        const nameElement = repo.querySelector('h2 a');
        if (!nameElement) return;

        const repoPath = nameElement.getAttribute('href')?.trim();
        if (!repoPath) return;

        const name = repoPath.substring(1); // 先頭の / を削除
        const url = `https://github.com${repoPath}`;

        // 説明
        const descriptionElement = repo.querySelector('p');
        const description = descriptionElement
          ? descriptionElement.textContent?.trim() || ''
          : '';

        // 言語
        const languageElement = repo.querySelector(
          '[itemprop="programmingLanguage"]'
        );
        const language = languageElement
          ? languageElement.textContent?.trim() || ''
          : '';

        // Star 数
        const starsElement = repo.querySelector('a[href$="/stargazers"]');
        const stars = starsElement
          ? starsElement.textContent?.trim() || ''
          : '';

        // Fork 数
        const forksElement = repo.querySelector('a[href$="/forks"]');
        const forks = forksElement
          ? forksElement.textContent?.trim() || ''
          : '';

        // 今日の Star 数
        const todayStarsElement = repo.querySelector(
          '.d-inline-block.float-sm-right'
        );
        const todayStars = todayStarsElement
          ? todayStarsElement.textContent?.trim() || ''
          : '';

        repos.push({
          name,
          url,
          description,
          language,
          stars,
          forks,
          todayStars,
          readme: '', // 初期値は空文字列
        });
      } catch (error: any) {
        logger.warn(`Error parsing repository: ${error.message}`);
      }
    });

    return repos;
  } catch (error: any) {
    logger.error(`Error parsing trending repositories: ${error.message}`);
    throw error;
  }
}

/**
 * リポジトリのREADME内容を取得する
 */
export async function fetchReadme(
  repoName: string,
  maxRetries = 3
): Promise<string> {
  const mainReadmeUrl = `https://raw.githubusercontent.com/${repoName}/main/README.md`;
  const masterReadmeUrl = `https://raw.githubusercontent.com/${repoName}/master/README.md`;

  const fetchWithRetry = async (
    url: string,
    retries: number
  ): Promise<string> => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GitHub-Trend-RSS-Generator/1.0',
        },
      });

      if (response.ok) {
        return await response.text();
      }

      if (retries <= 0) {
        throw new Error(`Failed to fetch README: ${response.status}`);
      }

      // エクスポネンシャルバックオフ
      const delay = Math.pow(2, maxRetries - retries) * 1000;
      logger.warn(`Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return fetchWithRetry(url, retries - 1);
    } catch (error: any) {
      if (retries <= 0) {
        throw error;
      }

      // エクスポネンシャルバックオフ
      const delay = Math.pow(2, maxRetries - retries) * 1000;
      logger.warn(
        `Network error. Retrying in ${delay}ms... (${retries} retries left)`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));

      return fetchWithRetry(url, retries - 1);
    }
  };

  try {
    logger.info(`Fetching README for ${repoName} from main branch`);
    return await fetchWithRetry(mainReadmeUrl, maxRetries);
  } catch (mainError) {
    try {
      logger.info(`Fetching README for ${repoName} from master branch`);
      return await fetchWithRetry(masterReadmeUrl, maxRetries);
    } catch (masterError: any) {
      logger.error(
        `Error fetching README for ${repoName}: ${masterError.message}`
      );
      return 'README not available. Either the repository does not have a README or it could not be accessed.';
    }
  }
}

/**
 * README のサイズが大きすぎる場合に要約する
 * @param readme README の内容
 * @param maxLength 最大文字数
 * @returns 要約された README
 */
export function summarizeReadme(
  readme: string,
  maxLength: number = 10000
): string {
  if (readme.length <= maxLength) {
    return readme;
  }

  // 単純に切り詰めて警告メッセージを追加
  const truncated = readme.substring(0, maxLength);
  return (
    truncated +
    '\n\n... [README content truncated due to size. Visit the repository for the complete README] ...'
  );
}
