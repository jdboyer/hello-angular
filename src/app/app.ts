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
   * Create a default scene with concentric rings
   */
  private createDefaultScene(): Scene {
    return {
      topLabels: [],
      topLabelsOffset: [],
      bottomLabels: [],
      bottomLabelsOffset: [],
      gridLines: [0.2, 0.4, 0.6, 0.8],
      gridLinesColor: '#ffffff',
      gridLinesWidth: 1,
      gridLinesOpacity: 0.3,
      circles: this.createConcentricRingsScene()
    };
  }

  /**
   * Create a tiled concentric rings pattern of circles that spans the full scrollable width
   */
  private createConcentricRingsScene(): CircleScene[] {
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
   * Create a spiral pattern of circles
   */
  createSpiralScene(): void {
    const circles: CircleScene[] = [];
    const numCircles = 100;
    
    for (let i = 0; i < numCircles; i++) {
      const angle = (i / numCircles) * 8 * Math.PI; // 4 full rotations
      const radius = (i / numCircles) * 0.8; // Spiral from center to edge
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      // Color gradient from blue to red
      const t = i / numCircles;
      const r = t;
      const g = 0.2;
      const b = 1.0 - t;
      const a = 0.8;
      
      circles.push({
        x: x,
        y: y,
        radius: 0.02 + (1 - t) * 0.03, // Larger circles at center
        color: [r, g, b, a]
      });
    }
    
    this.updateSceneCircles(circles);
  }

  /**
   * Create a random scatter of circles
   */
  createRandomScene(): void {
    const circles: CircleScene[] = [];
    const numCircles = 200;
    
    for (let i = 0; i < numCircles; i++) {
      const x = (Math.random() - 0.5) * 2; // -1 to 1
      const y = (Math.random() - 0.5) * 2; // -1 to 1
      
      // Random colors
      const r = Math.random();
      const g = Math.random();
      const b = Math.random();
      const a = 0.6 + Math.random() * 0.4; // 0.6 to 1.0
      
      circles.push({
        x: x,
        y: y,
        radius: 0.01 + Math.random() * 0.04, // 0.01 to 0.05
        color: [r, g, b, a]
      });
    }
    
    this.updateSceneCircles(circles);
  }

  /**
   * Create a Lissajous curve pattern of circles
   */
  createLissajousScene(): void {
    const circles: CircleScene[] = [];
    const numCircles = 200;
    // Lissajous parameters (A, B, a, b, delta)
    const A = 0.9; // x amplitude
    const B = 0.9; // y amplitude
    const a = 3;   // x frequency
    const b = 2;   // y frequency
    const delta = Math.PI / 2; // phase difference
    for (let i = 0; i < numCircles; i++) {
      const t = (i / (numCircles - 1)) * 2 * Math.PI;
      const x = A * Math.sin(a * t + delta);
      const y = B * Math.sin(b * t);
      // Color: cycle through hues
      const hue = (t / (2 * Math.PI)) * 360;
      const color = this.hslToRgba(hue, 0.7, 0.5, 0.8);
      circles.push({
        x: x,
        y: y,
        radius: 0.025,
        color: color
      });
    }
    this.updateSceneCircles(circles);
  }

  /**
   * Create a grid pattern of circles
   */
  createGridScene(): void {
    const circles: CircleScene[] = [];
    
    // Generate a wide grid of circles that spans multiple screen widths
    const numColumns = 60; // More columns to span wider area
    const numRows = 15;
    
    for (let i = 0; i < numColumns; i++) {
      for (let j = 0; j < numRows; j++) {
        // Map to a wider range: -3 to 3 (3x the normal width)
        const x = (i / (numColumns - 1)) * 6 - 3; // Map 0-59 to -3 to 3
        const y = (j / (numRows - 1)) * 2 - 1; // Map 0-14 to -1 to 1
        
        // Vary colors based on position
        const r = (i / (numColumns - 1)) * 0.8 + 0.2;
        const g = (j / (numRows - 1)) * 0.8 + 0.2;
        const b = 0.5;
        const a = 0.7;
        
        circles.push({
          x: x,
          y: y,
          radius: 0.02 + Math.random() * 0.03, // Random radius between 0.02 and 0.05
          color: [r, g, b, a]
        });
      }
    }
    
    // Add some larger accent circles at key positions
    circles.push(
      { x: -2.5, y: 0.8, radius: 0.08, color: [1.0, 0.0, 0.0, 0.9] }, // Red circle far left
      { x: 2.5, y: 0.8, radius: 0.08, color: [0.0, 1.0, 0.0, 0.9] },  // Green circle far right
      { x: -2.5, y: -0.8, radius: 0.08, color: [0.0, 0.0, 1.0, 0.9] }, // Blue circle bottom far left
      { x: 2.5, y: -0.8, radius: 0.08, color: [1.0, 1.0, 0.0, 0.9] },  // Yellow circle bottom far right
      { x: 0.0, y: 0.0, radius: 0.12, color: [1.0, 0.0, 1.0, 0.8] }   // Magenta circle center
    );
    
    this.updateSceneCircles(circles);
  }

  /**
   * Create columns of circles with the same spacing as overlay labels (8rem)
   */
  createColumnScene(): void {
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
    
    this.updateSceneCircles(circles);
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
