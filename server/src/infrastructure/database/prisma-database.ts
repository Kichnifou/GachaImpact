import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../../generated/prisma/client.js';

/**
 * Creates the database boundary lazily. Calling this requires DATABASE_URL,
 * but importing the backend or running health tests never does.
 */
export function createDatabase(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({ adapter });
}
