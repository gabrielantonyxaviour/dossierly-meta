// Desk-photo scene: CSS gradients for wood, 3D tilt, shadow, noise.
export const photoHtml = (src, dir) => `<!doctype html><meta charset="utf-8"><style>
*{margin:0}body{width:1200px;height:1600px;overflow:hidden;position:relative;perspective:1700px;
background:repeating-linear-gradient(92deg,#7a5230 0 7px,#86593a 7px 15px,#6d4727 15px 19px,#8a6140 19px 31px),#7a5230}
.wood{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,#ffffff22,transparent 60%),repeating-linear-gradient(88deg,transparent 0 60px,#0003 60px 62px)}
.sheet{position:absolute;left:${dir > 0 ? 95 : 130}px;top:${dir > 0 ? 150 : 175}px;width:930px;height:1316px;background:url("${src}") center/cover;
transform:rotateX(${dir > 0 ? 11 : 9}deg) rotateY(${dir > 0 ? -9 : 12}deg) rotateZ(${dir > 0 ? -3 : 3}deg);transform-origin:center;box-shadow:24px 40px 50px #0007,4px 6px 10px #0005}
.sheet:after{content:"";position:absolute;inset:0;background:linear-gradient(${dir > 0 ? 115 : 70}deg,#ffffff55 0%,transparent 35%,#00000055 100%),radial-gradient(circle at 70% 85%,#0003,transparent 40%)}
.mug{position:absolute;right:-60px;bottom:-40px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#e8e4dc,#a49f94);box-shadow:-30px 20px 40px #0006}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,#0006 100%)}
.noise{position:absolute;inset:0;opacity:.3;mix-blend-mode:overlay}
.wrap{position:absolute;inset:0;filter:blur(.9px) contrast(1.04) saturate(.95)}
</style><body><div class="wrap"><div class="wood"></div><div class="sheet"></div><div class="mug"></div><div class="vig"></div>
<svg class="noise" width="1200" height="1600"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg></div></body>`;
