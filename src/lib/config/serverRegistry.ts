import db from '@/lib/db';
import { api } from '../../../convex/_generated/api';
import { ConfigModelProvider } from './types';
import { hashObj } from '../serverUtils';

type ConvexProvider = {
  providerId: string;
  name: string;
  type: string;
  config: Record<string, any>;
  chatModels: {
    name: string;
    key: string;
  }[];
  embeddingModels: {
    name: string;
    key: string;
  }[];
  hash: string;
};

let hasSyncedLegacyProviders = false;

const mapToConfigProvider = (provider: ConvexProvider): ConfigModelProvider => {
  return {
    id: provider.providerId,
    name: provider.name,
    type: provider.type,
    config: provider.config,
    chatModels: provider.chatModels,
    embeddingModels: provider.embeddingModels,
    hash: provider.hash,
  };
};

const syncLegacyProvidersToConvex = async () => {
  if (hasSyncedLegacyProviders) return;

  const existingProviders = await db.query(api.providers.list, {});
  if (existingProviders.length > 0) {
    hasSyncedLegacyProviders = true;
    return;
  }

  const { default: configManager } = require('./index');
  const legacyProviders: ConfigModelProvider[] =
    configManager.getCurrentConfig().modelProviders ?? [];

  if (legacyProviders.length === 0) {
    hasSyncedLegacyProviders = true;
    return;
  }

  for (const provider of legacyProviders) {
    if (!provider.id || !provider.name || !provider.type) continue;

    try {
      await db.mutation(api.providers.create, {
        providerId: provider.id,
        name: provider.name,
        type: provider.type,
        config: provider.config ?? {},
        chatModels: provider.chatModels ?? [],
        embeddingModels: provider.embeddingModels ?? [],
        hash: provider.hash || hashObj(provider.config ?? {}),
      });
    } catch (error) {
      console.error(
        `Failed to migrate provider "${provider.name}" (${provider.id}) to Convex.`,
        error,
      );
    }
  }

  hasSyncedLegacyProviders = true;
};

export const getConfiguredModelProviders = async (): Promise<ConfigModelProvider[]> => {
  await syncLegacyProvidersToConvex();
  const providers = await db.query(api.providers.list, {});

  return providers.map((p: any) => mapToConfigProvider(p));
};

export const getConfiguredModelProviderById = async (
  id: string,
): Promise<ConfigModelProvider | undefined> => {
  await syncLegacyProvidersToConvex();
  const provider = await db.query(api.providers.getById, { providerId: id });

  if (!provider) return undefined;

  return mapToConfigProvider(provider as ConvexProvider);
};

export const getTavilyApiKey = () => {
  // This still uses the config manager for search settings
  // Could be migrated to Convex in the future
  const { default: configManager } = require('./index');
  return configManager.getConfig('search.tavilyApiKey', '');
};
