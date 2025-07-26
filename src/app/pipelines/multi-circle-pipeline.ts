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

    // Create uniform buffer for canvas width (in pixels)
    this.uniformBuffer = device.createBuffer({
      size: 8, // 2 floats: canvas width, aspect ratio
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

    // Create Shader Modules for Multiple Circles with Instancing
    const multiCircleVertexShaderModule = device.createShaderModule({
      code: `
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2f,
            @location(1) color: vec4<f32>,
        };

        struct CircleInstance {
            center: vec2f,
            radius: f32,
            color: vec4<f32>,
        };

        @group(0) @binding(0)
        var<uniform> uniforms: vec2f; // x: canvasWidth, y: aspectRatio

        @vertex
        fn main(
          @location(0) position: vec4<f32>,
          @location(1) color: vec4<f32>,
          @location(2) instance_center: vec2f, // x in pixels
          @location(3) instance_radius: f32,   // radius in pixels
          @location(4) instance_color: vec4<f32>,
          @builtin(instance_index) instance_idx: u32
        ) -> VertexOutput {
            var output: VertexOutput;
            let canvasWidth = uniforms.x;
            let aspectRatio = uniforms.y;
            // Convert pixel x to NDC: x_ndc = (x_pixel / (canvasWidth / 2.0)) - 1.0
            let ndc_x = (instance_center.x / (canvasWidth / 2.0)) - 1.0;
            // Convert pixel y to NDC: y_ndc = (y_pixel / (canvasHeight / 2.0)) - 1.0
            let canvasHeight = canvasWidth / aspectRatio;
            let ndc_y = (instance_center.y / (canvasHeight / 2.0)) - 1.0;
            // Scale the quad by the pixel radius and convert to NDC, preserving aspect ratio
            let scaled = vec4f(
                ndc_x + position.x * instance_radius / (canvasWidth / 2.0),
                ndc_y + position.y * instance_radius / (canvasHeight / 2.0),
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
   * @param circles Array of circle descriptions
   */
  setCircles(circles: CircleScene[]) {
    this.circles = circles;
    this.updateInstanceBuffer();
  }

  /**
   * Update the instance buffer with current circles and scroll offset
   */
  private updateInstanceBuffer() {
    if (this.circles.length === 0) return;
    // Convert normalized x to pixel x: x_normalized (-3 to 3) -> pixel_x
    // Assume -3 maps to 0, +3 maps to canvasWidthPixels
    const minX = -3;
    const maxX = 3;
    const rangeX = maxX - minX;
    // Convert normalized y to pixel y: y_normalized (-1 to 1) -> pixel_y
    const minY = -1;
    const maxY = 1;
    const rangeY = maxY - minY;
    const canvasHeightPixels = this.canvasWidthPixels / this.aspectRatio;
    // Use the same coordinate system as the overlay (-2000 offset)
    const totalScrollRange = 2000; // Total scroll range in pixels
    const instanceData = new Float32Array(this.circles.length * 7); // 7 floats per instance
    for (let i = 0; i < this.circles.length; i++) {
      const circle = this.circles[i];
      const offset = i * 7;
      // Map normalized x to pixel x using the same system as overlay
      const basePixelX = ((circle.x - minX) / rangeX) * totalScrollRange;
      const adjustedX = basePixelX + this.scrollOffsetInPixels;
      // Map normalized y to pixel y
      const pixelY = ((circle.y - minY) / rangeY) * canvasHeightPixels;
      // Convert normalized radius to pixels using the same system as overlay
      const radiusPixels = (circle.radius / rangeX) * totalScrollRange;
      instanceData[offset + 0] = adjustedX; // center.x in pixels
      instanceData[offset + 1] = pixelY; // center.y in pixels
      instanceData[offset + 2] = radiusPixels; // radius in pixels
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
   * Call this before draw() to update the aspect ratio dynamically.
   * @param device GPUDevice
   * @param aspectRatio number (canvas width / height)
   */
  updateAspectRatio(device: GPUDevice, aspectRatio: number) {
    this.aspectRatio = aspectRatio;
    this.updateUniforms(device);
  }

  /**
   * Update the scroll offset
   * @param device GPUDevice
   * @param scrollOffset number (horizontal scroll offset)
   */
  updateScrollOffset(device: GPUDevice, scrollOffsetInPixels: number, canvasWidthPixels: number) {
    this.scrollOffsetInPixels = scrollOffsetInPixels;
    this.canvasWidthPixels = canvasWidthPixels;
    this.updateUniforms(device);
    this.updateInstanceBuffer();
  }

  /**
   * Update the uniform buffer with current aspect ratio
   * @param device GPUDevice
   */
  private updateUniforms(device: GPUDevice) {
    device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([this.canvasWidthPixels, this.aspectRatio]));
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