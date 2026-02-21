# Voice Noise Resilience Plan

> **Goal:** Eliminate false interruptions during live voice chat caused by background noise in restaurant environments.
>
> **Approach:** Layered — implement and test one layer at a time. Only proceed to the next layer if testing confirms the current layer is insufficient.
>
> **Date:** 2026-02-21

---

## Table of Contents

1. [Problem Analysis](#problem-analysis)
2. [Layer 1: Server-Side VAD Tuning + OpenAI Noise Reduction](#layer-1-server-side-vad-tuning--openai-noise-reduction)
3. [Layer 2: Client-Side Noise Gate](#layer-2-client-side-noise-gate)
4. [Layer 3: Push-to-Talk Mode (Manual Toggle)](#layer-3-push-to-talk-mode-manual-toggle)
5. [Layer 4: Adaptive Auto-Switch (Smart Gate)](#layer-4-adaptive-auto-switch-smart-gate)
6. [Testing Protocol](#testing-protocol)
7. [File Reference](#file-reference)

---

## Problem Analysis

### What Happens

1. Background noise (kitchen clatter, music, nearby conversations) reaches the microphone
2. Browser's built-in `noiseSuppression: true` helps but is insufficient in loud restaurant environments
3. The raw audio stream goes directly to OpenAI via WebRTC — **no client-side filtering**
4. OpenAI's server VAD detects the noise as speech (`threshold: 0.5`)
5. OpenAI fires `input_audio_buffer.speech_started` — **immediately cuts off the AI mid-sentence**
6. Silence returns → OpenAI fires `speech_stopped` and commits the noise as a "user turn"
7. The AI tries to respond to gibberish/silence → stuttering, broken conversation

### Current Configuration (Both Edge Functions)

| Parameter | Value | Location |
|-----------|-------|----------|
| `turn_detection.type` | `server_vad` | `realtime-voice/index.ts:220`, `realtime-session/index.ts:486` |
| `turn_detection.threshold` | `0.5` | `realtime-voice/index.ts:221`, `realtime-session/index.ts:487` |
| `turn_detection.prefix_padding_ms` | `300` | `realtime-voice/index.ts:222`, `realtime-session/index.ts:488` |
| `turn_detection.silence_duration_ms` | `800` | `realtime-voice/index.ts:223`, `realtime-session/index.ts:489` |
| `input_audio_noise_reduction` | **NOT SET** | — |
| `interrupt_response` | **NOT SET** (defaults `true`) | — |

### What's Missing

- **No `input_audio_noise_reduction`** — OpenAI has a built-in noise filter and we're not using it
- **No client-side noise gate** — WebRTC sends the mic track raw (no AnalyserNode filtering)
- **No push-to-talk option** — always voice-activated, no manual override
- **No interruption monitoring** — no way to detect "too many false triggers" and adapt
- **`track.enabled` is never toggled** — the mic track stays hot from connect to disconnect

---

## Layer 1: Server-Side VAD Tuning + OpenAI Noise Reduction

### Priority: HIGHEST — Deploy First

This layer requires **zero client-side changes**. All changes are in the two edge functions. Deploy, test, and evaluate before moving to Layer 2.

### 1.1 — Enable OpenAI's Built-In Noise Reduction

OpenAI provides `input_audio_noise_reduction` at the session level. It filters audio **before** it reaches VAD and the model. We are not using it.

**Add to session config in both edge functions:**

```typescript
input_audio_noise_reduction: {
  type: 'near_field'   // Phone/tablet held close to face
}
```

| Type | Use Case |
|------|----------|
| `near_field` | Close-talking: phone, tablet, headset — **our primary use case** |
| `far_field` | Far-field: laptop mics, speakerphones, conference mics |

**Files to modify:**
- `supabase/functions/realtime-voice/index.ts` — Add to `buildSessionUpdate()` return object (after line 218)
- `supabase/functions/realtime-session/index.ts` — Add to `sessionConfig` object (line 474) or inside the `if (!listenOnly)` block (line 482)

### 1.2 — Raise VAD Threshold

Higher threshold = louder sound required to trigger speech detection.

| Parameter | Current | New Value | Rationale |
|-----------|---------|-----------|-----------|
| `threshold` | `0.5` | `0.7` | Filters out moderate ambient noise while still detecting normal speech |

**Files to modify:**
- `supabase/functions/realtime-voice/index.ts:221` — Change `0.5` → `0.7`
- `supabase/functions/realtime-session/index.ts:487` — Change `0.5` → `0.7`

> **Note:** Start at `0.7`. If still too sensitive, try `0.8`. Going above `0.85` may require the user to speak loudly, which is unnatural. We can fine-tune after testing.

### 1.3 — Increase Silence Duration

Longer silence requirement = brief noise bursts won't trigger a turn commit.

| Parameter | Current | New Value | Rationale |
|-----------|---------|-----------|-----------|
| `silence_duration_ms` | `800` | `1200` | Prevents brief clanks/bumps from committing a turn. 1.2s still feels responsive. |

**Files to modify:**
- `supabase/functions/realtime-voice/index.ts:223` — Change `800` → `1200`
- `supabase/functions/realtime-session/index.ts:489` — Change `800` → `1200`

### 1.4 — Increase Prefix Padding

Longer prefix = more sustained sound required before VAD activates.

| Parameter | Current | New Value | Rationale |
|-----------|---------|-----------|-----------|
| `prefix_padding_ms` | `300` | `500` | Captures more context and requires more sustained sound before triggering |

**Files to modify:**
- `supabase/functions/realtime-voice/index.ts:222` — Change `300` → `500`
- `supabase/functions/realtime-session/index.ts:488` — Change `300` → `500`

### 1.5 — Consider `semantic_vad` (Optional, Evaluate)

OpenAI also offers `semantic_vad` which uses a **semantic classifier** to determine if the user has finished speaking — based on the **words said**, not just silence duration. This is less prone to false triggers from noise because it understands linguistic context.

```typescript
turn_detection: {
  type: 'semantic_vad',
  eagerness: 'medium',       // 'low' | 'medium' | 'high' | 'auto'
  create_response: true,
  interrupt_response: true,
}
```

| Eagerness | Behavior | Max Wait |
|-----------|----------|----------|
| `low` | Waits longer for user to continue | ~8 seconds |
| `medium` | Balanced (default) | ~4 seconds |
| `high` | Responds quickly | ~2 seconds |

**Trade-off:** Slightly higher latency than `server_vad` due to semantic analysis. Test both and compare. `semantic_vad` does **not** use `threshold`, `silence_duration_ms`, or `prefix_padding_ms` — it has its own `eagerness` parameter instead.

**Decision:** Test Layer 1.1–1.4 first. If noise issues persist, try swapping `server_vad` for `semantic_vad` with `eagerness: 'medium'` before moving to Layer 2.

### Layer 1 — Final Config (Target)

**`realtime-voice/index.ts` — `buildSessionUpdate()` return object:**
```typescript
session: {
  modalities: ['text', 'audio'],
  voice: 'alloy',
  input_audio_format: 'pcm16',
  output_audio_format: 'pcm16',
  input_audio_transcription: { model: 'whisper-1' },
  input_audio_noise_reduction: { type: 'near_field' },   // NEW
  turn_detection: {
    type: 'server_vad',
    threshold: 0.7,              // WAS 0.5
    prefix_padding_ms: 500,      // WAS 300
    silence_duration_ms: 1200,   // WAS 800
  },
  instructions: systemPrompt,
  // ... tools, tool_choice
}
```

**`realtime-session/index.ts` — `sessionConfig` assembly:**
```typescript
const sessionConfig: Record<string, any> = {
  model: 'gpt-realtime-2025-08-28',
  voice,
  instructions: systemPrompt,
  tools: /* ... */,
  tool_choice: /* ... */,
  input_audio_noise_reduction: { type: 'near_field' },   // NEW
};

if (!listenOnly) {
  sessionConfig.input_audio_transcription = { model: 'whisper-1' };
  sessionConfig.turn_detection = {
    type: 'server_vad',
    threshold: 0.7,              // WAS 0.5
    prefix_padding_ms: 500,      // WAS 300
    silence_duration_ms: 1200,   // WAS 800
  };
}
```

### Layer 1 — Deployment Steps

1. Modify `realtime-voice/index.ts` (4 changes)
2. Modify `realtime-session/index.ts` (4 changes)
3. Deploy: `npx supabase functions deploy realtime-voice && npx supabase functions deploy realtime-session`
4. **TEST** — See [Testing Protocol](#testing-protocol)

### STOP — Test Layer 1

> **Do NOT proceed to Layer 2 until Layer 1 has been tested in a real noisy environment.**
> If Layer 1 resolves the issue, we're done.
> If interruptions are reduced but still occur, proceed to Layer 2.

---

## Layer 2: Client-Side Noise Gate

### Priority: MEDIUM — Only if Layer 1 is insufficient

This layer adds a Web Audio API `AnalyserNode` to the WebRTC mic track, monitoring audio levels in real-time. When the level is below a threshold, the mic track is muted (`track.enabled = false`), preventing noise from ever reaching OpenAI.

### 2.1 — Architecture

```
Microphone → getUserMedia() → MediaStream
                                   ↓
                         AudioContext.createMediaStreamSource()
                                   ↓
                              AnalyserNode (FFT analysis)
                                   ↓
                          getByteFrequencyData() → average amplitude
                                   ↓
                    ┌──────────────────────────────────┐
                    │  average > GATE_THRESHOLD (e.g. 15)?  │
                    └──────────────────────────────────┘
                         YES ↓              NO ↓
                   track.enabled = true   track.enabled = false
                         ↓                     ↓
                   Audio sent to OpenAI   Silence sent to OpenAI
```

### 2.2 — Existing Pattern to Follow

The text-mode recording hook (`use-voice-recording.ts:253-300`) already implements this exact pattern for silence detection. We adapt it for the WebRTC hook.

**Existing code (reference only — from `use-voice-recording.ts`):**
```typescript
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
source.connect(analyser);

const dataArray = new Uint8Array(analyser.frequencyBinCount);

const checkSilence = () => {
  analyser.getByteFrequencyData(dataArray);
  const average = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

  if (average > 10) {
    lastSoundTimeRef.current = Date.now();
  }

  animFrameRef.current = requestAnimationFrame(checkSilence);
};
```

### 2.3 — Implementation Plan

**File to modify:** `src/hooks/use-realtime-webrtc.ts`

**New refs needed:**
```typescript
const audioContextRef = useRef<AudioContext | null>(null);
const animFrameRef = useRef<number | null>(null);
```

**Where to add the noise gate:** Inside `connect()`, after `getUserMedia()` succeeds (after line 454), before `pc.addTrack()` (line 467):

1. Create `AudioContext` and `AnalyserNode` from the media stream
2. Start a `requestAnimationFrame` loop that:
   - Reads `getByteFrequencyData()`
   - Computes average amplitude
   - If `average < GATE_THRESHOLD` → `track.enabled = false` (mute)
   - If `average >= GATE_THRESHOLD` → `track.enabled = true` (unmute)
3. Add debounce: require the level to stay above threshold for ~100ms before unmuting (prevents single-sample spikes from triggering)

**Threshold tuning:**
| Threshold | Behavior |
|-----------|----------|
| `10` | Very permissive — same as voice recording hook |
| `15` | Moderate — filters soft ambient noise |
| `20` | Aggressive — requires clear speech |
| `25+` | Very aggressive — may clip quiet speakers |

> **Start with `15`**, test, adjust up/down as needed.

**Cleanup:** In the `cleanup()` function (line 325), add:
- Cancel `animFrameRef.current` via `cancelAnimationFrame()`
- Close `audioContextRef.current` via `.close()`

### 2.4 — Audio Level Reporting (Optional Enhancement)

Expose the current audio level to the UI so the user gets visual feedback:

- Add `audioLevel` state to the hook return interface
- Update it at ~10fps (throttled, same pattern as `use-voice-recording.ts:275-280`)
- The `VoiceModeButton` or a new indicator could pulse/scale based on this level
- Helps users understand when their mic is picking up noise vs speech

### 2.5 — Deployment Steps

1. Modify `src/hooks/use-realtime-webrtc.ts` (add noise gate logic)
2. No edge function changes needed
3. Build and test locally: `npm run dev`
4. **TEST** — See [Testing Protocol](#testing-protocol)

### STOP — Test Layer 2

> **Do NOT proceed to Layer 3 until Layer 2 has been tested in a real noisy environment.**
> If Layers 1+2 resolve the issue, we're done.
> If interruptions still occur in very noisy environments, proceed to Layer 3.

---

## Layer 3: Push-to-Talk Mode (Manual Toggle)

### Priority: LOW — Only if Layers 1+2 are insufficient

This layer adds a manual "Push-to-Talk" mode that the user can toggle. When enabled, the microphone is muted by default and only transmits audio while the user holds a button.

### 3.1 — Architecture

```
┌─────────────────────────────────────┐
│         Mode Toggle (UI)            │
│  [Voice-Activated]  [Push-to-Talk]  │
└─────────────────────────────────────┘
         ↓                    ↓
   Normal mode          Push-to-Talk mode
   (Layers 1+2)         ↓
                    track.enabled = false (default)
                    turn_detection: null (server)
                         ↓
                    User holds button
                         ↓
                    input_audio_buffer.clear
                    track.enabled = true
                         ↓
                    User releases button
                         ↓
                    track.enabled = false
                    input_audio_buffer.commit
                    response.create
```

### 3.2 — Server-Side Changes

When push-to-talk is active, the session must be configured with `turn_detection: null` so OpenAI doesn't try to auto-detect speech boundaries.

**Option A — Client sends mode via session params:**

The `realtime-session/index.ts` edge function already accepts params from the client. Add a new `pushToTalk` boolean parameter:

```typescript
// In realtime-session/index.ts, when building sessionConfig:
if (pushToTalk) {
  // No turn detection — client manages turns manually
  sessionConfig.turn_detection = null;
  sessionConfig.input_audio_transcription = { model: 'whisper-1' };
} else if (!listenOnly) {
  sessionConfig.input_audio_transcription = { model: 'whisper-1' };
  sessionConfig.turn_detection = { /* server_vad config */ };
}
```

**Option B — Client updates session after connect:**

Send a `session.update` message via the data channel after connecting:

```typescript
dcRef.current.send(JSON.stringify({
  type: 'session.update',
  session: {
    turn_detection: null,
  },
}));
```

> **Recommendation:** Option A (pass `pushToTalk` to the session endpoint). Cleaner — the session starts in the right mode from the beginning.

### 3.3 — Client-Side Changes

**File: `src/hooks/use-realtime-webrtc.ts`**

**New option:**
```typescript
export interface UseRealtimeWebRTCOptions {
  // ... existing options
  /** Push-to-talk mode: mic muted by default, user holds button to speak */
  pushToTalk?: boolean;
}
```

**New return values:**
```typescript
export interface UseRealtimeWebRTCReturn {
  // ... existing returns
  /** Whether push-to-talk is active */
  pushToTalk: boolean;
  /** Call when user presses the talk button (unmutes mic) */
  pushStart: () => void;
  /** Call when user releases the talk button (mutes mic, commits audio) */
  pushEnd: () => void;
}
```

**`pushStart()` implementation:**
```typescript
const pushStart = useCallback(() => {
  const track = mediaStreamRef.current?.getTracks()[0];
  if (!track || !dcRef.current) return;

  // Clear any stale audio in the buffer
  dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));

  // Unmute the mic
  track.enabled = true;
  updateState('listening');
}, [updateState]);
```

**`pushEnd()` implementation:**
```typescript
const pushEnd = useCallback(() => {
  const track = mediaStreamRef.current?.getTracks()[0];
  if (!track || !dcRef.current) return;

  // Mute the mic
  track.enabled = false;
  updateState('processing');

  // Commit the audio buffer and request a response
  dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
  dcRef.current.send(JSON.stringify({
    type: 'response.create',
    response: { modalities: ['text', 'audio'] },
  }));
}, [updateState]);
```

**In `connect()`:** When `pushToTalk` is true, set `track.enabled = false` immediately after adding the track to the peer connection.

### 3.4 — UI Changes

**File: `src/components/ui/voice-mode-button.tsx`**

When push-to-talk is active and the voice state is `connected` (idle), the button behavior changes:

- **Label:** "Hold to Talk" (EN) / "Mantener para Hablar" (ES)
- **Events:** `onPointerDown` → `pushStart()`, `onPointerUp` / `onPointerLeave` → `pushEnd()`
- **Visual:** Different color/icon to distinguish from voice-activated mode (e.g., a hand icon)
- **While held:** Show `ListeningBars` animation (same as current listening state)

**File: `src/pages/Ask.tsx` and `src/components/manual/AskAboutContent.tsx`**

Add a mode toggle near the voice button:

```
┌─────────────────────────────────────┐
│  🎙 [Voice-Activated ▼]  [End]     │
│     ├─ Voice-Activated              │
│     └─ Push-to-Talk                 │
└─────────────────────────────────────┘
```

- Small dropdown or segmented control
- Persisted in `localStorage` so it remembers the user's preference
- Passed to `useRealtimeWebRTC({ pushToTalk: true/false })`

### 3.5 — Known WebRTC Caveat

Community reports indicate that `turn_detection: null` over WebRTC can sometimes break manual audio control. If this occurs:

**Workaround:** Instead of setting `turn_detection: null`, keep `server_vad` but set:
```typescript
turn_detection: {
  type: 'server_vad',
  threshold: 0.99,              // Nearly impossible to trigger via noise
  create_response: false,       // Don't auto-create response
  interrupt_response: false,    // Don't auto-interrupt AI speech
  silence_duration_ms: 60000,   // Effectively never auto-commit
}
```
Then manage turns manually via `input_audio_buffer.commit` + `response.create` on button release. This gives push-to-talk behavior while keeping the WebRTC connection stable.

### 3.6 — Deployment Steps

1. Modify `supabase/functions/realtime-session/index.ts` (add `pushToTalk` parameter handling)
2. Modify `src/hooks/use-realtime-webrtc.ts` (add `pushToTalk`, `pushStart`, `pushEnd`)
3. Modify `src/components/ui/voice-mode-button.tsx` (add hold-to-talk button behavior)
4. Modify `src/pages/Ask.tsx` and `src/components/manual/AskAboutContent.tsx` (add mode toggle)
5. Deploy edge function: `npx supabase functions deploy realtime-session`
6. Build and test locally: `npm run dev`
7. **TEST** — See [Testing Protocol](#testing-protocol)

### STOP — Test Layer 3

> **Do NOT proceed to Layer 4 until Layer 3 has been tested.**
> If the user can manually switch to push-to-talk when needed, that may be sufficient.
> Layer 4 automates that switch for a smoother experience.

---

## Layer 4: Adaptive Auto-Switch (Smart Gate)

### Priority: LOWEST — Quality-of-life enhancement

This layer monitors the frequency of false interruptions and automatically switches to push-to-talk mode when the environment is too noisy. It builds on top of Layer 3 (push-to-talk must already work).

### 4.1 — Architecture

```
┌───────────────────────────────────────┐
│        Interruption Monitor           │
│                                       │
│  Track: speech_started events         │
│  Window: rolling 30 seconds           │
│  Threshold: 5+ events in window       │
│                                       │
│  If exceeded:                         │
│    1. Auto-switch to push-to-talk     │
│    2. Show toast notification         │
│    3. Update session (turn_detection) │
│                                       │
│  User can manually switch back        │
└───────────────────────────────────────┘
```

### 4.2 — Implementation Plan

**File: `src/hooks/use-realtime-webrtc.ts`**

**New state:**
```typescript
const [voiceMode, setVoiceMode] = useState<'voice-activated' | 'push-to-talk'>('voice-activated');
const speechStartedTimestamps = useRef<number[]>([]);
```

**In the `speech_started` data channel handler (line 217):**
```typescript
case 'input_audio_buffer.speech_started': {
  const now = Date.now();
  speechStartedTimestamps.current.push(now);

  // Clean old entries (keep last 30 seconds)
  const cutoff = now - 30_000;
  speechStartedTimestamps.current = speechStartedTimestamps.current.filter(t => t > cutoff);

  // Check if too many triggers
  if (speechStartedTimestamps.current.length >= 5 && voiceMode === 'voice-activated') {
    // Auto-switch to push-to-talk
    switchToPushToTalk();
  }

  updateState('listening');
  break;
}
```

**`switchToPushToTalk()` function:**
1. Mute the mic track (`track.enabled = false`)
2. Send `session.update` via data channel with `turn_detection: null` (or high-threshold workaround)
3. Set `voiceMode` to `'push-to-talk'`
4. Show toast: "Noisy environment detected. Switched to Push-to-Talk." / "Ambiente ruidoso detectado. Cambio a Presionar para Hablar."
5. Reset the timestamps array

### 4.3 — Tuning Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `NOISE_WINDOW_MS` | `30000` | Rolling window for counting speech events |
| `NOISE_THRESHOLD_COUNT` | `5` | Number of speech_started events to trigger switch |
| `COOLDOWN_MS` | `60000` | After switching, don't auto-switch back for at least 1 minute |

These could be made configurable via constants at the top of the hook file.

### 4.4 — UI Changes

- The mode toggle from Layer 3 now also shows the current auto-detected mode
- When auto-switched, the toggle reflects the new state
- User can manually override back to voice-activated at any time
- If they switch back and noise triggers again, it auto-switches again after cooldown

### 4.5 — Deployment Steps

1. Modify `src/hooks/use-realtime-webrtc.ts` (add interruption monitor + auto-switch)
2. Modify mode toggle UI to support auto-detected state
3. Build and test locally: `npm run dev`
4. **TEST** — See [Testing Protocol](#testing-protocol)

---

## Testing Protocol

Use this protocol after deploying each layer. **Do not skip testing.**

### Environment Setup

1. Open the app on a phone/tablet (primary use case)
2. Log in as the test user
3. Navigate to the Ask page or a product AI action

### Test Scenarios

| # | Scenario | How to Simulate | Expected Result |
|---|----------|-----------------|-----------------|
| T1 | **Quiet room** | Speak normally in a quiet environment | AI responds without interruption, normal conversational flow |
| T2 | **Background music** | Play music at moderate volume (restaurant ambiance) | AI should NOT be interrupted by the music |
| T3 | **Kitchen clatter** | Play kitchen sounds (dishes, pans) or clap/tap near mic | Brief noises should NOT trigger a turn or cut off AI |
| T4 | **Nearby conversation** | Have someone talk nearby (not into the mic) | AI should NOT pick up the other person's speech |
| T5 | **Intentional speech** | Speak directly into the mic while AI is responding | AI SHOULD stop and listen to the user (intended interruption) |
| T6 | **Long pause** | Speak, then pause for 2-3 seconds, then continue | AI should wait for the pause, then respond — should NOT cut off mid-thought |
| T7 | **Whisper** | Speak very quietly into the mic | AI should still detect intentional speech (threshold not too high) |
| T8 | **Product pitch** | Trigger a listen-only pitch (voice-tts mode) | AI speaks the full pitch without being interrupted by ambient noise |

### Success Criteria Per Layer

| Layer | Pass If... |
|-------|------------|
| **Layer 1** | T1-T4 pass (no false interruptions from ambient noise). T5 still works (intentional interruption). T7 works (quiet speech detected). |
| **Layer 2** | T2-T4 dramatically improved. T7 still works. Audio level indicator (if added) responds to real speech. |
| **Layer 3** | Push-to-talk mode works: mic muted by default, audio only transmits while holding button. Mode toggle persists. T8 works in push-to-talk. |
| **Layer 4** | Auto-switch triggers after simulating 5+ noise bursts in 30 seconds. Toast notification appears. Manual override works. Cooldown prevents rapid toggling. |

### Regression Checks

After each layer, verify:
- [ ] Voice mode connects and disconnects cleanly
- [ ] Transcript shows user and assistant messages correctly
- [ ] Tool calls (search_handbook, product searches) still work during voice
- [ ] Listen-only / voice-tts mode still works for product pitches
- [ ] No console errors in browser dev tools
- [ ] Edge function logs show no new errors

---

## File Reference

### Edge Functions (Server-Side)

| File | What Changes | Layers |
|------|-------------|--------|
| `supabase/functions/realtime-voice/index.ts` | VAD config in `buildSessionUpdate()` (lines 219-224) | L1 |
| `supabase/functions/realtime-session/index.ts` | VAD config in `sessionConfig` (lines 485-490), new `pushToTalk` param | L1, L3 |

### React Hooks (Client-Side)

| File | What Changes | Layers |
|------|-------------|--------|
| `src/hooks/use-realtime-webrtc.ts` | Noise gate, push-to-talk, adaptive switch | L2, L3, L4 |
| `src/hooks/use-voice-recording.ts` | Reference only — has existing AnalyserNode pattern (lines 253-300) | — |

### UI Components

| File | What Changes | Layers |
|------|-------------|--------|
| `src/components/ui/voice-mode-button.tsx` | Hold-to-talk behavior, mode indicator | L3, L4 |
| `src/pages/Ask.tsx` | Mode toggle, pass pushToTalk to hook | L3, L4 |
| `src/components/manual/AskAboutContent.tsx` | Mode toggle, pass pushToTalk to hook | L3, L4 |
| `src/components/manual/VoiceTranscript.tsx` | No changes expected | — |

### Key Line References

| What | File | Lines |
|------|------|-------|
| VAD config (WebSocket relay) | `realtime-voice/index.ts` | 219-224 |
| VAD config (WebRTC session) | `realtime-session/index.ts` | 485-490 |
| Session config assembly | `realtime-session/index.ts` | 474-491 |
| Ephemeral key request | `realtime-session/index.ts` | 496-503 |
| speech_started handler (server) | `realtime-voice/index.ts` | 415-417 |
| speech_started handler (client) | `use-realtime-webrtc.ts` | 217-220 |
| getUserMedia constraints | `use-realtime-webrtc.ts` | 449-454 |
| Track added to PC | `use-realtime-webrtc.ts` | 467 |
| Data channel events | `use-realtime-webrtc.ts` | 197-317 |
| Cleanup function | `use-realtime-webrtc.ts` | 325-361 |
| Hook options interface | `use-realtime-webrtc.ts` | 26-42 |
| Existing noise gate pattern | `use-voice-recording.ts` | 253-300 |
| VoiceModeButton interface | `voice-mode-button.tsx` | 20-33 |
