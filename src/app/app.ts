import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
//import { HelloD3 } from './hello-d3/hello-d3';
import { HelloCanvas } from './hello-canvas/hello-canvas'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HelloCanvas],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('hello-angular');
}
