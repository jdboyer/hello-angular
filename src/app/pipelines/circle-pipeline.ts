
export class CirclePipeline {
  private pipeline!: GPURenderPipeline;
  private vertexBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private aspectRatio: number = 1.0; // Store current aspect ratio


  constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
    // --- Setup for Circle ---
    // Define a quad that covers the area where the circle will be drawn
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
      // All vertices same color (e.g., blue with transparency)
      0.0, 0.5, 1.0, 0.7,
      0.0, 0.5, 1.0, 0.7,
      0.0, 0.5, 1.0, 0.7,

      0.0, 0.5, 1.0, 0.7,
      0.0, 0.5, 1.0, 0.7,
      0.0, 0.5, 1.0, 0.7,
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

    // Create Shader Modules for Circle
    const circleVertexShaderModule = device.createShaderModule({
      code: `
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2f,
            @location(1) color: vec4<f32>,
        };

        struct CircleUniforms {
            center: vec2f,
            radius: f32,
            aspectRatio: f32,
            // 8 bytes padding for alignment
            padding: vec2f,
        };

        @group(0) @binding(0)
        var<uniform> circle: CircleUniforms;

        @vertex
        fn main(
          @location(0) position: vec4<f32>,
          @location(1) color: vec4<f32>
        ) -> VertexOutput {
            var output: VertexOutput;
            // Scale x by 1.0 / aspectRatio to maintain fixed aspect
            let scaled = vec4f(position.x / circle.aspectRatio, position.y, position.z, position.w);
            output.uv = scaled.xy * 2.0;
            output.position = scaled;
            output.color = color;
            return output;
        }
      `,
    });

    const circleFragmentShaderModule = device.createShaderModule({
      code: `
        struct FragmentInput {
            @location(1) color: vec4<f32>,
        };

        struct CircleUniforms {
            center: vec2f,
            radius: f32,
            aspectRatio: f32,
            padding: vec2f,
        };

        @group(0) @binding(0)
        var<uniform> circle: CircleUniforms;

        fn sdCircle(p: vec2f, r: f32) -> f32 {
            return length(p) - r;
        }

        @fragment
        fn main(
          @location(0) uv: vec2f,
          input: FragmentInput
        ) -> @location(0) vec4<f32> {
            // Aspect-correct the x coordinate for SDF
            let fragCoord = vec2f(uv.x * circle.aspectRatio, uv.y);
            let p = fragCoord - circle.center;
            let d = sdCircle(p, circle.radius);
            let alpha = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
            return vec4f(input.color.rgb, input.color.a * alpha);
        }
      `,
    });

    // Uniform buffer for circle properties + aspect ratio
    const uniformBufferSize = 32; // 2x f32 (center) + 1x f32 (radius) + 1x f32 (aspectRatio) + 2x f32 (padding) = 32 bytes
    this.uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: "uniform" },
            },
        ],
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });

    // Create Render Pipeline for Circle
    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: circleVertexShaderModule,
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
        topology: 'triangle-list', // A quad is rendered as two triangles
      },
      fragment: {
        module: circleFragmentShaderModule,
        entryPoint: 'main',
        targets: [
          {
            format: presentationFormat,
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

    // Circle properties
    const centerX = 0.0; // Center X (normalized, -1 to 1)
    const centerY = 0.0; // Center Y (normalized, -1 to 1)
    const radius = 0.5;  // Normalized radius
    const aspectRatio = 1.0; // Default, will be updated dynamically

    const uniformData = new Float32Array(uniformBufferSize / 4);
    uniformData[0] = centerX;
    uniformData[1] = centerY;
    uniformData[2] = radius;
    uniformData[3] = aspectRatio;
    // padding at [4], [5]

    device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    this.aspectRatio = aspectRatio;

  }

  /**
   * Call this before draw() to update the aspect ratio dynamically.
   * @param device GPUDevice
   * @param aspectRatio number (canvas width / height)
   */
  updateAspectRatio(device: GPUDevice, aspectRatio: number) {
    this.aspectRatio = aspectRatio;
    // Update only the aspectRatio float in the buffer (offset = 3 * 4 = 12 bytes)
    device.queue.writeBuffer(this.uniformBuffer, 12, new Float32Array([aspectRatio]));
  }

  draw(passEncoder: GPURenderPassEncoder) {
    passEncoder.setPipeline(this.pipeline); // Switch to the circle's pipeline
    passEncoder.setVertexBuffer(0, this.vertexBuffer); // Set quad's position buffer
    passEncoder.setVertexBuffer(1, this.colorBuffer);  // Set quad's color buffer
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.draw(6); // A quad is 6 vertices (2 triangles)
  }

  destroy() {
    if (this.vertexBuffer) { this.vertexBuffer.destroy(); }
    if (this.colorBuffer) { this.colorBuffer.destroy(); }
    if (this.uniformBuffer) { this.colorBuffer.destroy(); }
  }

}