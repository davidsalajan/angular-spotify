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

// LRCLIB API response type
export interface LrclibResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null; // LRC format: [mm:ss.xx] text
}
