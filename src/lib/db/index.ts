import { ConvexHttpClient } from 'convex/browser';

const db = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default db;
