require('dotenv').config();

const path = require('path');
const express = require('express');
const connectDB = require('./config/db');
const { ensureAdminUser } = require('./config/bootstrapAdmin');
const { validateRuntimeConfig } = require('./config/runtime');
const authRoutes = require('./routes/authRoutes');
const foodRoutes = require('./routes/foodRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Keep server wiring thin: mount each route module here, while request logic stays in middleware/controllers.
app.use('/', authRoutes);
app.use('/', foodRoutes);
app.use('/users', userRoutes);

const startServer = async () => {
  try {
    validateRuntimeConfig();
    await connectDB();
    await ensureAdminUser();

    return await new Promise((resolve, reject) => {
      const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
        resolve(server);
      });

      server.on('error', reject);
    });
  } catch (error) {
    if (require.main === module) {
      console.error('Failed to start server:', error.message);
      process.exit(1);
    }

    throw error;
  }
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer
};
