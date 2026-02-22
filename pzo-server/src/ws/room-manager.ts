// room-manager.ts
import { Room } from './room';
import { Player } from '../player/player';
import { MLModel } from '../../ml/model';

const MAX_PLAYERS_PER_ROOM = 4;

class RoomManager {
    private rooms: Map<number, Room>;
    private mlEnabled: boolean;
    private auditHash: string;

    constructor(seed: number) {
        this.rooms = new Map();
        this.mlEnabled = false;
        this.auditHash = '';

        const roomId = seed;
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Room(roomId));
        }
    }

    public create(seed: number): void {
        const roomId = seed;
        if (this.rooms.has(roomId)) {
            throw new Error(`Room with ID ${roomId} already exists`);
        }
        this.rooms.set(roomId, new Room(roomId));
    }

    public join(roomId: number, playerId: string): void {
        if (!this.rooms.has(roomId)) {
            throw new Error(`Room with ID ${roomId} does not exist`);
        }
        const room = this.rooms.get(roomId);
        if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
            throw new Error(`Maximum number of players reached in room ${roomId}`);
        }
        room.addPlayer(new Player(playerId));
    }

    public tick(roomId: number): void {
        if (!this.rooms.has(roomId)) {
            throw new Error(`Room with ID ${roomId} does not exist`);
        }
        const room = this.rooms.get(roomId);
        room.tick();
        this.broadcastState(roomId, room.getState());
    }

    private broadcastState(roomId: number, state: any): void {
        if (this.mlEnabled) {
            // Apply ML model to state
            const mlModel = new MLModel();
            const boundedOutput = mlModel.apply(state);
            console.log(`ML output for room ${roomId}: ${boundedOutput}`);
        }
        this.auditHash = crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');
        // Broadcast state to all players in the room
        const room = this.rooms.get(roomId);
        room.players.forEach((player) => {
            player.broadcastState(state);
        });
    }

    public getAuditHash(): string {
        return this.auditHash;
    }
}

export { RoomManager };
