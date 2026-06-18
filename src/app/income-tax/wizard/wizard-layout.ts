import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { TaxWizardStore, WIZARD_STEPS, WizardStep } from '../services/tax-wizard.store';

const STEP_LABELS: Record<WizardStep, string> = {
  taxpayer: 'ผู้มีเงินได้',
  income: 'เงินได้ 40(1)',
  deductions: 'ค่าลดหย่อน',
  review: 'ตรวจสอบ',
  result: 'สรุปผล',
};

@Component({
  selector: 'app-wizard-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './wizard-layout.html',
  styleUrl: './wizard-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WizardLayout {
  private readonly store = inject(TaxWizardStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly currentStep = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.activeStepFromRoute()),
    ),
    { initialValue: this.activeStepFromRoute() },
  );

  protected readonly steps = computed(() => {
    const current = this.currentStep();
    const completed = this.store.completedSteps();
    return WIZARD_STEPS.map((path, index) => ({
      path,
      number: index + 1,
      label: STEP_LABELS[path],
      active: path === current,
      done: completed.has(path) && path !== current,
    }));
  });

  private activeStepFromRoute(): WizardStep | null {
    const path = this.route.snapshot.firstChild?.url[0]?.path;
    return (WIZARD_STEPS as readonly string[]).includes(path ?? '') ? (path as WizardStep) : null;
  }
}
