const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

async function connectDB(uri = env.MONGODB_URI) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      driverInfo: { name: 'nodejs', version: '6.0.0' },
    });
    isConnected = true;
    console.log(`Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

async function closeDB() {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
  }
}

module.exports = {
  connectDB,
  closeDB,
  mongoose,
};
