import json,sys,numpy as np,soundfile as sf,subprocess
SR=44100
id,bpm,tr=sys.argv[1],sys.argv[2],sys.argv[3]
m=json.load(open(f'out/{id}.json'));T=m['T']
subprocess.run([sys.executable,'music.py',str(T),bpm,tr,f'out/{id}.m.wav'],check=True)
mus,_=sf.read(f'out/{id}.m.wav');out=mus*.8
def add(sig,t,g=1):
    i=int(t*SR);j=min(len(out),i+len(sig))
    if i<len(out): out[i:j]+=(sig[:j-i]*g)[:,None]
tt=lambda d:np.arange(int(d*SR))/SR
for t,k in m['sfx']:
    if k=='tap':
        a=tt(.12);add((np.sin(2*np.pi*1800*a)*.5+np.random.default_rng(1).standard_normal(len(a))*.15)*np.exp(-a*45),t,.5)
    elif k=='pop':
        a=tt(.18);f=600+900*a/.18;add(np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-a*20),t,.35)
    elif k=='buzz':
        for q in range(3):
            a=tt(.22);add(np.sign(np.sin(2*np.pi*165*a))*np.sin(np.pi*a/.22)*.25,t+q*.32,.6)
out/=np.abs(out).max()/.89
sf.write(f'out/{id}.a.wav',out,SR)
