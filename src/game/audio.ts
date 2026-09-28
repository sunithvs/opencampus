// A small, self-contained ambient soundscape. Audio starts only after a user gesture.
export class Ambience {
  private context?: AudioContext;
  private master?: GainNode;
  private timer?: number;
  setEnabled(enabled: boolean) {
    if (!enabled) { if (this.master && this.context) this.master.gain.setTargetAtTime(0, this.context.currentTime, .15); if (this.timer) clearTimeout(this.timer); return; }
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain(); this.master.gain.value = 0; this.master.connect(this.context.destination);
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
        const data = buffer.getChannelData(0); let last=0;
        for (let i=0;i<data.length;i++) { last=(last+(Math.random()*2-1)*.03)/1.025; data[i]=last*2; }
        const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;
        const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=450;
        source.connect(filter);filter.connect(this.master);source.start();
      }
      void this.context.resume(); this.master!.gain.setTargetAtTime(.15,this.context.currentTime,.3);
      if(this.timer)clearTimeout(this.timer);this.bird();
    } catch { /* Visual exploration remains available when browser audio is disabled. */ }
  }
  private bird=()=>{
    if(!this.context||!this.master)return;
    const t=this.context.currentTime;
    for(let i=0;i<3;i++){
      const o=this.context.createOscillator(),g=this.context.createGain();o.type='sine';o.frequency.setValueAtTime(1900+i*180,t+i*.16);o.frequency.exponentialRampToValueAtTime(2900-i*150,t+i*.16+.07);g.gain.setValueAtTime(0,t+i*.16);g.gain.linearRampToValueAtTime(.05,t+i*.16+.015);g.gain.exponentialRampToValueAtTime(.001,t+i*.16+.12);o.connect(g);g.connect(this.master);o.start(t+i*.16);o.stop(t+i*.16+.13);
    }
    this.timer=window.setTimeout(this.bird,4500+Math.random()*7000);
  };
}
