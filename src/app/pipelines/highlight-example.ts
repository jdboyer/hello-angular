import { MultiShapePipeline, ShapeScene } from './multi-circle-pipeline';

// Example usage of the highlighting feature
export class HighlightExample {
  private pipeline: MultiShapePipeline;
  private currentHighlightIndex: number = -1;

  constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
    this.pipeline = new MultiShapePipeline(device, presentationFormat);
  }

  // Example: Create shapes with different types
  createExampleShapes(): ShapeScene[] {
    return [
      // Circle
      { x: 2.0, y: 2.0, radius: 1.0, color: [1.0, 0.0, 0.0, 1.0], shapeType: 0 },
      // Square
      { x: 5.0, y: 2.0, radius: 1.0, color: [0.0, 1.0, 0.0, 1.0], shapeType: 1 },
      // Diamond
      { x: 8.0, y: 2.0, radius: 1.0, color: [0.0, 0.0, 1.0, 1.0], shapeType: 2 },
      // Triangle
      { x: 11.0, y: 2.0, radius: 1.0, color: [1.0, 1.0, 0.0, 1.0], shapeType: 3 },
    ];
  }

  // Set the shapes to render
  setShapes(shapes: ShapeScene[]) {
    this.pipeline.setShapes(shapes);
  }

  // Highlight a specific shape by index
  highlightShape(device: GPUDevice, index: number) {
    this.currentHighlightIndex = index;
    this.pipeline.setHighlightIndex(device, index);
  }

  // Remove highlight
  clearHighlight(device: GPUDevice) {
    this.currentHighlightIndex = -1;
    this.pipeline.setHighlightIndex(device, -1);
  }

  // Cycle through highlighting each shape
  cycleHighlight(device: GPUDevice) {
    const shapes = this.createExampleShapes();
    const nextIndex = (this.currentHighlightIndex + 1) % shapes.length;
    this.highlightShape(device, nextIndex);
  }

  // Update canvas dimensions
  updateCanvasDimensions(device: GPUDevice, width: number, height: number) {
    this.pipeline.updateCanvasDimensions(device, width, height);
  }

  // Update scroll offset
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

// Usage example:
/*
const example = new HighlightExample(device, presentationFormat);
const shapes = example.createExampleShapes();
example.setShapes(shapes);

// Highlight the first shape (index 0)
example.highlightShape(device, 0);

// Or cycle through highlights
example.cycleHighlight(device);

// Remove highlight
example.clearHighlight(device);
*/ 