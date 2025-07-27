import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HelloCanvas, Scene, MousePosition } from './hello-canvas/hello-canvas';
import { createChartScene } from './chart-scene';

@Component({
  selector: 'app-root',
  imports: [HelloCanvas, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('hello-angular');

  // Create a signal for the scene
  protected readonly scene = signal<Scene>(createChartScene(8, 200));
  
  // Signal for mouse position
  protected readonly mousePosition = signal<MousePosition>({x: 0, y: 0, nearestYAxisLabel: '', version: ''});

  /**
   * Handle mouse position changes from the canvas component
   */
  onMousePositionChange(position: MousePosition): void {
    this.mousePosition.set(position);
  }
}
