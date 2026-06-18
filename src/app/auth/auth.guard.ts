import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.me().pipe(
    map(user => {
      if (user) return true;
      auth.login();
      return false;
    }),
  );
};
