import { Routes } from '@angular/router';
import { TaxCalculatorService } from './income-tax/services/tax-calculator.service';
import { TaxWizardStore } from './income-tax/services/tax-wizard.store';
import { canActivateStep, loadDraftGuard } from './income-tax/wizard/guards/wizard.guard';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./income-tax/income-tax-page').then((m) => m.IncomeTaxPage),
  },
  {
    path: 'wizard',
    canActivate: [authGuard, loadDraftGuard],
    loadComponent: () => import('./income-tax/wizard/wizard-layout').then((m) => m.WizardLayout),
    providers: [TaxWizardStore, TaxCalculatorService],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'taxpayer' },
      {
        path: 'taxpayer',
        loadComponent: () =>
          import('./income-tax/wizard/steps/taxpayer-step').then((m) => m.TaxpayerStep),
      },
      {
        path: 'income',
        canActivate: [canActivateStep('income')],
        loadComponent: () =>
          import('./income-tax/wizard/steps/income-step').then((m) => m.IncomeStep),
      },
      {
        path: 'deductions',
        canActivate: [canActivateStep('deductions')],
        loadComponent: () =>
          import('./income-tax/wizard/steps/deductions-step').then((m) => m.DeductionsStep),
      },
      {
        path: 'review',
        canActivate: [canActivateStep('review')],
        loadComponent: () =>
          import('./income-tax/wizard/steps/review-step').then((m) => m.ReviewStep),
      },
      {
        path: 'result',
        canActivate: [canActivateStep('result')],
        loadComponent: () =>
          import('./income-tax/wizard/steps/result-step').then((m) => m.ResultStep),
      },
    ],
  },
];
