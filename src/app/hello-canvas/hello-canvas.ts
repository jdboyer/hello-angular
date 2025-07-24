import { AfterViewInit, Component, ViewChild, ElementRef, HostListener } from '@angular/core';
import { RectanglePipeline } from './rectangle-pipeline';
import { RoundedRectanglePipeline } from './rounded-rectangle-pipeline';
import { TexturedRectanglePipeline } from './textured-rectangle-pipeline';
import { CirclePipeline } from './circle-pipeline';

@Component({
  selector: 'app-hello-canvas',
  imports: [],
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
    // Pipeline and buffers for the triangles
  private trianglePipeline!: GPURenderPipeline;
  private triangleVertexBuffer!: GPUBuffer;
  private triangleColorBuffer!: GPUBuffer;

  // New: Pipeline and buffers for the square
  private squarePipeline!: GPURenderPipeline;
  private squareVertexBuffer!: GPUBuffer;
  private squareColorBuffer!: GPUBuffer;

  private rectanglePipeline!: RectanglePipeline;
  private roundedRectanglePipeline!: RoundedRectanglePipeline;
  private texturedRectanglePipeline!: TexturedRectanglePipeline;
  private circlePipeline!: CirclePipeline;


  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.resizeCanvas();
  }

  // Lifecycle hook: Called after Angular has initialized all view components
  ngAfterViewInitB(): void {

    if (!navigator.gpu) {
      console.error("WebGPU not supported on this browser.");
      // Handle fallback (e.g., use WebGL or display a message)
    }
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    const parent = canvasEl.parentElement;

    // Set canvas dimensions (e.g., a square for simplicity)
    // You can adjust these or make them responsive as in the previous example
    //canvasEl.width = 400;
    //canvasEl.height = 400;
    canvasEl.height = parent!.offsetHeight;
    canvasEl.width = parent!.offsetWidth;
    canvasEl.style.width = canvasEl.width.toString() + "px"
    canvasEl.style.height = canvasEl.height.toString() + "px"
    
    
    this.myPath = new Path2D()
    this.myPath.ellipse(5, 5, 0.5, 0.5, Math.PI / 4, 0, 2 * Math.PI);
    this.myPath.moveTo(18, 5)
    this.myPath.ellipse(18, 5, 0.5, 0.5, Math.PI / 4, 0, 2 * Math.PI);
    this.myPath.moveTo(18, 18)
    this.myPath.ellipse(18, 18, 0.5, 0.5, Math.PI / 4, 0, 2 * Math.PI);
    //this.myPath.moveTo(20, 5);  // Top point (x, y)
    ////this.myPath.lineTo(5, 35);  // Bottom-left point
    ////this.myPath.lineTo(35, 35); // Bottom-right point
    ////this.myPath.closePath();      // Closes the path back to the starting point
    //this.myPath.closePath();
    //this.myPath.ellipse(5, 3, 1, 1, 0, 0, 0, false);
    //this.myPath.ellipse(3, 1, 1, 1, 0, 0, 0, false);
    //this.myPath.ellipse(1, 5, 1, 1, 0, 0, 0, false);

    // Get the 2D rendering context
    const ctx = canvasEl.getContext('2d');
    if (ctx) {
      //this.context = ctx;
      //this.context.scale(this.convertRemToPixels(1), this.convertRemToPixels(1))
      //this.drawTriangle(); // Call the method to draw the triangle
    }


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
    this.setupRectangles();
    this.setupTriangles();

    this.rectanglePipeline = new RectanglePipeline(this.device, this.presentationFormat)
    //this.setupCircles();
    // textured squares for symbols
    // circles 
    // rectangles for grid lines
    // rounded rectangles


    // 7. Draw the Scene (now draws both triangles and square)
    this.drawScene(5); // Draw 5 instances of triangles

  }

  // Lifecycle hook: Called once, before the component is destroyed
  ngOnDestroy(): void {
    // Release WebGPU resources if necessary, though the device will be lost
    // when the tab closes or the component is destroyed.
    // Explicit destruction is not always required for simple cases,
    // but good practice for complex applications.
    if (this.triangleVertexBuffer) { this.triangleVertexBuffer.destroy(); }
    if (this.triangleColorBuffer) { this.triangleColorBuffer.destroy(); }
    if (this.squareVertexBuffer) { this.squareVertexBuffer.destroy(); } // New
    if (this.squareColorBuffer) { this.squareColorBuffer.destroy(); }   // New
    // The device itself doesn't have a 'destroy' method, it's managed by the browser.
    this.rectanglePipeline.destroy()
  }
  private drawScene(triangleInstanceCount: number = 1): void {
    if (!this.device || !this.context || !this.trianglePipeline || !this.triangleVertexBuffer || !this.triangleColorBuffer ||
        !this.squarePipeline || !this.squareVertexBuffer || !this.squareColorBuffer) {
      console.error('WebGPU not fully initialized for all objects.');
      return;
    }

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
    this.rectanglePipeline.draw(passEncoder);

    // End the render pass
    passEncoder.end();

    // Submit the command buffer to the GPU queue
    this.device.queue.submit([commandEncoder.finish()]);
  }

  private setupRectangles() {
    // --- New: Setup for Square ---
    // 3. Define Square Vertices and Colors
    // A square can be made of two triangles
    const squarePositions = new Float32Array([
      // Triangle 1 (bottom-left)
      -0.5,  0.5, 0.0, 1.0, // Top-left
      -0.5, -0.5, 0.0, 1.0, // Bottom-left
       0.5, -0.5, 0.0, 1.0, // Bottom-right

      // Triangle 2 (top-right)
      -0.5,  0.5, 0.0, 1.0, // Top-left
       0.5, -0.5, 0.0, 1.0, // Bottom-right
       0.5,  0.5, 0.0, 1.0, // Top-right
    ]);

    const squareColors = new Float32Array([
      // Triangle 1 colors (e.g., yellow with transparency)
      1.0, 1.0, 0.0, 0.7,
      1.0, 1.0, 0.0, 0.7,
      1.0, 1.0, 0.0, 0.7,

      // Triangle 2 colors (e.g., magenta with transparency)
      1.0, 0.0, 1.0, 0.7,
      1.0, 0.0, 1.0, 0.7,
      1.0, 0.0, 1.0, 0.7,
    ]);

    // 4. Create GPU Buffers for Square Vertex Data
    this.squareVertexBuffer = this.device.createBuffer({
      size: squarePositions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.squareVertexBuffer.getMappedRange()).set(squarePositions);
    this.squareVertexBuffer.unmap();

    this.squareColorBuffer = this.device.createBuffer({
      size: squareColors.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.squareColorBuffer.getMappedRange()).set(squareColors);
    this.squareColorBuffer.unmap();

    // 5. Create Shader Modules for Square (can reuse if logic is identical, but showing separate for clarity)
    const squareVertexShaderModule = this.device.createShaderModule({
      code: `
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(1) color: vec4<f32>,
        };

        @vertex
        fn main(
          @location(0) position: vec4<f32>,
          @location(1) color: vec4<f32>
        ) -> VertexOutput {
            var output: VertexOutput;
            // Offset the square to the left to avoid overlapping triangles too much
            output.position = position + vec4<f32>(-0.6, 0.0, 0.0, 0.0);
            output.color = color;
            return output;
        }
      `,
    });

    const squareFragmentShaderModule = this.device.createShaderModule({
      code: `
        struct FragmentInput {
            @location(1) color: vec4<f32>,
        };

        @fragment
        fn main(
          input: FragmentInput
        ) -> @location(0) vec4<f32> {
          return input.color;
        }
      `,
    });

    // 6. Create Render Pipeline for Square
    this.squarePipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: squareVertexShaderModule,
        entryPoint: 'main',
        buffers: [
          { // Buffer for positions
            arrayStride: 4 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }],
          },
          { // Buffer for colors
            arrayStride: 4 * 4,
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }],
          },
        ],
      },
      primitive: {
        topology: 'triangle-list', // A square is rendered as two triangles
      },
      fragment: {
        module: squareFragmentShaderModule,
        entryPoint: 'main',
        targets: [
          {
            format: this.presentationFormat,
            blend: { // Enable blending for transparency
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
    });
  }
  private setupTriangles(): void {
        // --- Setup for Triangles ---
    // 3. Define Triangle Vertices and Colors
    const trianglePositions = new Float32Array([
      0.0,  0.8, 0.0, 1.0,  // Top vertex (x, y, z, w)
      -0.8, -0.8, 0.0, 1.0,  // Bottom-left vertex
      0.8, -0.8, 0.0, 1.0,   // Bottom-right vertex
    ]);

    const triangleColors = new Float32Array([
      1.0, 0.0, 0.0, 0.6, // Red with 60% opacity
      0.0, 1.0, 0.0, 0.6, // Green with 60% opacity
      0.0, 0.0, 1.0, 0.6, // Blue with 60% opacity
    ]);

    // 4. Create GPU Buffers for Triangle Vertex Data
    this.triangleVertexBuffer = this.device.createBuffer({
      size: trianglePositions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.triangleVertexBuffer.getMappedRange()).set(trianglePositions);
    this.triangleVertexBuffer.unmap();

    this.triangleColorBuffer = this.device.createBuffer({
      size: triangleColors.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.triangleColorBuffer.getMappedRange()).set(triangleColors);
    this.triangleColorBuffer.unmap();

    // 5. Create Shader Modules for Triangles
    const triangleVertexShaderModule = this.device.createShaderModule({
      code: `
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(1) color: vec4<f32>,
        };

        @vertex
        fn main(
          @location(0) position: vec4<f32>,
          @location(1) color: vec4<f32>,
          @builtin(instance_index) instance_idx: u32
        ) -> VertexOutput {
            var output: VertexOutput;
            let offset_x = f32(instance_idx) * 0.2;
            output.position = position + vec4<f32>(offset_x, 0.0, 0.0, 0.0);
            output.color = color;
            return output;
        }
      `,
    });

    const triangleFragmentShaderModule = this.device.createShaderModule({
      code: `
        struct FragmentInput {
            @location(1) color: vec4<f32>,
        };

        @fragment
        fn main(
          input: FragmentInput
        ) -> @location(0) vec4<f32> {
          return input.color;
        }
      `,
    });

    // 6. Create Render Pipeline for Triangles
    this.trianglePipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: triangleVertexShaderModule,
        entryPoint: 'main',
        buffers: [
          { // Buffer for positions
            arrayStride: 4 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }],
          },
          { // Buffer for colors
            arrayStride: 4 * 4,
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }],
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      fragment: {
        module: triangleFragmentShaderModule,
        entryPoint: 'main',
        targets: [
          {
            format: this.presentationFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
    });
  }

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
      console.log(canvasEl.width.toString() + "," + canvasEl.height.toString());
      canvasEl.style.width = canvasEl.width.toString() + "px"
      canvasEl.style.height = canvasEl.height.toString() + "px"
      //this.context.scale(this.convertRemToPixels(1), this.convertRemToPixels(1))
      this.drawScene(); // Call the method to draw the triangle
      // Restore drawing after resizing
      //this.context.putImageData(imageData, 0, 0);
    }
  }
}
