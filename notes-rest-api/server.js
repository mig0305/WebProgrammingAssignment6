import 'dotenv/config';
import mongoose from 'mongoose';
import { app } from './app.js';

const port = Number(process.env.PORT) || 3000;
const dbUri = process.env.MONGODB_URI;

if (!dbUri) {
  console.error(
    'Missing MONGODB_URI. Copy .env.example to .env and configure MongoDB.'
  );
  process.exit(1);
}

try {
  await mongoose.connect(dbUri, {
    serverSelectionTimeoutMS: 10000
  });

  console.log('Connected to MongoDB');

  app.listen(port, () => {
    console.log(`Notes API running at http://localhost:${port}`);
  });

} catch (err) {
  console.error('Database connection failed:', err.message);
  process.exit(1);
}