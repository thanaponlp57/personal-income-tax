import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, tap } from 'rxjs';

export interface AuthUser {
  subject: string;
  username: string;
  fullName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<AuthUser | null>(null);

  me(): Observable<AuthUser | null> {
    return this.http.get<AuthUser>('/api/v1/auth/me').pipe(
      tap((user) => this.currentUser.set(user)),
      catchError(() => {
        this.currentUser.set(null);
        return of(null);
      }),
    );
  }

  login(): void {
    window.location.href = '/oauth2/authorization/keycloak';
  }

  /**
   * RP-initiated logout needs a top-level navigation, not an XHR. The BE answers
   * POST /api/v1/auth/logout with a 302 to Keycloak's end-session endpoint (on
   * taxbe.local:8888, cross-origin and not proxied). An XHR would auto-follow that
   * redirect into a CORS error and never close the SSO session, so we submit a real
   * form: the browser follows the 302 with its Keycloak cookie, the SSO session ends,
   * and the BE's post-logout handler redirects back to '/'. CSRF rides along as the
   * `_csrf` form field (raw token from the XSRF-TOKEN cookie).
   */
  logout(): void {
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/api/v1/auth/logout';

    const token = this.readXsrfToken();
    if (token) {
      const csrf = document.createElement('input');
      csrf.type = 'hidden';
      csrf.name = '_csrf';
      csrf.value = token;
      form.appendChild(csrf);
    }

    document.body.appendChild(form);
    form.submit();
  }

  private readXsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
