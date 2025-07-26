import { AfterViewInit, Component, ViewChild, ElementRef, HostListener } from '@angular/core';
import { RectanglePipeline } from '../pipelines/rectangle-pipeline';
import { RoundedRectanglePipeline } from '../pipelines/rounded-rectangle-pipeline';
import { TexturedRectanglePipeline } from '../pipelines/textured-rectangle-pipeline';
import { CirclePipeline } from '../pipelines/circle-pipeline';
import { GridPipeline } from '../pipelines/grid-pipeline';
import { OverlayComponent } from './overlay.component';
import { signal } from '@angular/core';

@Component({
  selector: 'app-hello-canvas',
  imports: [OverlayComponent],
  templateUrl: './hello-canvas.html',
  styleUrl: './hello-canvas.css'
})
export class HelloCanvas implements AfterViewInit {
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
  private gridPipeline!: GridPipeline;

  scrollRange = signal(100);
  scrollPosition = signal(0);
  canvasWidth = signal(500);
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
    this.rectanglePipeline.updateAspectRatio(this.device, this.canvas.nativeElement.width / this.canvas.nativeElement.height);
    this.rectanglePipeline.draw(passEncoder);
    //this.roundedRectanglePipeline.updateAspectRatio(this.device, this.canvas.nativeElement.width / this.canvas.nativeElement.height);
    //this.roundedRectanglePipeline.draw(passEncoder);
    //this.texturedRectanglePipeline.draw(passEncoder);
    this.circlePipeline.updateAspectRatio(this.device, this.canvas.nativeElement.width / this.canvas.nativeElement.height);
    this.circlePipeline.draw(passEncoder);

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
      //this.context.scale(this.convertRemToPixels(1), this.convertRemToPixels(1))
      this.drawScene(); // Call the method to draw the triangle
      // Restore drawing after resizing
      //this.context.putImageData(imageData, 0, 0);
    }
  }
}
