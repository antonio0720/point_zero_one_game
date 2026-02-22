import * as jwt from 'jsonwebtoken';
import { secret } from '../config';

type Claim = {
id: string;
proof: number[];
};

const generateProof = (proof: number[]): string => {
const claim: Claim = {
id: 'unique-id',
proof,
};

return jwt.sign(claim, secret, { algorithm: 'HS256' });
};

export default generateProof;
