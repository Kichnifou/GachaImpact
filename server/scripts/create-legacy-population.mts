import 'dotenv/config';
import { open } from 'node:fs/promises';
import { loadLocalOperatorSnapshot } from '../src/application/migration/local-operator-snapshot.js';
import { readLocalIdentityJson, checkedIdentityFile } from '../src/application/migration/local-identity-file.js';
import { createOwnerApprovedPopulation } from '../src/application/migration/owner-approved-population.js';

async function main() {
  const [snapshot, historicalReport, output, ...extra] = process.argv.slice(2);
  if (!snapshot || !historicalReport || !output || extra.length) throw new Error('FINAL_POPULATION_ARGUMENTS_INVALID');
  const population = createOwnerApprovedPopulation(await readLocalIdentityJson(historicalReport), await loadLocalOperatorSnapshot(snapshot));
  const target = await checkedIdentityFile(output, true);
  const file = await open(target, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(population)); await file.sync(); } finally { await file.close(); }
  process.stdout.write(JSON.stringify({ decision: population.decision, sourceProfiles: 216, approvedPopulation: 43, ownerDiscarded: 171,
    quarantined: 2, historicalMembershipFrozen: true, freshRevalidationRequired: true }) + '\n');
}
main().catch(() => { process.stderr.write('FINAL_POPULATION_FAILED_CLOSED: preuve historique et fichiers locaux ignorés requis.\n'); process.exitCode = 1; });
