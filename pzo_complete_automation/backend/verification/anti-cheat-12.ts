import Phaser from 'phaser';

export default class AntiCheatScene extends Phaser.Scene {
players: any[];
expectedInput: string;

constructor() {
super({
key: "AntiCheatScene"
});
}

init(data) {
this.players = data.players;
}

preload() {
// Preloading assets...
}

create() {
// Game setup...
this.expectedInput = '';

this.input.on('keydown', (event: any) => {
if (!this.players[this.sys.game.system.index].isLocalPlayer) return;
this.expectedInput += event.key;
});

this.scene.start('GameScene');
}

update(time: number, delta: number) {
if (this.players[this.sys.game.system.index].isLocalPlayer && this.expectedInput.length > 0) {
const player = this.physics.world.getEntitiesByProperty('type', 'player')[1]; // assuming there are two players and local player is the second one
if (player.body.velocity.x !== this.input.keyboard.lastKeyDown.code.value) {
this.scene.stop();
alert("Cheating detected! You have been kicked out.");
} else {
this.expectedInput = '';
}
}
}
}
