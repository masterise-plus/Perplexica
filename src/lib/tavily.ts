import { tavily } from '@tavily/core';
import { getTavilyApiKey } from './config/serverRegistry';

interface TavilySearchOptions {
  topic?: 'general' | 'news' | 'finance';
  includeDomains?: string[];
  excludeDomains?: string[];
  includeImages?: boolean;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

interface TavilySearchResultItem {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

export const searchTavily = async (
  query: string,
  opts?: TavilySearchOptions,
) => {
  const apiKey = getTavilyApiKey();

  const client = tavily({ apiKey });

  const response = await client.search(query, {
    searchDepth: opts?.searchDepth ?? 'basic',
    topic: opts?.topic ?? 'general',
    maxResults: opts?.maxResults ?? 10,
    includeDomains: opts?.includeDomains,
    excludeDomains: opts?.excludeDomains,
    includeImages: opts?.includeImages ?? false,
  });

  const results: TavilySearchResultItem[] = response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));

  // Map Tavily images into results format if available
  if (response.images && response.images.length > 0) {
    response.images.forEach((img) => {
      results.push({
        title: img.description || '',
        url: img.url,
        img_src: img.url,
        content: img.description || '',
      });
    });
  }

  const suggestions: string[] = [];

  return { results, suggestions };
};
