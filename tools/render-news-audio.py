import math,random,wave,struct
from pathlib import Path
R=22050;random.seed(5)
fx={'chime':[(660,0,.14,'sine',.07),(880,.13,.14,'sine',.07),(1320,.26,.32,'sine',.07)],'page':[(540,0,.06,'triangle',.04)],'alert':[(900 if i%2==0 else 640,i*.2,.18,'square',.045) for i in range(6)],'good':[(523,0,.14,'sine',.07),(659,.11,.14,'sine',.07),(784,.22,.3,'sine',.07)],'bad':[(392,0,.2,'triangle',.07),(311,.18,.36,'triangle',.07)],'tick':[(1200,0,.03,'square',.02)]}
out=Path(__file__).resolve().parents[1]/'assets/audio'
for name,notes in list(fx.items())+[('rumble',[])]:
 dur=2 if name=='rumble' else max(a+d+.02 for f,a,d,t,v in notes);samples=[0.]*(int(dur*R)+1)
 if name=='rumble':
  y=0;alpha=1-math.exp(-2*math.pi*110/R)
  for i in range(len(samples)):
   noise=random.uniform(-1,1)*(1-i/len(samples));y+=alpha*(noise-y);samples[i]=.9*y
 else:
  for freq,at,dur,typ,vol in notes:
   for j in range(int((dur+.02)*R)):
    t=j/R;gain=vol*t/.015 if t<.015 else vol*(.0001/vol)**(min(1,(t-.015)/(dur-.015)))
    phase=2*math.pi*freq*t
    if typ=='sine':v=math.sin(phase)
    elif typ=='square':v=sum(math.sin(k*phase)/k for k in range(1,min(100,int((R/2)/freq))+1,2))*4/math.pi
    else:v=sum((-1)**((k-1)//2)*math.sin(k*phase)/k**2 for k in range(1,min(100,int((R/2)/freq))+1,2))*8/math.pi**2
    ix=int(at*R)+j
    if ix<len(samples):samples[ix]+=gain*v
 with wave.open(str(out/(name+'.wav')),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(R);w.writeframes(b''.join(struct.pack('<h',round(max(-1,min(1,x))*32767)) for x in samples))
print('Rendered seven WAV files using module 5 note frequencies, gains and timing.')
