return this.market.buy(transaction.resource, transaction.amount, account).then(() => {
account.addResourceAmount(transaction.resource, transaction.amount);
resource.onBalanceChanged(transaction.amount, account);
totalProcessedTransactions++;
if (totalProcessedTransactions === transactionQueue.length) resolve();
});
case 'sell':
return this.market.sell(transaction.resource, transaction.amount, account).then(() => {
account.removeResourceAmount(transaction.resource, transaction.amount);
resource.onBalanceChanged(-transaction.amount, account);
totalProcessedTransactions++;
if (totalProcessedTransactions === transactionQueue.length) resolve();
});
}
};

// Process transactions concurrently to speed up the process
const transactionPromises = transactionQueue.map(processTransaction);
Promise.all(transactionPromises).then(() => resolve());
});
}

private updateMarketPrices(): void {
this.resources.forEach((resource) => {
const marketBuyVolume = this.market.getTotalBuyVolume(resource);
const marketSellVolume = this.market.getTotalSellVolume(resource);
const averagePrice = (marketBuyVolume * resource.buyPrice + marketSellVolume * resource.sellPrice) / (marketBuyVolume + marketSellVolume);

// Update the sell price based on the new average price and a margin
resource.setSellPrice(averagePrice * (1 + resource.priceMargin));
});
}
}
```
