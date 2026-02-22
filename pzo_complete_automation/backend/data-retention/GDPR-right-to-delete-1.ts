import { Request, Response } from 'express';
import User, { IUser } from './userModel'; // Import your user model

export const deleteUser = async (req: Request, res: Response) => {
try {
const { id } = req.params;
if (!id) return res.status(400).json({ error: 'Missing User ID' });

const user: IUser | null = await User.findByIdAndRemove(id);

if (!user) return res.status(404).json({ error: 'User not found' });

res.status(204).send();
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while deleting the user.' });
}
};
