module.exports = {
up: async (queryInterface, Sequelize) => {
await queryInterface.createTable('outbox_messages', {
id: {
allowNull: false,
autoIncrement: true,
primaryKey: true,
type: Sequelize.INTEGER,
},
messageId: {
allowNull: false,
unique: true,
type: Sequelize.UUID,
},
eventName: {
allowNull: false,
type: Sequelize.STRING,
},
data: {
type: Sequelize.JSONB,
},
createdAt: {
allowNull: false,
type: Sequelize.DATE,
},
updatedAt: {
allowNull: false,
type: Sequelize.DATE,
},
});
},

down: async (queryInterface) => {
await queryInterface.dropTable('outbox_messages');
},
};
