
export class RectanglePipeline {
  private pipeline!: GPURenderPipeline;
  private vertexBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;


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
            @location(0) uv: vec2f,
            @location(1) color: vec4<f32>,
        };

        @vertex
        fn main(
          @location(0) position: vec4<f32>,
          @location(1) color: vec4<f32>
        ) -> VertexOutput {
            var output: VertexOutput;
            // Offset the square to the left to avoid overlapping triangles too much
            output.uv = position.xy * 2.0;// + 1.0) / 2.0;
            output.position = position;
            //output.position = position + vec4<f32>(-0.3, 0.0, 0.0, 0.0);
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

        // Uniforms for rectangle properties
        struct RectUniforms {
            center: vec4f, // xy for center, zw unused or for other properties
            size: vec4f,   // xy for width/height, zw unused
            radius: vec4f,
            // Add padding to make it a multiple of 16 bytes
            // For example, if you add another float, you might need to add 3 floats for padding.
            // Here, 3 floats (12 bytes) + 4 bytes for radius = 16 bytes.
            // @size(12) padding: array<f32, 3>,
        };

        @group(0) @binding(0)
        var<uniform> rect: RectUniforms;

        // Signed Distance Function for a rounded box
        // Based on: https://www.iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
        fn sdRoundedBox(p: vec2f, b: vec2f, r: f32) -> f32 {
            let q = abs(p) - b + r;
            return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
        }

        @fragment
        fn main(
          @location(0) uv: vec2f,
          input: FragmentInput
        ) -> @location(0) vec4<f32> {

            // Convert UV (0 to 1) to clip space (-1 to 1)
            //let fragCoord = uv * 2.0 - 1.0;
            let fragCoord = uv;

            // Rectangle half-size relative to clip space
            let halfSize = rect.size.xy / 2.0;

            // Adjust fragment coordinate relative to rectangle's center
            let p = fragCoord - rect.center.xy;

            let d = sdRoundedBox(p, halfSize, rect.radius.x);

            // Smoothstep for anti-aliasing
            // fwidth(d) approximates the width of a pixel in terms of 'd' values.
            let alpha = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);

            //let color = vec4f(0.0, 0.7, 0.9, 1.0); // Cyan color for the rectangle
            //let color = input.color

            return vec4f(input.color.rgb, input.color.a * alpha);
            //return input.color;
        }
      `,
    });

    // Uniform buffer for rectangle properties
    const uniformBufferSize = (4 + 4 + 4) * 4; // vec4 for position, vec4 for size, float for radius
    this.uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: "uniform" },
            },
        ],
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });

    // 6. Create Render Pipeline for Square
    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
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

        // Rectangle properties
    const rectX = 0.0; // Center X (normalized, -1 to 1)
    const rectY = 0.0; // Center Y (normalized, -1 to 1)
    const rectWidth = 2.0; // Normalized width
    const rectHeight = 2.0; // Normalized height
    const borderRadius = 0.1; // Normalized radius

    const uniformData = new Float32Array(uniformBufferSize / 4);
    uniformData[0] = rectX;
    uniformData[1] = rectY;
    uniformData[4] = rectWidth;
    uniformData[5] = rectHeight;
    uniformData[8] = borderRadius; // Stored at index 4

    device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

  }

  draw(passEncoder: GPURenderPassEncoder) {
    passEncoder.setPipeline(this.pipeline); // Switch to the square's pipeline
    passEncoder.setVertexBuffer(0, this.vertexBuffer); // Set square's position buffer
    passEncoder.setVertexBuffer(1, this.colorBuffer);  // Set square's color buffer
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.draw(6); // A square is 6 vertices (2 triangles)
  }

  destroy() {
    if (this.vertexBuffer) { this.vertexBuffer.destroy(); }
    if (this.colorBuffer) { this.colorBuffer.destroy(); }
    if (this.uniformBuffer) { this.colorBuffer.destroy(); }
  }

}