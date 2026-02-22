import { Document, Model, Schema, model } from 'mongoose';

interface IPvPSession extends Document {
player1: string;
player2: string;
status: 'waiting' | 'inProgress' | 'completed';
createdAt: Date;
updatedAt: Date;
}

const PvPSessionSchema = new Schema<IPvPSession>({
player1: { type: String, required: true },
player2: { type: String, required: true },
status: { type: String, enum: ['waiting', 'inProgress', 'completed'], required: true },
createdAt: { type: Date, default: Date.now },
updatedAt: { type: Date, default: Date.now },
});

export const PvPSession = model<IPvPSession>('PvPSession', PvPSessionSchema);

interface IMatchmaker {
findOpponent(playerId: string): Promise<string | null>;
}

class Matchmaker implements IMatchmaker {
private sessions: IPvPSession[];

constructor() {
this.sessions = [];
}

async findOpponent(playerId: string): Promise<string | null> {
const playerAlreadyInSession = this.sessions.find((session) => session.player1 === playerId || session.player2 === playerId);

if (playerAlreadyInSession) {
return playerAlreadyInSession.player3 ? playerAlreadyInSession.player3 : null;
}

const potentialOpponents = this.sessions.filter((session) => session.status === 'waiting');
let opponent: string | null = null;

for (const potentialOpponent of potentialOpponents) {
if (!opponent) {
opponent = potentialOpponent.player2;
break;
} else {
const otherPotentialOpponent = this.sessions.find((session) => session.player1 === opponent || session.player2 === opponent);
if (otherPotentialOpponent) {
opponent = potentialOpponent.player3 ? potentialOpponent.player3 : null;
break;
}
}
}

if (!opponent) {
const newSession = new PvPSession({ player1: playerId, status: 'waiting' });
await newSession.save();
this.sessions.push(newSession);
return null;
}

const newSession = new PvPSession({ player1: playerId, player2: opponent });
await newSession.save();
this.sessions.push(newSession);
return null;
}
}
