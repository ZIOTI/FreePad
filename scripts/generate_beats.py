import os
import wave
import numpy as np

SAMPLE_RATE = 48000

def create_kick(sample_rate, duration=0.45):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    # Exponential frequency drop from 180 Hz to 42 Hz
    freq = 42.0 + (180.0 - 42.0) * np.exp(-t * 22)
    phase = 2 * np.pi * np.cumsum(freq) / sample_rate
    env = np.exp(-t * 10)
    sig = np.sin(phase) * env
    # Add punch click at attack
    click_t = t[:int(sample_rate * 0.01)]
    click = np.sin(2 * np.pi * 900 * click_t) * np.exp(-click_t * 500)
    sig[:len(click)] += click * 0.4
    # Soft saturation
    sig = np.tanh(sig * 1.5)
    return sig

def create_snare(sample_rate, duration=0.3):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    # Tone
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 25)
    # Noise body
    noise = np.random.uniform(-1, 1, len(t)) * np.exp(-t * 16)
    sig = tone * 0.4 + noise * 0.6
    return np.tanh(sig * 1.3)

def create_hihat(sample_rate, duration=0.08, open_hat=False):
    dur = 0.25 if open_hat else duration
    t = np.linspace(0, dur, int(sample_rate * dur), False)
    noise = np.random.uniform(-1, 1, len(t))
    # High-pass simulation with differentiation
    noise = np.diff(noise, prepend=0)
    decay = 12 if open_hat else 45
    env = np.exp(-t * decay)
    return noise * env * 0.35

def create_808_sub(sample_rate, freq, duration):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    phase = 2 * np.pi * freq * t
    sig = np.sin(phase) + 0.3 * np.sin(2 * phase) + 0.1 * np.sin(3 * phase)
    env = np.ones_like(t)
    decay_len = int(sample_rate * 0.08)
    env[-decay_len:] = np.linspace(1, 0, decay_len)
    return np.tanh(sig * 1.8) * env * 0.85

def create_cowbell(sample_rate, freq, duration=0.25):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    # Two detuned square/pulse waves bandpass-like
    w1 = np.sign(np.sin(2 * np.pi * freq * t))
    w2 = np.sign(np.sin(2 * np.pi * (freq * 1.48) * t))
    sig = (w1 + w2) * 0.5
    env = np.exp(-t * 18)
    return sig * env * 0.5

