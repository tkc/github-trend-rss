import { Feed } from 'feed';
import { TrendingRepo } from '../types';
import { escapeHtml } from './helpers';
import { logger } from './logger';

/**
 * トレンドリポジトリの情報をRSSフィードに変換する
 */
export function generateRSSFeed(
  repos: TrendingRepo[],
  title: string,
  description: string
): Feed {
  try {
    logger.info(`Generating RSS feed with title: ${title}`);
    const currentDate = new Date();
    const feed = new Feed({
      title,
      description,
      id: 'https://github.com/trending',
      link: 'https://github.com/trending',
      language: 'en',
      favicon: 'https://github.com/favicon.ico',
      copyright: `All rights reserved ${currentDate.getFullYear()}, GitHub`,
      updated: currentDate,
      generator: 'GitHub Trending RSS Generator',
      feedLinks: {
        json: 'https://github.com/trending/feed.json',
        atom: 'https://github.com/trending/feed.atom',
      },
      author: {
        name: 'GitHub Trend RSS Generator',
        email: 'noreply@github.com',
        link: 'https://github.com',
      },
    });

    repos.forEach((repo) => {
      try {
        const itemDate = new Date();

        // 投稿日時を少しずつずらすことで、RSSリーダーが新しい項目を認識しやすくする
        itemDate.setSeconds(itemDate.getSeconds() - repos.indexOf(repo));

        feed.addItem({
          title: repo.name,
          id: repo.url,
          link: repo.url,
          description: repo.description,
          content: `
            <h1><a href="${repo.url}">${repo.name}</a></h1>
            <p>${repo.description}</p>
            <p>Language: ${repo.language || 'Not specified'}</p>
            <p>Stars: ${repo.stars || '0'}</p>
            <p>Forks: ${repo.forks || '0'}</p>
            <p>Stars today: ${repo.todayStars || '0'}</p>
            ${
  repo.readme
    ? `<h2>README</h2><pre>${escapeHtml(repo.readme)}</pre>`
    : ''
}
          `,
          date: itemDate,
          // カテゴリ/タグを追加
          category: repo.language ? [{ name: repo.language }] : [],
        });
      } catch (error: any) {
        logger.error(
          `Error adding item to feed for repo ${repo.name}: ${error.message}`
        );
      }
    });

    return feed;
  } catch (error: any) {
    logger.error(`Error generating RSS feed: ${error.message}`);
    throw error;
  }
}
