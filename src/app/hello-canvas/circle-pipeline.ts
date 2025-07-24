
export class CirclePipeline {
  private pipeline!: GPURenderPipeline;
  private vertexBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;


  constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
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
    this.vertexBuffer = device.createBuffer({
      size: squarePositions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(squarePositions);
    this.vertexBuffer.unmap();

    this.colorBuffer = device.createBuffer({
      size: squareColors.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.colorBuffer.getMappedRange()).set(squareColors);
    this.colorBuffer.unmap();

    // 5. Create Shader Modules for Square (can reuse if logic is identical, but showing separate for clarity)
    const squareVertexShaderModule = device.createShaderModule({
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

    const squareFragmentShaderModule = device.createShaderModule({
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
    this.pipeline = device.createRenderPipeline({
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
  }

  draw(passEncoder: GPURenderPassEncoder) {
    passEncoder.setPipeline(this.pipeline); // Switch to the square's pipeline
    passEncoder.setVertexBuffer(0, this.vertexBuffer); // Set square's position buffer
    passEncoder.setVertexBuffer(1, this.colorBuffer);  // Set square's color buffer
    passEncoder.draw(6); // A square is 6 vertices (2 triangles)
  }

  destroy() {
    if (this.vertexBuffer) { this.vertexBuffer.destroy(); }
    if (this.colorBuffer) { this.colorBuffer.destroy(); }
  }

}