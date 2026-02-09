# Step 9: GPT Realtime Voice Conversation

**Goal**: Implement full-duplex voice conversation with OpenAI's Realtime API, grounded in handbook content via tool-calling RAG.

---

## Overview

This feature enables natural, real-time voice conversations with the AI assistant. **Primary users are managers** who will open the app and ask random questions about policies, procedures, and operations—they won't necessarily be viewing a specific section.

### Key Capabilities
- **Full-duplex audio**: Simultaneous speech input/output (no push-to-talk)
- **Server-side VAD**: OpenAI handles voice activity detection
- **Tool-first RAG**: AI searches handbook BEFORE answering policy questions
- **Existing search infrastructure**: Reuses `hybrid_search_manual` (FTS + vector)

### Design Decision: Tool-First Approach

We chose **tool-calling RAG** over pre-loaded context because:

1. **Random questions**: Managers ask whatever's on their mind, not about current section
2. **Accuracy over speed**: Better to wait 1.2s for correct answer than instant wrong one
3. **Full manual access**: Tool can search entire handbook, not just pre-loaded sections
4. **Natural UX**: AI says "Let me check that..." which feels conversational

**Expected latency**: ~1.2-1.5s from question to answer start (acceptable with acknowledgment)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ AudioRecorder│───▶│ WebSocket   │◀───│ AudioQueue + WAV Player │ │
│  │ (24kHz PCM) │    │ Client      │    │ (Sequential playback)   │ │
│  └─────────────┘    └──────┬───────┘    └─────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────────┘
                             │ wss://
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Edge Function (Relay)                             │
│  ┌────────────────┐    ┌────────────────┐    ┌───────────────────┐  │
│  │ Auth + Group   │───▶│ OpenAI RT API  │◀───│ search_handbook   │  │
│  │ + Usage Check  │    │ WebSocket      │    │ (hybrid_search)   │  │
│  └────────────────┘    └────────────────┘    └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Existing Supabase Infrastructure                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ manual_sections │    │hybrid_search_   │    │ usage_counters  │  │
│  │ (content + emb) │    │manual (RPC)     │    │ (rate limiting) │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### RAG Flow

```
1. User: "What's the policy on employee meals?"
2. GPT: "Let me check that for you..." (immediate acknowledgment)
3. GPT calls search_handbook tool with query: "employee meals policy"
4. Edge function:
   a. Generates embedding via OpenAI API (existing OPENAI_API_KEY)
   b. Calls hybrid_search_manual RPC (same as text AI)
   c. Fetches full content for top 2 results
   d. Returns formatted context to GPT
5. GPT: "According to the handbook, staff members receive 50% off..."
```

---

## Implementation Steps

### Step 1: Verify OpenAI API Key ✅
**File**: N/A (already configured)

- [x] `OPENAI_API_KEY` already exists in secrets (used for embeddings)
- [x] Same API key works for Realtime API (`gpt-4o-realtime-preview`)

**Status**: Complete. The existing key is used for both embeddings and Realtime API.

---

### Step 2: Create Realtime Relay Edge Function
**File**: `supabase/functions/realtime-voice/index.ts`

Core relay function that:
1. Authenticates user via JWT
2. Validates group membership and `voiceEnabled` policy
3. Checks usage limits before connecting
4. Establishes WebSocket to OpenAI Realtime API
5. Relays messages bidirectionally
6. Handles `search_handbook` tool calls

```typescript
// Session configuration (sent after session.created)
{
  "modalities": ["text", "audio"],
  "voice": "alloy",
  "input_audio_format": "pcm16",
  "output_audio_format": "pcm16",
  "input_audio_transcription": { "model": "whisper-1" },
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 800
  },
  "tools": [
    {
      "type": "function",
      "name": "search_handbook",
      "description": "Search the restaurant training handbook. ALWAYS use this before answering questions about policies, procedures, temperatures, standards, or operations.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { 
            "type": "string",
            "description": "What to search for in the handbook"
          }
        },
        "required": ["query"]
      }
    }
  ],
  "tool_choice": "auto"
}
```

**System Prompt** (optimized for random manager queries):
```
You are a voice assistant for Alamo Prime restaurant managers and staff.

CRITICAL BEHAVIOR:
1. For ANY question about policies, procedures, temperatures, standards, 
   cleaning, safety, or operations → ALWAYS call search_handbook FIRST
2. Give a brief acknowledgment: "Let me check that..." before searching
3. Only answer from handbook content - never invent policies
4. If not found: "I don't see that in the handbook. Ask your manager or check with HR."

VOICE GUIDELINES:
- Keep responses to 2-3 sentences maximum
- Be warm, helpful, and conversational
- Speak in {language} (English or Spanish based on user preference)

EXAMPLES OF WHEN TO SEARCH:
- "What's the break policy?" → search
- "How do I handle a complaint?" → search  
- "What temperature for the walk-in?" → search
- "Thanks!" → don't search, just respond
```

