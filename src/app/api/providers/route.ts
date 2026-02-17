import db from '@/lib/db';
import { api } from '../../../../convex/_generated/api';
import { NextRequest } from 'next/server';
import { hashObj } from '@/lib/serverUtils';

export const dynamic = 'force-dynamic';

export const GET = async (req: Request) => {
  try {
    const providers = await db.query(api.providers.list, {});

    // Transform to match expected format (providerId -> id)
    const filteredProviders = providers
      .filter((p: any) => {
        // Filter out providers with error models
        return !p.chatModels.some((m: any) => m.key === 'error');
      })
      .map((p: any) => ({
        id: p.providerId,
        name: p.name,
        chatModels: p.chatModels,
        embeddingModels: p.embeddingModels,
      }));

    return Response.json(
      {
        providers: filteredProviders,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while fetching providers', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { type, name, config } = body;

    if (!type || !name || !config) {
      return Response.json(
        {
          message: 'Missing required fields.',
        },
        {
          status: 400,
        },
      );
    }

    const providerId = crypto.randomUUID();
    const hash = hashObj(config);

    await db.mutation(api.providers.create, {
      providerId,
      name,
      type,
      config,
      chatModels: [],
      embeddingModels: [],
      hash,
    });

    return Response.json(
      {
        provider: {
          id: providerId,
          name,
          type,
          config,
          chatModels: [],
          embeddingModels: [],
          hash,
        },
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while creating provider', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};
