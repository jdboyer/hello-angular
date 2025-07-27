# Culling Strategies for WebGPU Instance Rendering

This document explains the different approaches to culling instances that are outside the canvas viewport, with specific focus on the `MultiCirclePipeline` implementation.

## Overview

Culling is the process of determining which objects are visible and should be rendered. For WebGPU instance rendering, culling can significantly improve performance by reducing the number of GPU draw calls and vertex processing.

## Culling Strategies

### 1. **No Culling (Baseline)**
- **Description**: Render all instances regardless of visibility
- **Performance**: O(n) where n = total instances
- **Memory**: All instances sent to GPU
- **Use Case**: Small datasets (< 100 instances)

```typescript
// All circles are rendered
passEncoder.draw(6, this.circles.length);
```

### 2. **CPU-Side Frustum Culling (Implemented)**
- **Description**: Filter instances on CPU before sending to GPU
- **Performance**: O(n) CPU + O(visible) GPU
- **Memory**: Only visible instances sent to GPU
- **Use Case**: Medium datasets (100-10,000 instances)

```typescript
// Filter visible circles on CPU
this.visibleCircles = this.circles.filter(circle => this.isCircleVisible(circle));
passEncoder.draw(6, this.visibleCircles.length);
```

**Advantages:**
- Simple to implement and debug
- Reduces GPU memory usage
- Reduces vertex processing overhead
- Works well with scroll-based applications

**Disadvantages:**
- CPU overhead for filtering
- Must re-filter on every scroll/zoom change
- Linear time complexity

### 3. **Spatial Partitioning (Implemented)**
- **Description**: Divide space into grid cells for efficient culling
- **Performance**: O(visible cells) + O(instances in visible cells)
- **Memory**: Grid structure + visible instances
- **Use Case**: Large datasets (> 10,000 instances)

```typescript
// Build spatial grid
this.buildSpatialGrid();

// Only check instances in visible grid cells
this.filterVisibleCirclesWithSpatialGrid();
```

**Advantages:**
- Sub-linear time complexity for large datasets
- Efficient for sparse data distributions
- Scales well with dataset size

**Disadvantages:**
- More complex implementation
- Memory overhead for grid structure
- Setup cost for grid building

### 4. **GPU-Side Culling (Not Implemented)**
- **Description**: Use compute shaders or vertex shader culling
- **Performance**: O(n) GPU processing
- **Memory**: All instances sent to GPU
- **Use Case**: When CPU is bottleneck

```wgsl
// Example vertex shader culling
@vertex
fn main(...) -> VertexOutput {
    // Early exit for off-screen instances
    if (isOffScreen(instance_center, instance_radius)) {
        // Move vertex outside viewport
        output.position = vec4f(2.0, 2.0, 0.0, 1.0);
        return output;
    }
    // ... normal processing
}
```

**Advantages:**
- No CPU overhead
- Parallel processing on GPU
- Can handle complex culling logic

**Disadvantages:**
- Still processes all vertices
- More complex shader code
- May not reduce GPU work significantly

## Implementation Details

### Frustum Culling Algorithm

```typescript
private isCircleVisible(circle: CircleScene): boolean {
    // Convert to screen coordinates
    const centerXInPixels = circle.x * this.pxToRemRatio;
    const centerYInPixels = circle.y * this.pxToRemRatio;
    const radiusInPixels = circle.radius * this.pxToRemRatio;
    
    // Apply scroll offset
    const adjustedXInPixels = centerXInPixels + this.scrollOffsetInPixels;
    
    // Calculate bounding box with margin
    const left = adjustedXInPixels - radiusInPixels - this.cullingMargin;
    const right = adjustedXInPixels + radiusInPixels + this.cullingMargin;
    const top = centerYInPixels - radiusInPixels - this.cullingMargin;
    const bottom = centerYInPixels + radiusInPixels + this.cullingMargin;
    
    // Check intersection with viewport
    return !(right < 0 || left > this.canvasWidthPixels || 
             bottom < 0 || top > this.canvasHeightPixels);
}
```

