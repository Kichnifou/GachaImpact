import 'dotenv/config';

import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const elements = [
  { key: 'pyro', displayName: 'Pyro', displayOrder: 1 },
  { key: 'hydro', displayName: 'Hydro', displayOrder: 2 },
  { key: 'cryo', displayName: 'Cryo', displayOrder: 3 },
  { key: 'electro', displayName: 'Electro', displayOrder: 4 },
  { key: 'anemo', displayName: 'Anemo', displayOrder: 5 },
  { key: 'geo', displayName: 'Geo', displayOrder: 6 },
  { key: 'dendro', displayName: 'Dendro', displayOrder: 7 },
] as const;

const resources = [
  { key: 'primogems', displayName: 'Primogemmes', category: 'CURRENCY', elementKey: null },
  { key: 'moras', displayName: 'Moras', category: 'CURRENCY', elementKey: null },
  ...elements.map((element) => ({
    key: `particles_${element.key}`,
    displayName: `Particules ${element.displayName}`,
    category: 'PARTICLE',
    elementKey: element.key,
  })),
] as const;

const config = loadConfig();

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const database = createDatabase(config.databaseUrl);

try {
  await database.$transaction(async (transaction) => {
    for (const element of elements) {
      await transaction.element.upsert({
        where: { key: element.key },
        create: element,
        update: {
          displayName: element.displayName,
          displayOrder: element.displayOrder,
          isActive: true,
        },
      });
    }

    for (const resource of resources) {
      await transaction.resourceDefinition.upsert({
        where: { key: resource.key },
        create: resource,
        update: {
          displayName: resource.displayName,
          category: resource.category,
          elementKey: resource.elementKey,
          isActive: true,
        },
      });
    }
  });
} finally {
  await database.$disconnect();
}
