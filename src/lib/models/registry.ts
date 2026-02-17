import db from '@/lib/db';
import { api } from '../../../convex/_generated/api';
import { ConfigModelProvider } from '../config/types';
import BaseModelProvider, { createProviderInstance } from './base/provider';
import { getConfiguredModelProviders } from '../config/serverRegistry';
import { hashObj } from '../serverUtils';
import { providers } from './providers';
import { MinimalProvider, Model, ModelList } from './types';

type ActiveProvider = ConfigModelProvider & {
  provider: BaseModelProvider<any>;
};

class ModelRegistry {
  private activeProviders: ActiveProvider[] = [];
  private readonly initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.initializeActiveProviders();
  }

  private async initializeActiveProviders() {
    const configuredProviders = await getConfiguredModelProviders();
    const initializedProviders: ActiveProvider[] = [];

    configuredProviders.forEach((p) => {
      try {
        const provider = providers[p.type];
        if (!provider) throw new Error('Invalid provider type');

        initializedProviders.push({
          ...p,
          provider: createProviderInstance(provider, p.id, p.name, p.config),
        });
      } catch (err) {
        console.error(
          `Failed to initialize provider. Type: ${p.type}, ID: ${p.id}, Config: ${JSON.stringify(p.config)}, Error: ${err}`,
        );
      }
    });

    this.activeProviders = initializedProviders;
  }

  private async ensureInitialized() {
    await this.initializationPromise;
  }

  async getActiveProviders() {
    await this.ensureInitialized();
    const activeProviders: MinimalProvider[] = [];

    await Promise.all(
      this.activeProviders.map(async (p) => {
        let m: ModelList = { chat: [], embedding: [] };

        try {
          m = await p.provider.getModelList();
        } catch (err: any) {
          console.error(
            `Failed to get model list. Type: ${p.type}, ID: ${p.id}, Error: ${err.message}`,
          );

          m = {
            chat: [
              {
                key: 'error',
                name: err.message,
              },
            ],
            embedding: [],
          };
        }

        activeProviders.push({
          id: p.id,
          name: p.name,
          chatModels: m.chat,
          embeddingModels: m.embedding,
        });
      }),
    );

    return activeProviders;
  }

  async loadChatModel(providerId: string, modelName: string) {
    await this.ensureInitialized();
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) throw new Error('Invalid provider id');

    const model = await provider.provider.loadChatModel(modelName);

    return model;
  }

  async loadEmbeddingModel(providerId: string, modelName: string) {
    await this.ensureInitialized();
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) throw new Error('Invalid provider id');

    const model = await provider.provider.loadEmbeddingModel(modelName);

    return model;
  }

  async addProvider(
    type: string,
    name: string,
    config: Record<string, any>,
  ): Promise<ConfigModelProvider> {
    await this.ensureInitialized();
    const provider = providers[type];
    if (!provider) throw new Error('Invalid provider type');

    const newProvider: ConfigModelProvider = {
      id: crypto.randomUUID(),
      name,
      type,
      config,
      chatModels: [],
      embeddingModels: [],
      hash: hashObj(config),
    };

    await db.mutation(api.providers.create, {
      providerId: newProvider.id,
      name: newProvider.name,
      type: newProvider.type,
      config: newProvider.config,
      chatModels: [],
      embeddingModels: [],
      hash: newProvider.hash,
    });

    const instance = createProviderInstance(
      provider,
      newProvider.id,
      newProvider.name,
      newProvider.config,
    );

    this.activeProviders.push({
      ...newProvider,
      provider: instance,
    });

    return newProvider;
  }

  async removeProvider(providerId: string): Promise<void> {
    await this.ensureInitialized();
    await db.mutation(api.providers.deleteById, { providerId });

    this.activeProviders = this.activeProviders.filter(
      (p) => p.id !== providerId,
    );

    return;
  }

  async updateProvider(
    providerId: string,
    name: string,
    config: any,
  ): Promise<ConfigModelProvider> {
    await this.ensureInitialized();

    const updated = await db.mutation(api.providers.update, {
      providerId,
      name,
      config,
      hash: hashObj(config),
    });

    const updatedProvider: ConfigModelProvider = {
      id: updated.providerId,
      name: updated.name,
      type: updated.type,
      config: updated.config,
      chatModels: updated.chatModels,
      embeddingModels: updated.embeddingModels,
      hash: updated.hash,
    };

    const providerConstructor = providers[updatedProvider.type];
    if (!providerConstructor) throw new Error('Invalid provider type');

    const instance = createProviderInstance(
      providerConstructor,
      providerId,
      name,
      config,
    );

    let replaced = false;
    this.activeProviders = this.activeProviders.map((provider) => {
      if (provider.id !== providerId) return provider;
      replaced = true;
      return {
        ...updatedProvider,
        provider: instance,
      };
    });

    if (!replaced) {
      this.activeProviders.push({
        ...updatedProvider,
        provider: instance,
      });
    }

    return updatedProvider;
  }

  /* Using async here because maybe in the future we might want to add some validation?? */
  async addProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    model: Model & { type?: 'embedding' | 'chat' },
  ): Promise<any> {
    await this.ensureInitialized();

    const addedModel = {
      name: model.name,
      key: model.key,
    };

    await db.mutation(api.providers.addModel, {
      providerId,
      type,
      model: addedModel,
    });

    this.activeProviders = this.activeProviders.map((provider) => {
      if (provider.id !== providerId) return provider;

      if (type === 'chat') {
        return {
          ...provider,
          chatModels: [...provider.chatModels, addedModel],
        };
      }

      return {
        ...provider,
        embeddingModels: [...provider.embeddingModels, addedModel],
      };
    });

    return addedModel;
  }

  async removeProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    modelKey: string,
  ): Promise<void> {
    await this.ensureInitialized();

    await db.mutation(api.providers.removeModel, {
      providerId,
      type,
      modelKey,
    });

    this.activeProviders = this.activeProviders.map((provider) => {
      if (provider.id !== providerId) return provider;

      if (type === 'chat') {
        return {
          ...provider,
          chatModels: provider.chatModels.filter((m) => m.key !== modelKey),
        };
      }

      return {
        ...provider,
        embeddingModels: provider.embeddingModels.filter(
          (m) => m.key !== modelKey,
        ),
      };
    });

    return;
  }
}

export default ModelRegistry;
