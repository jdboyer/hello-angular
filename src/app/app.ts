import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
//import { HelloD3 } from './hello-d3/hello-d3';
import { HelloCanvas, Scene, CircleScene } from './hello-canvas/hello-canvas'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HelloCanvas, FormsModule, MatFormFieldModule, MatInputModule, MatSliderModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('hello-angular');

  // Create a signal for the scene
  protected readonly scene = signal<Scene>(this.createDefaultScene());
  
  // Signal for scroll range in rem units (total scrollable width in rem)
  protected readonly scrollRangeRem = signal<number>(200); // 80rem = 5x canvas width (assuming 16rem canvas width)

  /**
   * Create a default scene with column pattern
   */
  private createDefaultScene(): Scene {
    const monthLabels = this.createMonthLabels();
    console.log('Created month labels:', monthLabels);
    return {
      gridLines: [0.2, 0.4, 0.6, 0.8],
      circles: this.createColumnCircles(8), // Default 8rem spacing
      labels: Array.from({length: 100}, (_, i) => (i + 1).toString()),
      bottomLabels: monthLabels,
      spacing: 8 // Default 8rem spacing
    };
  }

  /**
   * Create month labels with random rem offsets
   */
  private createMonthLabels(): { text: string; xOffset: number }[] {
    const months = [
      'Feb 25', 'Mar 25', 'Apr 25', 'May 25', 'Jun 25',
      'Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26'
    ];
    
    const labels: { text: string; xOffset: number }[] = [];
    
    for (let i = 0; i < months.length; i++) {
      // Generate random rem offset between -20 and 60 (more reasonable range)
      const randomOffset = -20 + Math.random() * 80;
      labels.push({
        text: months[i],
        xOffset: randomOffset
      });
    }
    
    return labels;
  }

  /**
   * Create a tiled concentric rings pattern of circles that spans the full scrollable width
   */
  private createConcentricRingsCircles(): CircleScene[] {
    const circles: CircleScene[] = [];
    const numRings = 10;
    const circlesPerRing = 32;
    const minRadius = 1.6; // 1.6rem
    const maxRadius = 19.2; // 19.2rem (1.2 * 16)
    const ringSpacing = (maxRadius - minRadius) / (numRings - 1);
    const tileSpacing = 38.4; // 38.4rem (2.4 * 16) - Distance between centers of each tile
    const minX = -48; // -48rem (-3 * 16)
    const maxX = 48 + 2 * tileSpacing; // extend even further beyond right edge
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
            radius: 1.12 - 0.064 * ring, // Slightly smaller for outer rings (0.07 * 16 - 0.004 * 16 * ring)
            color: color
          });
        }
      }
      // Add a central circle for each tile
      circles.push({ x: centerX, y: centerY, radius: 1.44, color: this.hslToRgba(tile * 30, 0.7, 0.5, 0.9) }); // 0.09 * 16
    }
    return circles;
  }

  /**
   * Create columns of circles with the same spacing as overlay labels
   */
  private createColumnCircles(spacingRem: number = 8): CircleScene[] {
    const circles: CircleScene[] = [];
    
    // Number of columns to span the full scrollable width
    const numColumns = 48; // Enough columns to span the scrollable area
    const circlesPerColumn = 8; // Number of circles per column
    
    for (let col = 0; col < numColumns; col++) {
      const x = (col * spacingRem) - 48; // Start at -48rem and go right (spacing in rem)
      
      for (let row = 0; row < circlesPerColumn; row++) {
        // Distribute circles evenly in the column from -16 to 16 rem
        const y = (row / (circlesPerColumn - 1)) * 32 - 16;
        
        // Vary colors based on column and row
        const hue = (col * 22.5 + row * 30) % 360; // 22.5° per column (360/16)
        const saturation = 0.7;
        const lightness = 0.5 + (row / circlesPerColumn) * 0.3; // Lighter at top
        const alpha = 0.8;
        
        const color = this.hslToRgba(hue, saturation, lightness, alpha);
        
        circles.push({
          x: x,
          y: y,
          radius: 0.48 + (row / circlesPerColumn) * 0.32, // Slightly larger circles at top (0.03*16 to 0.05*16)
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
    const currentScene = this.scene();
    this.scene.set({
      ...currentScene,
      circles: this.createConcentricRingsCircles()
    });
  }

  /**
   * Switch to column pattern
   */
  createColumnScene(): void {
    const currentScene = this.scene();
    this.scene.set({
      ...currentScene,
      circles: this.createColumnCircles(currentScene.spacing)
    });
  }

  /**
   * Update spacing and regenerate circles
   */
  updateSpacing(newSpacing: number): void {
    const currentScene = this.scene();
    this.scene.set({
      ...currentScene,
      spacing: newSpacing,
      circles: this.createColumnCircles(newSpacing)
    });
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
