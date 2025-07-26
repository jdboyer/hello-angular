import { Component, Input, Output, signal, computed, EventEmitter, Signal } from '@angular/core';

@Component({
  selector: 'app-overlay',
  standalone: true,
  template: `
    <div class="overlay-container">
      @for (text of visibleTexts(); track $index; let i = $index) {
        <span
          class="axis-label"
          [style.left.px]="(i) * convertRemToPixels(textSpacing) + offsetX()"
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
        [style.--thumb-width]="getThumbWidth() + 'px'"
      />
    </div>
  `,
  styleUrls: ['./overlay.component.css']
})
export class OverlayComponent {
  @Input({ required: true }) scrollRange!: Signal<number>;
  @Input({ required: true }) scrollPosition = signal(0);
  @Input({ required: true }) textList = signal<string[]>([]);
  @Input({ required: true }) offsetX = signal(0);
  @Input({ required: true }) canvasWidth = signal(500);
  @Input() textSpacing!: number; // Spacing in rem units
  @Output() scrollPositionChange = new EventEmitter<number>();

  get canvasWidthValue() {
    return this.canvasWidth();
  }

  convertRemToPixels(rem: number): number {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  getMaxVisibleItems(): number {
    const canvasWidth = this.canvasWidth();
    const spacingInPixels = this.convertRemToPixels(this.textSpacing);
    return Math.max(1, Math.floor(canvasWidth / spacingInPixels));
  }

  getThumbWidth(): number {
    const canvasWidth = this.canvasWidth();
    const scrollRange = this.scrollRange();
    const maxVisibleItems = this.getMaxVisibleItems();
    
    // Calculate thumb width as a percentage of the track
    // If scrollRange equals maxVisibleItems, thumb should be 100% of track
    // If scrollRange is 10x maxVisibleItems, thumb should be 10% of track
    const thumbPercentage = maxVisibleItems / scrollRange;
    const minThumbWidth = 20; // Minimum thumb width in pixels
    const maxThumbWidth = canvasWidth * 0.8; // Maximum thumb width (80% of canvas)
    
    const calculatedWidth = canvasWidth * thumbPercentage;
    return Math.max(minThumbWidth, Math.min(calculatedWidth, maxThumbWidth));
  }

  visibleTexts = computed(() => {
    const all = this.textList();
    const canvasWidth = this.canvasWidth();
    const spacingInPixels = this.convertRemToPixels(this.textSpacing);
    const maxVisibleItems = Math.max(1, Math.floor(canvasWidth / spacingInPixels));
    const labelWidth = spacingInPixels;
    const scrollRange = this.scrollRange();
    const totalScrollDistance = (scrollRange - maxVisibleItems) * labelWidth;
    const currentScrollDistance = this.scrollPosition() * totalScrollDistance;
    const wraps = Math.floor(Math.abs(currentScrollDistance) / labelWidth);
    const maxStart = Math.max(0, all.length - maxVisibleItems);
    const start = Math.min(wraps, maxStart);
    return all.slice(start, start + maxVisibleItems);
  });

  onScroll(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.scrollPosition.set(value);
    this.scrollPositionChange.emit(value); // Emit the new scroll position
    
    const canvasWidth = this.canvasWidth();
    const spacingInPixels = this.convertRemToPixels(this.textSpacing);
    const maxVisibleItems = Math.max(1, Math.floor(canvasWidth / spacingInPixels));
    const scrollRange = this.scrollRange();
    const totalScrollDistance = (scrollRange - maxVisibleItems) * spacingInPixels;
    const currentScrollDistance = value * totalScrollDistance;
    this.offsetX.set(-currentScrollDistance % spacingInPixels);
  }
} 