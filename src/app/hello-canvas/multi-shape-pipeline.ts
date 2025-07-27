import { CircleScene } from '../hello-canvas/hello-canvas';

export interface ShapeScene {
  x: number;           // center.x in rem units
  y: number;           // center.y in rem units
  radius: number;      // size/radius in rem units
  color: [number, number, number, number];
  shapeType: number;   // 0=circle, 1=square, 2=diamond, 3=triangle
  testResultIndex?: number; // Index of the test result in the ChartScene
}

export class MultiShapePipeline {
  private pipeline!: GPURenderPipeline;
  private vertexBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;
  private instanceBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private aspectRatio: number = 1.0;
  private scrollOffset: number = 0.0;
  private shapes: ShapeScene[] = [];
  private device!: GPUDevice;
  private scrollOffsetInPixels: number = 0.0;
  private canvasWidthPixels: number = 1.0;
  private canvasHeightPixels: number = 1.0;
  private pxToRemRatio: number = 16.0; // Default: 16px = 1rem
  private currentHighlightIndex: number = -1.0; // Track current highlight index

  constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
    this.device = device;
    
    // --- Setup for Multiple Shapes ---
    // Define a larger quad that will be instanced for each shape
    const quadPositions = new Float32Array([
      // Triangle 1
      -1.0,  1.0, 0.0, 1.0, // Top-left
      -1.0, -1.0, 0.0, 1.0, // Bottom-left
       1.0, -1.0, 0.0, 1.0, // Bottom-right

      // Triangle 2
      -1.0,  1.0, 0.0, 1.0, // Top-left
       1.0, -1.0, 0.0, 1.0, // Bottom-right
       1.0,  1.0, 0.0, 1.0, // Top-right
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
      size: 0, // Will be set when shapes are added
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create uniform buffer for transformation parameters
    this.uniformBuffer = device.createBuffer({
      size: 20, // 5 floats: canvas width, height, pxToRem ratio, scroll offset, highlight index
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout
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

    // Create Shader Modules for Multiple Shapes with Rem-based Transformation
    const multiShapeVertexShaderModule = device.createShaderModule({
      code: `
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2f,
            @location(1) color: vec4<f32>,
            @location(2) shapeType: f32,
            @location(3) instanceIndex: f32,
        };

        struct ShapeInstance {
            center: vec2f,    // x, y in rem units
            radius: f32,      // radius/size in rem units
            color: vec4<f32>,
            shapeType: f32,   // 0=circle, 1=square, 2=diamond, 3=triangle
        };

        struct Uniforms {
            canvasWidth: f32,
            canvasHeight: f32,
            pxToRemRatio: f32,
            scrollOffset: f32,
            highlightIndex: f32, // -1 for no highlight, otherwise instance index to highlight
        }

        @group(0) @binding(0)
        var<uniform> uniforms: Uniforms;

        @vertex
        fn main(
          @location(0) position: vec4<f32>,
          @location(1) color: vec4<f32>,
          @location(2) instance_center: vec2f, // x, y in rem units
          @location(3) instance_radius: f32,   // radius/size in rem units
          @location(4) instance_color: vec4<f32>,
          @location(5) instance_shapeType: f32, // shape type
          @builtin(instance_index) instance_idx: u32
        ) -> VertexOutput {
            var output: VertexOutput;
            
            let canvasWidth = uniforms.canvasWidth;
            let canvasHeight = uniforms.canvasHeight;
            let pxToRemRatio = uniforms.pxToRemRatio;
            let scrollOffset = uniforms.scrollOffset;
            
            // Convert rem coordinates to pixels
            let centerXInPixels = instance_center.x * pxToRemRatio;
            let centerYInPixels = instance_center.y * pxToRemRatio;
            let radiusInPixels = instance_radius * pxToRemRatio;
            
            // Apply scroll offset to x coordinate
            let adjustedXInPixels = centerXInPixels + scrollOffset;
            
            // Apply highlight scaling based on instance index
            let isHighlighted = f32(instance_idx) == uniforms.highlightIndex;
            let highlightScale = 1.0 + f32(isHighlighted) * 0.3; // 30% larger when highlighted
            let scaledRadiusInPixels = radiusInPixels * highlightScale;
            
            // Convert pixel coordinates to NDC (Normalized Device Coordinates)
            // NDC x: -1 to 1 maps to 0 to canvasWidth
            let ndc_x = (adjustedXInPixels / (canvasWidth / 2.0)) - 1.0;
            // NDC y: -1 to 1 maps to 0 to canvasHeight (flip Y so positive Y is up)
            let ndc_y = 1.0 - (centerYInPixels / (canvasHeight / 2.0));
            
            // Scale the quad by the pixel radius and convert to NDC
            let scaled = vec4f(
                ndc_x + position.x * scaledRadiusInPixels / (canvasWidth / 2.0),
                ndc_y + position.y * scaledRadiusInPixels / (canvasHeight / 2.0),
                position.z,
                position.w
            );
            
            output.uv = position.xy * 2.0;
            output.position = scaled;
            output.color = instance_color;
            output.shapeType = instance_shapeType;
            output.instanceIndex = f32(instance_idx);
            return output;
        }
      `,
    });

    const multiShapeFragmentShaderModule = device.createShaderModule({
      code: `
        struct Uniforms {
            canvasWidth: f32,
            canvasHeight: f32,
            pxToRemRatio: f32,
            scrollOffset: f32,
            highlightIndex: f32, // -1 for no highlight, otherwise instance index to highlight
        }

        @group(0) @binding(0)
        var<uniform> uniforms: Uniforms;

        struct FragmentInput {
            @location(1) color: vec4<f32>,
            @location(2) shapeType: f32,
        };

        // Signed Distance Functions for different shapes
        fn sdCircle(p: vec2f, r: f32) -> f32 {
            return length(p) - r;
        }

        fn sdSquare(p: vec2f, b: f32) -> f32 {
            let d = abs(p) - b;
            return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
        }

        fn sdDiamond(p: vec2f, b: f32) -> f32 {
            let q = abs(p);
            return (q.x + q.y - b) * 0.7071067811865476;
        }

        fn sdTriangle(p: vec2f, r: f32) -> f32 {
            let k = sqrt(3.0);
            var q = vec2f(abs(p.x) - r, p.y + 1.3 * r / k);
            if (q.x + k * q.y > 0.0) {
                q = vec2f(q.x - k * q.y, -k * q.x - q.y) / 2.0;
            }
            q.x -= clamp(q.x, -2.0 * r, 0.0);
            return -length(q) * sign(q.y);
        }

        @fragment
        fn main(
          @location(0) uv: vec2f,
          @location(1) color: vec4<f32>,
          @location(2) shapeType: f32,
          @location(3) instanceIndex: f32
        ) -> @location(0) vec4<f32> {
            // UV coordinates are in the shape's local space (-1 to 1)
            let p = uv;
            
            // Calculate all SDFs first (uniform control flow)
            let dCircle = sdCircle(p, 1.0);
            let dSquare = sdSquare(p, 1.0);
            let dDiamond = sdDiamond(p, 1.0);
            let dTriangle = sdTriangle(p, 1.0);
            
            // Calculate fwidth for all SDFs in uniform control flow
            let fwCircle = fwidth(dCircle);
            let fwSquare = fwidth(dSquare);
            let fwDiamond = fwidth(dDiamond);
            let fwTriangle = fwidth(dTriangle);
            
            // Select SDF based on shape type using select function (uniform control flow)
            let d = select(
                select(
                    select(dCircle, dSquare, shapeType >= 0.5),
                    dDiamond, 
                    shapeType >= 1.5
                ),
                dTriangle,
                shapeType >= 2.5
            );
            
            // Select corresponding fwidth
            let fw = select(
                select(
                    select(fwCircle, fwSquare, shapeType >= 0.5),
                    fwDiamond, 
                    shapeType >= 1.5
                ),
                fwTriangle,
                shapeType >= 2.5
            );
            
            // Check if this instance is highlighted
            let isHighlighted = instanceIndex == uniforms.highlightIndex;
            
            // Create border effect
            let borderWidth = 0.05; // Border thickness (adjust as needed)
            let fillAlpha = 1.0 - smoothstep(-fw, fw, d);
            let borderAlpha = 1.0 - smoothstep(-fw, fw, d - borderWidth);
            
            // Border has higher opacity than fill
            let borderOpacity = min(color.a * 1.5, 1.0); // 50% more opaque than fill
            let fillOpacity = color.a * 0.7; // 30% less opaque than original
            
            // Apply highlight brightness
            let brightnessMultiplier = 1.0 + f32(isHighlighted) * 0.8; // 50% brighter when highlighted
            var highlightedColor = vec4f(color.rgb * brightnessMultiplier, color.a * brightnessMultiplier);
            
            // Combine fill and border
            var finalAlpha = fillOpacity * fillAlpha + borderOpacity * (borderAlpha - fillAlpha);
            
            return vec4f(highlightedColor.rgb, finalAlpha);
        }
      `,
    });

    // Create Render Pipeline for Multiple Shapes with Instancing
    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: multiShapeVertexShaderModule,
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
          { // Instance buffer for shape data
            arrayStride: 8 * 4, // 2 floats (center) + 1 float (radius) + 4 floats (color) + 1 float (shapeType) = 8 floats
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'float32x2' }, // center
              { shaderLocation: 3, offset: 8, format: 'float32' },   // radius
              { shaderLocation: 4, offset: 12, format: 'float32x4' }, // color
              { shaderLocation: 5, offset: 28, format: 'float32' },  // shapeType
            ],
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      fragment: {
        module: multiShapeFragmentShaderModule,
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
   * Set the shapes to render
   * @param shapes Array of shape descriptions in rem units
   */
  setShapes(shapes: ShapeScene[]) {
    this.shapes = shapes;
    this.updateInstanceBuffer();
  }

  /**
   * Update the instance buffer with current shapes
   */
  private updateInstanceBuffer() {
    if (this.shapes.length === 0) return;
    
    const instanceData = new Float32Array(this.shapes.length * 8); // 8 floats per instance
    for (let i = 0; i < this.shapes.length; i++) {
      const shape = this.shapes[i];
      const offset = i * 8;
      
      // Store rem coordinates directly (transformation happens in vertex shader)
      instanceData[offset + 0] = shape.x; // center.x in rem
      instanceData[offset + 1] = shape.y; // center.y in rem
      instanceData[offset + 2] = shape.radius; // radius/size in rem
      instanceData[offset + 3] = shape.color[0];
      instanceData[offset + 4] = shape.color[1];
      instanceData[offset + 5] = shape.color[2];
      instanceData[offset + 6] = shape.color[3];
      instanceData[offset + 7] = shape.shapeType; // shape type
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
   * Set which shape to highlight
   * @param device GPUDevice
   * @param highlightIndex number (instance index to highlight, -1 for no highlight)
   */
  setHighlightIndex(device: GPUDevice, highlightIndex: number) {
    this.currentHighlightIndex = highlightIndex;
    // Update the entire uniform buffer to ensure consistency
    device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      this.canvasWidthPixels, 
      this.canvasHeightPixels, 
      this.pxToRemRatio, 
      this.scrollOffsetInPixels,
      this.currentHighlightIndex
    ]));
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
      this.scrollOffsetInPixels,
      this.currentHighlightIndex // Preserve current highlight index
    ]));
  }

  draw(passEncoder: GPURenderPassEncoder) {
    if (this.shapes.length === 0) return;
    
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setVertexBuffer(1, this.colorBuffer);
    passEncoder.setVertexBuffer(2, this.instanceBuffer);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.draw(6, this.shapes.length); // 6 vertices per quad, number of instances
  }

  destroy() {
    if (this.vertexBuffer) { this.vertexBuffer.destroy(); }
    if (this.colorBuffer) { this.colorBuffer.destroy(); }
    if (this.instanceBuffer) { this.instanceBuffer.destroy(); }
    if (this.uniformBuffer) { this.uniformBuffer.destroy(); }
  }
} 