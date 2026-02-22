import axios from 'axios';
import { User } from '../models/user';
import { Referral } from '../models/referral';
import config from '../../config';

async function shareLoops8(user: User) {
const { apiKey, baseUrl } = config.shareLoops;

try {
const response = await axios.get(`${baseUrl}/api/v1/invite?key=${apiKey}`);
const inviteLink = response.data.data.link;

const referral = new Referral({
userId: user._id,
link: inviteLink,
status: 'sent',
});

await referral.save();

// Send the invite link to the user via email or any other preferred method.
// For simplicity, let's assume we have an `sendEmail` function that takes the user and the inviteLink as arguments.
sendEmail(user, inviteLink);
} catch (error) {
console.error('Error during share loops 8:', error);
}
}
