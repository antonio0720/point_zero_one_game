// backend/src/index.ts
import express from 'express';
import { authMiddleware } from './middleware/auth_middleware';
import institutionsRoutes from './api-gateway/routes/institutions_routes';

const app = express();

app.use(express.json());

// installs app-wide auth middleware
authMiddleware(app);

// mount protected institutions routes
app.use('/api/v1/institutions', institutionsRoutes);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`[pzo-backend] listening on port ${port}`);
});

export default app;