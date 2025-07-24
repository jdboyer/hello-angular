import { AfterViewInit, Component, ViewChild, ElementRef, HostListener } from '@angular/core';

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
  private pipeline!: GPURenderPipeline;
  private vertexBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;

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
      alphaMode: 'opaque', // Or 'opaque'
    });

    // 3. Define Triangle Vertices and Colors
    // Vertices in Normalized Device Coordinates (NDC)
    const positions = new Float32Array([
      0.0,  0.8, 0.0, 1.0,  // Top vertex (x, y, z, w)
      -0.8, -0.8, 0.0, 1.0,  // Bottom-left vertex
      0.8, -0.8, 0.0, 1.0,   // Bottom-right vertex
    ]);

    // Colors (RGBA) for each vertex
    const colors = new Float32Array([
      1.0, 0.0, 0.0, 0.6, // Red
      0.0, 1.0, 0.0, 0.6, // Green
      0.0, 0.0, 1.0, 0.6, // Blue
    ]);

    // 4. Create GPU Buffers for Vertex Data
    this.vertexBuffer = this.device.createBuffer({
      size: positions.byteLength, // Size in bytes
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // Usable as vertex buffer, can be copied to
      mappedAtCreation: true, // Map the buffer for writing immediately
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(positions);
    this.vertexBuffer.unmap(); // Unmap to make it accessible by the GPU

    this.colorBuffer = this.device.createBuffer({
      size: colors.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.colorBuffer.getMappedRange()).set(colors);
    this.colorBuffer.unmap();

    // 5. Create Shader Modules
    // Vertex Shader: Transforms vertex positions and passes color to fragment shader
    const vertexShaderModule = this.device.createShaderModule({
      code: `
        // Output struct for the vertex shader
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(1) color: vec4<f32>, // Output color at location 1
        };

        @vertex
        fn main(
          @location(0) position: vec4<f32>, // Vertex position from buffer (location 0)
          @location(1) color: vec4<f32>,      // Vertex color from buffer (location 1)
          @builtin(instance_index) instance_idx: u32
        ) -> VertexOutput {
            var output: VertexOutput;
            let offset_x = f32(instance_idx) * 0.2; // Adjust offset as needed
            output.position = position + vec4<f32>(offset_x, 0.0, 0.0, 0.0);
            output.color = color;       // Pass the color to the fragment shader
            return output;
        }
      `,
    });

    // Fragment Shader: Determines the color of each pixel
    const fragmentShaderModule = this.device.createShaderModule({
      code: `
        // Input struct for the fragment shader, matching the vertex shader's output
        struct FragmentInput {
            @location(1) color: vec4<f32>, // Interpolated color from vertex shader (location 1)
        };

        @fragment
        fn main(
          input: FragmentInput // Receive the interpolated data via the struct
        ) -> @location(0) vec4<f32> {
          return input.color; // Output the interpolated color for the pixel
        }
      `,
    });

    // 6. Create Render Pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto', // Automatically infer bind group layout from shader
      vertex: {
        module: vertexShaderModule,
        entryPoint: 'main',
        buffers: [
          { // Buffer for positions
            arrayStride: 4 * 4, // 4 floats * 4 bytes/float = 16 bytes per vertex
            attributes: [
              {
                shaderLocation: 0, // Corresponds to @location(0) in shader
                offset: 0,
                format: 'float32x4', // vec4<f32>
              },
            ],
          },
          { // Buffer for colors
            arrayStride: 4 * 4, // 4 floats * 4 bytes/float = 16 bytes per vertex
            attributes: [
              {
                shaderLocation: 1, // Corresponds to @location(1) in shader
                offset: 0,
                format: 'float32x4', // vec4<f32>
              },
            ],
          },
        ],
      },
      primitive: {
        topology: 'triangle-list', // Draw a list of triangles
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: 'main',
        targets: [
          {
            format: this.presentationFormat, // Output format matches canvas
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

    // 7. Draw the Triangle
    this.drawTriangleWebGPU();
  }

  // Lifecycle hook: Called once, before the component is destroyed
  ngOnDestroy(): void {
    // Release WebGPU resources if necessary, though the device will be lost
    // when the tab closes or the component is destroyed.
    // Explicit destruction is not always required for simple cases,
    // but good practice for complex applications.
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
    }
    if (this.colorBuffer) {
      this.colorBuffer.destroy();
    }
    // The device itself doesn't have a 'destroy' method, it's managed by the browser.
  }

  /**
   * Encodes commands to draw the triangle using WebGPU.
   */
  private drawTriangleWebGPU(): void {
    if (!this.device || !this.context || !this.pipeline || !this.vertexBuffer || !this.colorBuffer) {
      console.error('WebGPU not fully initialized.');
      return;
    }

    // Create a command encoder
    const commandEncoder = this.device.createCommandEncoder();

    // Start a render pass
    const textureView = this.context.getCurrentTexture().createView(); // Get the texture to draw on
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }, // Clear color (dark grey)
          loadOp: 'clear', // Clear the texture before drawing
          storeOp: 'store', // Store the result in the texture
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    // Set the render pipeline
    passEncoder.setPipeline(this.pipeline);

    // Set the vertex buffers
    passEncoder.setVertexBuffer(0, this.vertexBuffer); // Corresponds to buffer at index 0 in pipeline config
    passEncoder.setVertexBuffer(1, this.colorBuffer);  // Corresponds to buffer at index 1 in pipeline config

    // Draw the 3 vertices (our triangle)
    passEncoder.draw(3, 5); // Draw 3 vertices

    // End the render pass
    passEncoder.end();

    // Submit the command buffer to the GPU queue
    this.device.queue.submit([commandEncoder.finish()]);
  }

  private drawTriangle(): void {
    if (!this.context) return;

    const ctx = this.context;

    // Set drawing style for the triangle
    //ctx.strokeStyle = '#3B82F6'; // Blue color
    //ctx.fillStyle = '#60A5FA';   // Lighter blue fill
    //ctx.lineWidth = 1;           // Line thickness

    // Start drawing the triangle
    //ctx.beginPath();
    //ctx.moveTo(20, 5);  // Top point (x, y)
    //ctx.lineTo(5, 35);  // Bottom-left point
    //ctx.lineTo(35, 35); // Bottom-right point
    //ctx.closePath();      // Closes the path back to the starting point

    //ctx.stroke(this.myPath); // Draws the outline of the triangle
    //ctx.fill(this.myPath);   // Fills the triangle with the fillStyle color
  }
  private convertRemToPixels(rem: number): number {    
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }
  private drawTriangleB(): void {
//    if (!this.overlayContext) return;

//    const ctx = this.overlayContext;

    // Set drawing style for the triangle
//    ctx.strokeStyle = '#880000'; // Blue color
  //  ctx.fillStyle = '#600000';   // Lighter blue fill
 //   ctx.lineWidth = 3;           // Line thickness

    // Start drawing the triangle
//    ctx.beginPath();
//    ctx.moveTo(190, 100);  // Top point (x, y)
//    ctx.lineTo(50, 300);  // Bottom-left point
//    ctx.lineTo(350, 300); // Bottom-right point
//    ctx.closePath();      // Closes the path back to the starting point
//
//    ctx.stroke(); // Draws the outline of the triangle
//    ctx.fill();   // Fills the triangle with the fillStyle color

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
      this.drawTriangleWebGPU(); // Call the method to draw the triangle
      // Restore drawing after resizing
      //this.context.putImageData(imageData, 0, 0);
    }
  }
}
