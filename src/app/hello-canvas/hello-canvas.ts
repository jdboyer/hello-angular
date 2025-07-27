import { AfterViewInit, Component, ViewChild, ElementRef, HostListener, OnDestroy, input, effect, computed, output, EventEmitter } from '@angular/core';
import { RectanglePipeline } from '../pipelines/rectangle-pipeline';
import { RoundedRectanglePipeline } from '../pipelines/rounded-rectangle-pipeline';
import { TexturedRectanglePipeline } from '../pipelines/textured-rectangle-pipeline';
import { CirclePipeline } from '../pipelines/circle-pipeline';
import { MultiShapePipeline } from '../pipelines/multi-circle-pipeline';
import { GridPipeline } from '../pipelines/grid-pipeline';
import { OverlayComponent } from './overlay.component';
import { signal } from '@angular/core';
import { HostRow, ChartScene } from '../chart-helper';
import { ShapeScene } from '../pipelines/multi-circle-pipeline';

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
  
  // Input signal for the scene
  scene = input.required<Scene>();
  
  //private context!: CanvasRenderingContext2D; // Stores the 2D rendering context
  private myPath: Path2D = new Path2D(); 

  private adapter!: GPUAdapter | null;
  public device!: GPUDevice;
  private context!: GPUCanvasContext;
  private presentationFormat!: GPUTextureFormat;


  private rectanglePipeline!: RectanglePipeline;
  private roundedRectanglePipeline!: RoundedRectanglePipeline;
  private texturedRectanglePipeline!: TexturedRectanglePipeline;
  private circlePipeline!: CirclePipeline;
  public multiShapePipeline!: MultiShapePipeline;
  private gridPipeline!: GridPipeline;

  scrollRange = signal(100); // Range for scrollbar (0-1 in overlay component)
  scrollPosition = signal(0);
  canvasWidth = signal(500);
  textList = signal<string[]>([]); // Will be populated from scene xAxisLabels
  gridLineLabelsList = signal<string[]>([]); // Will be populated from scene gridLineLabels
  bottomLabelsList = signal<{ text: string; xOffset: number }[]>([]); // Will be populated from scene bottomLabels
  offsetX = signal(0);
  overlayXOffset = signal(0); // X offset in rem units to shift all overlay text
  
  // Computed signal for scroll range from scene
  scrollRangeRem = computed(() => this.scene().scrollRangeRem);
  
  // Output for mouse position changes
  mousePositionChange = output<MousePosition>();
  
  // Computed signal for text spacing from scene
  textSpacing = computed(() => this.scene().spacing);
  
  // Computed signal for scroll range based on rem value
  computedScrollRange = computed(() => {
    const scrollRangeRem = this.scrollRangeRem();
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
        const success = this.highlightShapeByHostAndVersion(hostname, mousePos.version, mousePos.x);
        if (!success) {
          // If no shape found, clear the highlight
          this.highlightShape(-1);
        }
      }
    } else {
      // If no valid position, clear the highlight
      this.highlightShape(-1);
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
   * Find the instance index of a shape given a host and version
   * @param hostname The hostname to search for
   * @param version The version to search for
   * @param xPosition Optional X position to disambiguate between multiple shapes
   * @returns The instance index of the shape, or -1 if not found
   */
  public findShapeInstanceIndex(hostname: string, version: string, xPosition?: number): number {
    const scene = this.scene();
    
    // Find the host index from gridLineLabels
    const hostIndex = scene.gridLineLabels.findIndex(label => {
      // Extract hostname from label format: "hostname (platform - subplatform)" or "hostname (platform)"
      const match = label.match(/^([^(]+)/);
      return match && match[1].trim() === hostname;
    });
    
    if (hostIndex === -1) {
      return -1;
    }
    
    // Find the version index from xAxisLabels
    const versionIndex = scene.xAxisLabels.findIndex(v => v === version);
    if (versionIndex === -1) {
      return -1;
    }
    
    // Calculate the expected Y position for this host
    const expectedY = (1 - scene.gridLines[hostIndex]) * 60;
    
    // Calculate the base X position for this version
    const baseX = versionIndex * scene.spacing + 4;
    
    console.log(`Looking for host: ${hostname}, version: ${version}`);
    console.log(`Host index: ${hostIndex}, Version index: ${versionIndex}`);
    console.log(`Expected Y: ${expectedY}, Base X: ${baseX}`);
    console.log(`Mouse X position: ${xPosition}`);
    
    // Find all shapes that match both the host (Y position) and version (base X position)
    const shapes = scene.circles;
    const matchingShapes: { index: number; xOffset: number; shapeX: number }[] = [];
    
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      
      // Check if this shape is in the correct version column (base X position)
      const shapeBaseX = Math.floor((shape.x - 4) / scene.spacing) * scene.spacing + 4;
      if (Math.abs(shapeBaseX - baseX) > 0.1) {
        continue;
      }
      
      // Check if this shape is for the correct host (Y position)
      // Allow for small floating point differences
      if (Math.abs(shape.y - expectedY) < 0.1) {
        // Calculate the x offset from base position
        const xOffset = shape.x - baseX;
        matchingShapes.push({ index: i, xOffset, shapeX: shape.x });
        console.log(`Found matching shape ${i}: x=${shape.x}, xOffset=${xOffset}`);
      }
    }
    
    console.log(`Found ${matchingShapes.length} matching shapes`);
    
    if (matchingShapes.length === 0) {
      return -1;
    }
    
    // If no X position provided or only one shape, return the first match
    if (!xPosition || matchingShapes.length === 1) {
      console.log(`Returning first match: ${matchingShapes[0].index}`);
      return matchingShapes[0].index;
    }
    
    // If X position is provided, find the closest shape based on X offset
    const mouseXOffset = xPosition - baseX + 4;
    console.log(`Mouse X offset from base: ${mouseXOffset}`);
    
    let closestIndex = matchingShapes[0].index;
    let minDistance = Math.abs(matchingShapes[0].xOffset - mouseXOffset);
    
    for (let i = 1; i < matchingShapes.length; i++) {
      const distance = Math.abs(matchingShapes[i].xOffset - mouseXOffset);
      console.log(`Shape ${matchingShapes[i].index}: xOffset=${matchingShapes[i].xOffset}, distance=${distance}`);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = matchingShapes[i].index;
      }
    }
    
    console.log(`Selected shape ${closestIndex} with distance ${minDistance}`);
    return closestIndex;
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

    // Set canvas dimensions to fill its parent container
    if (!navigator.gpu) {
      console.error("WebGPU not supported on this browser.");
      // Handle fallback (e.g., use WebGL or display a message)
    }
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    const parent = canvasEl.parentElement;
    canvasEl.height = parent!.offsetHeight;
    canvasEl.width = parent!.offsetWidth;
    canvasEl.style.width = canvasEl.width.toString() + "px"
    canvasEl.style.height = canvasEl.height.toString() + "px"
    this.canvasWidth.set(canvasEl.width);

    // 1. Request WebGPU Adapter and Device
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

    // 2. Configure Canvas Context for WebGPU
    this.context = canvasEl.getContext('webgpu') as GPUCanvasContext;
    if (!this.context) {
      console.error('Failed to get WebGPU context from canvas.');
      return;
    }

    // Get the preferred format for the canvas texture
    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: 'premultiplied', // Or 'opaque'
    });


    //this.setupTextureRectagnles();
    //this.setupRoundedRectangles();

    // Example: Create 3 instance matrices (identity, translate right, translate up)
    const instanceMatrices = new Float32Array([
      // Identity
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
      // Translate right
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0.5, 0, 0, 1,
      // Translate up
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0.5, 0, 1,
    ]);

    // Add grid lines from the scene
    const currentScene = this.scene();
    this.gridPipeline = new GridPipeline(this.device, this.presentationFormat, currentScene.gridLines);
    this.rectanglePipeline = new RectanglePipeline(this.device, this.presentationFormat, instanceMatrices)
    this.roundedRectanglePipeline = new RoundedRectanglePipeline(this.device, this.presentationFormat)
    this.texturedRectanglePipeline = new TexturedRectanglePipeline(this.device, this.presentationFormat)
    this.circlePipeline = new CirclePipeline(this.device, this.presentationFormat)
    this.multiShapePipeline = new MultiShapePipeline(this.device, this.presentationFormat)
    
    // Set the shapes from the scene
    console.log(`Setting ${currentScene.circles.length} shapes from scene. First: (${currentScene.circles[0].x}, ${currentScene.circles[0].y}), Last: (${currentScene.circles[currentScene.circles.length-1].x}, ${currentScene.circles[currentScene.circles.length-1].y})`);
    this.multiShapePipeline.setShapes(currentScene.circles)
    
    // Set the labels from the scene
    this.textList.set(currentScene.xAxisLabels);
    console.log(`Setting ${currentScene.xAxisLabels.length} labels from scene: ${currentScene.xAxisLabels.slice(0, 5).join(', ')}...`);
    
    //this.setupCircles();
    // textured squares for symbols
    // circles 
    // rectangles for grid lines
    // rounded rectangles


    // 7. Draw the Scene (now draws both triangles and square)
    this.drawScene(); // Draw 5 instances of triangles

  }

  // Lifecycle hook: Called once, before the component is destroyed
  ngOnDestroy(): void {

    // The device itself doesn't have a 'destroy' method, it's managed by the browser.
    this.rectanglePipeline.destroy()
    this.roundedRectanglePipeline.destroy()
    this.texturedRectanglePipeline.destroy()
    this.circlePipeline.destroy()
    this.multiShapePipeline.destroy()
    this.gridPipeline.destroy();
  }
  private drawScene(): void {
    //if (!this.device || !this.context || !this.trianglePipeline || !this.triangleVertexBuffer || !this.triangleColorBuffer ||
    //    !this.squarePipeline || !this.squareVertexBuffer || !this.squareColorBuffer) {
    //  console.error('WebGPU not fully initialized for all objects.');
    //  return;
    //}

    // Create a command encoder
    const commandEncoder = this.device.createCommandEncoder();

    // Start a render pass
    const textureView = this.context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }, // Clear color (dark grey)
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    // Draw grid lines first (so they appear behind other shapes)
    this.gridPipeline.draw(passEncoder);
    // --- Draw Triangles ---
    //passEncoder.setPipeline(this.trianglePipeline);
    //passEncoder.setVertexBuffer(0, this.triangleVertexBuffer);
    //passEncoder.setVertexBuffer(1, this.triangleColorBuffer);
    //passEncoder.draw(3, triangleInstanceCount); // Draw 3 vertices, 'triangleInstanceCount' times

    // --- Draw Square ---
    //passEncoder.setPipeline(this.squarePipeline); // Switch to the square's pipeline
    //passEncoder.setVertexBuffer(0, this.squareVertexBuffer); // Set square's position buffer
    //passEncoder.setVertexBuffer(1, this.squareColorBuffer);  // Set square's color buffer
    //passEncoder.draw(6); // A square is 6 vertices (2 triangles)
    //this.rectanglePipeline.updateAspectRatio(this.device, this.canvas.nativeElement.width / this.canvas.nativeElement.height);
    //this.rectanglePipeline.draw(passEncoder);
    //this.roundedRectanglePipeline.updateAspectRatio(this.device, this.canvas.nativeElement.width / this.canvas.nativeElement.height);
    //this.roundedRectanglePipeline.draw(passEncoder);
    //this.texturedRectanglePipeline.draw(passEncoder);
    //this.circlePipeline.updateAspectRatio(this.device, this.canvas.nativeElement.width / this.canvas.nativeElement.height);
    //this.circlePipeline.draw(passEncoder);
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


