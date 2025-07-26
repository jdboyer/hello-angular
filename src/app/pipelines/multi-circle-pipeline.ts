import { CircleScene } from '../hello-canvas/hello-canvas';

export class MultiCirclePipeline {
  private pipeline!: GPURenderPipeline;
  private vertexBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;
  private instanceBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private aspectRatio: number = 1.0;
  private scrollOffset: number = 0.0;
  private circles: CircleScene[] = [];
  private device!: GPUDevice;
  private scrollOffsetInPixels: number = 0.0;
  private canvasWidthPixels: number = 1.0;
  private canvasHeightPixels: number = 1.0;
  private pxToRemRatio: number = 16.0; // Default: 16px = 1rem

  constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
    this.device = device;
    
    // --- Setup for Multiple Circles ---
    // Define a small quad that will be instanced for each circle
    const quadPositions = new Float32Array([
      // Triangle 1
      -0.5,  0.5, 0.0, 1.0, // Top-left
      -0.5, -0.5, 0.0, 1.0, // Bottom-left
       0.5, -0.5, 0.0, 1.0, // Bottom-right

      // Triangle 2
      -0.5,  0.5, 0.0, 1.0, // Top-left
       0.5, -0.5, 0.0, 1.0, // Bottom-right
       0.5,  0.5, 0.0, 1.0, // Top-right
    ]);

    const quadColors = new Float32Array([
      // All vertices same color (will be overridden by instance data)
      1.0, 1.0, 1.0, 1.0,
      1.0, 1.0, 1.0, 1.0,
      1.0, 1.0, 1.0, 1.0,

      1.0, 1.0, 1.0, 1.0,
      1.0, 1.0, 1.0, 1.0,
      1.0, 1.0, 1.0, 1.0,
    ]);

