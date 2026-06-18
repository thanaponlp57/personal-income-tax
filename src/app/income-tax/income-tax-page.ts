import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-income-tax-page',
  imports: [RouterLink],
  templateUrl: './income-tax-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeTaxPage {
  protected readonly title = signal('personal-income-tax');
}
