/**
 * KitStatsController - Handles GET /host/stats endpoint for admin dashboard
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database';

const router = express.Router();

// Validate JWT and check if it's an admin
router.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.sendStatus(401); // Unauthorized

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ADMIN_API_KEY_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403); // Forbidden
    req.adminId = decoded.id;
    next();
  });
});

router.get('/stats', async (req, res) => {
  try {
    const adminId = req.adminId;
    const totalDownloads = await db('downloads').count('* as total').where('admin_id', adminId).first();
    const today = new Date().toISOString().split('T')[0];
    const downloadsToday = await db('downloads')
      .count('* as today')
      .where('admin_id', adminId)
      .andWhere('created_at', '=', today)
      .first();

    // Query for top cities using SQL subquery and LIMIT/OFFSET to ensure performance
    const cityDownloads = await db('downloads')
      .select('city, count(*) as downloads')
      .where('admin_id', adminId)
      .groupBy('city')
      .orderBy('downloads', 'desc')
      .limit(10)
      .offset(0);

    const topCities = cityDownloads.map((city) => city.city);

    res.json({ total_downloads: totalDownloads.total, downloads_today: downloadsToday.today, top_cities });
  } catch (error) {
    console.error(error);
    res.sendStatus(500); // Internal Server Error
  }
});

export default router;
```

Please note that the SQL part is not included in this response, as it would require a separate file and schema design which goes beyond the scope of this question. However, I'd be happy to help you with that if needed!
