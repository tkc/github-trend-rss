import fs from 'fs';
import path from 'path';

// ログレベル設定
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 環境変数でログレベルを設定可能にする
const LOG_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase();

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private logFile: string | null = null;

  constructor() {
    // ログレベルの設定
    this.logLevel =
      LogLevel[LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO;
    this.logDir = 'logs';

    // 環境変数でログファイルの有効/無効を切り替え
    const enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';

    if (enableFileLogging) {
      this.setupLogFile();
    }
  }

  private setupLogFile() {
    try {
      // ログディレクトリが存在しない場合は作成
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // 日付ベースのログファイル名
      const date = new Date().toISOString().split('T')[0];
      this.logFile = path.join(this.logDir, `github-trend-rss_${date}.log`);
    } catch (error) {
      console.error(`Failed to set up log file: ${error}`);
      this.logFile = null;
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private log(level: LogLevel, levelName: string, message: string) {
    // Always log to console for debugging
    const formattedMessage = this.formatMessage(levelName, message);
    
    console.log(formattedMessage);
    
    // Original logic for file logging
    if (level >= this.logLevel) {
      // ファイルへのログ記録
      if (this.logFile) {
        try {
          fs.appendFileSync(this.logFile, formattedMessage + '\n');
        } catch (error) {
          console.error(`Failed to write to log file: ${error}`);
        }
      }
    }
  }

  debug(message: string) {
    this.log(LogLevel.DEBUG, 'DEBUG', message);
  }

  info(message: string) {
    this.log(LogLevel.INFO, 'INFO', message);
  }

  warn(message: string) {
    this.log(LogLevel.WARN, 'WARN', message);
  }

  error(message: string) {
    this.log(LogLevel.ERROR, 'ERROR', message);
  }
}

// シングルトンのロガーインスタンスをエクスポート
export const logger = new Logger();
