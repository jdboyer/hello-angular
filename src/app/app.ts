import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HelloCanvas, ChartScene } from './hello-canvas/hello-canvas';
import { createSampleChartScene } from './chart-helper';

@Component({
  selector: 'app-root',
  imports: [HelloCanvas, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('hello-angular');

  // Create a signal for the chart scene
  protected readonly chartScene = signal<ChartScene>(createSampleChartScene());
}
