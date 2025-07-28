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
  const availableSpace = 0.78 - totalGaps;
  const hostSpacing = availableSpace / hostRows.length;
  
  // Calculate grid line positions
  let currentY = 0.13; // Start at 0.1
  
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
  
  return gridLines;
}

/**
 * Create month labels based on version column timestamps
 */
function createMonthLabels(chartData: ChartScene, spacingRem: number, overlayXOffset: number): { text: string; xOffset: number }[] {
  const labels: { text: string; xOffset: number }[] = [];
  const seenMonths = new Set<string>();
  
  // Iterate through version columns
  chartData.versionColumns.forEach((versionColumn, columnIndex) => {
    const timestamp = versionColumn.timestamp;
    const monthKey = `${timestamp.getFullYear()}-${timestamp.getMonth()}`;
    
    // If this is the first time we've seen this month, add a label
    if (!seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      
      // Format the month label (e.g., "Jan 2024", "Feb 2024", etc.)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[timestamp.getMonth()];
      const year = timestamp.getFullYear().toString(); // Get full year
      const monthLabel = `${monthName} ${year}`;
      
      // Calculate x offset based on column index
      const xOffset = spacingRem * columnIndex;
      
      labels.push({
        text: monthLabel,
        xOffset: xOffset
      });
    }
  });
  
  return labels;
}



/**
 * Create chart shapes based on chart data
 */
function createChartShapes(chartData: ChartScene, hostGridLines: number[], spacingRem: number = 8, overlayXOffset: number = 4, canvasHeightRem: number = 60): ShapeScene[] {
  const shapes: ShapeScene[] = [];
  let globalTestResultIndex = 0; // Global index to track all test results across all version columns
  
  // Get the test result mappings, use defaults if not provided
  const testResultMappings = chartData.testResultMappings || createDefaultTestResultMappings();
  
  // Iterate through each version column
  chartData.versionColumns.forEach((versionColumn, columnIndex) => {
    const baseX = columnIndex * spacingRem + overlayXOffset;
    
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
      const y = (1 - hostGridLines[testResult.hostIndex]) * canvasHeightRem;
      
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
export function createChartScene(spacingRem: number = 8, scrollRangeRem: number = 200, canvasHeightRem: number = 60): Scene {
  const chartData = createSampleChartScene();
  const hostGridLines = createHostGridLines(chartData.hostRows);
  const gridLineLabels = createGridLineLabels(chartData.hostRows);
  const overlayXOffset = 4;
  const monthLabels = createMonthLabels(chartData, spacingRem, overlayXOffset);
  
  // Extract version strings from chartData.versionColumns
  const xAxisLabels = chartData.versionColumns.map(column => column.version);
  
  return {
    gridLines: hostGridLines,
    circles: createChartShapes(chartData, hostGridLines, spacingRem, overlayXOffset, canvasHeightRem),
    xAxisLabels: xAxisLabels,
    gridLineLabels: gridLineLabels,
    bottomLabels: monthLabels,
    spacing: spacingRem,
    overlayXOffset: overlayXOffset,
    scrollRangeRem: scrollRangeRem,
    chartScene: chartData, // Include the original chart data
    backgroundColor: chartData.backgroundColor || [0.1, 0.1, 0.1, 1.0] // Use provided background color or default to dark gray
  };
}

/**
 * Process a ChartScene into a Scene for rendering
 */
export function processChartScene(chartData: ChartScene, spacingRem: number = 4, scrollRangeRem: number = 200, canvasHeightRem: number = 60): Scene {
  // First, determine which hosts have test results by analyzing all version columns
  const hostsWithTestResults = new Set<number>();
  
  // Iterate through all version columns to find hosts that have at least one test result
  chartData.versionColumns.forEach(versionColumn => {
    versionColumn.testResults.forEach(testResult => {
      hostsWithTestResults.add(testResult.hostIndex);
    });
  });
  
  // Create filtered host rows and index mapping
  const filteredHostRows: HostRow[] = [];
  const oldToNewIndexMap = new Map<number, number>();
  let newIndex = 0;
  
  chartData.hostRows.forEach((hostRow, oldIndex) => {
    if (hostsWithTestResults.has(oldIndex)) {
      filteredHostRows.push(hostRow);
      oldToNewIndexMap.set(oldIndex, newIndex);
      newIndex++;
    }
  });
  
  // Create a new ChartScene with filtered host rows
  const filteredChartData: ChartScene = {
    ...chartData,
    hostRows: filteredHostRows
  };
  
  // Update test result host indices in all version columns
  const updatedVersionColumns = chartData.versionColumns.map(versionColumn => ({
    ...versionColumn,
    testResults: versionColumn.testResults.map(testResult => ({
      ...testResult,
      hostIndex: oldToNewIndexMap.get(testResult.hostIndex)!
    }))
  }));
  
  filteredChartData.versionColumns = updatedVersionColumns;
  
  // Create grid lines and labels for filtered hosts
  const hostGridLines = createHostGridLines(filteredHostRows);
  const gridLineLabels = createGridLineLabels(filteredHostRows);
  scrollRangeRem = spacingRem * chartData.versionColumns.length + 20;
  const overlayXOffset = 1;
  const monthLabels = createMonthLabels(chartData, spacingRem, overlayXOffset);
  
  // Extract version strings from chartData.versionColumns
  const xAxisLabels = chartData.versionColumns.map(column => column.version);
  
  return {
    gridLines: hostGridLines,
    circles: createChartShapes(filteredChartData, hostGridLines, spacingRem, overlayXOffset, canvasHeightRem),
    xAxisLabels: xAxisLabels,
    gridLineLabels: gridLineLabels,
    bottomLabels: monthLabels,
    spacing: spacingRem,
    overlayXOffset: overlayXOffset,
    scrollRangeRem: scrollRangeRem,
    chartScene: chartData, // Keep original chart data for reference
    backgroundColor: chartData.backgroundColor || [0.1, 0.1, 0.1, 1.0] // Use provided background color or default to dark gray
  };
} 