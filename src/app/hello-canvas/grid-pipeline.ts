
export class GridPipeline {
  private pipeline!: GPURenderPipeline;
  private vertexBuffer!: GPUBuffer;
  private lineCount: number = 0;
  private aspectRatio: number = 1.0;

  constructor(device: GPUDevice, presentationFormat: GPUTextureFormat, yPositions: number[]) {
    // yPositions: array of floats from 0 to 1 (normalized viewport coordinates)
    // Each y creates a line from (x=-1, y) to (x=1, y)
    const vertices = new Float32Array(yPositions.length * 2 * 2); // 2 points per line, 2 floats per point
    for (let i = 0; i < yPositions.length; i++) {
      const y = 2 * yPositions[i] - 1; // Convert [0,1] to [-1,1]
      // Start point (left)
      vertices[i * 4 + 0] = -1.0;
      vertices[i * 4 + 1] = y;
      // End point (right)
      vertices[i * 4 + 2] = 1.0;
      vertices[i * 4 + 3] = y;
    }
    this.lineCount = yPositions.length;

    this.vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    // Simple shaders for lines
    const vertexShaderModule = device.createShaderModule({
      code: `
        struct VertexOut {
          @builtin(position) position: vec4<f32>,
        };
        @vertex
        fn main(@location(0) pos: vec2<f32>) -> VertexOut {
          var out: VertexOut;
          out.position = vec4<f32>(pos, 0.0, 1.0);
          return out;
        }
      `,
    });
    const fragmentShaderModule = device.createShaderModule({
      code: `
        @fragment
        fn main() -> @location(0) vec4<f32> {
          return vec4<f32>(0.7, 0.7, 0.7, 1.0); // light gray lines
        }
      `,
    });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexShaderModule,
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 2 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
            ],
          },
        ],
      },
      primitive: {
        topology: 'line-list',
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: 'main',
        targets: [
          { format: presentationFormat },
        ],
      },
    });
  }

  draw(passEncoder: GPURenderPassEncoder) {
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.draw(this.lineCount * 2, 1);
  }

  destroy() {
    if (this.vertexBuffer) this.vertexBuffer.destroy();
  }
}