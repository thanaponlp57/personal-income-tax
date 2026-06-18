import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Host ต้องตั้งค่า HttpClient ที่ root injector — remote ที่ฝังผ่าน federation (expose แค่
    // ./routes) ใช้ HttpClient ตัวนี้. app.config ของ remote ทำงานเฉพาะตอน standalone (:4201)
    // ถ้าไม่มีบรรทัดนี้ mutating request (PUT/POST/DELETE) จะไม่แนบ X-XSRF-TOKEN → BE 403
    provideHttpClient(
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
  ],
};
