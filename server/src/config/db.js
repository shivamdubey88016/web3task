import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/watchparty';
    
    mongoose.connection.on('connected', () => {
      console.log('Mongoose default connection open to ' + mongoUri);
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose default connection error: ' + err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose default connection disconnected');
    });

    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error(`MongoDB connection setup failed: ${error.message}`);
    process.exit(1);
  }
};
