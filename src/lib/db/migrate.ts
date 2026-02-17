/**
 * Migration script: SQLite → Convex
 *
 * This script reads existing data from the local SQLite database (if it exists)
 * and inserts it into Convex. Run this once after setting up your Convex project
 * to migrate existing chat history.
 *
 * Usage: npx tsx src/lib/db/migrate.ts
 *
 * Requirements:
 * - NEXT_PUBLIC_CONVEX_URL environment variable must be set
 * - The SQLite database at data/db.sqlite must exist (if migrating data)
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import path from 'path';
import fs from 'fs';

async function migrate() {
  // Load .env.local since this script runs outside Next.js
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
    console.log('Loaded environment variables from .env.local');
  }

  const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!CONVEX_URL) {
    console.error(
      'NEXT_PUBLIC_CONVEX_URL is not set. Please set it in your .env.local file.',
    );
    process.exit(1);
  }

  const DATA_DIR = process.env.DATA_DIR || process.cwd();
  const dbPath = path.join(DATA_DIR, './data/db.sqlite');

  if (!fs.existsSync(dbPath)) {
    console.log('No SQLite database found at', dbPath);
    console.log(
      'Nothing to migrate. Convex is ready to use with a fresh database.',
    );
    return;
  }

  // Dynamically import better-sqlite3 (it may not be installed)
  let Database: any;
  try {
    Database = (await import('better-sqlite3')).default;
  } catch {
    console.log(
      'better-sqlite3 is not installed. Skipping SQLite data migration.',
    );
    return;
  }

  const sqliteDb = new Database(dbPath);
  const convex = new ConvexHttpClient(CONVEX_URL);

  console.log('Starting migration from SQLite to Convex...');

  // Migrate chats
  try {
    const chats = sqliteDb
      .prepare('SELECT id, title, createdAt, sources, files FROM chats')
      .all();

    console.log(`Found ${chats.length} chats to migrate.`);

    for (const chat of chats as any[]) {
      let sources = chat.sources;
      while (typeof sources === 'string') {
        sources = JSON.parse(sources || '[]');
      }

      let files = chat.files;
      while (typeof files === 'string') {
        files = JSON.parse(files || '[]');
      }

      try {
        await convex.mutation(api.chats.create, {
          chatId: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          sources: sources || [],
          files: files || [],
        });
        console.log(`  Migrated chat: ${chat.title}`);
      } catch (err) {
        console.error(`  Failed to migrate chat ${chat.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error reading chats from SQLite:', err);
  }

  // Migrate messages
  try {
    const messages = sqliteDb
      .prepare(
        'SELECT messageId, chatId, backendId, query, createdAt, responseBlocks, status FROM messages',
      )
      .all();

    console.log(`Found ${messages.length} messages to migrate.`);

    for (const msg of messages as any[]) {
      let responseBlocks = msg.responseBlocks;
      while (typeof responseBlocks === 'string') {
        responseBlocks = JSON.parse(responseBlocks || '[]');
      }

      try {
        await convex.mutation(api.messages.create, {
          messageId: msg.messageId,
          chatId: msg.chatId,
          backendId: msg.backendId,
          query: msg.query,
          createdAt: msg.createdAt,
          responseBlocks: responseBlocks || [],
          status: msg.status || 'completed',
        });
        console.log(`  Migrated message: ${msg.messageId}`);
      } catch (err) {
        console.error(
          `  Failed to migrate message ${msg.messageId}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.error('Error reading messages from SQLite:', err);
  }

  console.log('Migration complete!');
  sqliteDb.close();
}

migrate().catch(console.error);
