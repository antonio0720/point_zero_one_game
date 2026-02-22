import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { Op } from 'sequelize/lib/operators';

const db = new Sequelize('database', 'username', 'password', {
host: 'localhost',
dialect: 'mysql'
});

const User = db.define('User', {
username: {
type: Sequelize.STRING,
unique: true
},
score: {
type: Sequelize.FLOAT
}
});

const Submission = db.define('Submission', {
userId: {
type: Sequelize.INTEGER,
references: { model: User, key: 'id' }
},
proof: {
type: Sequelize.BOOLEAN
},
score: {
type: Sequelize.FLOAT
}
});

const leaderboardRouter = Router();

// Fetch the top N users ordered by their total scores, giving double weight to proof-verified submissions
leaderboardRouter.get('/', async (req, res) => {
const limit = parseInt(req.query.limit as string);

try {
const users = await User.findAll({
include: [Submission],
attributes: ['id', 'username', [Sequelize.fn('SUM', Sequelize.col('Submissions.score')), 'totalScore']],
group: ['User.id'],
order: [['totalScore', [Op.desc]]],
raw: true,
limit
});

const weightedUsers = users.map(user => ({ ...user, totalScore: user.totalScore * (user.Submissions[0].proof ? 2 : 1) }));
res.json(weightedUsers);
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

export default leaderboardRouter;