### Spatial Grid Algorithm

```typescript
private buildSpatialGrid(): void {
    this.spatialGrid.clear();
    
    for (const circle of this.circles) {
        // Calculate grid cells this circle overlaps
        const left = Math.floor((centerXInPixels - radiusInPixels) / this.gridCellSize);
        const right = Math.floor((centerXInPixels + radiusInPixels) / this.gridCellSize);
        const top = Math.floor((centerYInPixels - radiusInPixels) / this.gridCellSize);
        const bottom = Math.floor((centerYInPixels + radiusInPixels) / this.gridCellSize);
        
        // Add circle to all overlapping cells
        for (let x = left; x <= right; x++) {
            for (let y = top; y <= bottom; y++) {
                const key = `${x},${y}`;
                if (!this.spatialGrid.has(key)) {
                    this.spatialGrid.set(key, []);
                }
                this.spatialGrid.get(key)!.push(circle);
            }
        }
    }
}
```

## Performance Considerations

### When to Use Each Strategy

| Dataset Size | Recommended Strategy | Reason |
|--------------|---------------------|---------|
| < 100 instances | No culling | Overhead not worth it |
| 100 - 1,000 instances | CPU frustum culling | Good balance of simplicity and performance |
| 1,000 - 10,000 instances | CPU frustum culling with margin | Handles moderate complexity |
| > 10,000 instances | Spatial partitioning | Scales better with large datasets |
| CPU bottleneck | GPU-side culling | Offloads work to GPU |

### Performance Metrics

```typescript
// Get culling statistics
const stats = this.getCullingStats();
console.log(`Culling: ${stats.culled}/${stats.total} instances (${stats.percentage.toFixed(1)}%)`);
```

### Optimization Tips

1. **Culling Margin**: Add margin to prevent popping artifacts
   ```typescript
   this.setCulling(true, 50); // 50px margin
   ```

2. **Grid Cell Size**: Balance between memory and performance
   ```typescript
   this.setSpatialPartitioning(true, 100); // 100px cells
   ```

3. **Batch Updates**: Re-filter only when necessary
   ```typescript
   // Only re-filter on scroll/zoom changes
   this.updateScrollOffset(device, newOffset);
   ```

4. **Memory Management**: Destroy buffers when not needed
   ```typescript
   this.instanceBuffer.destroy();
   ```

## Usage Examples

### Basic Culling
```typescript
// Enable culling with 50px margin
this.multiCirclePipeline.setCulling(true, 50);
```

### Spatial Partitioning for Large Datasets
```typescript
// Enable spatial partitioning with 100px cells
this.multiCirclePipeline.setSpatialPartitioning(true, 100);
```

### Performance Monitoring
```typescript
// Monitor culling effectiveness
const stats = this.multiCirclePipeline.getCullingStats();
console.log(`Rendering ${stats.visible}/${stats.total} instances`);
```

### Large Dataset Testing
```typescript
// Create 10,000 circles for testing
const largeDataset = this.createLargeDataset(10000);
this.multiCirclePipeline.setCircles(largeDataset);
```

## Tradeoffs Summary

| Strategy | CPU Cost | GPU Cost | Memory | Complexity | Best For |
|----------|----------|----------|---------|------------|----------|
| No Culling | None | High | High | Low | Small datasets |
| CPU Frustum | Medium | Low | Low | Medium | Medium datasets |
| Spatial Grid | Low | Low | Medium | High | Large datasets |
| GPU Culling | None | Medium | High | High | CPU bottleneck |

## Future Enhancements

1. **Hierarchical Culling**: Use quadtree/octree for 3D applications
2. **Occlusion Culling**: Skip instances hidden behind others
3. **LOD System**: Render fewer instances at distance
4. **Async Culling**: Use Web Workers for CPU culling
5. **Predictive Culling**: Pre-cull based on movement direction 