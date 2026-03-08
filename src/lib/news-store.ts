// ═══════════════════════════════════════════════════════════════
// Civic Social — News Store (Server-Side)
// ═══════════════════════════════════════════════════════════════
//
// Stores news articles fetched from external sources (RSS feeds).
// Falls back to seed data when no external sources are available.
//
// Uses Symbol.for on global for HMR persistence in dev.
// ═══════════════════════════════════════════════════════════════

import { mockNewsArticles, type MockNewsArticle } from './data/mock-data';

// ─── Types ───────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceDomain: string;
  publishedAt: string; // ISO string
  imageUrl?: string;
  topics: string[];
  factCheckStatus: 'VERIFIED' | 'UNCHECKED' | 'DISPUTED' | 'PARTIALLY_TRUE';
  sourceTrustScore: number;
  discussionCount: number;
}

// ─── Credible source registry ────────────────────────────────

interface SourceConfig {
  name: string;
  domain: string;
  trustScore: number;
  rssUrl: string;
  topics: string[];
}

// Curated list of credible, neutral-to-balanced political news sources
const CREDIBLE_SOURCES: SourceConfig[] = [
  {
    name: 'Associated Press',
    domain: 'apnews.com',
    trustScore: 0.92,
    rssUrl: 'https://rsshub.app/apnews/topics/politics',
    topics: ['politics', 'legislation'],
  },
  {
    name: 'Reuters',
    domain: 'reuters.com',
    trustScore: 0.94,
    rssUrl: 'https://www.reutersagency.com/feed/?best-topics=political-general',
    topics: ['politics', 'global'],
  },
  {
    name: 'NPR',
    domain: 'npr.org',
    trustScore: 0.88,
    rssUrl: 'https://feeds.npr.org/1014/rss.xml',
    topics: ['politics', 'policy'],
  },
  {
    name: 'PBS NewsHour',
    domain: 'pbs.org',
    trustScore: 0.90,
    rssUrl: 'https://www.pbs.org/newshour/feeds/rss/politics',
    topics: ['politics', 'policy'],
  },
  {
    name: 'BBC News',
    domain: 'bbc.com',
    trustScore: 0.90,
    rssUrl: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
    topics: ['politics', 'global'],
  },
];

// ─── Global store ────────────────────────────────────────────

const STORE_KEY = Symbol.for('civic.news.store');

interface NewsStore {
  articles: NewsArticle[];
  lastFetchedAt: number;
  initialized: boolean;
}

interface GlobalWithStore {
  [key: symbol]: NewsStore | undefined;
}

function getStore(): NewsStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY] || !g[STORE_KEY]!.initialized) {
    g[STORE_KEY] = {
      articles: seedFromMockData(),
      lastFetchedAt: 0,
      initialized: true,
    };
  }
  return g[STORE_KEY]!;
}

function seedFromMockData(): NewsArticle[] {
  return mockNewsArticles.map((m: MockNewsArticle) => ({
    id: m.id,
    title: m.title,
    summary: m.summary,
    url: m.url,
    source: m.source,
    sourceDomain: m.sourceDomain,
    publishedAt: m.publishedAt.toISOString(),
    imageUrl: m.imageUrl,
    topics: m.topics,
    factCheckStatus: m.factCheckStatus,
    sourceTrustScore: m.sourceTrustScore,
    discussionCount: m.discussionCount,
  }));
}

// ─── Public API ──────────────────────────────────────────────

export function getAllNews(limit = 50): NewsArticle[] {
  const store = getStore();
  return store.articles.slice(0, limit);
}

export function getNewsById(id: string): NewsArticle | null {
  return getStore().articles.find((a) => a.id === id) ?? null;
}

export function getNewsByTopic(topic: string, limit = 20): NewsArticle[] {
  return getStore()
    .articles.filter((a) => a.topics.some((t) => t.toLowerCase() === topic.toLowerCase()))
    .slice(0, limit);
}

// ─── RSS fetcher ─────────────────────────────────────────────

const FETCH_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch fresh articles from RSS feeds of credible sources.
 * Respects a cooldown so we don't spam external services.
 * Returns the number of new articles added.
 */
