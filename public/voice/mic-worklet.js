/* Mic capture: downsamples the context rate to 16 kHz and posts 80 ms Int16 frames plus an RMS level. */
class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.frame = new Int16Array(1280);
    this.n = 0;
    this.pos = 0;
    this.acc = 0;
    this.cnt = 0;
    this.sq = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i];
      this.cnt++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const v = Math.max(-1, Math.min(1, this.acc / this.cnt));
        this.acc = 0;
        this.cnt = 0;
        this.sq += v * v;
        this.frame[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        if (this.n === this.frame.length) {
          const level = Math.sqrt(this.sq / this.n);
          this.port.postMessage({ pcm: this.frame.buffer, level }, [this.frame.buffer]);
          this.frame = new Int16Array(1280);
          this.n = 0;
          this.sq = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("mic-capture", MicCapture);
