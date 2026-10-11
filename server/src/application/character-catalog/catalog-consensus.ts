import type { CatalogFields, Evidence } from './catalog-policy.js';

export const consensusPolicy = { minimumEditors: 3, majority: 2 / 3, maxAgeDays: 30 } as const;
const publishers = new Set(['icy-veins', 'game8', 'sephijin']);
export function evidenceTrail(value: Evidence): Evidence[] {
  const result: Evidence[] = [];
  const visit = (item: Evidence, depth: number) => {
    if (depth > 8) return;
    const { alternatives, ...proof } = item;
    if (!result.some(row => row.provider === proof.provider && row.url === proof.url && row.value === proof.value && row.fetchedAt === proof.fetchedAt)) result.push(proof);
    for (const alternative of alternatives ?? []) visit(alternative, depth + 1);
  };
  visit(value, 0);
  return result;
}

/** Dated, identity-bound editorial attestations only. Ambiguity cancels an editor's vote. */
export function resolveConsensus(value: Evidence, identity: string, now: Date): Evidence {
  const trail = evidenceTrail(value);
  if (value.locked || value.override || value.reliability === 'ADMIN' || value.reliability === 'OFFICIAL' || value.reliability === 'STRUCTURED') return value;
  const groups = new Map<string, Evidence[]>();
  const upstreamByPublisher = new Map<string,string>();
  for (const proof of trail) if (proof.consensusSource?.upstream) upstreamByPublisher.set(proof.consensusSource.publisher, proof.consensusSource.upstream);
  const root = (publisher: string) => { const seen=new Set<string>(); let key=publisher;
    while(upstreamByPublisher.has(key)&&!seen.has(key)){seen.add(key);key=upstreamByPublisher.get(key)!;}
    return seen.has(key)?[...seen].sort()[0]!:key;
  };
  for (const proof of trail) {
    const q = proof.consensusSource;
    const age = now.getTime() - new Date(q?.observedAt ?? '').getTime();
    // A later withdrawal or loss of qualification at the same article retires its older vote.
    const latest=trail.filter(other=>other.provider===proof.provider&&other.url===proof.url).sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt))[0];
    if(latest!==proof)continue;
    if (!publishers.has(proof.provider) || !q?.qualified || q.publisher!==proof.provider || q.identity !== identity || q.withdrawn || !Number.isFinite(age) || age < 0 || age > consensusPolicy.maxAgeDays * 86_400_000) continue;
    const group = root(q.publisher);
    groups.set(group, [...(groups.get(group) ?? []), proof]);
  }
  // A preserved contradiction from that publisher cancels its vote, even if its
  // old review was not qualified to vote independently.
  const votes = [...groups.values()].filter(rows => new Set(trail.filter(proof=>root(proof.consensusSource?.publisher??proof.provider)===root(rows[0]!.provider)).map(row=>String(row.value))).size===1).map(rows => rows[0]!);
  const counts = new Map<string, Evidence[]>();
  for (const proof of votes) counts.set(String(proof.value), [...(counts.get(String(proof.value)) ?? []), proof]);
  const ranked = [...counts.values()].sort((a, b) => b.length - a.length);
  const winner = ranked[0];
  const qualified = votes.length >= consensusPolicy.minimumEditors && !!winner && winner.length / votes.length >= consensusPolicy.majority && winner.length > (ranked[1]?.length ?? 0);
  const primary = qualified ? winner[0]! : value;
  return { ...primary, reliability: 'PROVISIONAL', editorialStatus: 'PROVISIONAL',
    qualification: qualified ? 'PROVISIONAL_CONSENSUS' : trail.some(proof => proof.value !== value.value) ? 'CONFLICT' : 'PROVISIONAL',
    consensus: { editors: votes.length, supportingEditors: winner?.length ?? 0, evaluatedAt: now.toISOString() },
    conflict: trail.some(proof => proof.value !== primary.value), alternatives: trail.filter(proof => proof !== primary).map(({ alternatives: _alternatives, ...proof }) => proof) };
}

export function qualifyFields(fields: CatalogFields, identity: string, now: Date): CatalogFields {
  return { ...fields, ...Object.fromEntries(['rarity', 'element'].flatMap(key => {
    const proof = fields[key as keyof CatalogFields];
    return proof ? [[key, resolveConsensus(proof, identity, now)]] : [];
  })) };
}
