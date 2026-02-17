import db from '@/lib/db';
import { api } from '../../../../../convex/_generated/api';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query(api.chats.getById, {
      chatId: id,
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const chatMessages = await db.query(api.messages.getByChatId, {
      chatId: id,
    });

    const mappedChat = {
      id: chatExists.chatId,
      title: chatExists.title,
      createdAt: chatExists.createdAt,
      sources: chatExists.sources ?? [],
      files: chatExists.files ?? [],
    };

    const mappedMessages = chatMessages.map((msg: any) => ({
      messageId: msg.messageId,
      chatId: msg.chatId,
      backendId: msg.backendId,
      query: msg.query,
      createdAt: msg.createdAt,
      responseBlocks: msg.responseBlocks ?? [],
      status: msg.status ?? 'completed',
    }));

    return Response.json(
      {
        chat: mappedChat,
        messages: mappedMessages,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query(api.chats.getById, {
      chatId: id,
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    await db.mutation(api.chats.deleteById, { chatId: id });

    return Response.json(
      { message: 'Chat deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
