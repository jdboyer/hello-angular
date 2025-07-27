import { AfterViewInit, Component, ViewChild, ElementRef, HostListener, OnDestroy, input, effect, computed, output, EventEmitter } from '@angular/core';
import { MultiShapePipeline } from '../pipelines/multi-circle-pipeline';
import { GridPipeline } from '../pipelines/grid-pipeline';
import { OverlayComponent } from './overlay.component';
import { signal } from '@angular/core';
import { ShapeScene } from '../pipelines/multi-circle-pipeline';
import { processChartScene } from './chart-scene';

export interface HostRow {
  platform: string;
  subplatform: string;
  hostname: string;
}

export interface TestResult {
  result: number;
  hostIndex: number;
  globalTestResultIndex?: number;
}

export interface VersionColumn {
  version: string;
  testResults: TestResult[];
}

export interface TestResultMapping {
  shapeType: number; // 0 = Circle, 1 = Square, 2 = Diamond, 3 = Triangle
  color: [number, number, number, number]; // RGBA values
}

export interface ChartScene {
  hostRows: HostRow[];
  versionColumns: VersionColumn[];
  testResultMappings?: Map<number, TestResultMapping>; // Optional mapping, defaults will be used if not provided
}

export interface CircleScene {
  x: number;        // X position in rem units
  y: number;        // Y position in rem units  
  radius: number;   // Radius in rem units
  color: [number, number, number, number]; // RGBA values
}

export interface MousePosition {
  x: number;
  y: number;
  nearestYAxisLabel: string;
  version: string;
}

export interface Scene {
  gridLines: number[];
  circles: ShapeScene[]; // Array of shapes to render (using circles property name for backward compatibility)
  xAxisLabels: string[]; // Array of strings to use as X-axis labels
  gridLineLabels: string[]; // Array of strings to use as Y-axis labels for grid lines
  bottomLabels: { text: string; xOffset: number }[]; // Array of bottom labels with x offsets in rem
  spacing: number; // Spacing in rem units for both overlay text and shape columns
  overlayXOffset: number; // X offset in rem units to shift all overlay text
  scrollRangeRem: number; // Total scrollable width in rem units
  chartScene?: ChartScene; // Original chart data for future reference
}

