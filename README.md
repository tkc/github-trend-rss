# GitHub Trend RSS 📊 🚀

A tool that converts GitHub Trending repositories into RSS feeds, making it easy to stay updated with the latest trending projects! Built with Bun runtime.

## 🌟 What is this?

This project automatically fetches the trending repositories from GitHub and converts them into RSS feeds. It runs daily via GitHub Actions, ensuring you always have the most current data.

## 🔍 Features

- 🔄 Daily automatic updates via GitHub Actions
- 🗣️ Multi-language support
- 📂 Customizable output paths
- 💾 Caching capabilities for better performance
- 📝 README summary for each repository
- ⚡ Parallel processing

## 📡 Available RSS Feeds

You can subscribe to these RSS feeds in your favorite RSS reader:

- 🐍 **Python**: [https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/python-daily.xml](https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/python-daily.xml)
- 🟨 **JavaScript**: [https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/javascript-daily.xml](https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/javascript-daily.xml)
- 🔷 **TypeScript**: [https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/typescript-daily.xml](https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/typescript-daily.xml)
- 🐹 **Go**: [https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/go-daily.xml](https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/go-daily.xml)
- 🦀 **Rust**: [https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/rust-daily.xml](https://raw.githubusercontent.com/tkc/github-trend-rss/main/rss/rust-daily.xml)

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/tkc/github-trend-rss.git
cd github-trend-rss

# Install dependencies
bun install
```

## 💻 Usage

### Command Line

```bash
# Default (daily trends)
bun start

# Use configuration file to generate multiple feeds
bun start --config config.json
```

### NPM Scripts

```bash
# Daily trends
bun run daily

# Weekly trends
bun run weekly

# Monthly trends
bun run monthly
```

## 📋 Output

When you run the script, RSS feeds will be saved to `github-trending.xml` or the paths specified in your configuration file.

Access http://localhost:3000 in your browser to view the generated RSS feeds interactively.

## 🤖 Automated Updates

This repository includes a GitHub Actions workflow that automatically updates the RSS feeds:

- 🕒 Runs daily at 00:00 UTC (09:00 JST)
- 📊 Generates all feeds defined in `config.json`
- 💾 Automatically commits updated feeds to the repository

You can also manually trigger the workflow from the "Actions" tab in the GitHub repository by clicking the "Run workflow" button on the "Daily GitHub Trending Update" workflow.

## ⚙️ Customization

- 📝 RSS Feed Configuration: Edit the `config.json` file to customize languages, time ranges, and output paths
- 🔧 RSS Generation Logic: Edit the `src/index.ts` file to customize feed content and style
- 🎨 HTML Viewer: Edit the `index.html` file to change the viewer design and layout

## 📜 License

MIT
