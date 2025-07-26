import { Component, Input, signal, computed } from '@angular/core';

@Component({
  selector: 'app-overlay',
  standalone: true,
  template: `
    <div class="overlay-container">
      @for (text of visibleTexts(); track $index; let i = $index) {
        <span
          class="axis-label"
          [style.left.px]="(i) * convertRemToPixels(textSpacing()) + offsetX()"
        >{{ text }}</span>
      }
      <input
        type="range"
        class="overlay-scrollbar"
        [min]="0"
        [max]="1"
        [step]="0.001"
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
  @Input({ required: true }) canvasWidth = signal(500);
  @Input() textSpacing = signal(2); // Default 2rem spacing between text elements

  get canvasWidthValue() {
    return this.canvasWidth();
  }

  convertRemToPixels(rem: number): number {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  getMaxVisibleItems(): number {
    const canvasWidth = this.canvasWidth();
    const spacingInPixels = this.convertRemToPixels(this.textSpacing());
    return Math.max(1, Math.floor(canvasWidth / spacingInPixels));
  }

  visibleTexts = computed(() => {
    const all = this.textList();
    const canvasWidth = this.canvasWidth();
    const spacingInPixels = this.convertRemToPixels(this.textSpacing());
    const maxVisibleItems = Math.max(1, Math.floor(canvasWidth / spacingInPixels));
    const labelWidth = spacingInPixels;
    const wraps = Math.floor(Math.abs(this.scrollPosition() * -2000) / labelWidth);
    const maxStart = Math.max(0, all.length - maxVisibleItems);
    const start = wraps % (maxStart + 1);
    return all.slice(start, start + maxVisibleItems);
  });

  onScroll(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.scrollPosition.set(value);
    const spacingInPixels = this.convertRemToPixels(this.textSpacing());
    this.offsetX.set((value * -2000) % spacingInPixels);
  }
} 