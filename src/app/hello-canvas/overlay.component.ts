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
    const pxToRemRatio = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const canvasWidthRem = canvasWidth / pxToRemRatio;
    
    // Calculate thumb width as a percentage of the track based on canvas width vs scroll range
    const thumbPercentage = canvasWidthRem / scrollRange;
    const minThumbWidth = 20; // Minimum thumb width in pixels
    const maxThumbWidth = canvasWidth; // Maximum thumb width (100% of canvas)
    
    const calculatedWidth = canvasWidth * thumbPercentage;
    return Math.max(minThumbWidth, Math.min(calculatedWidth, maxThumbWidth));
  }

  visibleTexts = computed(() => {
    const all = this.textList();
    const canvasWidth = this.canvasWidth();
    const spacingInPixels = this.convertRemToPixels(this.textSpacing);
    const maxVisibleItems = Math.max(1, Math.floor(canvasWidth / spacingInPixels));
    const scrollRange = this.scrollRange();
    const pxToRemRatio = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const canvasWidthRem = canvasWidth / pxToRemRatio;
    
    // If scroll range is smaller than or equal to canvas width, show all items from start
    if (scrollRange <= canvasWidthRem) {
      return all.slice(0, maxVisibleItems);
    }
    
    // Calculate scroll distance based on canvas width vs scroll range
    const totalScrollDistanceRem = scrollRange - canvasWidthRem;
    const totalScrollDistancePixels = totalScrollDistanceRem * pxToRemRatio;
    const currentScrollDistancePixels = this.scrollPosition() * totalScrollDistancePixels;
    const wraps = Math.floor(Math.abs(currentScrollDistancePixels) / spacingInPixels);
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
    const scrollRange = this.scrollRange();
    const pxToRemRatio = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const canvasWidthRem = canvasWidth / pxToRemRatio;
    
    // If scroll range is smaller than or equal to canvas width, no offset needed
    if (scrollRange <= canvasWidthRem) {
      this.offsetX.set(0);
      return;
    }
    
    // Calculate scroll distance based on canvas width vs scroll range
    const totalScrollDistanceRem = scrollRange - canvasWidthRem;
    const totalScrollDistancePixels = totalScrollDistanceRem * pxToRemRatio;
    const currentScrollDistancePixels = value * totalScrollDistancePixels;
    this.offsetX.set(-currentScrollDistancePixels % spacingInPixels);
  }
} 