import { useState, useRef } from 'react';
import { Play, Pause, Loader2, AlertCircle, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatVideoDuration } from '@/lib/utils';

interface VideoPlayerProps {
  url: string;
  thumbnail: string | null;
  duration: number | null;
  title: string;
}

export function VideoPlayer({ url, thumbnail, duration, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true);
    setError(null);
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      video.play()
        .then(() => {
          setPlaying(true);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to play video');
          setLoading(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    setProgress(pct);
    setCurrentTime(video.currentTime);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleError = () => {
    setError('This video could not be loaded. The URL may be invalid or the file may not be accessible.');
    setLoading(false);
    setPlaying(false);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) video.requestFullscreen();
  };

  return (
    <div className="relative w-full aspect-video bg-ink-secondary rounded-xl2 overflow-hidden group">
      <video
        ref={videoRef}
        src={url}
        poster={thumbnail ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        onLoadedData={() => setLoading(false)}
        className="w-full h-full object-cover"
        playsInline
        preload="metadata"
      />

      {/* Gradient overlay */}
      {!playing && (
        <div className="absolute inset-0 bg-gradient-to-t from-ink-bg/80 via-transparent to-transparent pointer-events-none" />
      )}

      {/* Play button overlay */}
      {!playing && !error && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label={`Play ${title} tutorial video`}
        >
          <div className="w-16 h-16 rounded-full bg-lime/90 flex items-center justify-center shadow-lime transition-all group-hover:scale-110 group-active:scale-95">
            {loading ? (
              <Loader2 className="w-7 h-7 text-ink-bg animate-spin" />
            ) : (
              <Play className="w-7 h-7 text-ink-bg ml-1" fill="currentColor" />
            )}
          </div>
        </button>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rust mb-2" />
          <p className="text-xs text-cloud-dim max-w-xs">{error}</p>
        </div>
      )}

      {/* Video info bar */}
      {!error && (
        <div className={cn(
          'absolute bottom-0 left-0 right-0 p-3 transition-opacity',
          playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          <div className="flex items-center gap-3">
            <button onClick={handlePlay} className="text-cloud hover:text-lime transition-colors">
              {playing ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}
            </button>
            <div className="flex-1 h-1 bg-ink-bg/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-lime rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-cloud font-mono tabular-nums">
              {formatVideoDuration(Math.round(currentTime))}
            </span>
            <button onClick={toggleMute} className="text-cloud-dim hover:text-cloud transition-colors">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={handleFullscreen} className="text-cloud-dim hover:text-cloud transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Duration badge */}
      {!playing && duration && !error && (
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-ink-bg/80 text-[10px] text-cloud font-mono">
          {formatVideoDuration(duration)}
        </div>
      )}
    </div>
  );
}
