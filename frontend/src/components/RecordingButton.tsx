import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface RecordingButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function RecordingButton({ onTranscript, onRecordingStateChange }: RecordingButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isRecordingRef = useRef(false); // Track recording state for onend handler

  useEffect(() => {
    // Check for Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      console.error('Web Speech API is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('Speech recognition started');
      isRecordingRef.current = true;
      setIsRecording(true);
      setIsProcessing(false);
      onRecordingStateChange?.(true);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      // Auto-restart if we were recording (Web Speech API stops after ~10-15s of silence)
      if (isRecordingRef.current && recognitionRef.current) {
        console.log('Auto-restarting speech recognition...');
        setTimeout(() => {
          if (isRecordingRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              // If restart fails, stop recording
              console.error('Failed to restart recognition:', error);
              isRecordingRef.current = false;
              setIsRecording(false);
              setIsProcessing(false);
              onRecordingStateChange?.(false);
            }
          }
        }, 100); // Small delay to avoid immediate restart issues
      } else {
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsProcessing(false);
        onRecordingStateChange?.(false);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Don't auto-restart on these errors
      if (event.error === 'aborted' || event.error === 'not-allowed') {
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsProcessing(false);
        onRecordingStateChange?.(false);
        return;
      }
      
      // Auto-restart on recoverable errors (no-speech, audio-capture)
      if (isRecordingRef.current && (event.error === 'no-speech' || event.error === 'audio-capture')) {
        console.log('Recoverable error, will auto-restart...');
        // onend will handle the restart
        return;
      }
      
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsProcessing(false);
      onRecordingStateChange?.(false);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript, true);
      } else if (interimTranscript) {
        onTranscript(interimTranscript, false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript, onRecordingStateChange]);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      isRecordingRef.current = false; // Prevent auto-restart
      setIsProcessing(true);
      recognitionRef.current.stop();
    } else {
      isRecordingRef.current = true;
      setIsProcessing(true);
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        isRecordingRef.current = false;
        setIsProcessing(false);
      }
    }
  }, [isRecording]);

  if (!isSupported) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 border border-gray-700/50 rounded-lg opacity-50 cursor-not-allowed"
        title="Speech recognition not supported in this browser"
      >
        <MicOff className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400 text-sm font-medium">Not Supported</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleRecording}
      disabled={isProcessing}
      className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all group relative overflow-hidden ${
        isRecording
          ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50'
          : 'bg-gray-800/60 hover:bg-gray-800 border-gray-700/50'
      }`}
      title={isRecording ? 'Stop Recording' : 'Start Recording'}
    >
      {/* Pulsing animation when recording */}
      {isRecording && (
        <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
      )}
      
      {isProcessing ? (
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
      ) : isRecording ? (
        <div className="relative">
          <Mic className="w-4 h-4 text-red-400" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
        </div>
      ) : (
        <Mic className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
      )}
      
      <span className={`text-sm font-medium relative z-10 ${
        isRecording ? 'text-red-300' : 'text-gray-300'
      }`}>
        {isProcessing ? 'Processing...' : isRecording ? 'Recording...' : 'Record'}
      </span>
    </button>
  );
}