**Acceptance Criteria**:
- WebSocket relay works end-to-end
- Tool calls execute and return results
- Proper error handling and connection cleanup

---

### Step 3: Implement Tool Handler Using Existing Search
**File**: `supabase/functions/realtime-voice/index.ts` (within same file)

When OpenAI calls `search_handbook`, reuse existing infrastructure:

```typescript
async function handleSearchHandbook(
  supabase: SupabaseClient,
  query: string,
  language: 'en' | 'es'
): Promise<string> {
  console.log('[realtime-voice] Tool call: search_handbook, query:', query);
  
  // 1. Generate embedding using existing OpenAI API key
  const embedding = await getQueryEmbedding(query); // Same as ask function
  
  // 2. Call existing hybrid_search_manual RPC
  const { data: results, error } = await supabase.rpc('hybrid_search_manual', {
    search_query: query,
    query_embedding: JSON.stringify(embedding),
    search_language: language,
    result_limit: 2  // Fewer results for voice (conciseness)
  });
  
  if (error || !results?.length) {
    console.log('[realtime-voice] No results found');
    return "No relevant information found in the handbook.";
  }
  
  // 3. Fetch full content for top results
  const slugs = results.map((r: { slug: string }) => r.slug);
  const { data: sections } = await supabase
    .from('manual_sections')
    .select('slug, title_en, title_es, content_en, content_es')
    .in('slug', slugs);
  
  if (!sections?.length) {
    return "No relevant information found in the handbook.";
  }
  
  // 4. Format for voice context (shorter than text AI)
  const formatted = sections.map(s => {
    const title = language === 'es' && s.title_es ? s.title_es : s.title_en;
    const content = language === 'es' && s.content_es ? s.content_es : s.content_en;
    // Truncate to 2500 chars for voice (vs 8000 for text)
    const truncated = content && content.length > 2500 
      ? content.substring(0, 2500) + '...'
      : content;
    return `## ${title}\n${truncated || ''}`;
  }).join('\n\n---\n\n');
  
  console.log('[realtime-voice] Returning', sections.length, 'sections');
  return formatted;
}

// Reuse embedding function from ask edge function
async function getQueryEmbedding(query: string): Promise<number[]> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
    }),
  });
  const data = await response.json();
  return data.data[0].embedding;
}
```

**Key differences from text AI (`/ask`)**:
| Aspect | Text AI | Voice AI |
|--------|---------|----------|
| Results returned | Top 3 | Top 2 |
| Content truncation | 8000 chars | 2500 chars |
| Response length | 1-2 paragraphs | 2-3 sentences |

**Acceptance Criteria**:
- Tool uses existing `hybrid_search_manual` RPC
- Embedding uses existing `OPENAI_API_KEY`
- Content sized appropriately for voice context

---

### Step 4: Create Audio Recording Utilities
**File**: `src/lib/audio-recorder.ts`

Reusable audio recording class:
- 24kHz sample rate (OpenAI requirement)
- PCM16 encoding
- Chunk streaming to WebSocket
- Echo cancellation + noise suppression

```typescript
export class RealtimeAudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  
  constructor(private onAudioChunk: (base64Audio: string) => void) {}
  
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0);
      const base64 = this.encodeToBase64PCM16(float32);
      this.onAudioChunk(base64);
    };
    
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }
  
  stop(): void { /* cleanup */ }
  
  private encodeToBase64PCM16(float32: Float32Array): string {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    // Convert to base64...
  }
}
```

**Acceptance Criteria**:
- Audio captures at correct sample rate
- Chunks are properly encoded
- Resources are cleaned up on stop

---

### Step 5: Create Audio Playback Queue
**File**: `src/lib/audio-player.ts`

Sequential audio playback with WAV conversion:
- Queue management for ordered playback
- PCM16 to WAV header generation
- Error recovery (continue on failed chunk)

```typescript
export class AudioPlaybackQueue {
  private queue: Uint8Array[] = [];
  private isPlaying = false;
  private audioContext: AudioContext;
  
  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 24000 });
  }
  
  async addChunk(base64Audio: string): Promise<void> {
    const pcmData = this.base64ToUint8Array(base64Audio);
    this.queue.push(pcmData);
    if (!this.isPlaying) this.playNext();
  }
  
  private async playNext(): Promise<void> {
    if (!this.queue.length) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    const pcmData = this.queue.shift()!;
    
    try {
      const wavData = this.createWavFromPCM(pcmData);
      const buffer = await this.audioContext.decodeAudioData(wavData.buffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.onended = () => this.playNext();
      source.start(0);
    } catch (e) {
      console.error('Audio playback error:', e);
      this.playNext(); // Continue with next chunk
    }
  }
  
  private createWavFromPCM(pcm: Uint8Array): Uint8Array {
    // Generate 44-byte WAV header + PCM data
  }
  
  clear(): void {
    this.queue = [];
    this.isPlaying = false;
  }
}
```

**Acceptance Criteria**:
- Audio plays sequentially without gaps
- Errors don't break the queue
- Can be cleared/reset

---

### Step 6: Create Realtime Voice Hook
**File**: `src/hooks/use-realtime-voice.ts`

React hook managing full conversation state:

```typescript
interface UseRealtimeVoiceOptions {
  language: 'en' | 'es';
  groupId: string;
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
  onError?: (error: string) => void;
}

