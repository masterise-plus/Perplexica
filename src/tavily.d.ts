declare module '@tavily/core' {
  interface TavilyClientOptions {
    apiKey?: string;
  }

  interface TavilyImage {
    url: string;
    description?: string;
  }

  interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    rawContent?: string;
    score: number;
    publishedDate: string;
  }

  interface TavilySearchResponse {
    answer?: string;
    query: string;
    responseTime: number;
    images: TavilyImage[];
    results: TavilySearchResult[];
  }

  interface TavilySearchOptions {
    searchDepth?: 'basic' | 'advanced';
    topic?: 'general' | 'news' | 'finance';
    days?: number;
    maxResults?: number;
    includeImages?: boolean;
    includeImageDescriptions?: boolean;
    includeAnswer?: boolean;
    includeRawContent?: boolean;
    includeDomains?: string[];
    excludeDomains?: string[];
  }

  interface TavilyClient {
    search(query: string, options?: TavilySearchOptions): Promise<TavilySearchResponse>;
  }

  export function tavily(options?: TavilyClientOptions): TavilyClient;
}
