import configManager from '@/lib/config';
import { NextRequest, NextResponse } from 'next/server';
import { getConfiguredModelProviders } from '@/lib/config/serverRegistry';

export const dynamic = 'force-dynamic';

type SaveConfigBody = {
  key: string;
  value: string;
};

export const GET = async (req: NextRequest) => {
  try {
    const values = configManager.getCurrentConfig();
    const fields = configManager.getUIConfigSections();
    values.modelProviders = await getConfiguredModelProviders();

    return NextResponse.json({
      values,
      fields,
    });
  } catch (err) {
    console.error('Error in getting config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const body: SaveConfigBody = await req.json();

    if (!body.key || !body.value) {
      return Response.json(
        {
          message: 'Key and value are required.',
        },
        {
          status: 400,
        },
      );
    }

    configManager.updateConfig(body.key, body.value);

    return Response.json(
      {
        message: 'Config updated successfully.',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('Error in getting config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
