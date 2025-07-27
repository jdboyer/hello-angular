import { Scene, CircleScene } from './hello-canvas/hello-canvas';
import { ChartScene, createSampleChartScene, createVersionColumns, HostRow } from './chart-helper';
import { ShapeScene } from './pipelines/multi-circle-pipeline';

/**
 * Create grid line positions for hostRows with proper spacing
 */
function createHostGridLines(hostRows: HostRow[]): number[] {
  const gridLines: number[] = [];
  
  const smallGap = 0.02;
  const largeGap = 0.03;
  // Calculate total gaps needed
  let totalGaps = 0;
  for (let i = 0; i < hostRows.length - 1; i++) {
    const currentHost = hostRows[i];
    const nextHost = hostRows[i + 1];
    
    if (nextHost.platform === currentHost.platform) {
      if (nextHost.subplatform === currentHost.subplatform) {
        totalGaps += 0.00; // Small gap between subplatforms of same platform
      } else {
        totalGaps += smallGap; // Larger gap between different platforms
      }
    } else {
      totalGaps += largeGap; // Larger gap between different platforms
    }
  }
  
  // Calculate available space for hosts (0.15 to 0.8 = 0.65 total space)
  const availableSpace = 0.8 - totalGaps;
  const hostSpacing = availableSpace / hostRows.length;
  
  // Calculate grid line positions
  let currentY = 0.07; // Start at 0.1
  
  for (let i = 0; i < hostRows.length; i++) {
    const currentHost = hostRows[i];
    const nextHost = hostRows[i + 1];
    
    // Add grid line for current host
    gridLines.push(currentY);
    
    // Move to next position
    currentY += hostSpacing;
    
    // Add gap after this host if there's a next host
    if (nextHost) {
      if (nextHost.platform === currentHost.platform) {
        if (nextHost.subplatform === currentHost.subplatform) {
          currentY += 0;
        } else {
          currentY += smallGap;
        }
      } else {
        currentY += largeGap;
      }
    }
  }
  console.log(hostRows);
  console.log(gridLines);
  
  return gridLines;
}

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
 * Create chart shapes based on chart data
 */
function createChartShapes(chartData: ChartScene, hostGridLines: number[], spacingRem: number = 8): ShapeScene[] {
  const shapes: ShapeScene[] = [];
  
  // Iterate through each version column
  chartData.versionColumns.forEach((versionColumn, columnIndex) => {
    const baseX = columnIndex * spacingRem + 4;
    
    // Track how many shapes have been added for each host index in this version column
    const hostShapeCounts = new Map<number, number>();
    
    // Iterate through each test result in this version column
    versionColumn.testResults.forEach(testResult => {
      // Get the count of shapes already added for this host index in this version column
      const shapeCount = hostShapeCounts.get(testResult.hostIndex) || 0;
      
      // Calculate x offset based on the number of shapes already added for this host
      const xOffset = shapeCount * 0.5;
      const x = baseX + xOffset;
      
      // Get the y position from the corresponding host grid line
      const y = (1 - hostGridLines[testResult.hostIndex]) * 60;
      
      // Color based on test result value (1-5)
      const hue = (testResult.result * 60) % 360; // Different hue for each result value
      const saturation = 0.7;
      const lightness = 0.5;
      const alpha = 0.8;
      
      const color = hslToRgba(hue, saturation, lightness, alpha);
      
      // Shape type based on test result value (1-5)
      // 1 = Circle, 2 = Square, 3 = Diamond, 4 = Triangle, 5 = Circle (cycle back)
      const shapeType = (testResult.result - 1) % 4;
      
      shapes.push({
        x: x,
        y: y,
        radius: 0.48 + (testResult.result / 5) * 0.32, // Radius based on test result value
        color: color,
        shapeType: shapeType
      });
      
      // Increment the count for this host index
      hostShapeCounts.set(testResult.hostIndex, shapeCount + 1);
    });
  });
  
  return shapes;
}

/**
 * Create grid line labels from host rows
 */
function createGridLineLabels(hostRows: HostRow[]): string[] {
  // Create labels in reverse order to match the top-to-bottom grid line positioning
  return hostRows.map(host => {
    if (host.subplatform) {
      return `${host.hostname} (${host.platform} - ${host.subplatform})`;
    } else {
      return `${host.hostname} (${host.platform})`;
    }
  });
}

/**
 * Create a chart scene with custom spacing
 */
export function createChartScene(spacingRem: number = 8, scrollRangeRem: number = 200): Scene {
  const monthLabels = createMonthLabels();
  const chartData = createSampleChartScene();
  const hostGridLines = createHostGridLines(chartData.hostRows);
  const gridLineLabels = createGridLineLabels(chartData.hostRows);
  
  // Extract version strings from chartData.versionColumns
  const xAxisLabels = chartData.versionColumns.map(column => column.version);
  
  return {
    gridLines: hostGridLines,
    circles: createChartShapes(chartData, hostGridLines, spacingRem),
    xAxisLabels: xAxisLabels,
    gridLineLabels: gridLineLabels,
    bottomLabels: monthLabels,
    spacing: spacingRem,
    overlayXOffset: 4,
    scrollRangeRem: scrollRangeRem
  };
} 