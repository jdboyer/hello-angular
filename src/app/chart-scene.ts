import { Scene, CircleScene } from './hello-canvas/hello-canvas';
import { ChartScene, createSampleChartScene, createVersionColumns } from './chart-helper';

/**
 * Create month labels with hardcoded random rem offsets
 */
function createMonthLabels(): { text: string; xOffset: number }[] {
  const months = [
    'Feb 25', 'Mar 25', 'Apr 25', 'May 25', 'Jun 25',
    'Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25'
  ];
  
  // Hardcoded random offsets from 0 to 200 (generated once, sorted from smallest to largest)
  const hardcodedOffsets = [23, 41, 47, 78, 92, 134, 156, 167, 183, 198];
  
  const labels: { text: string; xOffset: number }[] = [];
  
  for (let i = 0; i < months.length; i++) {
    labels.push({
      text: months[i],
      xOffset: hardcodedOffsets[i]
    });
  }
  
  return labels;
}

/**
 * Helper to convert HSL to RGBA
 */
function hslToRgba(h: number, s: number, l: number, a: number): [number, number, number, number] {
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

/**
 * Create chart circles based on chart data
 */
function createChartCircles(spacingRem: number = 8): CircleScene[] {
  const circles: CircleScene[] = [];
  const chartData = createSampleChartScene();
  
  // Create circles based on chart data
  // For now, using a similar pattern to column circles but adapted for chart visualization
  const circlesPerColumn = 4;
  const numColumns = 25; // Number of version columns to display
  
  for (let col = 0; col < numColumns; col++) {
    const x = col * spacingRem;
    
    for (let row = 0; row < circlesPerColumn; row++) {
      const y = (row - circlesPerColumn / 2) * spacingRem;
      
      // Color based on column and row
      const hue = (col * 15 + row * 30) % 360;
      const saturation = 0.7;
      const lightness = 0.5;
      const alpha = 0.8;
      
      const color = hslToRgba(hue, saturation, lightness, alpha);
      
      circles.push({
        x: x,
        y: y,
        radius: 0.48 + (row / circlesPerColumn) * 0.32,
        color: color
      });
    }
  }
  
  return circles;
}

/**
 * Create a default chart scene
 */
export function createDefaultChartScene(): Scene {
  const monthLabels = createMonthLabels();
  console.log('Created month labels:', monthLabels);
  return {
    gridLines: [0.2, 0.4, 0.6, 0.8],
    circles: createChartCircles(8), // Default 8rem spacing
    labels: Array.from({length: 100}, (_, i) => (i + 1).toString()),
    bottomLabels: monthLabels,
    spacing: 8, // Default 8rem spacing
    overlayXOffset: 4 // Default 4rem offset
  };
}

/**
 * Create a chart scene with custom spacing
 */
export function createChartScene(spacingRem: number = 8): Scene {
  const monthLabels = createMonthLabels();
  return {
    gridLines: [0.2, 0.4, 0.6, 0.8],
    circles: createChartCircles(spacingRem),
    labels: Array.from({length: 100}, (_, i) => (i + 1).toString()),
    bottomLabels: monthLabels,
    spacing: spacingRem,
    overlayXOffset: 4
  };
} 