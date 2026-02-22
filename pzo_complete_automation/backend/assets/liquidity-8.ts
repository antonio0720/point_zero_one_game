import { Center } from 'phaser3-collision';

class GameScene extends Phaser.Scene {
constructor() {
super({
key: 'GameScene',
physics: {
default: 'arcade',
arcade: {
debug: false,
},
},
plugins: {
global: [Center],
},
});
}

preload() {
this.load.image('liquidity-8', 'assets/liquidity-8.png');
}

create() {
const liquidityAsset = new LiquidityAsset(this, 400, 300);
}
}
