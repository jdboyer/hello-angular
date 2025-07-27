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
  protected readonly mousePosition = signal<MousePosition>({x: 0, y: 0, nearestYAxisLabel: '', version: ''});
  
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
    this.highlightCurrentPosition();
  }

  /**
   * Highlight the shape at the current mouse position
   */
  private highlightCurrentPosition(): void {
    const mousePos = this.mousePosition();
    if (mousePos.version && mousePos.nearestYAxisLabel && this.helloCanvas) {
      // Extract hostname from the label
      const match = mousePos.nearestYAxisLabel.match(/^([^(]+)/);
      if (match) {
        const hostname = match[1].trim();
        const success = this.helloCanvas.highlightShapeByHostAndVersion(hostname, mousePos.version, mousePos.x);
        if (success) {
          // Find the instance index to update the display
          const instanceIndex = this.helloCanvas.findShapeInstanceIndex(hostname, mousePos.version, mousePos.x);
          this.currentHighlightIndex.set(instanceIndex);
        } else {
          // If no shape found, clear the highlight
          this.currentHighlightIndex.set(-1);
          this.helloCanvas.highlightShape(-1);
        }
      }
    } else {
      // If no valid position, clear the highlight
      this.currentHighlightIndex.set(-1);
      if (this.helloCanvas) {
        this.helloCanvas.highlightShape(-1);
      }
    }
  }

  /**
   * Test method to find and highlight a shape by host and version
   * @param hostname The hostname to search for
   * @param version The version to search for
   */
  testFindShapeByHostAndVersion(hostname: string, version: string): void {
    if (this.helloCanvas) {
      const instanceIndex = this.helloCanvas.findShapeInstanceIndex(hostname, version);
      console.log(`Found shape for host "${hostname}" and version "${version}" at index: ${instanceIndex}`);
      
      if (instanceIndex !== -1) {
        this.currentHighlightIndex.set(instanceIndex);
        this.helloCanvas.highlightShape(instanceIndex);
      } else {
        console.log(`No shape found for host "${hostname}" and version "${version}"`);
      }
    }
  }

  /**
   * Test method to highlight a shape by host and version
   * @param hostname The hostname to search for
   * @param version The version to search for
   */
  testHighlightByHostAndVersion(hostname: string, version: string): void {
    if (this.helloCanvas) {
      const success = this.helloCanvas.highlightShapeByHostAndVersion(hostname, version);
      if (success) {
        console.log(`Successfully highlighted shape for host "${hostname}" and version "${version}"`);
      } else {
        console.log(`Failed to highlight shape for host "${hostname}" and version "${version}"`);
      }
    }
  }
}
