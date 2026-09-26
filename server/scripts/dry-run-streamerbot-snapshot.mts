import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import { snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';

const directory = process.argv[2];
if (!directory) throw new Error('Usage: tsx scripts/dry-run-streamerbot-snapshot.mts <ignored-snapshot-directory>');
const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for a read-only comparison.');
const db = createDatabase(config.databaseUrl);
try {
  const players = await db.player.findMany({ where: { displayName: 'Kichnifou', status: 'ACTIVE' }, select: { id: true } });
  if (players.length !== 1) throw new Error('Exactly one active pilot Player is required.');
  const files = Object.fromEntries(await Promise.all(snapshotFileNames.map(async name => [name, await readFile(join(directory, name), 'utf8')])));
  const twitch = new TwitchPilotService(db, new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), config);
  const report = await new SnapshotPilotService(db, twitch, config.twitch?.clientSecret ?? 'read-only-local-report').localReadOnlyReport(players[0]!.id, 'kichnifou', files);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally { await db.$disconnect(); }
