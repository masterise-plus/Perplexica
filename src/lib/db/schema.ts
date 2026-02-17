/**
 * Database schema type definitions.
 *
 * These types are now used as shared TypeScript interfaces.
 * The actual schema is defined in convex/schema.ts.
 */

import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export interface DBMessage {
  messageId: string;
  chatId: string;
  backendId: string;
  query: string;
  createdAt: string;
  responseBlocks?: Block[];
  status?: 'answering' | 'completed' | 'error';
}

export interface DBFile {
  name: string;
  fileId: string;
}

export interface DBChat {
  chatId: string;
  title: string;
  createdAt: string;
  sources?: SearchSources[];
  files?: DBFile[];
}
