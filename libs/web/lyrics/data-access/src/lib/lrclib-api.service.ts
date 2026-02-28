import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LyricLine, LrclibResponse } from './lyrics.models';

const LRCLIB_BASE_URL = 'https://lrclib.net/api';

@Injectable({ providedIn: 'root' })
export class LrclibApiService {
  constructor(private http: HttpClient) {}

  /**
   * Fetch lyrics for a track from LRCLIB.
   * Prefers synced lyrics (LRC format), falls back to plain lyrics.
   */
  getLyrics(
    trackName: string,
    artistName: string
  ): Observable<{ lyrics: LyricLine[]; isSynced: boolean }> {
    const params = {
      track_name: trackName,
      artist_name: artistName
    };

    return this.http.get<LrclibResponse>(`${LRCLIB_BASE_URL}/get`, { params }).pipe(
      map((response) => {
        if (response.syncedLyrics) {
          return { lyrics: this.parseLrc(response.syncedLyrics), isSynced: true };
        }
        if (response.plainLyrics) {
          return { lyrics: this.parsePlain(response.plainLyrics), isSynced: false };
        }
        return { lyrics: [], isSynced: false };
      }),
      catchError(() => of({ lyrics: [] as LyricLine[], isSynced: false }))
    );
  }

  /**
   * Parse LRC format: [mm:ss.xx] lyrics text
   */
  private parseLrc(lrc: string): LyricLine[] {
    const results: LyricLine[] = [];
    for (const line of lrc.split('\n')) {
      const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s?(.*)/);
      if (!match) {
        continue;
      }
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const hundredths = match[3].length === 2
        ? parseInt(match[3], 10) * 10
        : parseInt(match[3], 10);
      const time = (minutes * 60 + seconds) * 1000 + hundredths;
      const text = match[4].trim();
      if (text.length > 0) {
        results.push({ time, text });
      }
    }
    return results;
  }

  private parsePlain(plain: string): LyricLine[] {
    return plain
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => ({ time: null, text: line.trim() }));
  }
}
