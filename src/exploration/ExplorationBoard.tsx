import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react'
import AppButton from '../components/AppButton'
import {directions,walkMaze,type Direction,type ExplorationMaze,type Point} from '../../server/src/domain/exploration/maze'

const arrows:Readonly<Record<string,Direction>>={ArrowUp:'U',ArrowRight:'R',ArrowDown:'D',ArrowLeft:'L'}
export default function ExplorationBoard({maze,active,openedChest,busy,onOpen}:{maze:ExplorationMaze;active:boolean;openedChest:number|null;busy:boolean;onOpen:(index:number,path:string)=>void}) {
  const initial=()=>{
    const chest=openedChest===null?null:maze.chests[openedChest]
    return chest?Object.values(directions).map(delta=>({x:chest.x+delta.x,y:chest.y+delta.y})).find(at=>at.x>=0&&at.y>=0&&at.x<maze.width&&at.y<maze.height&&maze.cells[at.y*maze.width+at.x]===1)??maze.start:maze.start
  }
  const [position,setPosition]=useState<Point>(initial),board=useRef<HTMLDivElement>(null),held=useRef<Direction|null>(null),at=useRef(position),trail=useRef<Point[]>([maze.start]),proof=useRef(''),last=useRef(0),opening=useRef(onOpen)
  opening.current=onOpen
  const open=()=>{
    if(!active||busy)return
    const index=maze.chests.findIndex(chest=>Math.abs(chest.x-at.current.x)+Math.abs(chest.y-at.current.y)===1)
    if(index>=0)opening.current(index,proof.current)
  }
  const openRef=useRef(open);openRef.current=open
  const step=(direction:Direction)=>{
    if(!active||busy)return
    const next=walkMaze(maze,at.current,direction,true)
    if(next===at.current)return
    const previous=trail.current.findIndex(point=>point.x===next.x&&point.y===next.y)
    if(previous>=0){trail.current=trail.current.slice(0,previous+1);proof.current=proof.current.slice(0,previous)}
    else {trail.current.push(next);proof.current+=direction}
    at.current=next;setPosition(next)
  }
  const stepRef=useRef(step);stepRef.current=step
  useEffect(()=>{
    const focused=document.activeElement as HTMLElement|null
    if(!focused?.matches('input,textarea,select')&&!focused?.isContentEditable)board.current?.focus({preventScroll:true})
    if(window.matchMedia('(max-width:1120px)').matches)board.current?.closest('.exploration-screen')?.scrollIntoView?.({block:'start'})
  },[])
  useEffect(()=>{
    if(!active)return
    let frame=0,padOpen=false
    const stop=()=>{held.current=null}
    const tick=(time:number)=>{
      if(document.visibilityState==='visible'){
        let direction=held.current
        if(document.activeElement===board.current){
          const pad=navigator.getGamepads?.().find(value=>value?.connected)
          if(pad){direction=pad.buttons[12]?.pressed?'U':pad.buttons[13]?.pressed?'D':pad.buttons[14]?.pressed?'L':pad.buttons[15]?.pressed?'R':Math.abs(pad.axes[0]??0)>.45?(pad.axes[0]!>0?'R':'L'):Math.abs(pad.axes[1]??0)>.45?(pad.axes[1]!>0?'D':'U'):direction
            const pressed=Boolean(pad.buttons[0]?.pressed);if(pressed&&!padOpen)openRef.current();padOpen=pressed}
        }
        if(direction&&time-last.current>=100){last.current=time;stepRef.current(direction)}
      }
      frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick);window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop)
    return()=>{cancelAnimationFrame(frame);stop();window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop)}
  },[active])
  const keyboard=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(!active||event.target!==event.currentTarget)return
    if(arrows[event.key]){event.preventDefault();if(held.current!==arrows[event.key])last.current=0;held.current=arrows[event.key]}
    else if(event.code==='Space'){event.preventDefault();if(!event.repeat)open()}
  }
  const pointer=(event:PointerEvent<HTMLButtonElement>,direction:Direction)=>{event.preventDefault();if(!active||busy)return;event.currentTarget.setPointerCapture(event.pointerId);board.current?.focus({preventScroll:true});held.current=direction;last.current=0}
  return <>
    <div className="exploration-board" ref={board} tabIndex={0} role="application" aria-label="Labyrinthe : flèches pour avancer, Espace pour ouvrir un coffre adjacent" onKeyDown={keyboard} onKeyUp={event=>{if(arrows[event.key]){event.preventDefault();if(held.current===arrows[event.key])held.current=null}}} onBlur={()=>{held.current=null}}>
      <svg viewBox={`0 0 ${maze.width*32} ${maze.height*32}`} aria-hidden="true">
        <defs><filter id="exploration-avatar-outline"><feMorphology in="SourceAlpha" operator="dilate" radius=".8" result="outline"/><feFlood floodColor="white"/><feComposite in2="outline" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <rect width={maze.width*32} height={maze.height*32} rx="8" className="exploration-floor"/>
        {maze.cells.map((cell,index)=>cell===0&&<rect key={index} x={index%maze.width*32+.5} y={Math.floor(index/maze.width)*32+.5} width="31" height="31" rx="3" className="exploration-wall"/>)}
        <circle cx={maze.start.x*32+16} cy={maze.start.y*32+16} r="10" className="exploration-spawn"/>
        {maze.chests.map((chest,index)=><g key={index} className={openedChest===index?'exploration-chest opened':'exploration-chest'}><image href="/assets/exploration/chest.png" x={chest.x*32+2} y={chest.y*32+2} width="28" height="28"/><text x={chest.x*32+16} y={chest.y*32+22}>{index+1}</text></g>)}
        <image data-exploration-avatar href="/assets/exploration/avatar.png" width="24" height="27" filter="url(#exploration-avatar-outline)" style={{transform:`translate(${position.x*32+4}px,${position.y*32+2}px)`}}/>
      </svg>
    </div>
    <div className="exploration-controls"><div className="exploration-dpad" aria-label="Déplacements">
      {([['U','↑','Haut'],['L','←','Gauche'],['D','↓','Bas'],['R','→','Droite']] as const).map(([direction,symbol,label])=><AppButton key={direction} className={`exploration-direction direction-${direction}`} aria-label={label} disabled={!active||busy} onPointerDown={event=>pointer(event,direction)} onPointerUp={()=>{held.current=null}} onPointerCancel={()=>{held.current=null}} onClick={event=>{if(event.detail===0)step(direction)}}>{symbol}</AppButton>)}
    </div><AppButton variant="primary" disabled={!active||busy} onClick={open}>Ouvrir · Espace</AppButton><small>Flèches pour avancer · Choisissez un seul coffre</small></div>
  </>
}
