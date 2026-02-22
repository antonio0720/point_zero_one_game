import { ViralMechanics2 } from '../../../backend/growth/viral-mechanics-2';
import { User } from '../../../backend/user/user.model';
import { Post } from '../../../backend/post/post.model';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';

describe('ViralMechanics2', () => {
let viralMechanics: ViralMechanics2;

beforeEach(() => {
viralMechanics = new ViralMechanics2();
});

it('should create an instance', () => {
expect(viralMechanics).toBeInstanceOf(ViralMechanics2);
});

it('should not trigger when post is created by the user', async () => {
const user = new User({ id: uuidv4(), username: 'test-user' });
const post = new Post({ id: uuidv4(), content: 'Test post', userId: user.id });

viralMechanics.onPostCreated(post);

expect(viralMechanics.getTriggerCount()).toBe(0);
});

it('should trigger when a user comments on another user\'s post', async () => {
const user1 = new User({ id: uuidv4(), username: 'user1' });
const user2 = new User({ id: uuidv4(), username: 'user2' });
const post = new Post({ id: uuidv4(), content: 'Test post', userId: user1.id });

viralMechanics.onPostCreated(post);

viralMechanics.onCommentCreated({
id: uuidv4(),
content: 'Nice post!',
commenterId: user2.id,
postId: post.id,
});

expect(viralMechanics.getTriggerCount()).toBe(1);
});

it('should trigger when a user shares another user\'s post', async () => {
const user1 = new User({ id: uuidv4(), username: 'user1' });
const user2 = new User({ id: uuidv4(), username: 'user2' });
const post = new Post({ id: uuidv4(), content: 'Test post', userId: user1.id });

viralMechanics.onPostCreated(post);

viralMechanics.onShare({
id: uuidv4(),
sharerId: user2.id,
sharedPostId: post.id,
});

expect(viralMechanics.getTriggerCount()).toBe(1);
});

it('should trigger multiple times when a post gets lots of comments and shares', async () => {
const user1 = new User({ id: uuidv4(), username: 'user1' });
const user2 = new User({ id: uuidv4(), username: 'user2' });
const user3 = new User({ id: uuidv4(), username: 'user3' });
const post = new Post({ id: uuidv4(), content: 'Test post', userId: user1.id });

viralMechanics.onPostCreated(post);

// Simulate comments and shares
for (let i = 0; i < 10; i++) {
const commenterId = i % 3 === 0 ? user2.id : user3.id;
viralMechanics.onCommentCreated({
id: uuidv4(),
content: `Comment ${i}`,
commenterId,
postId: post.id,
});

if (i > 1) {
viralMechanics.onShare({
id: uuidv4(),
sharerId: user2.id,
sharedPostId: post.id,
});
}
}

expect(viralMechanics.getTriggerCount()).toBeGreaterThanOrEqual(10);
});
});
