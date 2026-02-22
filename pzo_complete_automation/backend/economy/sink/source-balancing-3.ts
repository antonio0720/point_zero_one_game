import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sink, Source, Item, EconomyEntity } from './entities';
import { Observable, from, map, mergeMap, tap } from 'rxjs';

@Injectable()
export class EconomyService {
constructor(
@InjectRepository(EconomyEntity)
private readonly economyRepository: Repository<EconomyEntity>,
@InjectRepository(Sink)
private readonly sinkRepository: Repository<Sink>,
@InjectRepository(Source)
private readonly sourceRepository: Repository<Source>,
@InjectRepository(Item)
private readonly itemRepository: Repository<Item>,
) {}

balance(): Observable<void> {
return from(this.getAllItems()).pipe(
mergeMap((item) =>
this.calculateDemandAndSupply(item).pipe(
tap(({ demand, supply }) =>
this.updateEconomyEntity(item.id, demand, supply),
),
),
),
);
}

private async getAllItems(): Promise<Item[]> {
return await this.itemRepository.find();
}

private async calculateDemandAndSupply(item: Item): Observable<{ demand: number; supply: number }> {
const sinks = await from(this.sinkRepository.find({ where: { itemId: item.id } })).toArray();
const sources = await from(this.sourceRepository.find({ where: { itemId: item.id } })).toArray();

return Observable.create((observer) => {
let demand = 0;
let supply = 0;

sinks.forEach((sink) => (demand += sink.quantity));
sources.forEach((source) => (supply += source.quantity));

observer.next({ demand, supply });
observer.complete();
});
}

private async updateEconomyEntity(itemId: number, demand: number, supply: number): Promise<void> {
const economyEntity = await this.economyRepository.findOneBy({ itemId });

if (!economyEntity) {
await this.economyRepository.save(new EconomyEntity({ itemId, demand, supply }));
} else {
economyEntity.demand = demand;
economyEntity.supply = supply;
await this.economyRepository.save(economyEntity);
}
}
}
