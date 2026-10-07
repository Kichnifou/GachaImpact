import { performance } from 'node:perf_hooks';

export type ContestDiagnostic = Readonly<{
  scope: number;
  stage: string;
  state: 'START' | 'WAITING' | 'DONE' | 'ERROR';
  elapsedMs: number;
  code?: string;
}>;
export type ContestDiagnosticSink = (event: ContestDiagnostic) => void;
let scope = 0;

function report(event: ContestDiagnostic) {
  if (event.state === 'WAITING' || event.state === 'ERROR' || (event.state === 'DONE' && event.elapsedMs >= 2_000)) {
    console.warn('[contest-stage]', event);
  }
}

// Observes the awaited operation itself. No race, detached query, cancellation,
// identity, SQL, error message, DTO or credential is passed to the sink.
export function contestDiagnostics(sink: ContestDiagnosticSink = report, slowMs = 2_000) {
  const requestScope = ++scope;
  return async function stage<T>(name: string, action: () => Promise<T>): Promise<T> {
    const started = performance.now();
    const emit = (state: ContestDiagnostic['state'], code?: string) => {
      try { sink({ scope: requestScope, stage: name, state, elapsedMs: Math.round(performance.now() - started), ...(code ? { code } : {}) }); }
      catch { /* A diagnostic must never change a business outcome. */ }
    };
    emit('START');
    const timer = setTimeout(() => emit('WAITING'), slowMs);
    timer.unref();
    try { const result = await action(); emit('DONE'); return result; }
    catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^(P\d{4}|[0-9A-Z]{5})$/.test(error.code) ? error.code : undefined;
      emit('ERROR', code);
      throw error;
    } finally { clearTimeout(timer); }
  };
}
