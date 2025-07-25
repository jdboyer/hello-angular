import { Component, Input, signal } from '@angular/core';

@Component({
  selector: 'app-overlay',
  standalone: true,
  template: `
    <div class="overlay-container">
      <div class="overlay-text-row" [style.marginLeft.px]="offsetX()">
        @for (text of textList(); track text) {
          <span class="overlay-text">{{ text }}</span>
        }
      </div>
      <input
        type="range"
        class="overlay-scrollbar"
        [min]="0"
        [max]="scrollRange()"
        [value]="scrollPosition()"
        (input)="onScroll($event)"
      />
    </div>
  `,
  styleUrls: ['./overlay.component.css']
})
export class OverlayComponent {
  @Input({ required: true }) scrollRange = signal(100);
  @Input({ required: true }) scrollPosition = signal(0);
  @Input({ required: true }) textList = signal<string[]>([]);
  @Input({ required: true }) offsetX = signal(0);

  onScroll(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.scrollPosition.set(value);
    this.offsetX.set((value * 10) % 200);
    console.log(this.offsetX());
  }
} 