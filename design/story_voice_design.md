# Design: AI Story Voice (Text-to-Speech)

This document outlines the implementation plan for adding audio narration to generated stories using OpenAI's TTS API.

## Objective
Provide an immersive narration experience for children by converting generated story text into high-quality audio.

## Technical Architecture

### 1. Backend: Audio Generation Endpoint
We will add a new endpoint to the Express server to handle TTS requests.

- **Endpoint**: `POST /api/generate-story-audio`
- **Model**: `tts-1` (optimized for real-time) or `tts-1-hd` (high quality).
- **Voice Options**: 
    - `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`.
    - Recommended for children: `shimmer` (vibrant) or `nova` (warm).
- **Process**:
    1. Receive story text and selected voice.
    2. Call OpenAI `audio.speech.create`.
    3. Stream the buffer back to the client or return a temporary URL.

### 2. Frontend: Audio Player UI
The `StoryPage` will be updated with an audio control section.

- **Listen Button**: A prominent "Narrate Story" button with a play icon.
- **Controls**: Standard HTML5 Audio elements (Play/Pause, Progress Bar, Volume).
- **States**:
    - **Idle**: Show "Narrate Story" button.
    - **Generating**: Show a pulse animation (e.g., "Warming up the vocal cords...").
    - **Ready**: Replace the button with a persistent audio player component allowing the user to play, pause, and seek through the story.

### 3. API Service Extension
Update `api.ts` to support audio generation:
```typescript
generateAudio: async (text: string, voice: string = "shimmer"): Promise<Blob> => {
    // Calls /api/generate-story-audio and returns the audio blob
}
```

## User Experience Flow
1. User completes story generation.
2. User clicks the "Narration" icon next to the story title.
3. Backend generates audio from the text.
4. Audio starts playing automatically once the first chunk is ready.

## Future Enhancements
- **Auto-Play**: Option to start narration as soon as the story is ready.
- **Highlighting**: Highlight the text being read in real-time (requires timestamp data from TTS).
- **Chapter Selection**: Narrate only specific chapters.