export async function refreshNews(): Promise<{ added: number; errors: string[] }> {
  const store = getStore();
  const now = Date.now();

  if (now - store.lastFetchedAt < FETCH_COOLDOWN_MS) {
    return { added: 0, errors: [] };
  }

  store.lastFetchedAt = now;
  let added = 0;
  const errors: string[] = [];
  const existingUrls = new Set(store.articles.map((a) => a.url));

  for (const source of CREDIBLE_SOURCES) {
    try {
      const articles = await fetchRssFeed(source);
      for (const article of articles) {
        if (!existingUrls.has(article.url)) {
          store.articles.unshift(article);
          existingUrls.add(article.url);
          added++;
        }
      }
    } catch (err) {
      errors.push(`${source.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Sort by publishedAt descending
  store.articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Keep only the most recent 200 articles
  if (store.articles.length > 200) {
    store.articles = store.articles.slice(0, 200);
  }

  return { added, errors };
}

async function fetchRssFeed(source: SourceConfig): Promise<NewsArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(source.rssUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CivicSocial/1.0 (News Aggregator)' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const xml = await res.text();
    return parseRssXml(xml, source);
  } finally {
    clearTimeout(timeout);
  }
}

function parseRssXml(xml: string, source: SourceConfig): NewsArticle[] {
  const articles: NewsArticle[] = [];

  // Simple XML parsing for RSS <item> elements
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (!title || !link) continue;

    // Validate URL — skip articles with malformed or non-HTTP URLs
    const trimmedLink = link.trim();
    try {
      const parsed = new URL(trimmedLink);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
    } catch {
      continue;
    }

    // Clean HTML from description
    const cleanSummary = (description || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim()
      .slice(0, 500);

    // Detect topics from title + description
    const detectedTopics = detectTopics(title + ' ' + cleanSummary, source.topics);

    articles.push({
      id: `news-${Buffer.from(trimmedLink).toString('base64url').slice(0, 16)}-${Date.now().toString(36).slice(-4)}`,
      title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
      summary: cleanSummary || `Read the full article from ${source.name}.`,
      url: trimmedLink,
      source: source.name,
      sourceDomain: source.domain,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      topics: detectedTopics,
      factCheckStatus: 'UNCHECKED',
      sourceTrustScore: source.trustScore,
      discussionCount: 0,
    });
  }

  return articles.slice(0, 10); // Max 10 per source per fetch
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1];

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

// ─── Topic detection ─────────────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'healthcare': ['health', 'medicare', 'medicaid', 'hospital', 'insurance', 'medical', 'vaccine', 'pandemic'],
  'economy': ['economy', 'economic', 'jobs', 'unemployment', 'inflation', 'gdp', 'recession', 'trade', 'tariff'],
  'climate': ['climate', 'environment', 'carbon', 'emissions', 'renewable', 'fossil', 'green', 'sustainability'],
  'immigration': ['immigration', 'immigrant', 'border', 'asylum', 'refugee', 'visa', 'deportation', 'migrant'],
  'education': ['education', 'school', 'student', 'university', 'college', 'teacher', 'curriculum'],
  'elections': ['election', 'vote', 'voter', 'ballot', 'campaign', 'poll', 'primary', 'caucus', 'candidate'],
  'legislation': ['bill', 'law', 'congress', 'senate', 'house', 'legislation', 'bipartisan', 'filibuster'],
  'supreme-court': ['supreme court', 'scotus', 'justice', 'ruling', 'constitutional'],
  'defense': ['military', 'defense', 'pentagon', 'nato', 'troops', 'war', 'security'],
  'technology': ['tech', 'technology', 'ai', 'artificial intelligence', 'social media', 'privacy', 'data'],
  'criminal-justice': ['crime', 'police', 'prison', 'incarceration', 'reform', 'justice'],
  'housing': ['housing', 'rent', 'mortgage', 'homelessness', 'affordable'],
  'taxation': ['tax', 'taxes', 'irs', 'revenue', 'fiscal'],
};

function detectTopics(text: string, defaultTopics: string[]): string[] {
  const lower = text.toLowerCase();
  const detected: string[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      detected.push(topic);
    }
  }

  if (detected.length === 0) return defaultTopics.slice(0, 3);
  return detected.slice(0, 5);
}

export { CREDIBLE_SOURCES };
