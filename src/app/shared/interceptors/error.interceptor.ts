import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export interface AppError {
  type: string;
  title: string;
  status: number;
  detail?: string;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const appError: AppError = {
        type: err.error?.type ?? 'urn:problem-type:unknown',
        title: err.error?.title ?? err.statusText,
        status: err.status,
        detail: err.error?.detail,
      };
      return throwError(() => appError);
    }),
  );