interface UseRealtimeVoiceReturn {
  isConnected: boolean;
  isListening: boolean;  // AI is listening to user
  isSpeaking: boolean;   // AI is speaking
  connect: () => Promise<void>;
  disconnect: () => void;
  transcript: { role: 'user' | 'assistant'; text: string }[];
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  
  const recorderRef = useRef<RealtimeAudioRecorder | null>(null);
  const playerRef = useRef<AudioPlaybackQueue | null>(null);
  
  const connect = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    
    const wsUrl = `wss://hnjgnewfxmxbzvdgmigy.functions.supabase.co/realtime-voice?token=${session.access_token}&groupId=${options.groupId}&language=${options.language}`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      setIsConnected(true);
      // Start recording after session.created
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };
    
    // ... error handling
  }, [options]);
  
  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'session.created':
        // Session ready, start audio recording
        startRecording();
        break;
      case 'response.audio.delta':
        // Queue audio for playback
        playerRef.current?.addChunk(data.delta);
        setIsSpeaking(true);
        break;
      case 'response.audio.done':
        setIsSpeaking(false);
        break;
      case 'response.audio_transcript.delta':
        // Update assistant transcript
        updateTranscript('assistant', data.delta);
        break;
      case 'input_audio_buffer.speech_started':
        setIsListening(true);
        break;
      case 'input_audio_buffer.speech_stopped':
        setIsListening(false);
        break;
      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        updateTranscript('user', data.transcript);
        break;
    }
  };
  
  return { isConnected, isListening, isSpeaking, connect, disconnect, transcript };
}
```

**Acceptance Criteria**:
- Full lifecycle management
- Proper state tracking
- Transcript accumulation
- Clean disconnect

---

### Step 7: Create Voice Conversation UI
**File**: `src/components/voice/VoiceConversation.tsx`

Full-screen or modal voice interface:

```typescript
interface VoiceConversationProps {
  language: 'en' | 'es';
  groupId: string;
  onClose: () => void;
  initialContext?: string; // e.g., current section title
}

// Visual elements:
// - Large animated orb/waveform showing AI state
// - Transcript display (scrolling conversation)
// - Mute/unmute button
// - End conversation button
// - Connection status indicator
```

**States to visualize**:
1. **Connecting**: Pulsing animation, "Connecting..."
2. **Listening**: Calm animation, user's words appearing
3. **Thinking**: Processing animation (after user stops, before AI speaks)
4. **Speaking**: Active animation, AI text appearing
5. **Error**: Red indicator, retry option

**Acceptance Criteria**:
- Clear visual feedback for all states
- Accessible (screen reader announcements)
- Works on mobile and desktop
- Graceful error display

---

### Step 8: Integrate with Existing UI
**Files**: 
- `src/components/manual/ManualHeader.tsx` (add voice button)
- `src/components/manual/DockedAIPanel.tsx` (add voice mode)
- `src/pages/Ask.tsx` (add voice option)

Add entry points to voice conversation:
- Floating action button on manual pages
- Toggle in AI panel header
- Voice option on Ask page

**Acceptance Criteria**:
- Voice accessible from main interaction points
- Seamless transition between text and voice
- Respects user permissions (voiceEnabled policy)

---

### Step 9: Usage Tracking Integration
**File**: `supabase/functions/realtime-voice/index.ts`

Track voice interactions against usage limits:
- Count each "turn" (user speaks → AI responds) as 1 usage
- Check limits before processing
- Return limit info in connection metadata

**Acceptance Criteria**:
- Voice uses same counters as text AI
- Users see remaining usage
- Graceful handling at limit

---

### Step 10: Error Handling & Recovery
**Files**: Multiple

Implement robust error handling:
- WebSocket disconnection → auto-reconnect with backoff
- Microphone permission denied → clear message
- OpenAI rate limits → queue/retry
- Network issues → graceful degradation

**Acceptance Criteria**:
- No silent failures
- User always knows what's happening
- Automatic recovery when possible

---

## RAG Strategy: Tool-First with Existing Infrastructure

### Why Tool-Calling Over Pre-Loading

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Pre-load section** | Fast first response | Wrong context for random Qs | Reading a specific section |
| **Pre-load FAQ** | Instant common answers | Stale, limited scope | High-volume simple Qs |
| **Tool-calling** ✓ | Always accurate, full access | ~1.2s latency | Random manager queries |

**Our choice**: Tool-calling, because managers ask random questions, not section-specific ones.

### Reusing Existing Search Infrastructure

The `search_handbook` tool calls the **same infrastructure** as text AI:

```
search_handbook("employee meals policy")
        │
        ▼
