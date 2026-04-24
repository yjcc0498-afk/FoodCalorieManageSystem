import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import connectDB from './config/db';
import { ensureAdminUser } from './config/bootstrapAdmin';
import { getJsonBodyLimit, validateRuntimeConfig } from './config/runtime';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import dailyLogRoutes from './routes/dailyLogRoutes';
import foodRoutes from './routes/foodRoutes';
import goalsRoutes from './routes/goalsRoutes';
import journalRoutes from './routes/journalRoutes';
import profileRoutes from './routes/profileRoutes';
import userRoutes from './routes/userRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

app.use(express.json({ limit: getJsonBodyLimit() }));
app.use(express.static(publicDir));

app.get('/', (_req, res) => {
  res.redirect('/login');
});

app.get('/login', (_req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/register', (_req, res) => {
  res.sendFile(path.join(publicDir, 'register.html'));
});

app.get('/app', (_req, res) => {
  res.sendFile(path.join(publicDir, 'user.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.use('/', authRoutes);
app.use('/', foodRoutes);
app.use('/goals', goalsRoutes);
app.use('/daily-log', dailyLogRoutes);
app.use('/journal', journalRoutes);
app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);
app.use('/users', userRoutes);

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

const startServer = async () => {
  try {
    validateRuntimeConfig();
    await connectDB();
    await ensureAdminUser();

    return await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
        resolve(server);
      });

      server.on('error', reject);
    });
  } catch (error) {
    if (require.main === module) {
      console.error('Failed to start server:', getErrorMessage(error));
      process.exit(1);
    }

    throw error;
  }
};

if (require.main === module) {
  void startServer();
}

export {
  app,
  startServer
};
