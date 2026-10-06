"""Original procedural music; deterministic and free of sampled recordings."""
import math, wave, array, random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
BPM = 96
BEAT = 60 / BPM

def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)

def make_music(seconds, destination):
    n = int(seconds * SR)
    left, right = array.array('f', [0]) * n, array.array('f', [0]) * n
    def note(start, midi, duration, gain, pan, kind='bell'):
        f = frequency(midi)
        begin = int(start * SR)
        count = min(int(duration * SR), n - begin)
        for j in range(max(0, count)):
            t = j / SR
            attack = min(1, t / .014)
            release = min(1, max(0, (duration - t) / .25))
            if kind == 'pad':
                tone = (math.sin(2*math.pi*f*t) + .18*math.sin(2*math.pi*f*2*t))
                env = min(1,t/.45) * release * math.exp(-t/3.5)
            else:
                tone = (math.sin(2*math.pi*f*t) + .25*math.sin(2*math.pi*f*2*t)*math.exp(-t*4))
                env = attack * release * math.exp(-t*2.3)
            value = tone * env * gain
            left[begin+j] += value * math.sqrt((1-pan)/2)
            right[begin+j] += value * math.sqrt((1+pan)/2)
    chords = [[50,57,61,66], [47,54,57,62], [43,50,54,59], [45,52,59,61]]
    for bar in range(math.ceil(seconds / (4 * BEAT))):
        start = bar * 4 * BEAT
        chord = chords[bar % 4]
        for i, pitch in enumerate(chord):
            note(start, pitch+12, 3.0, .025, (i-1.5)*.25, 'pad')
        note(start, chord[0], 1.8, .035, 0, 'pad')
        for step in [0, 1.5, 2.5, 3.5]:
            pitch = chord[int(step) % 4] + 24
            note(start+step*BEAT, pitch, 1.3, .023, -.3 if step < 2 else .3)
    # A small original pentatonic melody; no existing song or audio is used.
    melody = [74,78,81,78,76,74,73,76,74,71,69,74,76,73,69,73]
    for i in range(math.ceil(seconds/(2*BEAT))):
        note(i*2*BEAT+.28, melody[i % len(melody)], 1.0, .025, .2)
    peak = max(max(abs(v) for v in left), max(abs(v) for v in right))
    scale = .20/peak
    pcm = array.array('h')
    for i in range(n):
        t=i/SR
        envelope=min(1,t/1.2,max(0,(seconds-t)/2.0))
        pcm.append(round(left[i]*scale*envelope*32767))
        pcm.append(round(right[i]*scale*envelope*32767))
    with wave.open(str(destination), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

for name, duration in [('registro',42),('recuperar',39)]:
    output=ROOT/name/'assets'/'musica-original.wav'
    output.parent.mkdir(parents=True,exist_ok=True)
    make_music(duration,output)
    print(f'{name}: {duration}s, stereo 48kHz, original synthesis')
