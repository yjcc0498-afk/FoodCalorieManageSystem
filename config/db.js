// This file initializes the MongoDB connection from environment variables.
//负责连接 MongoDB 数据库
const mongoose = require('mongoose');

//定义连接函数
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  //判断环境变量中mongoUri是否存在
  if (!mongoUri) {
    console.error('MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    // Keep DB bootstrapping isolated so route/controller code only handles request flow.
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
