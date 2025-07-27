import { MultiShapePipeline, ShapeScene } from '../hello-canvas/multi-shape-pipeline';

// Example usage of the MultiShapePipeline
export class MultiShapeExample {
  private pipeline: MultiShapePipeline;

  constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
    this.pipeline = new MultiShapePipeline(device, presentationFormat);
  }

  // Example: Create a scene with different shapes
  createExampleScene(): ShapeScene[] {
    return [
      // Circle (shapeType: 0)
      {
        x: 2.0,    // 2rem from left
        y: 2.0,    // 2rem from top
        radius: 1.0, // 1rem radius
        color: [1.0, 0.0, 0.0, 1.0], // Red
        shapeType: 0
      },
      
      // Square (shapeType: 1)
      {
        x: 5.0,    // 5rem from left
        y: 2.0,    // 2rem from top
        radius: 1.0, // 1rem size
        color: [0.0, 1.0, 0.0, 1.0], // Green
        shapeType: 1
      },
      
      // Diamond (shapeType: 2)
      {
        x: 8.0,    // 8rem from left
        y: 2.0,    // 2rem from top
        radius: 1.0, // 1rem size
        color: [0.0, 0.0, 1.0, 1.0], // Blue
        shapeType: 2
      },
      
      // Triangle (shapeType: 3)
      {
        x: 11.0,   // 11rem from left
        y: 2.0,    // 2rem from top
        radius: 1.0, // 1rem size
        color: [1.0, 1.0, 0.0, 1.0], // Yellow
        shapeType: 3
      },
      
      // Another circle with different color
      {
        x: 2.0,    // 2rem from left
        y: 5.0,    // 5rem from top
        radius: 0.5, // 0.5rem radius
        color: [1.0, 0.0, 1.0, 0.8], // Magenta with transparency
        shapeType: 0
      }
    ];
  }

  // Update the pipeline with new shapes
  updateShapes(shapes: ShapeScene[]) {
    this.pipeline.setShapes(shapes);
  }

  // Update canvas dimensions (call when canvas resizes)
  updateCanvasDimensions(device: GPUDevice, width: number, height: number) {
    this.pipeline.updateCanvasDimensions(device, width, height);
  }

  // Update scroll offset (call when scrolling)
  updateScrollOffset(device: GPUDevice, scrollOffset: number) {
    this.pipeline.updateScrollOffset(device, scrollOffset);
  }

  // Draw the shapes
  draw(passEncoder: GPURenderPassEncoder) {
    this.pipeline.draw(passEncoder);
  }

  // Clean up resources
  destroy() {
    this.pipeline.destroy();
  }
}

// Shape type constants for easier use
export const SHAPE_TYPES = {
  CIRCLE: 0,
  SQUARE: 1,
  DIAMOND: 2,
  TRIANGLE: 3
} as const;

// Helper function to create shapes
export function createShape(
  x: number, 
  y: number, 
  radius: number, 
  color: [number, number, number, number], 
  shapeType: number
): ShapeScene {
  return { x, y, radius, color, shapeType };
}

// Example: Create a row of shapes
export function createShapeRow(
  startX: number,
  y: number,
  spacing: number,
  radius: number,
  colors: [number, number, number, number][]
): ShapeScene[] {
  return colors.map((color, index) => ({
    x: startX + (index * spacing),
    y,
    radius,
    color,
    shapeType: index % 4 // Cycle through shape types
  }));
} 