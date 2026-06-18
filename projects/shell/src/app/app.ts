import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
// Side-effect import: collapse.js registers a document-level click handler for
// [data-bs-toggle="collapse"] at import time — no manual instantiation needed.
import 'bootstrap/js/dist/collapse';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly auth = inject(AuthService);

  constructor() {
    // Fill the navbar with the current user (or leave it empty if not logged in).
    this.auth.me().subscribe();
  }

  protected logout(): void {
    // BE handles RP-initiated logout + the post-logout redirect back to '/'.
    this.auth.logout();
  }
}
