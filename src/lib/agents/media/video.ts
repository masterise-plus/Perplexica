import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { searchTavily } from '@/lib/tavily';
import {
  videoSearchFewShots,
  videoSearchPrompt,
} from '@/lib/prompts/media/videos';
import { ChatTurnMessage } from '@/lib/types';
import BaseLLM from '@/lib/models/base/llm';
import z from 'zod';

type VideoSearchChainInput = {
  chatHistory: ChatTurnMessage[];
  query: string;
};

type VideoSearchResult = {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
};

const searchVideos = async (
  input: VideoSearchChainInput,
  llm: BaseLLM<any>,
) => {
  const schema = z.object({
    query: z.string().describe('The video search query.'),
  });

  const res = await llm.generateObject<typeof schema>({
    messages: [
      {
        role: 'system',
        content: videoSearchPrompt,
      },
      ...videoSearchFewShots,
      {
        role: 'user',
        content: `<conversation>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation>\n<follow_up>\n${input.query}\n</follow_up>`,
      },
    ],
    schema: schema,
  });

  const searchRes = await searchTavily(res.query, {
    includeDomains: ['youtube.com'],
  });

  const videos: VideoSearchResult[] = [];

  searchRes.results.forEach((result) => {
    if (result.url && result.title) {
      // Extract YouTube video ID from URL
      const videoIdMatch = result.url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;

      if (videoId) {
        videos.push({
          img_src: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          url: result.url,
          title: result.title,
          iframe_src: `https://www.youtube.com/embed/${videoId}`,
        });
      }
    }
  });

  return videos.slice(0, 10);
};

export default searchVideos;
