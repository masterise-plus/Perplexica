import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Akselia Chat',
  description: 'Akselia is a free AI internet search engine for everyone. Chat with the internet and get instant answers.',
};

const Home = () => {
  return <ChatWindow />;
};

export default Home;
