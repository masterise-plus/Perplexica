import db from '@/lib/db';
import { api } from '../../../../convex/_generated/api';

export const GET = async (req: Request) => {
  try {
    const chats = await db.query(api.chats.list, {});

    // Deduplicate by chatId to prevent React "duplicate key" warnings
    const seen = new Set<string>();
    const mappedChats = chats
      .map((chat: any) => ({
        id: chat.chatId,
        title: chat.title,
        createdAt: chat.createdAt,
        sources: chat.sources ?? [],
        files: chat.files ?? [],
      }))
      .filter((chat: any) => {
        if (seen.has(chat.id)) return false;
        seen.add(chat.id);
        return true;
      });

    return Response.json({ chats: mappedChats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
