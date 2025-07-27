import { Component, Input, Output, signal, computed, EventEmitter, Signal, ViewChild, ElementRef, effect } from '@angular/core';

@Component({
  selector: 'app-overlay',
  standalone: true,
  template: `
    <div #overlayContainer class="overlay-container" (mousemove)="onMouseMove($event)">
      @for (text of visibleTexts(); track $index; let i = $index) {
        <div class="tick-container top-tick-container"
             [style.left.px]="(i) * convertRemToPixels(textSpacing) + offsetX() + convertRemToPixels(overlayXOffset())">
          <span class="axis-label">{{ text }}</span>
          <div class="tick-mark top-tick"></div>
        </div>
      }
      @for (label of visibleBottomLabels(); track $index) {
        <div class="tick-container bottom-tick-container"
             [style.left.px]="convertRemToPixels(label.xOffset) - getBottomLabelsScrollOffset() + convertRemToPixels(overlayXOffset())">
          <div class="tick-mark bottom-tick"></div>
          <span class="bottom-axis-label">{{ label.text }}</span>
        </div>
      }
      <div 
        class="overlay-scrollbar"
        [style.--thumb-width]="getThumbWidth() + 'px'"
        (mousedown)="onMouseDown($event)"
      >
        <div 
          class="scrollbar-track"
          (click)="onTrackClick($event)"
        ></div>
        <div 
          class="scrollbar-thumb"
          [style.left]="getThumbPosition() + 'px'"
        ></div>
      </div>
    </div>
  `,
  styleUrls: ['./overlay.component.css']
})
export class OverlayComponent {
  @ViewChild('overlayContainer', { static: true }) overlayContainer!: ElementRef<HTMLElement>;
  
  @Input({ required: true }) scrollRange!: Signal<number>;
  @Input({ required: true }) scrollPosition = signal(0);
  @Input({ required: true }) textList = signal<string[]>([]);
  @Input({ required: true }) bottomLabelsList = signal<{ text: string; xOffset: number }[]>([]);
  @Input({ required: true }) offsetX = signal(0);
  @Input({ required: true }) overlayXOffset = signal(0); // X offset in rem units to shift all overlay text
  @Input({ required: true }) canvasWidth = signal(500);
  @Input() textSpacing!: number; // Spacing in rem units
  @Output() scrollPositionChange = new EventEmitter<number>();
  @Output() mousePositionChange = new EventEmitter<{x: number, y: number}>();

  // Effect to update offsetX when scroll position changes
  private scrollEffect = effect(() => {
    const scrollPos = this.scrollPosition();
    this.updateOffsetX(scrollPos);
  });

  get canvasWidthValue() {
    return this.canvasWidth();
  }