//  private setupTriangles(): void {
        //// --- Setup for Triangles ---
    //// 3. Define Triangle Vertices and Colors
    //const trianglePositions = new Float32Array([
      //0.0,  0.8, 0.0, 1.0,  // Top vertex (x, y, z, w)
      //-0.8, -0.8, 0.0, 1.0,  // Bottom-left vertex
      //0.8, -0.8, 0.0, 1.0,   // Bottom-right vertex
    //]);

    //const triangleColors = new Float32Array([
      //1.0, 0.0, 0.0, 0.6, // Red with 60% opacity
      //0.0, 1.0, 0.0, 0.6, // Green with 60% opacity
      //0.0, 0.0, 1.0, 0.6, // Blue with 60% opacity
    //]);

    //// 4. Create GPU Buffers for Triangle Vertex Data
    //this.triangleVertexBuffer = this.device.createBuffer({
      //size: trianglePositions.byteLength,
      //usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      //mappedAtCreation: true,
    //});
    //new Float32Array(this.triangleVertexBuffer.getMappedRange()).set(trianglePositions);
    //this.triangleVertexBuffer.unmap();

    //this.triangleColorBuffer = this.device.createBuffer({
      //size: triangleColors.byteLength,
      //usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      //mappedAtCreation: true,
    //});
    //new Float32Array(this.triangleColorBuffer.getMappedRange()).set(triangleColors);
    //this.triangleColorBuffer.unmap();

    //// 5. Create Shader Modules for Triangles
    //const triangleVertexShaderModule = this.device.createShaderModule({
      //code: `
        //struct VertexOutput {
            //@builtin(position) position: vec4<f32>,
            //@location(1) color: vec4<f32>,
        //};

        //@vertex
        //fn main(
          //@location(0) position: vec4<f32>,
          //@location(1) color: vec4<f32>,
          //@builtin(instance_index) instance_idx: u32
        //) -> VertexOutput {
            //var output: VertexOutput;
            //let offset_x = f32(instance_idx) * 0.2;
            //output.position = position + vec4<f32>(offset_x, 0.0, 0.0, 0.0);
            //output.color = color;
            //return output;
        //}
      //`,
    //});

    //const triangleFragmentShaderModule = this.device.createShaderModule({
      //code: `
        //struct FragmentInput {
            //@location(1) color: vec4<f32>,
        //};

        //@fragment
        //fn main(
          //input: FragmentInput
        //) -> @location(0) vec4<f32> {
          //return input.color;
        //}
      //`,
    //});

    //// 6. Create Render Pipeline for Triangles
    //this.trianglePipeline = this.device.createRenderPipeline({
      //layout: 'auto',
      //vertex: {
        //module: triangleVertexShaderModule,
        //entryPoint: 'main',
        //buffers: [
          //{ // Buffer for positions
            //arrayStride: 4 * 4,
            //attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }],
          //},
          //{ // Buffer for colors
            //arrayStride: 4 * 4,
            //attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }],
          //},
        //],
      //},
      //primitive: {
        //topology: 'triangle-list',
      //},
      //fragment: {
        //module: triangleFragmentShaderModule,
        //entryPoint: 'main',
        //targets: [
          //{
            //format: this.presentationFormat,
            //blend: {
              //color: {
                //srcFactor: 'src-alpha',
                //dstFactor: 'one-minus-src-alpha',
                //operation: 'add',
              //},
              //alpha: {
                //srcFactor: 'one',
                //dstFactor: 'one-minus-src-alpha',
                //operation: 'add',
              //},
            //},
          //},
        //],
      //},
    //});
  //}

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
    this.drawScene(); // Call the method to draw the triangle
  }
}
