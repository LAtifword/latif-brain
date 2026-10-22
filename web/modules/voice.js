/**
 * Voice Module
 * Voice recording and playback
 */

import { api } from '../utils/api.js';

export class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }

  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        this.audioChunks.push(e.data);
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      return true;
    } catch (error) {
      console.error('Microphone access denied:', error);
      return false;
    }
  }

  async stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.isRecording = false;
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  cancel() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.audioChunks = [];
      this.isRecording = false;
    }
  }

  async transcribe() {
    if (this.audioChunks.length === 0) return null;

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

    try {
      const response = await api.transcribeAudio(audioBlob);
      return response.text || '';
    } catch (error) {
      console.error('Transcription failed:', error);
      return null;
    }
  }
}

export class VoicePlayer {
  constructor() {
    this.audio = new Audio();
    this.isPlaying = false;
  }

  async play(audioData) {
    try {
      const blob = new Blob([audioData], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);

      this.audio.src = url;
      this.audio.onended = () => {
        this.isPlaying = false;
        URL.revokeObjectURL(url);
      };

      this.audio.play();
      this.isPlaying = true;
    } catch (error) {
      console.error('Playback failed:', error);
    }
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
  }

  resume() {
    this.audio.play();
    this.isPlaying = true;
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
  }

  setVolume(level) {
    this.audio.volume = Math.max(0, Math.min(1, level));
  }
}

export class TextToSpeech {
  async synthesize(text, options = {}) {
    try {
      const response = await api.synthesizeSpeech(text, options.voice || 'default');
      return response.audio || null;
    } catch (error) {
      console.error('Synthesis failed:', error);
      return null;
    }
  }
}

export const voiceRecorder = new VoiceRecorder();
export const voicePlayer = new VoicePlayer();
export const textToSpeech = new TextToSpeech();