def save_wav(filename, stereo_data, sample_rate=48000):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    # Normalize peak to -1 dB
    peak = np.max(np.abs(stereo_data))
    if peak > 0:
        stereo_data = stereo_data * (0.89 / peak)
    
    int_data = (stereo_data * 32767).astype(np.int16)
    with wave.open(filename, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(int_data.tobytes())
    print(f"Generated: {filename} ({len(int_data)/sample_rate:.2f}s)")

# -------------------------------------------------------------
# 1. DRILL BEAT (140 BPM, 4 Bars)
# -------------------------------------------------------------
def generate_drill():
    bpm = 140
    beat_dur = 60.0 / bpm
    total_beats = 16  # 4 bars
    total_dur = total_beats * beat_dur
    num_samples = int(SAMPLE_RATE * total_dur)
    left = np.zeros(num_samples)
    right = np.zeros(num_samples)
    
    kick = create_kick(SAMPLE_RATE, 0.4)
    snare = create_snare(SAMPLE_RATE, 0.28)
    hihat = create_hihat(SAMPLE_RATE, 0.06)
    openhat = create_hihat(SAMPLE_RATE, 0.2, open_hat=True)
    
    # Drill rhythm:
    # Bar = 4 beats. Beats 0, 1, 2, 3
    # Snare on 2 (or 3 in half-time), typical drill has snares on 3 with ghost snares
    for bar in range(4):
        bar_start = bar * 4 * beat_dur
        # Kicks: Drill syncopated pattern
        kick_times = [0.0, 1.75, 2.5]
        for kt in kick_times:
            pos = int((bar_start + kt * beat_dur) * SAMPLE_RATE)
            if pos + len(kick) <= num_samples:
                left[pos:pos+len(kick)] += kick * 0.95
                right[pos:pos+len(kick)] += kick * 0.95
                
        # Main Snare on beat 3
        pos = int((bar_start + 3.0 * beat_dur) * SAMPLE_RATE)
        if pos + len(snare) <= num_samples:
            left[pos:pos+len(snare)] += snare * 0.9
            right[pos:pos+len(snare)] += snare * 0.9
            
        # Ghost snare on beat 3.75
        pos_ghost = int((bar_start + 3.75 * beat_dur) * SAMPLE_RATE)
        if pos_ghost + len(snare) <= num_samples:
            left[pos_ghost:pos_ghost+len(snare)] += snare * 0.4
            right[pos_ghost:pos_ghost+len(snare)] += snare * 0.4

        # Hi-hats: Syncopated UK Drill swing (1/8th and 1/16th triplets)
        for h in range(16):
            h_time = bar_start + (h * 0.25) * beat_dur
            pos_h = int(h_time * SAMPLE_RATE)
            if pos_h + len(hihat) <= num_samples:
                vol = 0.55 if (h % 2 == 0) else 0.35
                pan = 0.8 if (h % 4 == 0) else 0.2
                left[pos_h:pos_h+len(hihat)] += hihat * vol * pan
                right[pos_h:pos_h+len(hihat)] += hihat * vol * (1.0 - pan)
                
        # 808 Bass notes per bar: F1 (43.65), G#1 (51.9), D#1 (38.89), C1 (32.7)
        bass_freqs = [43.65, 51.91, 38.89, 43.65]
        bf = bass_freqs[bar]
        bass = create_808_sub(SAMPLE_RATE, bf, beat_dur * 3.5)
        pos_b = int(bar_start * SAMPLE_RATE)
        if pos_b + len(bass) <= num_samples:
            left[pos_b:pos_b+len(bass)] += bass * 0.85
            right[pos_b:pos_b+len(bass)] += bass * 0.85

    stereo = np.column_stack([left, right])
    save_wav(r"C:\Users\FlowUP\Documents\PROJETS\FreePad\public\beats\drill_140bpm.wav", stereo)

# -------------------------------------------------------------
# 2. PHONK DRIFT BEAT (130 BPM, 4 Bars)
# -------------------------------------------------------------
def generate_phonk():
    bpm = 130
    beat_dur = 60.0 / bpm
    total_beats = 16
    total_dur = total_beats * beat_dur
    num_samples = int(SAMPLE_RATE * total_dur)
    left = np.zeros(num_samples)
    right = np.zeros(num_samples)
    
    kick = create_kick(SAMPLE_RATE, 0.35)
    snare = create_snare(SAMPLE_RATE, 0.22)
    hihat = create_hihat(SAMPLE_RATE, 0.05)
    
    # Cowbell melody (F# minor / Memphis Phonk: F#4=370, A4=440, B4=494, C#5=554, E5=659)
    cowbell_notes = [
        (0.0, 554.37), (0.5, 493.88), (1.0, 440.0), (1.5, 369.99),
        (2.0, 440.0),  (2.5, 493.88), (3.0, 554.37), (3.5, 659.25),
        (4.0, 554.37), (4.5, 493.88), (5.0, 440.0), (5.5, 369.99),
        (6.0, 440.0),  (6.5, 369.99), (7.0, 329.63), (7.5, 369.99),
    ]
    for b_idx in range(2): # loop 2-bar melody twice
        offset = b_idx * 8.0 * beat_dur
        for note_time, freq in cowbell_notes:
            cb = create_cowbell(SAMPLE_RATE, freq, 0.22)
            pos = int((offset + note_time * beat_dur) * SAMPLE_RATE)
            if pos + len(cb) <= num_samples:
                left[pos:pos+len(cb)] += cb * 0.7
                right[pos:pos+len(cb)] += cb * 0.7

    for bar in range(4):
        bar_start = bar * 4 * beat_dur
        # Hard Phonk Kick on 1 and 3 (with syncopation)
        for k_beat in [0.0, 1.5, 2.0, 3.25]:
            pos = int((bar_start + k_beat * beat_dur) * SAMPLE_RATE)
            if pos + len(kick) <= num_samples:
                left[pos:pos+len(kick)] += kick * 1.05
                right[pos:pos+len(kick)] += kick * 1.05

        # Hard Clapping Snare on 2 and 4
        for s_beat in [1.0, 3.0]:
            pos = int((bar_start + s_beat * beat_dur) * SAMPLE_RATE)
            if pos + len(snare) <= num_samples:
                left[pos:pos+len(snare)] += snare * 0.95
                right[pos:pos+len(snare)] += snare * 0.95

        # Rapid 16th Hi-Hats
        for h in range(16):
            pos_h = int((bar_start + h * 0.25 * beat_dur) * SAMPLE_RATE)
            if pos_h + len(hihat) <= num_samples:
                left[pos_h:pos_h+len(hihat)] += hihat * 0.4
                right[pos_h:pos_h+len(hihat)] += hihat * 0.4

        # Distorted 808 Bass (F#1 = 46.25 Hz)
        bass = create_808_sub(SAMPLE_RATE, 46.25 if bar % 2 == 0 else 41.2, beat_dur * 3.8)
        pos_b = int(bar_start * SAMPLE_RATE)
        if pos_b + len(bass) <= num_samples:
            left[pos_b:pos_b+len(bass)] += bass * 0.9
            right[pos_b:pos_b+len(bass)] += bass * 0.9

    stereo = np.column_stack([left, right])
    save_wav(r"C:\Users\FlowUP\Documents\PROJETS\FreePad\public\beats\phonk_130bpm.wav", stereo)

# -------------------------------------------------------------
# 3. TRAP BANGER BEAT (135 BPM, 4 Bars)
# -------------------------------------------------------------
def generate_trap():
    bpm = 135
    beat_dur = 60.0 / bpm
    total_beats = 16
    total_dur = total_beats * beat_dur
    num_samples = int(SAMPLE_RATE * total_dur)
    left = np.zeros(num_samples)
    right = np.zeros(num_samples)
    
    kick = create_kick(SAMPLE_RATE, 0.4)
    snare = create_snare(SAMPLE_RATE, 0.25)
    hihat = create_hihat(SAMPLE_RATE, 0.05)
    openhat = create_hihat(SAMPLE_RATE, 0.3, open_hat=True)

    for bar in range(4):
        bar_start = bar * 4 * beat_dur
        # Trap Kick on 1 and varying drop
        for kt in [0.0, 1.75, 2.0, 3.5]:
            pos = int((bar_start + kt * beat_dur) * SAMPLE_RATE)
            if pos + len(kick) <= num_samples:
                left[pos:pos+len(kick)] += kick * 0.95
                right[pos:pos+len(kick)] += kick * 0.95

        # Snare on 3 (half-time trap)
        pos_s = int((bar_start + 2.0 * beat_dur) * SAMPLE_RATE)
        if pos_s + len(snare) <= num_samples:
            left[pos_s:pos_s+len(snare)] += snare * 0.9
            right[pos_s:pos_s+len(snare)] += snare * 0.9

        # Open hat on upbeat 1.5 and 3.5
        for oh_t in [0.5, 2.5]:
            pos_oh = int((bar_start + oh_t * beat_dur) * SAMPLE_RATE)
            if pos_oh + len(openhat) <= num_samples:
                left[pos_oh:pos_oh+len(openhat)] += openhat * 0.35
                right[pos_oh:pos_oh+len(openhat)] += openhat * 0.35

        # Rolling Hi-hats with roll on beat 4
        for h in range(16):
            pos_h = int((bar_start + h * 0.25 * beat_dur) * SAMPLE_RATE)
            if pos_h + len(hihat) <= num_samples:
                left[pos_h:pos_h+len(hihat)] += hihat * 0.45
                right[pos_h:pos_h+len(hihat)] += hihat * 0.45
        
        # 32nd roll on the last beat
        for r in range(8):
            pos_r = int((bar_start + 3.5 * beat_dur + r * 0.0625 * beat_dur) * SAMPLE_RATE)
            if pos_r + len(hihat) <= num_samples:
                left[pos_r:pos_r+len(hihat)] += hihat * 0.35
                right[pos_r:pos_r+len(hihat)] += hihat * 0.35

        # Heavy 808 Trap Bass (C1=32.7, D#1=38.9, G1=49.0, F1=43.6)
        freqs = [32.7, 38.89, 49.0, 43.65]
        bass = create_808_sub(SAMPLE_RATE, freqs[bar], beat_dur * 3.6)
        pos_b = int(bar_start * SAMPLE_RATE)
        if pos_b + len(bass) <= num_samples:
            left[pos_b:pos_b+len(bass)] += bass * 0.9
            right[pos_b:pos_b+len(bass)] += bass * 0.9

    stereo = np.column_stack([left, right])
    save_wav(r"C:\Users\FlowUP\Documents\PROJETS\FreePad\public\beats\trap_135bpm.wav", stereo)

if __name__ == "__main__":
    generate_drill()
    generate_phonk()
    generate_trap()
    print("ALL BEATS GENERATED SUCCESSFULLY!")
