import { describe,expect,it } from 'vitest';
import { createExplorationMaze,directions,validateChestPath,walkMaze,type Direction } from '../src/domain/exploration/maze.js';

describe('authoritative Exploration mazes',()=>{
  it('is deterministic with exactly three reachable distinct boundary exits over1000seeds',()=>{
    for(let seed=0;seed<1000;seed++){
      const maze=createExplorationMaze(seed);expect(createExplorationMaze(seed)).toEqual(maze);
      expect(new Set(maze.chests.map(p=>`${p.x},${p.y}`)).size).toBe(3);
      const queue=[{...maze.start,path:''}],seen=new Set([`${maze.start.x},${maze.start.y}`]);
      while(queue.length){const at=queue.shift()!;for(const direction of Object.keys(directions) as Direction[]){const next=walkMaze(maze,at,direction,true),key=`${next.x},${next.y}`;if(!seen.has(key)){seen.add(key);queue.push({...next,path:at.path+direction});}
        for(let index=0;index<3;index++)if(Math.abs(maze.chests[index]!.x-at.x)+Math.abs(maze.chests[index]!.y-at.y)===1)expect(validateChestPath(maze,at.path,index)).toBe(true);
      }}
      for(const chest of maze.chests)expect([...seen].some(key=>{const [x,y]=key.split(',').map(Number);return Math.abs(x!-chest.x)+Math.abs(y!-chest.y)===1;})).toBe(true);
      const exits=maze.cells.filter((value,index)=>value===1&&(index%maze.width===0||index%maze.width===maze.width-1||index<maze.width||index>=maze.width*(maze.height-1)));
      expect(exits).toHaveLength(3);
    }
  });
  it('rejects collision, teleportation, invalid chest and oversized proofs',()=>{
    const maze=createExplorationMaze(42);
    expect(validateChestPath(maze,'teleport',0)).toBe(false);expect(validateChestPath(maze,'',-1)).toBe(false);
    expect(validateChestPath(maze,'U'.repeat(2049),0)).toBe(false);expect(validateChestPath(maze,'D',0)).toBe(false);
    expect(walkMaze(maze,maze.start,'D')).toBe(maze.start);
  });
});
