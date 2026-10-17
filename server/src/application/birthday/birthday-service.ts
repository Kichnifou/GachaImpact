import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { lockPlayerMutationState } from '../player/player-mutation-guard.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { birthdayDate, lastDueBirthdayYear, validBirthday } from './birthday-date.js';
const select = { birthdayDay: true, birthdayMonth: true } as const;
export class BirthdayService {
  constructor(private readonly getPlayer: GetCurrentPlayer, private readonly db: PrismaClient, private readonly clock: Clock,
    private readonly economy = new PrismaEconomyService(() => clock.now())) {}
  async register(identity: PlayerExecutionActor, day: number, month: number) {
    if (!validBirthday(day, month)) throw new AppError('Choisissez un jour et un mois valides.', 400, 'BIRTHDAY_INVALID');
    const player = await this.getPlayer.execute(identity);
    return this.retry(() => this.db.$transaction(async tx => {
      if (!await lockPlayerMutationState(tx, player.id)) throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
      const row = await tx.player.findUniqueOrThrow({ where: { id: player.id }, select: { ...select, status: true } });
      if (row.status !== 'ACTIVE') throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
      if (row.birthdayDay !== null) {
        if (row.birthdayDay !== day || row.birthdayMonth !== month) throw new AppError('Votre anniversaire est définitif et ne peut plus être modifié.', 409, 'BIRTHDAY_IMMUTABLE');
        return { day, month };
      }
      const now = this.clock.now(), today = getBusinessDate(now), year = Number(today.slice(0, 4));
      // A birthday before registration is not a missed grant. Today itself remains eligible.
      const lastYear = birthdayDate(year, month, day) < today ? year : year - 1;
      await tx.player.update({ where: { id: player.id }, data: { birthdayDay: day, birthdayMonth: month, birthdayRegisteredAt: now, birthdayLastRewardYear: lastYear } });
      return { day, month };
    }));
  }
  async read(playerId: string) {
    const row = await this.db.player.findUniqueOrThrow({ where: { id: playerId }, select });
    return row.birthdayDay === null || row.birthdayMonth === null ? null : { day: row.birthdayDay, month: row.birthdayMonth };
  }
  /** Durable cursor + unique economic key: no Chat/browser prerequisite, no shared cache. */
  async processCurrentDate() {
    const today = getBusinessDate(this.clock.now()), [year, month, day] = today.split('-').map(Number) as [number, number, number];
    let cursor = '';
    for (;;) {
      const rows = await this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM players WHERE status='ACTIVE' AND birthday_registered_at IS NOT NULL
        AND (birthday_last_reward_year < ${year - 1} OR (birthday_last_reward_year < ${year}
          AND (birthday_month < ${month} OR (birthday_month = ${month} AND
            LEAST(birthday_day, EXTRACT(DAY FROM (make_date(${year}::int,birthday_month,1)+INTERVAL '1 month - 1 day'))::int) <= ${day}))))
        AND (${cursor} = '' OR id::text > ${cursor}) ORDER BY id LIMIT 100
      `);
      if (!rows.length) return;
      for (const row of rows) await this.processPlayer(row.id);
      cursor = rows.at(-1)!.id;
    }
  }
  async processPlayer(playerId: string) {
    // Each missed year commits separately; interruption resumes from the durable annual cursor.
    for (;;) {
      const granted = await this.retry(() => this.db.$transaction(async tx => {
        if (!await lockPlayerMutationState(tx, playerId)) return false;
        const row = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { status: true, elementKey: true,
          birthdayDay: true, birthdayMonth: true, birthdayRegisteredAt: true, birthdayLastRewardYear: true } });
        if (row.status !== 'ACTIVE' || row.birthdayDay === null || row.birthdayMonth === null || row.birthdayLastRewardYear === null) return false;
        const now = this.clock.now(), due = lastDueBirthdayYear(getBusinessDate(now), row.birthdayMonth, row.birthdayDay);
        const year = row.birthdayLastRewardYear + 1;
        if (year > due) return false;
        const key = 'birthday.grant:' + playerId + ':' + year;
        const previous = await tx.businessOperation.findFirst({ where: { sourceChannel: 'SYSTEM', idempotencyKey: key } });
        if (previous) {
          if (previous.status !== 'COMPLETED' || previous.playerId !== playerId || previous.operationType !== 'birthday.grant') throw new Error('BIRTHDAY_PROOF_INVALID');
        } else {
          const operation = await tx.businessOperation.create({ data: { playerId, operationType: 'birthday.grant', sourceChannel: 'SYSTEM', idempotencyKey: key, startedAt: now, resultSummary: { year, primogems: '50000', moras: '200000' } } });
          for (const [resourceKey, amount] of [['primogems', 50000n], ['moras', 200000n]] as const) {
            await this.economy.credit(tx, { playerId, playerElementKey: row.elementKey && isElementKey(row.elementKey) ? row.elementKey : null,
              resourceKey, amount, causeKey: 'birthday.annual', domainKey: 'birthday', operationId: operation.id, sourceChannel: 'SYSTEM' });
          }
          await tx.notification.create({ data: { playerId, domainKey: 'birthday', typeKey: 'BIRTHDAY_REWARD', deduplicationKey: key,
            payload: { title: 'Joyeux anniversaire !', message: '🎂 Joyeux anniversaire ! GachaImpact t’offre 50 000 Primogemmes et 200 000 Moras pour fêter cette journée !', year }, createdAt: now } });
          await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now } });
        }
        await tx.player.update({ where: { id: playerId }, data: { birthdayLastRewardYear: year } });
        return true;
      }));
      if (!granted) return;
    }
  }
  private async retry<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 0;; attempt++) try { return await run(); } catch (error) {
      if (attempt === 3 || !isPrismaConcurrencyCollision(error)) throw error;
    }
  }
}
