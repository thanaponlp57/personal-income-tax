import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Deductions, EmploymentIncome, TaxComputation, TaxpayerProfile,
} from '../models/tax.models';
import { WizardStep } from './tax-wizard.store';

export interface FilingResult {
  id: string;
  submittedAt: string;
  computation: TaxComputation;
}

export interface DraftPayload {
  profile: TaxpayerProfile | null;
  income: EmploymentIncome | null;
  deductions: Deductions | null;
  completedSteps: WizardStep[];
}

@Injectable({ providedIn: 'root' })
export class TaxApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  calculate(
    profile: TaxpayerProfile,
    income: EmploymentIncome,
    deductions: Deductions,
  ): Observable<TaxComputation> {
    return this.http.post<TaxComputation>(
      `${this.base}/api/v1/tax/calculate`,
      this.toRequest(profile, income, deductions),
    );
  }

  submitFiling(
    profile: TaxpayerProfile,
    income: EmploymentIncome,
    deductions: Deductions,
  ): Observable<FilingResult> {
    return this.http.post<FilingResult>(
      `${this.base}/api/v1/filings`,
      this.toRequest(profile, income, deductions),
    );
  }

  getReceipt(filingId: string): Observable<Blob> {
    return this.http.get(`${this.base}/api/v1/filings/${filingId}/receipt`, {
      responseType: 'blob',
    });
  }

  saveDraft(payload: DraftPayload): Observable<void> {
    return this.http.put<void>(`${this.base}/api/v1/drafts/me`, payload);
  }

  getDraft(): Observable<DraftPayload | null> {
    return this.http.get<DraftPayload>(`${this.base}/api/v1/drafts/me`).pipe(
      catchError(() => of(null)),
    );
  }

  deleteDraft(): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/v1/drafts/me`);
  }

  private toRequest(
    profile: TaxpayerProfile,
    income: EmploymentIncome,
    deductions: Deductions,
  ) {
    return {
      taxpayer: {
        maritalStatus: profile.maritalStatus.toUpperCase() as 'SINGLE' | 'MARRIED',
        spouseHasIncome: profile.spouseHasIncome,
      },
      income: {
        salary: income.salary,
        bonus: income.bonus,
        otherIncome: income.otherIncome,
        withholdingTax: income.withholdingTax,
      },
      deductions: {
        children: deductions.children,
        parents: deductions.parents,
        socialSecurity: deductions.socialSecurity,
        lifeInsurance: deductions.lifeInsurance,
        providentFund: deductions.providentFund,
        homeLoanInterest: deductions.homeLoanInterest,
        donation: deductions.donation,
      },
    };
  }
}
