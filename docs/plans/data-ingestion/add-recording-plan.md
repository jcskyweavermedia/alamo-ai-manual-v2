Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Plan: Voice-to-Text Transcription + Auto-Growing Textarea in ChatIngestionPanel

 Context

 The ChatIngestionPanel currently uses a single-line <Input> for typing recipe descriptions. Chefs in a     
 kitchen need a hands-free option to dictate recipes. The app already has a complete voice recording +      
 Whisper transcription pipeline (useVoiceRecording hook + /transcribe edge function) used in the Ask page   
 via VoiceChatInput. We reuse this exact infrastructure — the mic button just records audio, transcribes    
 via Whisper, and fills the text input. One-way transcription only, no live conversation.

 Additionally, the single-line input is too small for multi-line recipe descriptions. We convert it to an   
 auto-growing <Textarea> capped at ~5 lines, then scrollable.

 ---
 Changes

 1. Replace <Input> with auto-growing <Textarea> in ChatIngestionPanel

 File: src/components/ingest/ChatIngestionPanel.tsx

 - Import Textarea from @/components/ui/textarea (replaces Input import for the chat field)
 - Replace the chat <Input> with <Textarea>:
   - rows={1} — starts as a single line (like the current input)
   - onInput handler auto-grows height up to a max (~120px ≈ 5 lines), then scrolls via overflow-y: auto    
   - Enter sends (existing handleKeyDown), Shift+Enter inserts newline
   - Same placeholder, value, onChange, disabled, ref wiring
   - Override min-h from the base Textarea component (which has min-h-[88px]) to min-h-[40px] so it starts  
 compact
 - Keep the inputRef but change its type from HTMLInputElement to HTMLTextAreaElement
 - Update handleKeyDown — Enter sends only when Shift is NOT held (already the pattern), Shift+Enter        
 inserts newline naturally

 2. Add mic button + recording UI to the input bar

 File: src/components/ingest/ChatIngestionPanel.tsx

 - Import useVoiceRecording, formatRecordingTime, isRecordingSupported from @/hooks/use-voice-recording     
 - Import Mic, Square, Loader2 icons from lucide-react
 - Import useLanguage from @/hooks/use-language (for language hint to Whisper)
 - Wire up useVoiceRecording({ language, onTranscription }):
   - onTranscription(text) → append text to input state, focus textarea
 - Add a Mic button in the input bar between the Paperclip and the Textarea:
   - Idle: ghost mic icon
   - Recording: destructive (red) mic icon with pulsing CSS animation (recording-indicator class — already  
 in index.css)
   - Transcribing: disabled mic with Loader2 spinner
   - Click toggles start/stop recording
 - Add a recording timer badge (conditionally rendered when recording):
   - Shows elapsed time as M:SS using formatRecordingTime()
   - Red badge, same style as VoiceChatInput timer
   - Positioned next to mic button
 - Add a Stop button when recording:
   - Replace the Send button with a red Stop (Square icon) button during recording
   - Clear visual signal that recording is active and stoppable
 - When transcribing:
   - Send button area shows a Loader2 spinner
   - Textarea placeholder changes to "Transcribing..." (bilingual)
   - Textarea is disabled

 3. Add silence detection to useVoiceRecording hook

 File: src/hooks/use-voice-recording.ts

 This is the key enhancement for the chef use case. The existing hook has a hard 60s cutoff but no silence  
 detection.

 - Add new option: silenceTimeoutMs (default: 4000 — 4 seconds of silence for chefs who pause between       
 thoughts)
 - Add new option: maxRecordingSeconds (default: 120 — 2 minutes for long recipe dictation, overridable     
 per-consumer)
 - Implementation:
   - During startRecording(), create an AudioContext + AnalyserNode from the media stream
   - Run an requestAnimationFrame loop checking volume (RMS of frequency data)
   - Track lastSoundTime — reset whenever volume exceeds a threshold (e.g., RMS > 10 out of 255)
   - When Date.now() - lastSoundTime > silenceTimeoutMs → auto-call stopRecording()
   - Clean up AudioContext on stop/cancel/unmount
 - Update MAX_RECORDING_SECONDS usage to use the configurable maxRecordingSeconds option
 - Update WARNING_SECONDS to be maxRecordingSeconds - 10
 - Existing consumers unaffected — silence detection defaults to off when silenceTimeoutMs is not provided
 (set default to 0 = disabled). Only the ingestion panel enables it.

 4. Wire silence detection in ChatIngestionPanel

 File: src/components/ingest/ChatIngestionPanel.tsx

 - Pass silenceTimeoutMs: 4000 and maxRecordingSeconds: 120 to useVoiceRecording() so chef recordings       
 auto-stop after 4s of silence, max 2 minutes.

 ---
 Files Modified
 File: src/components/ingest/ChatIngestionPanel.tsx
 Action: Edit
 Scope: Replace Input→Textarea, add mic button + recording UI, wire useVoiceRecording
 ────────────────────────────────────────
 File: src/hooks/use-voice-recording.ts
 Action: Edit
 Scope: Add silence detection via AudioContext/AnalyserNode, configurable max duration
 No new files. Everything reuses existing hook + edge function + CSS animations.

 ---
 Input Bar Layout (Visual)

 Idle:
 [📎 Attach] [🎤 Mic] [ Textarea (auto-grow)                ] [▶ Send]

 Recording:
 [📎 Attach] [🎤 Mic (red pulse)] [0:12] [ Textarea (disabled) ] [⬛ Stop]

 Transcribing:
 [📎 Attach] [🎤 (disabled)] [ "Transcribing..." (disabled)    ] [⏳ Loader]

 ---
 Silence Detection Details

 - AudioContext created from the mic MediaStream (same stream as MediaRecorder)
 - AnalyserNode with fftSize: 256 for fast frequency sampling
 - Volume check: getByteFrequencyData() → compute average → compare to threshold
 - Threshold: ~10/255 (tuned for kitchen background noise — not too sensitive)
 - Silence timer: 4000ms (4 seconds) — generous for chefs who pause between sentences
 - Max recording: 120s (2 minutes) — plenty for a full recipe dictation
 - Warning: at 110s (10 seconds before max)
 - Cleanup: AudioContext closed on stop/cancel/unmount

 ---
 Verification

 1. npx tsc --noEmit — 0 errors
 2. Textarea: Type multi-line text → grows to ~5 lines → scroll appears after that → Enter sends,
 Shift+Enter newlines
 3. Mic idle: Click mic → browser mic permission prompt → recording starts
 4. Recording UI: Red pulsing mic, timer counting, Stop button visible, textarea disabled
 5. Manual stop: Click Stop or red mic → transcription starts → "Transcribing..." shown → text appears in   
 textarea
 6. Silence auto-stop: Speak, then go silent for 4s → recording auto-stops and transcribes
 7. Max time: Record for 2 min → auto-stops at 120s
 8. Append: Record a second time → new text appends to existing text (doesn't overwrite)
 9. Cancel: Press Escape during recording → recording discarded, no transcription
 10. Existing consumers: VoiceChatInput and QuizVoiceQuestion still work as before (they don't pass
 silenceTimeoutMs, so silence detection is off for them)