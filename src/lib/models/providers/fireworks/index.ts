import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import FireworksLLM from './fireworksLLM';

interface FireworksConfig {
  apiKey: string;
}

const defaultChatModels: Model[] = [
  {
    name: 'MiniMax M2.5',
    key: 'accounts/fireworks/models/minimax-m2p5',
  },
  {
    name: 'GPT 04 Mini',
    key: 'accounts/fireworks/models/gpt-oss-120b'
  }
];

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Fireworks AI API key',
    required: true,
    placeholder: 'Fireworks API Key',
    env: 'FIREWORKS_API_KEY',
    scope: 'server',
  },
];

class FireworksProvider extends BaseModelProvider<FireworksConfig> {
  constructor(id: string, name: string, config: FireworksConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    return {
      embedding: [],
      chat: defaultChatModels,
    };
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    return {
      embedding: [
        ...defaultModels.embedding,
        ...configProvider.embeddingModels,
      ],
      chat: [...defaultModels.chat, ...configProvider.chatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Fireworks Chat Model. Invalid Model Selected',
      );
    }

    return new FireworksLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://api.fireworks.ai/inference/v1',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('Fireworks Provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): FireworksConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');

    return {
      apiKey: String(raw.apiKey),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'fireworks',
      name: 'Fireworks',
    };
  }
}

export default FireworksProvider;
