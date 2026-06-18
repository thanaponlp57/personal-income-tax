import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  subject: string;
  username: string;
  fullName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  readonly currentUser = signal<AuthUser | null>(null);

  me(): Observable<AuthUser | null> {
    return this.http.get<AuthUser>(`${this.base}/api/v1/auth/me`).pipe(
      tap(user => this.currentUser.set(user)),
      catchError(() => {
        this.currentUser.set(null);
        return of(null);
      }),
    );
  }

  login(): void {
    window.location.href = `${this.base}/oauth2/authorization/keycloak`;
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/api/v1/auth/logout`, null).pipe(
      tap(() => this.currentUser.set(null)),
    );
  }
}
