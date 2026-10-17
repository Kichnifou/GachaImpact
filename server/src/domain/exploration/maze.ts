/** Pure versioned maze contract shared by the authoritative server and renderer. */
export type Point = Readonly<{ x:number; y:number }>;
export type ExplorationMaze = Readonly<{ version:1; width:number; height:number; cells:readonly number[]; start:Point; chests:readonly Point[] }>;
export type Direction = 'U'|'R'|'D'|'L';
export const directions:Readonly<Record<Direction,Point>>={U:{x:0,y:-1},R:{x:1,y:0},D:{x:0,y:1},L:{x:-1,y:0}};
export function seededRandom(seed:number) {
  let state=seed>>>0;
  return () => { state=(state+0x6D2B79F5)>>>0;let value=state;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return ((value^(value>>>14))>>>0)/4294967296; };
}
export function createExplorationMaze(seed:number):ExplorationMaze {
  const width=17,height=11,cells=Array<number>(width*height).fill(0),random=seededRandom(seed);
  const start={x:9,y:9},stack:Point[]=[start];cells[start.y*width+start.x]=1;
  while(stack.length) {
    const at=stack[stack.length-1]!;
    const choices=Object.values(directions).map(delta=>({x:at.x+delta.x*2,y:at.y+delta.y*2})).filter(next=>next.x>0&&next.x<width-1&&next.y>0&&next.y<height-1&&!cells[next.y*width+next.x]);
    if(!choices.length){stack.pop();continue;}
    const next=choices[Math.floor(random()*choices.length)]!;
    cells[((at.y+next.y)/2)*width+(at.x+next.x)/2]=1;cells[next.y*width+next.x]=1;stack.push(next);
  }
  // Only these three boundary cells are open; each connects to the carved tree.
  const chests=[{x:1,y:0},{x:0,y:9},{x:16,y:9}];
  for(const chest of chests)cells[chest.y*width+chest.x]=1;
  return {version:1,width,height,cells,start,chests};
}
export function walkMaze(maze:ExplorationMaze,at:Point,direction:Direction,blockChests=false):Point {
  const delta=directions[direction];if(!delta)return at;
  const next={x:at.x+delta.x,y:at.y+delta.y};
  return next.x<0||next.y<0||next.x>=maze.width||next.y>=maze.height||maze.cells[next.y*maze.width+next.x]!==1||blockChests&&maze.chests.some(chest=>chest.x===next.x&&chest.y===next.y)?at:next;
}
/** Compact path from the persisted spawn, validated without a movement stream. */
export function validateChestPath(maze:ExplorationMaze,path:string,chestIndex:number):boolean {
  if(!Number.isInteger(chestIndex)||chestIndex<0||chestIndex>=maze.chests.length||path.length>2048||!/^[URDL]*$/.test(path))return false;
  let at=maze.start;
  for(const direction of path){const next=walkMaze(maze,at,direction as Direction,true);if(next===at)return false;at=next;}
  const chest=maze.chests[chestIndex]!;
  return Math.abs(chest.x-at.x)+Math.abs(chest.y-at.y)===1;
}
