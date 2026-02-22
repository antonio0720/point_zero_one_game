// ============================================================
// POINT ZERO ONE DIGITAL — Portfolio & Economy Engine
// Position management, P&L, liquidation logic
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { Portfolio, Position, Card, MarketTick } from './types';

export function createPortfolio(startingCash: number): Portfolio {
  return {
    cash: startingCash,
    positions: new Map(),
    totalEquity: startingCash,
    peakEquity: startingCash,
    maxDrawdown: 0,
  };
}

export class PortfolioEngine {

  openPosition(portfolio: Portfolio, card: Card, symbol: string, currentPrice: number): Portfolio {
    const posSize = portfolio.cash * 0.1; // risk 10% per trade
    const quantity = (posSize / currentPrice) * card.leverage;
    const cost = posSize;

    if (cost > portfolio.cash) {
      return portfolio; // insufficient funds
    }

    const position: Position = {
      assetId: uuidv4(),
      symbol,
      quantity,
      entryPrice: currentPrice,
      currentPrice,
      leverage: card.leverage,
      isLong: card.leverage > 0,
    };

    const newPositions = new Map(portfolio.positions);
    newPositions.set(position.assetId, position);

    return {
      ...portfolio,
      cash: portfolio.cash - cost,
      positions: newPositions,
    };
  }

  closePosition(portfolio: Portfolio, positionId: string, currentPrice: number): { portfolio: Portfolio; pnl: number } {
    const position = portfolio.positions.get(positionId);
    if (!position) return { portfolio, pnl: 0 };

    const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
    const rawReturn = position.quantity * position.entryPrice * priceChange;
    const pnl = position.isLong ? rawReturn : -rawReturn;
    const recovered = position.quantity * position.entryPrice / position.leverage + pnl;

    const newPositions = new Map(portfolio.positions);
    newPositions.delete(positionId);

    return {
      portfolio: { ...portfolio, cash: portfolio.cash + Math.max(0, recovered), positions: newPositions },
      pnl,
    };
  }

  updatePrices(portfolio: Portfolio, market: MarketTick): Portfolio {
    let updatedPositions = new Map(portfolio.positions);
    let totalPositionValue = 0;

    for (const [id, position] of updatedPositions) {
      const asset = market.assets.get(position.symbol);
      if (!asset) continue;

      const updatedPosition: Position = { ...position, currentPrice: asset.price };
      updatedPositions.set(id, updatedPosition);

      const unrealizedPnl = (asset.price - position.entryPrice) / position.entryPrice
        * position.quantity * position.entryPrice
        * (position.isLong ? 1 : -1);

      totalPositionValue += position.quantity * position.entryPrice / position.leverage + unrealizedPnl;
    }

    const totalEquity = portfolio.cash + totalPositionValue;
    const peakEquity = Math.max(portfolio.peakEquity, totalEquity);
    const drawdown = (peakEquity - totalEquity) / peakEquity;
    const maxDrawdown = Math.max(portfolio.maxDrawdown, drawdown);

    return { ...portfolio, positions: updatedPositions, totalEquity, peakEquity, maxDrawdown };
  }

  checkLiquidations(portfolio: Portfolio, market: MarketTick): { portfolio: Portfolio; liquidated: string[] } {
    const liquidated: string[] = [];
    let current = portfolio;

    for (const [id, position] of portfolio.positions) {
      const asset = market.assets.get(position.symbol);
      if (!asset) continue;

      const priceChange = (asset.price - position.entryPrice) / position.entryPrice;
      const lossThreshold = -1 / position.leverage; // liquidation at 100% margin loss

      if ((position.isLong && priceChange <= lossThreshold) ||
          (!position.isLong && priceChange >= -lossThreshold)) {
        const { portfolio: p } = this.closePosition(current, id, asset.price);
        current = p;
        liquidated.push(id);
      }
    }

    return { portfolio: current, liquidated };
  }

  calcScore(portfolio: Portfolio, startingCash: number): number {
    const roi = (portfolio.totalEquity - startingCash) / startingCash;
    const drawdownPenalty = portfolio.maxDrawdown * 0.5;
    return Math.round((roi - drawdownPenalty) * 10000); // basis points
  }
}
