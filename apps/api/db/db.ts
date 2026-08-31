import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import * as schema from './schema';

// Load environment variables
dotenv.config();

// Create the connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Disable prepared statements for Neon
const client = postgres(connectionString, { 
  prepare: false,
  onnotice: (notice) => console.log('PostgreSQL notice:', notice),
  debug: (connection, query, params) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Drizzle query:', query);
    }
  }
});

// Create Drizzle instance
export const db = drizzle(client, { schema });

export type Database = typeof db;

// Export schema for easy access
export { schema };
