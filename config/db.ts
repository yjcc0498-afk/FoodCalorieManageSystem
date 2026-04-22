import mongoose from 'mongoose';

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', getErrorMessage(error));
    process.exit(1);
  }
};

export default connectDB;
