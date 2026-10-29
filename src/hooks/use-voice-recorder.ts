'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Safari/iOS records audio/mp4, Chrome/Android audio/webm: pick whatever the browser supports
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) =>
    MediaRecorder.isTypeSupported(t)
  );
}

interface Options {
  onFinish: (audio: Blob) => void;
  onError: (message: string) => void;
}

export function useVoiceRecorder({ onFinish, onError }: Options) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  // Keep the latest callbacks without re-creating start()
  const callbacks = useRef({ onFinish, onError });
  callbacks.current = { onFinish, onError };

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
        const blob = new Blob(chunksRef.current, { type });
        const cancelled = cancelledRef.current;
        cleanup();
        if (!cancelled && blob.size > 0) callbacks.current.onFinish(blob);
      };

      recorder.start();
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      console.error('Audio recording failed', e);
      cleanup();
      callbacks.current.onError('Нет доступа к микрофону');
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else cleanup();
  }, [cleanup]);

  // Release the microphone if the component unmounts mid-recording
  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      cleanup();
    },
    [cleanup]
  );

  return { isRecording, seconds, start, stop, cancel };
}
