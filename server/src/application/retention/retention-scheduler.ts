import type { Clock } from '../../domain/time/business-date.js';
import type { RetentionLog } from './retention-engine.js';
import { nextCycleAt, type RetentionMode } from './retention-policy.js';

export class RetentionScheduler {
  private timer?:ReturnType<typeof setTimeout>;
  private stopped=true;
  private running?:Promise<void>;
  private controller?:AbortController;
  constructor(private readonly engine:{mode:RetentionMode;run(signal?:AbortSignal):Promise<unknown>},private readonly clock:Clock,
    private readonly log:RetentionLog=event=>console.info(JSON.stringify(event))) {}
  start() {
    if (!this.stopped) return;
    this.stopped=false;
    this.log({event:'RETENTION_SCHEDULED',mode:this.engine.mode,nextCycleAt:nextCycleAt(this.clock.now()).toISOString(),timeZone:'Europe/Paris'});
    if (this.engine.mode!=='DISABLED') void this.tick();
  }
  async stop() {this.stopped=true;if(this.timer) clearTimeout(this.timer);this.controller?.abort();await this.running;}
  private async tick() {
    if(this.stopped||this.running) return;
    this.controller=new AbortController();
    let delay=60_000;
    this.running=this.engine.run(this.controller.signal).then(result=>{
      if (result && typeof result==='object' && 'status' in result && result.status==='SUCCESS')
        delay=Math.max(1,nextCycleAt(this.clock.now()).getTime()-this.clock.now().getTime());
    }).catch(()=>{this.log({event:'RETENTION_CYCLE_FAILED',mode:this.engine.mode});});
    try {await this.running;}finally {this.running=undefined;if(!this.stopped){this.timer=setTimeout(()=>void this.tick(),delay);this.timer.unref?.();}}
  }
}
