import { Scene, CircleScene, ChartScene, HostRow, TestResultMapping } from './hello-canvas';
import { createSampleChartScene, createVersionColumns } from '../chart-helper';
import { ShapeScene } from './multi-shape-pipeline';

/**
 * Create default test result mappings
 * 1 = green circle, 2 = yellow triangle, 3 = red square, 4 = teal diamond, 5 = white triangle
 */
function createDefaultTestResultMappings(): Map<number, TestResultMapping> {
  const mappings = new Map<number, TestResultMapping>();
  
  // 1 = green circle
  mappings.set(1, {
    shapeType: 0, // Circle
    color: [0.0, 1.0, 0.0, 0.8] // Green with 80% opacity
  });
  
  // 2 = yellow triangle
  mappings.set(2, {
    shapeType: 3, // Triangle
    color: [1.0, 1.0, 0.0, 0.8] // Yellow with 80% opacity
  });
  
  // 3 = red square
  mappings.set(3, {
    shapeType: 1, // Square
    color: [1.0, 0.0, 0.0, 0.8] // Red with 80% opacity
  });
  
  // 4 = teal diamond
  mappings.set(4, {
    shapeType: 2, // Diamond
    color: [0.0, 0.5, 0.5, 0.8] // Teal with 80% opacity
  });
  
  // 5 = white triangle
  mappings.set(5, {
    shapeType: 3, // Triangle
    color: [1.0, 1.0, 1.0, 0.8] // White with 80% opacity
  });
  
  return mappings;
}

/**
 * Create grid line positions for hostRows with proper spacing
 */
function createHostGridLines(hostRows: HostRow[]): number[] {
  const gridLines: number[] = [];
  
  const smallGap = 0.01;
  const largeGap = 0.04;
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
 * Create chart shapes based on chart data
 */
function createChartShapes(chartData: ChartScene, hostGridLines: number[], spacingRem: number = 8): ShapeScene[] {
  const shapes: ShapeScene[] = [];
  let globalTestResultIndex = 0; // Global index to track all test results across all version columns
  
  // Get the test result mappings, use defaults if not provided
  const testResultMappings = chartData.testResultMappings || createDefaultTestResultMappings();
  
  // Iterate through each version column
  chartData.versionColumns.forEach((versionColumn, columnIndex) => {
    const baseX = columnIndex * spacingRem + 4;
    
    // Track how many shapes have been added for each host index in this version column
    const hostShapeCounts = new Map<number, number>();
    
    // Iterate through each test result in this version column
    versionColumn.testResults.forEach((testResult, testResultIndex) => {
      // Get the count of shapes already added for this host index in this version column
      const shapeCount = hostShapeCounts.get(testResult.hostIndex) || 0;
      
      // Calculate x offset based on the number of shapes already added for this host
      const xOffset = shapeCount * 0.5;
      const x = baseX + xOffset;
      
      // Get the y position from the corresponding host grid line
      const y = (1 - hostGridLines[testResult.hostIndex]) * 60;
      
      // Get the mapping for this test result value
      const mapping = testResultMappings.get(testResult.result);
      if (!mapping) {
        console.warn(`No mapping found for test result value: ${testResult.result}`);
        return; // Skip this test result if no mapping is found
      }
      
      // Store the global test result index in the test result object
      testResult.globalTestResultIndex = globalTestResultIndex;
      
      shapes.push({
        x: x,
        y: y,
        radius: 0.8,//0.48 + (testResult.result / 5) * 0.32, // Radius based on test result value
        color: mapping.color,
        shapeType: mapping.shapeType
      });
      
      // Increment the count for this host index
      hostShapeCounts.set(testResult.hostIndex, shapeCount + 1);
      
      // Increment the global test result index
      globalTestResultIndex++;
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
    scrollRangeRem: scrollRangeRem,
    chartScene: chartData // Include the original chart data
  };
}

/**
 * Process a ChartScene into a Scene for rendering
 */
export function processChartScene(chartData: ChartScene, spacingRem: number = 8, scrollRangeRem: number = 200): Scene {
  const monthLabels = createMonthLabels();
  const hostGridLines = createHostGridLines(chartData.hostRows);
  const gridLineLabels = createGridLineLabels(chartData.hostRows);
  scrollRangeRem = spacingRem * chartData.versionColumns.length;
  
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
    scrollRangeRem: scrollRangeRem,
    chartScene: chartData // Include the original chart data
  };
} 