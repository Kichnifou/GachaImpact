import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import type { BankingTransferView, BankingView, GetCurrentPlayerBank, TransferPlayerBank } from '../../application/banking/banking-services.js';
import type { BankOperation, BankTransferAmount } from '../../application/banking/banking-store.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{
  authenticate: preHandlerHookHandler;
  getCurrentPlayerBank: GetCurrentPlayerBank;
  depositPlayerBank: TransferPlayerBank;
  withdrawPlayerBank: TransferPlayerBank;
}>;

const transferSchema = z.object({
  amount: z.string().regex(/^(?:max|MAX|[1-9]\d*)$/),
  idempotencyKey: z.uuid(),
}).strict();

export async function registerBankRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/bank', { preHandler: options.authenticate }, async (request) =>
    bankDto(await options.getCurrentPlayerBank.execute(requireAuthenticatedIdentity(request))));

  app.post('/api/v1/me/bank/deposit', { preHandler: options.authenticate }, async (request) => {
    const body = parseTransfer(request.body);
    return bankTransferDto(await options.depositPlayerBank.execute(
      requireAuthenticatedIdentity(request), toAmount(body.amount), body.idempotencyKey,
    ));
  });

  app.post('/api/v1/me/bank/withdraw', { preHandler: options.authenticate }, async (request) => {
    const body = parseTransfer(request.body);
    return bankTransferDto(await options.withdrawPlayerBank.execute(
      requireAuthenticatedIdentity(request), toAmount(body.amount), body.idempotencyKey,
    ));
  });
}

function parseTransfer(body: unknown): z.infer<typeof transferSchema> {
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('Un montant entier positif ou MAX et une clé d’idempotence UUID sont requis.', 400, 'VALIDATION_ERROR');
  }
  return parsed.data;
}

function toAmount(amount: string): BankTransferAmount {
  return amount.toLowerCase() === 'max' ? 'max' : BigInt(amount);
}

function bankDto(view: BankingView) {
  return {
    walletMoras: view.walletMoras.toString(),
    bankMoras: view.bankMoras.toString(),
    totalWealth: view.totalWealth.toString(),
    estimatedInterest: view.estimatedInterest.toString(),
    interestRatePercent: 3,
    nextInterestAt: view.nextInterestAt.toISOString(),
    recentOperations: view.recentOperations.map(operationDto),
  };
}

function bankTransferDto(view: BankingTransferView) {
  return { ...bankDto(view), operation: view.operation };
}

function operationDto(operation: BankOperation) {
  return {
    ...operation,
    amount: operation.amount.toString(),
    bankBalanceAfter: operation.bankBalanceAfter.toString(),
    walletBalanceAfter: operation.walletBalanceAfter?.toString() ?? null,
    createdAt: operation.createdAt.toISOString(),
  };
}
