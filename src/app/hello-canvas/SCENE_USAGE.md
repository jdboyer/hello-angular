# Scene-Based Circle Rendering System

This system allows you to describe scenes with multiple circles that are rendered using WebGPU. The circles are positioned at specified coordinates with custom colors, sizes, and transparency.

## Basic Usage

### 1. Define a Circle Scene

```typescript
import { CircleScene } from './hello-canvas';

const circles: CircleScene[] = [
  { x: -0.5, y: 0.5, radius: 0.1, color: [1.0, 0.0, 0.0, 0.8] }, // Red circle
  { x: 0.5, y: 0.5, radius: 0.1, color: [0.0, 1.0, 0.0, 0.8] },  // Green circle
  { x: 0.0, y: 0.0, radius: 0.15, color: [0.0, 0.0, 1.0, 0.6] }, // Blue circle
];
```

### 2. Update the Scene

```typescript
// In your component
this.updateScene(circles);
```

## CircleScene Interface

```typescript
interface CircleScene {
  x: number;        // X position (normalized -1 to 1)
  y: number;        // Y position (normalized -1 to 1)
  radius: number;   // Radius (normalized)
  color: [number, number, number, number]; // RGBA values (0-1)
}
```

## Pre-built Scene Generators

The system includes several pre-built scene generators:

### Grid Pattern
```typescript
// Already used by default - creates a 20x15 grid of circles
const gridCircles = this.generateCircleScene();
```

### Spiral Pattern
```typescript
const spiralCircles = this.createSpiralScene();
this.updateScene(spiralCircles);
```

### Random Scatter
```typescript
const randomCircles = this.createRandomScene();
this.updateScene(randomCircles);
```

## Creating Custom Scenes

You can create any pattern by defining circles with specific positions:

```typescript
// Example: Create a circle pattern
const customCircles: CircleScene[] = [];
const numCircles = 12;

for (let i = 0; i < numCircles; i++) {
  const angle = (i / numCircles) * 2 * Math.PI;
  const radius = 0.6;
  
  customCircles.push({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    radius: 0.05,
    color: [0.8, 0.2, 0.8, 0.7] // Purple
  });
}

this.updateScene(customCircles);
```

## Performance Notes

- The system can handle hundreds of circles efficiently
- Each circle is rendered as a separate draw call
- For very large numbers of circles (>1000), consider batching or instancing
- The aspect ratio is automatically handled for different canvas sizes

## Coordinate System

- X and Y coordinates are normalized from -1 to 1
- (-1, -1) is bottom-left
- (1, 1) is top-right
- (0, 0) is center
- Radius is also normalized (0.1 = 10% of canvas width)

## Color Format

Colors are specified as RGBA arrays with values from 0.0 to 1.0:
- `[1.0, 0.0, 0.0, 1.0]` = Solid red
- `[0.0, 1.0, 0.0, 0.5]` = Semi-transparent green
- `[0.5, 0.5, 0.5, 0.8]` = Semi-transparent gray 