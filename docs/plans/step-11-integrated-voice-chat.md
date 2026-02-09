# Step 11: Integrated Voice Chat Mode (GPT-Style)

## Overview

Replace the full-screen VoiceOrb UI with an **integrated voice mode** that uses the existing chat interface. This mirrors the ChatGPT approach:
- Voice mode activates within the current panel
- Transcribed messages appear in the same chat thread
- No separate full-screen overlay
- Button states change to show connection status

## Current State

- `VoiceConversation.tsx` - Full-screen overlay with VoiceOrb animation
- `DockedAIPanel.tsx` - Desktop docked panel with AskAboutContent
- `AskAboutContent.tsx` - Chat UI with VoiceChatInput
- `use-realtime-webrtc.ts` - WebRTC hook for voice

## Target Experience

### User Flow
1. User clicks **Wave/Mic** button in chat input
2. Button shows **X Cancel** while connecting
3. Once connected, button shows **END** 
4. Mic button interior shows animated indicator (dot/wave) during listening
5. User speaks → transcribed text appears in chat as user message
6. AI responds → transcribed response appears in chat as assistant message
7. User clicks **END** to disconnect

### Visual States (Voice Button)
| State | Button Icon | Label/Text | Interior Animation |
|-------|-------------|------------|-------------------|
| Disconnected | Mic | — | None |
| Connecting | X | "Cancel" | Spinner/pulse |
| Connected/Idle | Stop circle | "End" | Small dot |
| Listening | Stop circle | "End" | Animated waves |
| Processing | Stop circle | "End" | Pulsing dot |
| Speaking | Stop circle | "End" | Bouncing bars |

### Transcript Display
- Show **last 5 transcript entries** in the chat area
- User messages: Right-aligned, styled like existing user bubbles
- Assistant messages: Left-aligned, styled like existing AI cards (simplified)
- Scroll to bottom on new messages
- Clear transcript on disconnect (or keep? TBD)

## Implementation Plan

### Phase 1: Unified Transcript Component
**File:** `src/components/manual/VoiceTranscript.tsx`

```typescript
interface VoiceTranscriptProps {
  entries: TranscriptEntry[];
  maxEntries?: number; // default 5
  language: 'en' | 'es';
}
```

- Displays transcript entries in chat bubble style
- Scrolls to latest message
- Fades in new messages with animation

### Phase 2: Integrated Voice Button
**File:** `src/components/ui/voice-mode-button.tsx`

```typescript
interface VoiceModeButtonProps {
  state: WebRTCVoiceState;
  onConnect: () => void;
  onDisconnect: () => void;
  disabled?: boolean;
  language: 'en' | 'es';
}
```

States:
- `disconnected` → Mic icon, clickable to connect
- `connecting` → X icon with "Cancel" text
- `connected/listening/processing/speaking` → Stop circle with "End" + interior animation

### Phase 3: Integrate into AskAboutContent
**Modify:** `src/components/manual/AskAboutContent.tsx`

1. Add `useRealtimeWebRTC` hook integration
2. Replace VoiceChatInput voice button behavior
3. When voice mode active:
   - Hide text input (or keep it but disabled)
   - Show VoiceTranscript with last 5 entries
   - Show VoiceModeButton controls
4. When voice mode inactive:
   - Show normal text input with voice toggle

### Phase 4: Remove Full-Screen VoiceConversation
**Delete:** `src/components/voice/VoiceConversation.tsx`

- Remove the full-screen overlay entirely
- Update any references (DockedAIPanel, Manual.tsx, etc.)

### Phase 5: Update System Prompt (Force Search)
**Modify:** `supabase/functions/realtime-session/index.ts`

Update the system prompt to **always** trigger handbook search:

```typescript
const systemPrompt = `You are a voice assistant for restaurant managers and staff.

CRITICAL: You MUST use search_handbook for EVERY user question without exception.
- Greetings only: Respond directly ("Hello! How can I help?")  
- ANY other query: ALWAYS call search_handbook first
- Even if you think you know the answer, search first to verify
- Even if the question seems unrelated, search anyway - the handbook may have relevant info

After searching:
- Summarize the relevant information from results
- If nothing found: "I didn't find that in the handbook. Ask your manager."
- Keep responses to 2-3 sentences maximum
- Be warm and conversational`;
```

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/manual/VoiceTranscript.tsx` | **CREATE** |
| `src/components/ui/voice-mode-button.tsx` | **CREATE** |
| `src/components/manual/AskAboutContent.tsx` | **MODIFY** - Add voice integration |
| `src/components/manual/DockedAIPanel.tsx` | **MODIFY** - Remove voiceClick passthrough |
| `src/components/voice/VoiceConversation.tsx` | **DELETE** |
| `src/components/voice/index.ts` | **DELETE** or update |
| `src/pages/Manual.tsx` | **MODIFY** - Remove voice overlay logic |
| `supabase/functions/realtime-session/index.ts` | **MODIFY** - Update prompt |

## UI/UX Details

### Voice Mode Button Interior Animations

```css
/* Listening - animated bars */
.voice-bars {
  display: flex;
  gap: 2px;
  height: 16px;
}
.voice-bar {
  width: 3px;
  background: currentColor;
  animation: voice-wave 1s ease-in-out infinite;
}

/* Processing - pulsing dot */
.voice-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 1s ease-in-out infinite;
}

/* Speaking - bouncing bars */
.speaking-bars .voice-bar {
  animation: bounce 0.6s ease-in-out infinite;
}
```

### Transcript Entry Style
- User: `bg-primary/10` pill, right-aligned
- Assistant: `bg-muted` pill, left-aligned  
- Smaller text (`text-sm`)
- Max width 80%
- Fade-in animation on new entries

## Testing Checklist

- [ ] Click mic → shows connecting state with X/Cancel
- [ ] Connection successful → shows End button
- [ ] Speak → listening animation shows
- [ ] User transcript appears in chat
- [ ] AI responds → speaking animation shows
- [ ] AI transcript appears in chat
- [ ] Click End → disconnects, returns to normal input
- [ ] Verify AI always searches handbook (check logs)
- [ ] Test both EN and ES languages

## Rollback Plan

If issues arise, the WebRTC hook is unchanged. Only UI components are modified. The `realtime-voice` edge function (WebSocket fallback) remains available.

## Dependencies

- No new packages needed
- Uses existing `use-realtime-webrtc.ts` hook
- Uses existing Tailwind animations

## Notes

- Consider keeping transcript after disconnect for reference (user can review what was said)
- May want a "clear" button for transcript
- Could add visual connection quality indicator later
