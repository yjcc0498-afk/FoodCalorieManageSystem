// This file wires config, middleware, routes, and starts the Express server.
//把数据库、路由、前端资源全部“接起来”，然后启动一个 Web 服务

require('dotenv').config();

const path = require('path');
const express = require('express');
const connectDB = require('./config/db');
const foodRoutes = require('./routes/foodRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Routes stay focused on request entry, while server.js only wires the application together.
app.use('/', foodRoutes);

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });
};

startServer();
