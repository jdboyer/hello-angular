import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { HelloCanvas, Scene, CircleScene } from './hello-canvas/hello-canvas';
import { createChartScene } from './chart-scene';
import { createSampleChartScene } from './chart-helper';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HelloCanvas, FormsModule, DecimalPipe, MatFormFieldModule, MatInputModule, MatSliderModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('hello-angular');

  // Create a signal for the scene
  protected readonly scene = signal<Scene>(createChartScene(8));
  
  // Signal for chart data
  protected readonly chartData = signal(createSampleChartScene());
  
  // Signal for scroll range in rem units (total scrollable width in rem)
  protected readonly scrollRangeRem = signal<number>(200);
  
  // Signal for mouse position
  protected readonly mousePosition = signal<{x: number, y: number}>({x: 0, y: 0});

  /**
   * Switch to chart scene
   */
  createChartScene(): void {
    const currentScene = this.scene();
    this.scene.set(createChartScene(currentScene.spacing));
  }

  /**
   * Update spacing and regenerate circles
   */
  updateSpacing(newSpacing: number): void {
    this.scene.set(createChartScene(newSpacing));
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
      this.scrollRangeRem.set(newScrollRange);
    }
  }

  /**
   * Handle mouse position changes from the canvas component
   */
  onMousePositionChange(position: {x: number, y: number}): void {
    this.mousePosition.set(position);
  }
}
