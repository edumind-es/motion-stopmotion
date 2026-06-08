export function getCanvasPointerPosition(canvas: HTMLCanvasElement, e: PointerEvent) {
  const rect = canvas.getBoundingClientRect()
  
  if (canvas.width === 0 || canvas.height === 0 || rect.width === 0 || rect.height === 0) {
    return { x: 0, y: 0 }
  }

  const cssAspect = rect.width / rect.height
  const canvasAspect = canvas.width / canvas.height
  
  let drawW = rect.width
  let drawH = rect.height
  let offsetX = 0
  let offsetY = 0

  if (canvasAspect > cssAspect) {
    // Canvas intrinsic is wider. 'cover' means it matches the height and crops the sides.
    drawH = rect.height
    drawW = rect.height * canvasAspect
    offsetX = (rect.width - drawW) / 2
  } else {
    // Canvas intrinsic is taller. 'cover' means it matches the width and crops the top/bottom.
    drawW = rect.width
    drawH = rect.width / canvasAspect
    offsetY = (rect.height - drawH) / 2
  }

  // Calculate actual normalized coordinates [0..1]
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left - offsetX) / drawW))
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top - offsetY) / drawH))

  return { x, y }
}
