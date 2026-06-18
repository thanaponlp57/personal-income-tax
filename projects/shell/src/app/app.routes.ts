import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';

export const routes: Routes = [
  {
    path: 'income-tax',
    loadChildren: () =>
      loadRemoteModule('personal-income-tax', './routes').then((m) => m.routes),
  },
  { path: '', redirectTo: '/income-tax', pathMatch: 'full' },
];
