import db from '@/lib/db';
import { api } from '../../../../convex/_generated/api';

export const GET = async (req: Request) => {
  try {
    const chats = await db.query(api.chats.list, {});
    return Response.json({ chats: chats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
