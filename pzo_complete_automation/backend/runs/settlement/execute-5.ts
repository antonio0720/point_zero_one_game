import { NextFunction, Request, Response } from 'express';
import { getRepository } from 'typeorm';
import Settlement from '../entities/Settlement';
import { ISettlementData } from '../interfaces/ISettlementData';

async function execute(req: Request, res: Response, next: NextFunction) {
try {
const settlementRepository = getRepository(Settlement);
const id = parseInt(req.params.id);
const settlementData: ISettlementData = req.body;

const settlement = await settlementRepository.findOneBy({ id });
if (!settlement) {
return res.status(404).json({ error: 'Settlement not found' });
}

Object.assign(settlement, settlementData);
await settlementRepository.save(settlement);

res.status(200).json(settlement);
} catch (err) {
next(err);
}
}

export default execute;
