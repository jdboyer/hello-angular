import { Component, signal, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { HelloCanvas, Scene, CircleScene, MousePosition } from './hello-canvas/hello-canvas';
import { createChartScene } from './chart-scene';
import { ViewChild } from '@angular/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HelloCanvas, FormsModule, DecimalPipe, MatFormFieldModule, MatInputModule, MatSliderModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  @ViewChild(HelloCanvas) helloCanvas!: HelloCanvas;
  
  protected readonly title = signal('hello-angular');

  // Create a signal for the scene
  protected readonly scene = signal<Scene>(createChartScene(8, 200));
  
  // Signal for mouse position
  protected readonly mousePosition = signal<MousePosition>({x: 0, y: 0, nearestYAxisLabel: ''});
  
  // Signal for current highlight index
  protected readonly currentHighlightIndex = signal<number>(-1);

  // Computed signal to get scroll range from scene
  protected readonly scrollRangeRem = computed(() => this.scene().scrollRangeRem);

  /**
   * Switch to chart scene
   */
  createChartScene(): void {
    const currentScene = this.scene();
    this.scene.set(createChartScene(currentScene.spacing, currentScene.scrollRangeRem));
  }

  /**
   * Update spacing and regenerate circles
   */
  updateSpacing(newSpacing: number): void {
    const currentScene = this.scene();
    this.scene.set(createChartScene(newSpacing, currentScene.scrollRangeRem));
  }

  /**
   * Handle spacing input change
   */
  onSpacingChange(event: any): void {
    const newSpacing = parseFloat(event.target.value);
    if (!isNaN(newSpacing) && newSpacing > 0) {
      this.updateSpacing(newSpacing);
    }
  }

  /**
   * Handle scroll range input change
   */
  onScrollRangeChange(event: any): void {
    const newScrollRange = parseFloat(event.target.value);
    if (!isNaN(newScrollRange) && newScrollRange > 0) {
      const currentScene = this.scene();
      this.scene.set(createChartScene(currentScene.spacing, newScrollRange));
    }
  }

  /**
   * Handle mouse position changes from the canvas component
   */
  onMousePositionChange(position: MousePosition): void {
    this.mousePosition.set(position);
    this.highlightRandomShape();
  }

  /**
   * Highlight a random shape when mouse moves
   */
  private highlightRandomShape(): void {
    if (this.helloCanvas && this.helloCanvas.multiShapePipeline) {
      const shapes = this.scene().circles;
      if (shapes.length > 0) {
        const randomIndex = Math.floor(Math.random() * shapes.length);
        this.currentHighlightIndex.set(randomIndex);
        this.helloCanvas.highlightShape(randomIndex);
      }
    }
  }
}
