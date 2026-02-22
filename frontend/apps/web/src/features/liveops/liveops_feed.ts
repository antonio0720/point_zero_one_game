/**
 * LiveOpsFeedService - Handles fetching and parsing of the LiveOps feed data.
 */
import axios from 'axios';

interface LiveOpsPost {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
}

/**
 * Fetches the latest pinned community post from the LiveOps feed endpoint.
 */
export async function getPinnedCommunityPost(): Promise<LiveOpsPost | null> {
  const response = await axios.get('/api/liveops');
  const data = response.data as LiveOpsPost[];

  // Assuming there's a 'pinned' property on each post in the feed
  return data.find((post) => post.pinned);
}
