import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { APP_CONFIG, AppConfig } from '@angular-spotify/web/shared/app-config';
import {
  LyricLine,
  MusixmatchSubtitleResponse,
  MusixmatchLyricsResponse,
  MusixmatchSubtitleLine
} from './lyrics.models';

@Injectable({ providedIn: 'root' })
export class MusixmatchApiService {
  constructor(
    @Inject(APP_CONFIG) private appConfig: AppConfig,
    private http: HttpClient
  ) {}

  /**
   * Fetch lyrics for a track. Tries synced (subtitle) first, falls back to plain lyrics.
   * Returns { lyrics, isSynced }.
   */
  getLyrics(
    trackName: string,
    artistName: string
  ): Observable<{ lyrics: LyricLine[]; isSynced: boolean }> {
    return this.getSyncedLyrics(trackName, artistName).pipe(
      switchMap((result) => {
        if (result.length > 0) {
          return of({ lyrics: result, isSynced: true });
        }
        return this.getPlainLyrics(trackName, artistName).pipe(
          map((plainLines) => ({ lyrics: plainLines, isSynced: false }))
        );
      })
    );
  }

  private getSyncedLyrics(trackName: string, artistName: string): Observable<LyricLine[]> {
    const params = {
      q_track: trackName,
      q_artist: artistName,
      apikey: this.appConfig.musixmatchApiKey,
      f_subtitle_length_max_deviation: '1'
    };

    return this.http
      .get<MusixmatchSubtitleResponse>(`${this.appConfig.musixmatchBaseURL}/matcher.subtitle.get`, {
        params
      })
      .pipe(
        map((response) => {
          if (response.message.header.status_code !== 200) {
            return [];
          }
          const subtitleBody = response.message.body?.subtitle?.subtitle_body;
          if (!subtitleBody) {
            return [];
          }
          const parsed: MusixmatchSubtitleLine[] = JSON.parse(subtitleBody);
          return parsed
            .filter((line) => line.text.trim().length > 0)
            .map((line) => ({
              time: Math.round(line.time.total * 1000), // convert seconds to ms
              text: line.text
            }));
        }),
        catchError(() => of([]))
      );
  }

  private getPlainLyrics(trackName: string, artistName: string): Observable<LyricLine[]> {
    const params = {
      q_track: trackName,
      q_artist: artistName,
      apikey: this.appConfig.musixmatchApiKey
    };

    return this.http
      .get<MusixmatchLyricsResponse>(`${this.appConfig.musixmatchBaseURL}/matcher.lyrics.get`, {
        params
      })
      .pipe(
        map((response) => {
          if (response.message.header.status_code !== 200) {
            return [];
          }
          const body = response.message.body?.lyrics?.lyrics_body;
          if (!body) {
            return [];
          }
          return body
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .map((line) => ({ time: null, text: line }));
        }),
        catchError(() => of([]))
      );
  }
}
