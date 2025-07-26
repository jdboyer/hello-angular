import { AfterViewInit, Component, ViewChild, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { RectanglePipeline } from '../pipelines/rectangle-pipeline';
import { RoundedRectanglePipeline } from '../pipelines/rounded-rectangle-pipeline';
import { TexturedRectanglePipeline } from '../pipelines/textured-rectangle-pipeline';
import { CirclePipeline } from '../pipelines/circle-pipeline';
import { MultiCirclePipeline } from '../pipelines/multi-circle-pipeline';
import { GridPipeline } from '../pipelines/grid-pipeline';
import { OverlayComponent } from './overlay.component';
import { signal } from '@angular/core';

export interface CircleScene {
  x: number;        // X position (normalized -1 to 1)
  y: number;        // Y position (normalized -1 to 1)
  radius: number;   // Radius (normalized)
  color: [number, number, number, number]; // RGBA values
}

export interface Scene {
  topLabels: string[];
  topLabelsOffset: number[];
  bottomLabels: string[];
  bottomLabelsOffset: number[];
  gridLines: number[];
  gridLinesColor: string;
  gridLinesWidth: number;
  gridLinesOpacity: number;
  circles: CircleScene[]; // Array of circles to render
}

@Component({
  selector: 'app-hello-canvas',
  imports: [OverlayComponent],
  templateUrl: './hello-canvas.html',
  styleUrl: './hello-canvas.css'
})
export class HelloCanvas implements AfterViewInit, OnDestroy {
  @ViewChild('drawingCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  //private context!: CanvasRenderingContext2D; // Stores the 2D rendering context
  private myPath: Path2D = new Path2D(); 

  private adapter!: GPUAdapter | null;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private presentationFormat!: GPUTextureFormat;


  private rectanglePipeline!: RectanglePipeline;
  private roundedRectanglePipeline!: RoundedRectanglePipeline;
  private texturedRectanglePipeline!: TexturedRectanglePipeline;
  private circlePipeline!: CirclePipeline;
  private multiCirclePipeline!: MultiCirclePipeline;
  private gridPipeline!: GridPipeline;

  scrollRange = signal(100); // Range for scrollbar (0-1 in overlay component)
  scrollPosition = signal(0);
  canvasWidth = signal(500);
  textSpacing = signal(8); // Default 2rem spacing
  textList = signal<string[]>([
    'Overlay Text 1', 
    'Overlay Text 2', 
    'Overlay Text 3',
    'Overlay Text 4',
    'Overlay Text 5',
    'Overlay Text 6',
    'Overlay Text 7',
    'Overlay Text 8',
    'Overlay Text 9',
    'Overlay Text 10',
    'Overlay Text 11',
    'Overlay Text 12',
    'Overlay Text 13',
    'Overlay Text 14',
    'Overlay Text 15',
    'Overlay Text 16',
    'Overlay Text 17',
    'Overlay Text 18',
    'Overlay Text 19',
    'Overlay Text 20',
    'Overlay Text 21',
  ].reverse());
  offsetX = signal(0);

  /**
   * Generate a scene with many small circles that span the complete width
   */
  private generateCircleScene(): CircleScene[] {
    const circles: CircleScene[] = [];
    
    // Generate a wide grid of circles that spans multiple screen widths
    const numColumns = 60; // More columns to span wider area
    const numRows = 15;
    
    for (let i = 0; i < numColumns; i++) {
      for (let j = 0; j < numRows; j++) {
        // Map to a wider range: -3 to 3 (3x the normal width)
        const x = (i / (numColumns - 1)) * 6 - 3; // Map 0-59 to -3 to 3
        const y = (j / (numRows - 1)) * 2 - 1; // Map 0-14 to -1 to 1
        
        // Debug: Log first and last positions
        if ((i === 0 && j === 0) || (i === numColumns - 1 && j === numRows - 1)) {
          console.log(`Grid circle at (${i}, ${j}): x=${x}, y=${y}`);
        }
        
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
    
    console.log(`Accent circles added. Total circles: ${circles.length}`);
    console.log(`Grid circles: ${numColumns * numRows}, Accent circles: 5`);
    
    return circles;
  }

  /**
   * Handle scroll position changes from the overlay component
   * @param newPosition New scroll position (0-1)
   */
  onScrollPositionChange(newPosition: number) {
    console.log(`Scroll position changed to: ${newPosition}`);
    this.scrollPosition.set(newPosition);
    this.drawScene(); // Redraw with new scroll position
  }

  /**
   * Update the scene with new circle data
   * @param circles New array of circles to render
   */
  updateScene(circles: CircleScene[]) {
    this.scene.circles = circles;
    this.multiCirclePipeline.setCircles(circles);
    this.drawScene(); // Redraw with new scene
  }

  /**
   * Create a spiral pattern of circles
   */
  createSpiralScene(): CircleScene[] {
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
    
    return circles;
  }

  /**
   * Create a random scatter of circles
   */
  createRandomScene(): CircleScene[] {
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
    
    return circles;
  }

  /**
   * Create a Lissajous curve pattern of circles
   */
  createLissajousScene(): CircleScene[] {
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
      const color = hslToRgba(hue, 0.7, 0.5, 0.8);
      circles.push({
        x: x,
        y: y,
        radius: 0.025,
        color: color
      });
    }
    return circles;
  }

  /**
   * Create a tiled concentric rings pattern of circles that spans the full scrollable width
   */
  createConcentricRingsScene(): CircleScene[] {
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
          const color = hslToRgba(hue, 0.7, 0.5, 0.7);
          circles.push({
            x: x,
            y: y,
            radius: 0.07 - 0.004 * ring, // Slightly smaller for outer rings
            color: color
          });
        }
      }
      // Add a central circle for each tile
      circles.push({ x: centerX, y: centerY, radius: 0.09, color: hslToRgba(tile * 30, 0.7, 0.5, 0.9) });
    }
    return circles;
  }

  // Scene description for rendering multiple circles
  private scene: Scene = {
    topLabels: [],
    topLabelsOffset: [],
    bottomLabels: [],
    bottomLabelsOffset: [],
    gridLines: [],
    gridLinesColor: '#ffffff',
    gridLinesWidth: 1,
    gridLinesOpacity: 0.3,
    circles: [] // Will be populated in ngAfterViewInit
  };

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.resizeCanvas();
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

    // Add grid lines at y = 0.2, 0.4, 0.6, 0.8 (normalized)
    this.gridPipeline = new GridPipeline(this.device, this.presentationFormat, [0.2, 0.4, 0.6, 0.8]);
    this.rectanglePipeline = new RectanglePipeline(this.device, this.presentationFormat, instanceMatrices)
    this.roundedRectanglePipeline = new RoundedRectanglePipeline(this.device, this.presentationFormat)
    this.texturedRectanglePipeline = new TexturedRectanglePipeline(this.device, this.presentationFormat)
    this.circlePipeline = new CirclePipeline(this.device, this.presentationFormat)
    this.multiCirclePipeline = new MultiCirclePipeline(this.device, this.presentationFormat)
    
    // Generate the circle scene
    this.scene.circles = this.createConcentricRingsScene();
    console.log(`Generated ${this.scene.circles.length} circles. First: (${this.scene.circles[0].x}, ${this.scene.circles[0].y}), Last: (${this.scene.circles[this.scene.circles.length-1].x}, ${this.scene.circles[this.scene.circles.length-1].y})`);
    this.multiCirclePipeline.setCircles(this.scene.circles)
    
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
    this.multiCirclePipeline.destroy()
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
    const aspectRatio = this.canvas.nativeElement.width / this.canvas.nativeElement.height;
    this.multiCirclePipeline.updateAspectRatio(this.device, aspectRatio);
    
    // Calculate scroll offset in pixels to match text movement
    const scrollOffsetInPixels = this.scrollPosition() * -2000;
    const canvasWidthPixels = this.canvas.nativeElement.width;
    this.multiCirclePipeline.updateScrollOffset(this.device, scrollOffsetInPixels, canvasWidthPixels);
    
    this.multiCirclePipeline.draw(passEncoder);

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

  private resizeCanvas(): void {
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    const parent = canvasEl.parentElement;

    if (parent && this.context) {
      // Store current drawing before resizing
      //const imageData = this.context.getImageData(0, 0, canvasEl.width, canvasEl.height);

      // Update canvas dimensions

      //this.context.reset();
      //this.context.scale(1, 1);
      canvasEl.width = parent.offsetWidth;
      canvasEl.height = parent.offsetHeight;
      canvasEl.style.width = canvasEl.width.toString() + "px"
      canvasEl.style.height = canvasEl.height.toString() + "px"
      this.canvasWidth.set(canvasEl.width);
      //this.context.scale(this.convertRemToPixels(1), this.convertRemToPixels(1))
      this.drawScene(); // Call the method to draw the triangle
      // Restore drawing after resizing
      //this.context.putImageData(imageData, 0, 0);
    }
  }
}

// Helper to convert HSL to RGBA
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
