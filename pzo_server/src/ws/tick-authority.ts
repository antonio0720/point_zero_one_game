// tslint:disable:no-any strict-type-checking

import { TickAuthority } from './tick-authority';
import { ServerClock } from './server-clock';
import { GameTick } from './game-tick';
import { BroadcastDiff } from './broadcast-diff';

export class WSTickAuthority {
  private serverClock: ServerClock;
  private tickAuthority: TickAuthority;

  constructor(serverClock: ServerClock, tickAuthority: TickAuthority) {
    this.serverClock = serverClock;
    this.tickAuthority = tickAuthority;
  }

  public async broadcastTick(): Promise<void> {
    const currentTick = await this.serverClock.getTick();
    const diff = await this.tickAuthority.getDiff(currentTick);
    await BroadcastDiff.broadcast(diff);
  }
}

export class ServerTickAuthority extends WSTickAuthority {
  private mlEnabled: boolean;
  private auditHash: string;

  constructor(
    serverClock: ServerClock,
    tickAuthority: TickAuthority,
    mlEnabled: boolean = false,
    auditHash?: string
  ) {
    super(serverClock, tickAuthority);
    this.mlEnabled = mlEnabled;
    this.auditHash = auditHash || '';
  }

  public async broadcastTick(): Promise<void> {
    if (this.mlEnabled) {
      const boundedOutput = await GameTick.boundedOutput();
      await BroadcastDiff.broadcast(boundedOutput);
    } else {
      super.broadcastTick();
    }
  }
}
