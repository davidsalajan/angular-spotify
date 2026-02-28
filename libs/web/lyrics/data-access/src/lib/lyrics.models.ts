export interface LyricLine {
  time: number | null; // milliseconds, null for unsynced lyrics
  text: string;
}

export type LyricsStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface LyricsState {
  lyrics: LyricLine[] | null;
  isSynced: boolean;
  isVisible: boolean;
  isShownAsPiP: boolean;
  isFirstTime: boolean;
  status: LyricsStatus;
  currentTrackId: string | null;
}

// Musixmatch API response types
export interface MusixmatchSubtitleResponse {
  message: {
    header: { status_code: number };
    body: {
      subtitle: {
        subtitle_body: string; // JSON string of [{time: {total, minutes, seconds, hundredths}, text}]
      };
    };
  };
}

export interface MusixmatchLyricsResponse {
  message: {
    header: { status_code: number };
    body: {
      lyrics: {
        lyrics_body: string; // Plain text with \n line breaks
      };
    };
  };
}

export interface MusixmatchSubtitleLine {
  text: string;
  time: {
    total: number; // seconds as float
    minutes: number;
    seconds: number;
    hundredths: number;
  };
}
