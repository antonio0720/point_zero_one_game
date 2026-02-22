import { Service, Controller } from '@deck-reactor/core';
import { CanaryRolloutStrategy } from '@deck-reactor/strategies';
import { ExpressAdapter } from '@deck-reactor/adapters-express';

@Service()
class MyCanaryRolloutService {
private strategy = new CanaryRolloutStrategy({
primary: 'v1',
canaries: [
{ name: 'v2', weight: 50 },
{ name: 'v3', weight: 25 },
],
});

constructor(private app: ExpressAdapter) {}

public register() {
this.app.get('/api/data', (req, res) => {
const variant = this.strategy.decide(req);
if (variant === 'v1') {
res.send('This is version v1');
} else if (variant === 'v2') {
res.send('This is version v2');
} else if (variant === 'v3') {
res.send('This is version v3');
}
});
}
}

@Controller()
export class MyAppController {
private app: ExpressAdapter;

constructor(myCanaryRolloutService: MyCanaryRolloutService) {
this.app = myCanaryRolloutService.app;
myCanaryRolloutService.register();
}
}