@Component({
  selector: 'app-hello-canvas',
  imports: [OverlayComponent],
  templateUrl: './hello-canvas.html',
  styleUrl: './hello-canvas.css'
})
export class HelloCanvas implements AfterViewInit, OnDestroy {
  @ViewChild('drawingCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  
  // Input signal for the chart scene
  chartScene = input.required<ChartScene>();
  
  // Default spacing and scroll range
  //spacing = signal(8);
  //scrollRangeRem = signal(200);
  
  // Computed signal to process ChartScene into Scene
  //scene = computed(() => processChartScene(this.chartScene(), this.spacing(), this.scrollRangeRem()));
  scene = computed(() => processChartScene(this.chartScene()));

  private adapter!: GPUAdapter | null;
  public device!: GPUDevice;
  private context!: GPUCanvasContext;
  private presentationFormat!: GPUTextureFormat;

  public multiShapePipeline!: MultiShapePipeline;
  private gridPipeline!: GridPipeline;

  scrollRange = signal(100);
  scrollPosition = signal(1);
  canvasWidth = signal(500);
  textList = signal<string[]>([]);
  gridLineLabelsList = signal<string[]>([]);
  bottomLabelsList = signal<{ text: string; xOffset: number }[]>([]);
  offsetX = signal(0);
  overlayXOffset = signal(0);
  
  mousePositionChange = output<MousePosition>();
  selectedTestResult = signal<TestResult | null>(null);
  textSpacing = computed(() => this.scene().spacing);
  
  // Computed signal for scroll range based on rem value
  computedScrollRange = computed(() => {
    const scrollRangeRem = this.scene().scrollRangeRem;
    const canvasWidthPixels = this.canvasWidth();
    const pxToRemRatio = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const canvasWidthRem = canvasWidthPixels / pxToRemRatio;
    
    // The scroll range is simply the specified rem value
    // No need to convert to number of items - it's just the total scrollable width in rem
    return scrollRangeRem;
  });

  // Effect to watch for scene changes
  private sceneEffect = effect(() => {
    const currentScene = this.scene();
    
    // Always update labels and bottom labels, even if pipelines aren't ready
    this.textList.set(currentScene.xAxisLabels);
    this.gridLineLabelsList.set(currentScene.gridLineLabels);
    console.log('Setting bottom labels:', currentScene.bottomLabels);
    this.bottomLabelsList.set(currentScene.bottomLabels);
    this.overlayXOffset.set(currentScene.overlayXOffset);
    
    if (this.multiShapePipeline && this.gridPipeline) {
      // Update grid lines
      this.gridPipeline = new GridPipeline(this.device, this.presentationFormat, currentScene.gridLines);
      
      // Update shapes
      console.log(`Scene updated: ${currentScene.circles.length} shapes`);
      this.multiShapePipeline.setShapes(currentScene.circles);
      
      // Redraw the scene
      this.drawScene();
    }
  });

  /**
   * Calculate the maximum number of visible items based on canvas width and text spacing
   */
  private getMaxVisibleItems(): number {
    const canvasWidth = this.canvasWidth();
    const spacingInPixels = this.convertRemToPixels(this.textSpacing());
    return Math.max(1, Math.floor(canvasWidth / spacingInPixels));
  }

  /**
   * Calculate the continuous number of visible items (for smooth calculations)
   */
  private getContinuousVisibleItems(): number {
    const canvasWidth = this.canvasWidth();
    const spacingInPixels = this.convertRemToPixels(this.textSpacing());
    return canvasWidth / spacingInPixels;
  }

  /**
   * Convert rem to pixels
   */
  private convertRemToPixels(rem: number): number {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  /**
   * Adjust scroll position when canvas is resized to maintain the same visual offset
   */
  private adjustScrollPositionForResize(oldCanvasWidth: number): void {
    const newCanvasWidth = this.canvas.nativeElement.width;
    const scrollRange = this.computedScrollRange();
    const pxToRemRatio = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const oldCanvasWidthRem = oldCanvasWidth / pxToRemRatio;
    const newCanvasWidthRem = newCanvasWidth / pxToRemRatio;
    
    // If scroll range is smaller than or equal to both old and new canvas widths, no adjustment needed
    if (scrollRange <= oldCanvasWidthRem && scrollRange <= newCanvasWidthRem) {
      return;
    }
    
    // If scroll range is smaller than or equal to new canvas width but was larger than old, reset to 0
    if (scrollRange <= newCanvasWidthRem && scrollRange > oldCanvasWidthRem) {
      this.scrollPosition.set(0);
      return;
    }
    
    // Calculate the current visual offset in rem
    const currentScrollPosition = this.scrollPosition();
    let currentVisualOffsetRem = 0;
    
    if (scrollRange > oldCanvasWidthRem) {
      const oldTotalScrollDistanceRem = scrollRange - oldCanvasWidthRem;
      currentVisualOffsetRem = currentScrollPosition * oldTotalScrollDistanceRem;
    }
    
    // Calculate the new scroll position needed to maintain the same visual offset
    if (scrollRange > newCanvasWidthRem) {
      const newTotalScrollDistanceRem = scrollRange - newCanvasWidthRem;
      const newScrollPosition = currentVisualOffsetRem / newTotalScrollDistanceRem;
      this.scrollPosition.set(Math.max(0, Math.min(1, newScrollPosition)));
    } else {
      // If new canvas is wide enough to show everything, reset to 0
      this.scrollPosition.set(0);
    }
  }

  /**
   * Handle scroll position changes from the overlay component
   * @param newPosition New scroll position (0-1)
   */
  onScrollPositionChange(newPosition: number) {
    //console.log(`Scroll position changed to: ${newPosition}`);
    this.scrollPosition.set(newPosition);
    this.drawScene(); // Redraw with new scroll position
  }

  /**
   * Handle mouse position changes from the overlay component
   * @param position Mouse position {x, y}
   */
  onMousePositionChange(position: {x: number, y: number}) {
    // Find the nearest y-axis label based on Y position
    const nearestLabel = this.getNearestYAxisLabel(position.y);
    
    // Calculate version from X position
    const version = this.getVersionFromXPosition(position.x);
    
    // Create the mouse position object
    const mousePosition: MousePosition = {
      x: position.x,
      y: position.y,
      nearestYAxisLabel: nearestLabel,
      version: version
    };
    
    // Handle highlighting internally
    this.highlightCurrentPosition(mousePosition);
    
    // Emit the mouse position with the nearest label and version to the parent component
    this.mousePositionChange.emit(mousePosition);
  }

  /**
   * Highlight the shape at the current mouse position
   */
  private highlightCurrentPosition(mousePos: MousePosition): void {
    if (mousePos.version && mousePos.nearestYAxisLabel) {
      // Extract hostname from the label
      const match = mousePos.nearestYAxisLabel.match(/^([^(]+)/);
      if (match) {
        const hostname = match[1].trim();
        const testResult = this.findTestResult(hostname, mousePos.version, mousePos.x);
        
        if (testResult) {
          // Highlight the shape using the global test result index
          this.highlightShape(testResult.globalTestResultIndex ?? -1);
          // Set the selected test result
          this.selectedTestResult.set(testResult);
        } else {
          // If no test result found, clear the highlight and set null
          this.highlightShape(-1);
          this.selectedTestResult.set(null);
        }
      }
    } else {
      // If no valid position, clear the highlight and set null
      this.highlightShape(-1);
      this.selectedTestResult.set(null);
    }
  }

  /**
   * Get the nearest y-axis label based on Y position
   * @param yPosition Y position in rem units
   * @returns The nearest y-axis label or empty string if no labels
   */
  private getNearestYAxisLabel(yPosition: number): string {
    const gridLines = this.scene().gridLines;
    const gridLineLabels = this.scene().gridLineLabels;
    
    if (gridLines.length === 0 || gridLineLabels.length === 0) {
      return '';
    }
    
    // Convert Y position to percentage (0-100) to match grid line positioning
    // The canvas is 10rem height and centered in the 60rem container
    const containerHeightRem = 60; // From .example-container height
    const canvasHeightRem = 60; // From .my-canvas height
    const canvasTopY = 0;
    
    // Convert Y position to percentage relative to canvas
    const yPercentage = ((yPosition + canvasTopY) / canvasHeightRem) * 100;
    
    // Find the nearest grid line
    let nearestIndex = 0;
    let minDistance = Math.abs(yPercentage - (100 - gridLines[0] * 100));
    
    for (let i = 1; i < gridLines.length; i++) {
      const gridLineY = 100 - gridLines[i] * 100;
      const distance = Math.abs(yPercentage - gridLineY);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    // Return the corresponding label
    return gridLineLabels[nearestIndex] || '';
  }

  /**
   * Get the version from X position
   * @param xPosition X position in rem units
   * @returns The version string or empty string if not found
   */
  private getVersionFromXPosition(xPosition: number): string {
    const scene = this.scene();
    const xAxisLabels = scene.xAxisLabels;
    const spacing = scene.spacing;
    
    if (xAxisLabels.length === 0) {
      return '';
    }
    
    // Calculate version index from X position
    // X position formula: baseX = versionIndex * spacing + 4
    // So: versionIndex = (xPosition - 4) / spacing
    const versionIndex = Math.floor((xPosition + 4) / spacing);
    
    // Check if the version index is valid
    if (versionIndex >= 0 && versionIndex < xAxisLabels.length) {
      return xAxisLabels[versionIndex];
    }
    
    return '';
  }

  /**
   * Find the test result given a host and version
   * @param hostname The hostname to search for
   * @param version The version to search for
   * @param xPosition Optional X position to disambiguate between multiple shapes
   * @returns The test result object, or null if not found
   */
  public findTestResult(hostname: string, version: string, xPosition?: number): TestResult | null {
    const scene = this.scene();
    const chartScene = scene.chartScene;
    
    if (!chartScene) {
      console.error('Chart scene data not available');
      return null;
    }
    
    // Find the host index from gridLineLabels
    const hostIndex = scene.gridLineLabels.findIndex(label => {
      // Extract hostname from label format: "hostname (platform - subplatform)" or "hostname (platform)"
      const match = label.match(/^([^(]+)/);
      return match && match[1].trim() === hostname;
    });
    
    if (hostIndex === -1) {
      return null;
    }
    
    // Find the version index from xAxisLabels
    const versionIndex = scene.xAxisLabels.findIndex(v => v === version);
    if (versionIndex === -1) {
      return null;
    }
    
    // Get the version column for this version
    const versionColumn = chartScene.versionColumns[versionIndex];
    if (!versionColumn) {
      return null;
    }
    
    // Find all test results for this host in this version column
    const testResultsForHost = versionColumn.testResults.filter(testResult => testResult.hostIndex === hostIndex);
    
    if (testResultsForHost.length === 0) {
      return null;
    }
    
    // If only one test result, return it
    if (testResultsForHost.length === 1) {
      return testResultsForHost[0];
    }
    
    // If multiple test results and X position is provided, find the closest one
    if (xPosition !== undefined) {
      // Calculate the base X position for this version
      const baseX = versionIndex * scene.spacing + 4;
      const mouseXOffset = xPosition - baseX + 4;
      
      let closestTestResult = testResultsForHost[0];
      let minDistance = Math.abs(0 - mouseXOffset); // First shape has offset 0
      
      for (let i = 1; i < testResultsForHost.length; i++) {
        const shapeOffset = i * 0.5; // Each additional shape is offset by 0.5
        const distance = Math.abs(shapeOffset - mouseXOffset);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestTestResult = testResultsForHost[i];
        }
      }
      
      return closestTestResult;
    }
    
    // If no X position provided or no closest match found, return the first test result
    return testResultsForHost[0];
  }

  /**
   * Find the instance index of a shape given a host and version
   * @param hostname The hostname to search for
   * @param version The version to search for
   * @param xPosition Optional X position to disambiguate between multiple shapes
   * @returns The instance index of the shape, or -1 if not found
   */
  public findShapeInstanceIndex(hostname: string, version: string, xPosition?: number): number {
    const testResult = this.findTestResult(hostname, version, xPosition);
    return testResult?.globalTestResultIndex ?? -1;
  }

  /**
   * Highlight a shape by host and version
   * @param hostname The hostname to search for
   * @param version The version to search for
   * @param xPosition Optional X position to disambiguate between multiple shapes
   * @returns true if the shape was found and highlighted, false otherwise
   */
  public highlightShapeByHostAndVersion(hostname: string, version: string, xPosition?: number): boolean {
    const instanceIndex = this.findShapeInstanceIndex(hostname, version, xPosition);
    if (instanceIndex !== -1) {
      this.highlightShape(instanceIndex);
      return true;
    }
    return false;
  }

  /**
   * Get the Y position for a y-axis label based on the grid line positions
   */
  getYAxisLabelPosition(index: number): number {
    const gridLines = this.scene().gridLines;
    const gridLineLabels = this.scene().gridLineLabels;
    if (index >= 0 && index < gridLines.length && index < gridLineLabels.length) {
      // Convert from 0-1 range to percentage (0-100)
      return 100 - gridLines[index] * 100;
    }
    return 0;
  }

  /**
   * Update the scene with new circle data
   * @param circles New array of circles to render
   */
  updateScene(shapes: ShapeScene[]) {
    this.multiShapePipeline.setShapes(shapes);
    this.drawScene(); // Redraw with new scene
  }

  /**
   * Highlight a specific shape by index
   * @param highlightIndex Index of shape to highlight (-1 for no highlight)
   */
  highlightShape(highlightIndex: number): void {
    //highlightIndex = 0;
    if (this.multiShapePipeline && this.device) {
      this.multiShapePipeline.setHighlightIndex(this.device, highlightIndex);
      this.drawScene(); // Redraw to show the highlight
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    const oldCanvasWidth = this.canvasWidth();
    this.resizeCanvasWithoutDraw();
    this.adjustScrollPositionForResize(oldCanvasWidth);
    this.drawScene(); // Draw after scroll position is adjusted
  }

    // Lifecycle hook: Called after Angular has initialized all view components
  async ngAfterViewInit(): Promise<void> {
    if (!navigator.gpu) {
      console.error("WebGPU not supported on this browser.");
      return;
    }

    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    const parent = canvasEl.parentElement;
    canvasEl.height = parent!.offsetHeight;
    canvasEl.width = parent!.offsetWidth;
    canvasEl.style.width = canvasEl.width.toString() + "px"
    canvasEl.style.height = canvasEl.height.toString() + "px"
    this.canvasWidth.set(canvasEl.width);

    try {
      this.adapter = await navigator.gpu.requestAdapter();
      if (!this.adapter) {
        console.error('No WebGPU adapter found. Make sure your browser supports WebGPU.');
        return;
      }
      this.device = await this.adapter.requestDevice();
    } catch (error) {
      console.error('Failed to get WebGPU adapter or device:', error);
      return;
    }

    this.context = canvasEl.getContext('webgpu') as GPUCanvasContext;
    if (!this.context) {
      console.error('Failed to get WebGPU context from canvas.');
      return;
    }

    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: 'premultiplied',
    });

    const currentScene = this.scene();
    this.gridPipeline = new GridPipeline(this.device, this.presentationFormat, currentScene.gridLines);
    this.multiShapePipeline = new MultiShapePipeline(this.device, this.presentationFormat)
    
    this.multiShapePipeline.setShapes(currentScene.circles)
    this.textList.set(currentScene.xAxisLabels);
    
    this.drawScene();
  }

  ngOnDestroy(): void {
    this.multiShapePipeline.destroy()
    this.gridPipeline.destroy();
  }
  private drawScene(): void {
    const commandEncoder = this.device.createCommandEncoder();

    const textureView = this.context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    this.gridPipeline.draw(passEncoder);
    const canvasWidthPixels = this.canvas.nativeElement.width;
    const canvasHeightPixels = this.canvas.nativeElement.height;
    this.multiShapePipeline.updateCanvasDimensions(this.device, canvasWidthPixels, canvasHeightPixels);
    
    // Calculate scroll offset in pixels to match text movement
    const canvasWidth = this.canvas.nativeElement.width;
    const scrollRange = this.computedScrollRange();
    const pxToRemRatio = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const canvasWidthRem = canvasWidth / pxToRemRatio;
    
    // If scroll range is smaller than or equal to canvas width, no scroll offset needed
    if (scrollRange <= canvasWidthRem) {
      this.multiShapePipeline.updateScrollOffset(this.device, 0);
    } else {
      // Calculate scroll distance based on canvas width vs scroll range
      const totalScrollDistanceRem = scrollRange - canvasWidthRem;
      const totalScrollDistancePixels = totalScrollDistanceRem * pxToRemRatio;
      const scrollOffsetInPixels = -this.scrollPosition() * totalScrollDistancePixels;
      this.multiShapePipeline.updateScrollOffset(this.device, scrollOffsetInPixels);
    }
    
    this.multiShapePipeline.draw(passEncoder);

    // End the render pass
    passEncoder.end();

    // Submit the command buffer to the GPU queue
    this.device.queue.submit([commandEncoder.finish()]);
  }

  private resizeCanvasWithoutDraw(): void {
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    const parent = canvasEl.parentElement;

    if (parent && this.context) {
      // Update canvas dimensions without drawing
      canvasEl.width = parent.offsetWidth;
      canvasEl.height = parent.offsetHeight;
      canvasEl.style.width = canvasEl.width.toString() + "px"
      canvasEl.style.height = canvasEl.height.toString() + "px"
      this.canvasWidth.set(canvasEl.width);
    }
  }

  private resizeCanvas(): void {
    this.resizeCanvasWithoutDraw();
    this.drawScene();
  }
}
