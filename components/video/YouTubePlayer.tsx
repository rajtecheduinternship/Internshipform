'use client';

import LoadingState, { BusyText } from '@/components/LoadingState';
import { Progress } from '@/components/ui';
import { useCopy } from '@/components/help/i18n';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  mergeIntervals,
  calculateUniqueSecondsWatched,
  calculateCompletionPercentage,
  formatDuration,
  Interval,
} from '@/lib/tracking';

interface YouTubePlayerProps {
  videoId: string;
  youtubeId: string;
  studentEmail: string;
  requiredPercent?: number;
  initialIntervals?: Interval[];
  lastPosition?: number;
  onProgress?: (data: {
    percentage: number;
    totalSeconds: number;
    isCompleted: boolean;
    intervals: Interval[];
  }) => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: () => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

export default function YouTubePlayer({
  videoId,
  youtubeId,
  studentEmail,
  requiredPercent = 90,
  initialIntervals = [],
  lastPosition = 0,
  onProgress,
}: YouTubePlayerProps) {
  const t = useCopy();
  const containerBase = `yt-player-${videoId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [playerReady, setPlayerReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(lastPosition);
  const [duration, setDuration] = useState(0);
  const [intervals, setIntervals] = useState<Interval[]>(initialIntervals);
  const [isCompleted, setIsCompleted] = useState(false);

  const containerId = `${containerBase}-${attempt}`;

  const segmentStartRef = useRef<number | null>(null);
  const intervalsRef = useRef<Interval[]>(initialIntervals);
  const durationRef = useRef<number>(0);
  const lastLoggedSecRef = useRef<number>(lastPosition);
  const isCompletedRef = useRef<boolean>(false);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // Sync intervals state to ref
  useEffect(() => {
    intervalsRef.current = intervals;
  }, [intervals]);

  // Start watch session once
  useEffect(() => {
    let active = true;
    async function initSession() {
      try {
        const res = await fetch('/api/tracking/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (active) sessionIdRef.current = data.session_id;
        }
      } catch (err) {
        console.error('Failed to init watch session:', err);
      }
    }

    if (studentEmail && videoId) {
      initSession();
    }

    return () => {
      active = false;
    };
  }, [studentEmail, videoId]);

  // Stable progress flush function
  const flushProgress = useCallback((isFinal = false) => {
    if (!studentEmail || !videoId) return;

    const merged = mergeIntervals(intervalsRef.current);
    const uniqueSec = calculateUniqueSecondsWatched(merged);
    const dur = durationRef.current;
    const pct = calculateCompletionPercentage(merged, dur);
    const completed = pct >= requiredPercent;

    if (completed && !isCompletedRef.current) {
      isCompletedRef.current = true;
      setIsCompleted(true);
    }

    if (onProgressRef.current) {
      onProgressRef.current({
        percentage: pct,
        totalSeconds: uniqueSec,
        isCompleted: completed,
        intervals: merged,
      });
    }

    // The server recomputes percentage/completion itself; only the played ranges are sent.
    const payload = {
      video_id: videoId,
      last_watched_position: Math.floor(lastLoggedSecRef.current),
      watched_intervals: merged,
    };

    if (isFinal && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/tracking/heartbeat', blob);
    } else {
      fetch('/api/tracking/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((e) => console.error('Heartbeat fetch error:', e));
    }
  }, [studentEmail, videoId, requiredPercent]);

  // Log events (play, pause, ended, blur)
  const logEvent = useCallback((eventType: string, timeSec: number) => {
    if (!sessionIdRef.current) return;
    fetch('/api/tracking/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionIdRef.current,
        event_type: eventType,
        video_time: Math.floor(timeSec),
      }),
    }).catch(() => {});
  }, []);

  // Initialize YouTube IFrame Player
  useEffect(() => {
    let isDestroyed = false;
    // A blocked third-party script must not leave an endless blank player.
    const readyTimeout = window.setTimeout(() => {
      if (!isDestroyed) setPlayerError(true);
    }, 20000);

    function createPlayer() {
      if (!window.YT || !window.YT.Player || isDestroyed) return;

      try {
        playerRef.current = new window.YT.Player(containerId, {
          videoId: youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            start: Math.floor(lastPosition),
          },
          events: {
            onReady: (event) => {
              if (isDestroyed) return;
              window.clearTimeout(readyTimeout);
              setPlayerReady(true); setPlayerError(false);
              const dur = event.target.getDuration();
              setDuration(dur);
              durationRef.current = dur;
              if (lastPosition > 0) {
                event.target.seekTo(lastPosition, true);
              }
            },
            onError: () => {
              if (isDestroyed) return;
              window.clearTimeout(readyTimeout);
              setPlayerError(true); setBuffering(false); setIsPlaying(false);
            },
            onStateChange: (event) => {
              if (isDestroyed) return;
              const state = event.data;
              setBuffering(state === window.YT.PlayerState.BUFFERING);
              const player = event.target;
              const current = player.getCurrentTime ? player.getCurrentTime() : 0;
              setCurrentTime(current);
              lastLoggedSecRef.current = current;

              // PLAYING
              if (state === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                segmentStartRef.current = current;
                logEvent('play', current);
              }
              // PAUSED or ENDED
              else if (
                state === window.YT.PlayerState.PAUSED ||
                state === window.YT.PlayerState.ENDED
              ) {
                setIsPlaying(false);
                if (segmentStartRef.current !== null) {
                  const start = segmentStartRef.current;
                  const end = current;
                  if (end > start) {
                    const updated = [...intervalsRef.current, [Math.floor(start), Math.ceil(end)] as Interval];
                    const merged = mergeIntervals(updated);
                    setIntervals(merged);
                    intervalsRef.current = merged;
                  }
                  segmentStartRef.current = null;
                }
                logEvent(state === window.YT.PlayerState.ENDED ? 'ended' : 'pause', current);
                flushProgress();
              }
            },
          },
        });
      } catch (e) {
        window.clearTimeout(readyTimeout);
        setPlayerError(true);
        console.error('Error mounting YT Player:', e);
      }
    }

    const prevCallback = window.onYouTubeIframeAPIReady;
    let apiReady: (() => void) | undefined;
    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const existingScript = document.getElementById('yt-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      apiReady = () => {
        if (prevCallback) prevCallback();
        createPlayer();
      };
      window.onYouTubeIframeAPIReady = apiReady;
    }

    return () => {
      isDestroyed = true;
      window.clearTimeout(readyTimeout);
      if (apiReady && window.onYouTubeIframeAPIReady === apiReady) window.onYouTubeIframeAPIReady = prevCallback;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [youtubeId, containerId, lastPosition, logEvent, flushProgress]);

  // Periodic interval tracking & heartbeat while playing
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTimer = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const current = playerRef.current.getCurrentTime();
        setCurrentTime(current);
        lastLoggedSecRef.current = current;

        if (segmentStartRef.current !== null) {
          const start = segmentStartRef.current;
          if (current > start) {
            const updated = [...intervalsRef.current, [Math.floor(start), Math.ceil(current)] as Interval];
            const merged = mergeIntervals(updated);
            setIntervals(merged);
            intervalsRef.current = merged;
            segmentStartRef.current = current;
          }
        } else {
          segmentStartRef.current = current;
        }
      }
    }, 1000);

    // 20s keeps ~200 concurrent viewers at ~10 writes/sec; pause/end/unload flush immediately.
    const heartbeatTimer = setInterval(() => {
      flushProgress();
    }, 20000);

    return () => {
      clearInterval(intervalTimer);
      clearInterval(heartbeatTimer);
    };
  }, [isPlaying, flushProgress]);

  // Pause on window blur & flush on page unload
  useEffect(() => {
    const handleBlur = () => {
      if (playerRef.current && isPlaying) {
        try {
          playerRef.current.pauseVideo();
        } catch {}
        logEvent('blur', lastLoggedSecRef.current);
      }
    };

    const handleBeforeUnload = () => {
      flushProgress(true);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isPlaying, logEvent, flushProgress]);

  const uniqueSeconds = calculateUniqueSecondsWatched(intervals);
  const completionPct = calculateCompletionPercentage(intervals, duration);

  const reached = isCompleted || completionPct >= requiredPercent;

  return (
    <div className="ui-card" style={{ overflow: 'hidden' }}>
      <div className="relative aspect-video w-full bg-black">
        <div key={containerId} className="h-full w-full"><div id={containerId} className="h-full w-full" /></div>
        {(!playerReady || playerError) && <div className="video-loading-overlay">
          {playerError ? <div role="alert" className="space-y-3"><p>{t('The video could not load. Check your connection and try again.', 'वीडियो नहीं खुल पाया। इंटरनेट जाँचें और फिर कोशिश करें।')}</p><button className="ui-btn ui-btn-light" onClick={() => { setPlayerReady(false); setPlayerError(false); setBuffering(false); if (!window.YT?.Player) document.getElementById('yt-iframe-api')?.remove(); setAttempt((n) => n + 1); }}>{t('Try again', 'फिर कोशिश करें')}</button></div> : <LoadingState compact label={t('Loading video…', 'वीडियो लोड हो रहा है…')} />}
        </div>}
        {playerReady && buffering && !playerError && <div className="video-buffering"><BusyText>{t('Buffering…', 'वीडियो लोड हो रहा है…')}</BusyText></div>}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className="ui-muted">{isPlaying ? t('Playing · tracking your watch time', 'वीडियो चल रहा है · देखने का समय दर्ज हो रहा है') : t('Ready when you are · press play to learn', 'जब तैयार हों, वीडियो चलाएँ')}</span>
          <span className="tnum ui-muted">
            {formatDuration(currentTime)} / {formatDuration(duration)} · {formatDuration(uniqueSeconds)} {t('watched', 'देखा गया')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1"><Progress value={completionPct} done={reached} /></div>
          <span className="tnum text-[13px]" style={{ fontWeight: 600, width: 40, textAlign: 'right' }}>{Math.round(completionPct)}%</span>
        </div>
        <div className="ui-muted">
          {reached
            ? <span style={{ color: 'var(--ok)', fontWeight: 600 }}>{t(`Completed. You have watched the required ${requiredPercent}% of this lesson.`, `पूरा हुआ। आपने इस पाठ का ज़रूरी ${requiredPercent}% हिस्सा देख लिया है।`)}</span>
            : <>{t(`Watch at least ${requiredPercent}% to complete this lesson. Skipped sections do not count.`, `पाठ पूरा करने के लिए कम से कम ${requiredPercent}% हिस्सा देखें। आगे बढ़ाए गए हिस्से नहीं गिने जाते।`)}</>}
        </div>
      </div>
    </div>
  );
}