  convertRemToPixels(rem: number): number {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  convertPixelsToRem(pixels: number): number {
    return pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  calculateSceneRelativePosition(event: MouseEvent): {x: number, y: number} {
    // Get the overlay container element using ViewChild reference
    const overlayElement = this.overlayContainer.nativeElement;
    const rect = overlayElement.getBoundingClientRect();
    
    // Calculate mouse position relative to the overlay container
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    
    // Convert to rem units
    const pxToRemRatio = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const xRem = relativeX / pxToRemRatio;
    const yRem = relativeY / pxToRemRatio;
    
    // Get current scroll and offset information
    const scrollRange = this.scrollRange();
    const canvasWidth = this.canvasWidth();
    const canvasWidthRem = canvasWidth / pxToRemRatio;
    const overlayXOffset = this.overlayXOffset();
    
    // Calculate the current scroll offset in rem
    let scrollOffsetRem = 0;
    if (scrollRange > canvasWidthRem) {
      const totalScrollDistanceRem = scrollRange - canvasWidthRem;
      const currentScrollDistanceRem = this.scrollPosition() * totalScrollDistanceRem;
      scrollOffsetRem = currentScrollDistanceRem;
    }
    
    // Calculate scene-relative position
    // X position: relative to scene (accounting for scroll and overlay offset)
    const sceneX = xRem + scrollOffsetRem - overlayXOffset;
    
    // Y position: relative to top of canvas (y = 0 at top)
    // The canvas is 10rem height and centered in the 60rem container
    const containerHeightRem = 60; // From .example-container height
    const canvasHeightRem = 60; // From .my-canvas height
    const canvasTopY = (containerHeightRem - canvasHeightRem) / 2; // 25rem from container top
    const sceneY = yRem - canvasTopY;
    
    return {x: sceneX, y: sceneY};
  }

  getBottomLabelsScrollOffset(): number {
    const canvasWidth = this.canvasWidth();
    const scrollRange = this.scrollRange();
    const pxToRemRatio = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const canvasWidthRem = canvasWidth / pxToRemRatio;
    
    // If scroll range is smaller than or equal to canvas width, no offset needed
    if (scrollRange <= canvasWidthRem) {
      return 0;
    }
    
    // Calculate scroll distance based on canvas width vs scroll range
    const totalScrollDistanceRem = scrollRange - canvasWidthRem;
    const totalScrollDistancePixels = totalScrollDistanceRem * pxToRemRatio;
    const currentScrollDistancePixels = this.scrollPosition() * totalScrollDistancePixels;
    
    return currentScrollDistancePixels;
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
    const maxVisibleItems = Math.max(1, Math.floor(canvasWidth / spacingInPixels) + 1);
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

  visibleBottomLabels = computed(() => {
    const all = this.bottomLabelsList();
    
    // For bottom labels, we want to show all labels and let them move with the scroll
    // They have individual x offsets, so we don't need the same filtering logic as top labels
    return all;
  });

  private isDragging = false;
  private dragStartX = 0;
  private dragStartScrollPosition = 0;

  getThumbPosition(): number {
    const canvasWidth = this.canvasWidth();
    const scrollPosition = this.scrollPosition();
    const thumbWidth = this.getThumbWidth();
    const trackWidth = canvasWidth - thumbWidth;
    return scrollPosition * trackWidth;
  }

  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.dragStartX = event.clientX;
    this.dragStartScrollPosition = this.scrollPosition();
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  onMouseMove(event: MouseEvent): void {
    // Calculate mouse position relative to scene in rem units
    const sceneRelativePosition = this.calculateSceneRelativePosition(event);
    this.mousePositionChange.emit(sceneRelativePosition);
    
    // Handle dragging if active
    if (!this.isDragging) return;
    
    const canvasWidth = this.canvasWidth();
    const thumbWidth = this.getThumbWidth();
    const trackWidth = canvasWidth - thumbWidth;
    const deltaX = event.clientX - this.dragStartX;
    const deltaScroll = deltaX / trackWidth;
    
    const newScrollPosition = Math.max(0, Math.min(1, this.dragStartScrollPosition + deltaScroll));
    this.updateScrollPosition(newScrollPosition);
  }

  onMouseUp(event: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      document.removeEventListener('mousemove', this.onMouseMove.bind(this));
      document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    }
  }

  onTrackClick(event: MouseEvent): void {
    const canvasWidth = this.canvasWidth();
    const thumbWidth = this.getThumbWidth();
    const trackWidth = canvasWidth - thumbWidth;
    const clickX = event.offsetX;
    const newScrollPosition = Math.max(0, Math.min(1, clickX / trackWidth));
    this.updateScrollPosition(newScrollPosition);
  }

  private updateOffsetX(scrollValue: number): void {
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
    const currentScrollDistancePixels = scrollValue * totalScrollDistancePixels;
    this.offsetX.set(-currentScrollDistancePixels % spacingInPixels);
  }

  private updateScrollPosition(value: number): void {
    this.scrollPosition.set(value);
    this.scrollPositionChange.emit(value);
    this.updateOffsetX(value);
  }
} 