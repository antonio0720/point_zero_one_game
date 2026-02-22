import { NextFunction, Request, Response } from 'express';
import SettlementService from '../services/settlement.service';

const settlementService = new SettlementService();

export const execute9 = async (req: Request, res: Response, next: NextFunction) => {
try {
const result = await settlementService.executeSettlement(req.body);
res.status(200).json(result);
} catch (error) {
next(error);
}
};
