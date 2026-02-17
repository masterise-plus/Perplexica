import db from '@/lib/db';
import { api } from '../../../../../convex/_generated/api';
import { NextRequest } from 'next/server';
import { hashObj } from '@/lib/serverUtils';

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    if (!id) {
      return Response.json(
        {
          message: 'Provider ID is required.',
        },
        {
          status: 400,
        },
      );
    }

    await db.mutation(api.providers.deleteById, { providerId: id });

    return Response.json(
      {
        message: 'Provider deleted successfully.',
      },
      {
        status: 200,
      },
    );
  } catch (err: any) {
    console.error('An error occurred while deleting provider', err.message);
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

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const body = await req.json();
    const { name, config } = body;
    const { id } = await params;

    if (!id || !name || !config) {
      return Response.json(
        {
          message: 'Missing required fields.',
        },
        {
          status: 400,
        },
      );
    }

    const hash = hashObj(config);

    const updatedProvider = await db.mutation(api.providers.update, {
      providerId: id,
      name,
      config,
      hash,
    });

    return Response.json(
      {
        provider: {
          id: updatedProvider.providerId,
          name: updatedProvider.name,
          type: updatedProvider.type,
          config: updatedProvider.config,
          chatModels: updatedProvider.chatModels,
          embeddingModels: updatedProvider.embeddingModels,
          hash: updatedProvider.hash,
        },
      },
      {
        status: 200,
      },
    );
  } catch (err: any) {
    console.error('An error occurred while updating provider', err.message);
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