┌─────────────────────────────────────────┐
│      getQueryEmbedding(query)           │  ← Same OpenAI API key
│      text-embedding-3-small             │  ← Same model
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│      hybrid_search_manual RPC           │  ← Same function
│      FTS (40%) + Vector (60%)           │  ← Same RRF weights
│      Result limit: 2 (vs 3 for text)    │  ← Only difference
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│      Fetch full content                 │
│      Truncate to 2500 chars (vs 8000)   │  ← Voice-optimized
└─────────────────────────────────────────┘
```

### Voice vs Text AI Comparison

| Aspect | Text AI (`/ask`) | Voice AI (realtime) |
|--------|------------------|---------------------|
| Search method | `hybrid_search_manual` | `hybrid_search_manual` |
| Embedding model | `text-embedding-3-small` | `text-embedding-3-small` |
| Results returned | Top 3 | Top 2 |
| Content truncation | 8000 chars | 2500 chars |
| Response style | 1-2 paragraphs | 2-3 sentences |
| LLM | Gemini 2.5 Flash | GPT-4o Realtime |

### Latency Breakdown

```
User finishes speaking ────────────────────────────► 0ms
        │
GPT processes, decides to search ─────────────────► ~200ms
        │
GPT: "Let me check that..." (acknowledgment) ────► ~300ms
        │
Tool call: generate embedding ────────────────────► ~150ms
        │
Tool call: hybrid_search_manual RPC ──────────────► ~200ms
        │
Tool call: fetch full content ────────────────────► ~100ms
        │
GPT receives context, starts speaking ───────────► ~250ms
        │
First audio chunk arrives ────────────────────────► ~1.2s total
```

---

## Technical Considerations

### Audio Quality
- 24kHz sample rate (OpenAI requirement)
- PCM16 encoding (little-endian)
- Chunk size: 4096 samples (~170ms)

### Latency Optimization
- Send audio chunks immediately (no batching)
- Server VAD eliminates client-side detection
- Audio queue enables smooth playback
- Acknowledgment ("Let me check...") masks search latency

### Mobile Considerations
- Request microphone permission early
- Handle audio focus (pause music apps)
- Battery-efficient audio processing
- Test on iOS Safari (strict audio policies)

### Security
- JWT validation on WebSocket upgrade
- Group membership verification (`voiceEnabled` policy)
- Usage limit enforcement (same counters as text AI)
- No raw API key exposure to client

---

## Testing Plan

1. **Unit tests**: Audio encoding/decoding utilities
2. **Integration tests**: Edge function tool calling with real DB
3. **E2E tests**: Full conversation flow (question → search → answer)
4. **Device testing**: iOS Safari, Android Chrome, Desktop browsers
5. **Load testing**: Multiple concurrent connections
6. **RAG quality**: Verify correct sections retrieved for common questions

---

## Success Metrics

- Connection success rate > 99%
- Average latency (user stops speaking → first audio) < 1.5s
- Tool call success rate > 99%
- Handbook grounding rate > 95% (answers come from manual content)
- User satisfaction with voice responses

---

## Dependencies

- `OPENAI_API_KEY` (already configured, used for embeddings + Realtime)
- `hybrid_search_manual` RPC (already implemented)
- `manual_sections` table with embeddings (already populated)
- Usage tracking infrastructure (already implemented)

---

## Estimated Effort

| Step | Complexity | Hours |
|------|------------|-------|
| 1. Verify API Key | Low | 0.25 |
| 2. Edge Function (relay) | High | 4 |
| 3. Tool Handler (search) | Low | 1 (reuses existing) |
| 4. Audio Recording | Medium | 2 |
| 5. Audio Playback | Medium | 2 |
| 6. React Hook | High | 3 |
| 7. Voice UI | High | 4 |
| 8. Integration | Medium | 2 |
| 9. Usage Tracking | Low | 1 |
| 10. Error Handling | Medium | 2 |

**Total: ~21 hours**

---

## References

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [Supabase Edge Functions WebSocket](https://supabase.com/docs/guides/functions/websockets)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
