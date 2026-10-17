import type { ExplorationMaze } from './maze.js';
import type { ExplorationProgress,ExplorationReward } from './rewards.js';
export type ExplorationRegionView=Readonly<{key:string;name:string;progress:ExplorationProgress}>;
export type ExplorationSessionView=Readonly<{
  id:string;regionKey:string;regionName:string;maze:ExplorationMaze;state:'ACTIVE'|'OPENED';infinite:boolean;
  backgroundPath:string|null;backgroundCredit:{sourceUrl:string;licenseUrl:string;attribution:string}|null;
  openedChest:number|null;reward:ExplorationReward|null;progress:ExplorationProgress;expiresAt:string|null;
}>;
export type ExplorationSnapshot=Readonly<{regions:readonly ExplorationRegionView[];session:ExplorationSessionView|null;serverNow:string}>;
export type ExplorationAction={idempotencyKey:string}&(
  {kind:'START';regionKey:string;sessionId:null}|
  {kind:'NEXT'|'STOP'|'ABANDON';sessionId:string}|
  {kind:'OPEN';sessionId:string;chestIndex:number;path:string}
);
export type ExplorationMutation=ExplorationSnapshot&Readonly<{operationId:string;alreadyProcessed:boolean}>;
export type ExplorationPresence=Readonly<{tabKey:string;sequence:number;visible:boolean}>;