    // Create GPU Buffers for Quad Vertex Data
    this.vertexBuffer = device.createBuffer({
      size: quadPositions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(quadPositions);
    this.vertexBuffer.unmap();

    this.colorBuffer = device.createBuffer({
      size: quadColors.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.colorBuffer.getMappedRange()).set(quadColors);
    this.colorBuffer.unmap();

    // Create instance buffer (will be populated later)
    this.instanceBuffer = device.createBuffer({
      size: 0, // Will be set when circles are added
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create uniform buffer for transformation parameters
    this.uniformBuffer = device.createBuffer({
      size: 16, // 4 floats: canvas width, height, pxToRem ratio, scroll offset
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    // Create bind group
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
          },
        },
      ],
    });

    // Create Shader Modules for Multiple Circles with Rem-based Transformation
    const multiCircleVertexShaderModule = device.createShaderModule({
      code: `
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2f,
            @location(1) color: vec4<f32>,
        };

        struct CircleInstance {
            center: vec2f,    // x, y in rem units
            radius: f32,      // radius in rem units
            color: vec4<f32>,
        };

        @group(0) @binding(0)
        var<uniform> uniforms: vec4f; // x: canvasWidth, y: canvasHeight, z: pxToRemRatio, w: scrollOffset

        @vertex
        fn main(
          @location(0) position: vec4<f32>,
          @location(1) color: vec4<f32>,
          @location(2) instance_center: vec2f, // x, y in rem units
          @location(3) instance_radius: f32,   // radius in rem units
          @location(4) instance_color: vec4<f32>,
          @builtin(instance_index) instance_idx: u32
        ) -> VertexOutput {
            var output: VertexOutput;
            
            let canvasWidth = uniforms.x;
            let canvasHeight = uniforms.y;
            let pxToRemRatio = uniforms.z;
            let scrollOffset = uniforms.w;
            
            // Convert rem coordinates to pixels
            let centerXInPixels = instance_center.x * pxToRemRatio;
            let centerYInPixels = instance_center.y * pxToRemRatio;
            let radiusInPixels = instance_radius * pxToRemRatio;
            
            // Apply scroll offset to x coordinate
            let adjustedXInPixels = centerXInPixels + scrollOffset;
            
            // Convert pixel coordinates to NDC (Normalized Device Coordinates)
            // NDC x: -1 to 1 maps to 0 to canvasWidth
            let ndc_x = (adjustedXInPixels / (canvasWidth / 2.0)) - 1.0;
            // NDC y: -1 to 1 maps to 0 to canvasHeight (flip Y so positive Y is up)
            let ndc_y = 1.0 - (centerYInPixels / (canvasHeight / 2.0));
            
            // Scale the quad by the pixel radius and convert to NDC
            let scaled = vec4f(
                ndc_x + position.x * radiusInPixels / (canvasWidth / 2.0),
                ndc_y + position.y * radiusInPixels / (canvasHeight / 2.0),
                position.z,
                position.w
            );
            
            output.uv = position.xy * 2.0;
            output.position = scaled;
            output.color = instance_color;
            return output;
        }
      `,
    });

    const multiCircleFragmentShaderModule = device.createShaderModule({
      code: `
        struct FragmentInput {
            @location(1) color: vec4<f32>,
        };

        fn sdCircle(p: vec2f, r: f32) -> f32 {
            return length(p) - r;
        }

        @fragment
        fn main(
          @location(0) uv: vec2f,
          input: FragmentInput
        ) -> @location(0) vec4<f32> {
            // UV coordinates are in the circle's local space
            let p = uv;
            let d = sdCircle(p, 1.0); // Use unit circle since we scaled in vertex shader
            let alpha = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
            return vec4f(input.color.rgb, input.color.a * alpha);
        }
      `,
    });

    // Create Render Pipeline for Multiple Circles with Instancing
    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: multiCircleVertexShaderModule,
        entryPoint: 'main',
        buffers: [
          { // Buffer for positions
            arrayStride: 4 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }],
          },
          { // Buffer for colors (not used, but required)
            arrayStride: 4 * 4,
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }],
          },
          { // Instance buffer for circle data
            arrayStride: 7 * 4, // 2 floats (center) + 1 float (radius) + 4 floats (color)
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'float32x2' }, // center
              { shaderLocation: 3, offset: 8, format: 'float32' },   // radius
              { shaderLocation: 4, offset: 12, format: 'float32x4' }, // color
            ],
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      fragment: {
        module: multiCircleFragmentShaderModule,
        entryPoint: 'main',
        targets: [
          {
            format: presentationFormat,
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

  /**
   * Set the circles to render
   * @param circles Array of circle descriptions in rem units
   */
  setCircles(circles: CircleScene[]) {
    this.circles = circles;
    this.updateInstanceBuffer();
  }

  /**
   * Update the instance buffer with current circles
   */
  private updateInstanceBuffer() {
    if (this.circles.length === 0) return;
    
    const instanceData = new Float32Array(this.circles.length * 7); // 7 floats per instance
    for (let i = 0; i < this.circles.length; i++) {
      const circle = this.circles[i];
      const offset = i * 7;
      
      // Store rem coordinates directly (transformation happens in vertex shader)
      instanceData[offset + 0] = circle.x; // center.x in rem
      instanceData[offset + 1] = circle.y; // center.y in rem
      instanceData[offset + 2] = circle.radius; // radius in rem
      instanceData[offset + 3] = circle.color[0];
      instanceData[offset + 4] = circle.color[1];
      instanceData[offset + 5] = circle.color[2];
      instanceData[offset + 6] = circle.color[3];
    }
    
    this.instanceBuffer.destroy();
    this.instanceBuffer = this.device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
  }

  /**
   * Call this before draw() to update the canvas dimensions and aspect ratio.
   * @param device GPUDevice
   * @param canvasWidthPixels number (canvas width in pixels)
   * @param canvasHeightPixels number (canvas height in pixels)
   */
  updateCanvasDimensions(device: GPUDevice, canvasWidthPixels: number, canvasHeightPixels: number) {
    this.canvasWidthPixels = canvasWidthPixels;
    this.canvasHeightPixels = canvasHeightPixels;
    this.aspectRatio = canvasWidthPixels / canvasHeightPixels;
    this.updateUniforms(device);
  }

  /**
   * Update the scroll offset
   * @param device GPUDevice
   * @param scrollOffsetInPixels number (horizontal scroll offset in pixels)
   */
  updateScrollOffset(device: GPUDevice, scrollOffsetInPixels: number) {
    this.scrollOffsetInPixels = scrollOffsetInPixels;
    this.updateUniforms(device);
  }

  /**
   * Update the uniform buffer with current transformation parameters
   * @param device GPUDevice
   */
  private updateUniforms(device: GPUDevice) {
    device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      this.canvasWidthPixels, 
      this.canvasHeightPixels, 
      this.pxToRemRatio, 
      this.scrollOffsetInPixels
    ]));
  }

  draw(passEncoder: GPURenderPassEncoder) {
    if (this.circles.length === 0) return;
    
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setVertexBuffer(1, this.colorBuffer);
    passEncoder.setVertexBuffer(2, this.instanceBuffer);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.draw(6, this.circles.length); // 6 vertices per quad, number of instances
  }

  destroy() {
    if (this.vertexBuffer) { this.vertexBuffer.destroy(); }
    if (this.colorBuffer) { this.colorBuffer.destroy(); }
    if (this.instanceBuffer) { this.instanceBuffer.destroy(); }
    if (this.uniformBuffer) { this.uniformBuffer.destroy(); }
  }
} 