export const INTERCEPTOR_SKIP_URLS = [
  // Token exchange/refresh endpoint uses its own Content-Type, must not have a
  // Bearer token injected. Errors (e.g. revoked refresh token) need to propagate
  // to the auth store for proper handling.
  'accounts.spotify.com/api/token',
  // Third-party lyrics API, not part of Spotify. Requires no auth and errors
  // should propagate to the lyrics feature for its own handling.
  'lrclib.net'
];

export function shouldSkipInterceptor(url: string): boolean {
  return INTERCEPTOR_SKIP_URLS.some((skipUrl) => url.includes(skipUrl));
}
