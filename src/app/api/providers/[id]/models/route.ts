import db from '@/lib/db';
import { api } from '../../../../../../convex/_generated/api';
import { Model } from '@/lib/models/types';
import { NextRequest } from 'next/server';

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const body: Partial<Model> & { type: 'embedding' | 'chat' } =
      await req.json();

    if (!body.key || !body.name) {
      return Response.json(
        {
          message: 'Key and name must be provided',
        },
        {
          status: 400,
        },
      );
    }

    await db.mutation(api.providers.addModel, {
      providerId: id,
      type: body.type,
      model: {
        key: body.key,
        name: body.name,
      },
    });

    return Response.json(
      {
        message: 'Model added successfully',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while adding provider model', err);
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

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const body: { key: string; type: 'embedding' | 'chat' } = await req.json();

    if (!body.key) {
      return Response.json(
        {
          message: 'Key and name must be provided',
        },
        {
          status: 400,
        },
      );
    }

    await db.mutation(api.providers.removeModel, {
      providerId: id,
      type: body.type,
      modelKey: body.key,
    });

    return Response.json(
      {
        message: 'Model removed successfully',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while deleting provider model', err);
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