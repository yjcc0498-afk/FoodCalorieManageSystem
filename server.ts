import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import connectDB from './config/db';
import { ensureAdminUser } from './config/bootstrapAdmin';
import { validateRuntimeConfig } from './config/runtime';
import authRoutes from './routes/authRoutes';
import foodRoutes from './routes/foodRoutes';
import userRoutes from './routes/userRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

app.use(express.json());
app.use(express.static(publicDir));

app.get(['/', '/login', '/app', '/admin'], (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use('/', authRoutes);
app.use('/', foodRoutes);
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
