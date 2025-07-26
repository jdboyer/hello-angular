import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
//import { HelloD3 } from './hello-d3/hello-d3';
import { HelloCanvas, Scene, CircleScene } from './hello-canvas/hello-canvas'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HelloCanvas],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('hello-angular');

  // Create a signal for the scene
  protected readonly scene = signal<Scene>(this.createDefaultScene());

  /**
   * Create a default scene with column pattern
   */
  private createDefaultScene(): Scene {
    return {
      gridLines: [0.2, 0.4, 0.6, 0.8],
      circles: this.createColumnCircles(),
      labels: Array.from({length: 100}, (_, i) => (i + 1).toString())
    };
  }

  /**
   * Create a tiled concentric rings pattern of circles that spans the full scrollable width
   */
  private createConcentricRingsCircles(): CircleScene[] {
    const circles: CircleScene[] = [];
    const numRings = 10;
    const circlesPerRing = 32;
    const minRadius = 0.1;
    const maxRadius = 1.2; // Slightly smaller for tiling
    const ringSpacing = (maxRadius - minRadius) / (numRings - 1);
    const tileSpacing = 2.4; // Distance between centers of each tile (should be > maxRadius*2 for overlap)
    const minX = -3;
    const maxX = 3 + 2 * tileSpacing; // extend even further beyond right edge
    // Compute how many tiles are needed to cover the full scrollable width (including right edge)
    const numTiles = Math.ceil((maxX - minX) / tileSpacing) + 1;
    for (let tile = 0; tile < numTiles; tile++) {
      const centerX = minX + tile * tileSpacing;
      const centerY = 0;
      for (let ring = 0; ring < numRings; ring++) {
        const r = minRadius + ring * ringSpacing;
        for (let i = 0; i < circlesPerRing; i++) {
          const theta = (i / circlesPerRing) * 2 * Math.PI;
          const x = centerX + r * Math.cos(theta);
          const y = centerY + r * Math.sin(theta);
          // Color: vary by ring, angle, and tile
          const hue = ((ring / numRings) * 360 + (theta / (2 * Math.PI)) * 60 + tile * 30) % 360;
          const color = this.hslToRgba(hue, 0.7, 0.5, 0.7);
          circles.push({
            x: x,
            y: y,
            radius: 0.07 - 0.004 * ring, // Slightly smaller for outer rings
            color: color
          });
        }
      }
      // Add a central circle for each tile
      circles.push({ x: centerX, y: centerY, radius: 0.09, color: this.hslToRgba(tile * 30, 0.7, 0.5, 0.9) });
    }
    return circles;
  }

  /**
   * Create columns of circles with the same spacing as overlay labels (8rem)
   */
  private createColumnCircles(): CircleScene[] {
    const circles: CircleScene[] = [];
    
    // Calculate exact spacing to match overlay labels
    // 8rem = 8 * 16px = 128px (assuming 16px base font size)
    // Total scroll range is 2000 pixels, normalized range is -3 to 3 (6 units)
    // So 128px maps to: (128 / 2000) * 6 = 0.384 normalized units
    const columnSpacing = 0.384; // Exact spacing to match 8rem overlay labels
    
    // Number of columns to span the full scrollable width
    const numColumns = 16; // Enough columns to span the scrollable area
    const circlesPerColumn = 8; // Number of circles per column
    
    for (let col = 0; col < numColumns; col++) {
      const x = (col * columnSpacing) - 3; // Start at -3 and go right
      
      for (let row = 0; row < circlesPerColumn; row++) {
        // Distribute circles evenly in the column from -1 to 1
        const y = (row / (circlesPerColumn - 1)) * 2 - 1;
        
        // Vary colors based on column and row
        const hue = (col * 22.5 + row * 30) % 360; // 22.5° per column (360/16)
        const saturation = 0.7;
        const lightness = 0.5 + (row / circlesPerColumn) * 0.3; // Lighter at top
        const alpha = 0.8;
        
        const color = this.hslToRgba(hue, saturation, lightness, alpha);
        
        circles.push({
          x: x,
          y: y,
          radius: 0.03 + (row / circlesPerColumn) * 0.02, // Slightly larger circles at top
          color: color
        });
      }
    }
    
    return circles;
  }

  /**
   * Switch to concentric rings pattern
   */
  createConcentricRingsScene(): void {
    this.updateSceneCircles(this.createConcentricRingsCircles());
  }

  /**
   * Switch to column pattern
   */
  createColumnScene(): void {
    this.updateSceneCircles(this.createColumnCircles());
  }

  /**
   * Update the scene with new circles
   */
  private updateSceneCircles(circles: CircleScene[]): void {
    const currentScene = this.scene();
    this.scene.set({
      ...currentScene,
      circles: circles
    });
  }

  /**
   * Helper to convert HSL to RGBA
   */
  private hslToRgba(h: number, s: number, l: number, a: number): [number, number, number, number] {
    h = h % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m, a];
  }
}
