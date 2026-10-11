import {describe,it,expect} from 'vitest'
import {compareReleaseDates} from './character-catalog'
import type {GachaCharacterDto} from '../api/types'
const row=(id:string,name:string,releaseDate:string|null)=>({id,name,releaseDate} as GachaCharacterDto)
describe('public release calendar sort',()=>{
 it.each(['asc','desc'] as const)('keeps unknown dates last and ties stable in %s',direction=>{
  const rows=[row('u','Unknown',null),row('b','B','2025-01-01'),row('a2','A','2025-01-01'),row('a1','A','2025-01-01'),row('old','Old','2020-09-28')]
  expect(rows.sort((a,b)=>compareReleaseDates(a,b,direction)).map(value=>value.id)).toEqual(direction==='asc'?['old','a1','a2','b','u']:['a1','a2','b','old','u'])
 })
 it('compares civil dates without local timezone conversion',()=>{
  expect(compareReleaseDates(row('a','A','2024-01-01'),row('b','B','2024-01-02'),'asc')).toBeLessThan(0)
 })
})
