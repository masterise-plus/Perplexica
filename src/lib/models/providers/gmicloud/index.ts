import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import GMICloudLLM from './gmicloudLLM';

interface GMICloudConfig {
    apiKey: string;
}

const defaultChatModels: Model[] = [
    {
        name: 'GPT 5.2',
        key: 'openai/gpt-5.2',
    },
];

const providerConfigFields: UIConfigField[] = [
    {
        type: 'password',
        name: 'API Key',
        key: 'apiKey',
        description: 'Your GMICloud API key',
        required: true,
        placeholder: 'GMICloud API Key',
        env: 'GMICLOUD_API_KEY',
        scope: 'server',
    },
];

class GMICloudProvider extends BaseModelProvider<GMICloudConfig> {
    constructor(id: string, name: string, config: GMICloudConfig) {
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
        const configProvider = await getConfiguredModelProviderById(this.id);

        if (!configProvider) {
            return defaultModels;
        }

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
                'Error Loading GMICloud Chat Model. Invalid Model Selected',
            );
        }

        return new GMICloudLLM({
            apiKey: this.config.apiKey,
            model: key,
            baseURL: 'https://api.gmi-serving.com/v1',
        });
    }

    async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
        throw new Error('GMICloud Provider does not support embedding models.');
    }

    static parseAndValidate(raw: any): GMICloudConfig {
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
            key: 'gmicloud',
            name: 'GMICloud',
        };
    }
}

export default GMICloudProvider;
