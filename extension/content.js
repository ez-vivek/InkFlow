let activeTool = 'none'; // 'none', 'laser', 'pencil', 'rect'
let drawingColor = '#ef4444';
let theme = 'light'; // 'light', 'dark'
let isDraggingToolbar = false;

// Laser State
let laserEl = null;

// Pencil/Rect State
let drawingCanvas = null;
let rc = null;
let isDrawing = false;
let currentPath = [];
let currentRect = null; // [x, y, width, height]
let allPaths = [];
let redoPaths = []; // for rectangle undo/redo
let pencilCursorEl = null;

function createLaser() {
  if (laserEl) return;
  laserEl = document.createElement('div');
  laserEl.className = 'presentation-laser-pointer';
  document.body.appendChild(laserEl);
}

function removeLaser() {
  if (laserEl) {
    laserEl.remove();
    laserEl = null;
  }
}

function getScrollDocumentSize() {
  return {
    width: Math.max(
      document.body.scrollWidth, document.documentElement.scrollWidth,
      document.body.offsetWidth, document.documentElement.offsetWidth,
      document.body.clientWidth, document.documentElement.clientWidth
    ),
    height: Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    )
  };
}

function createPencilCanvas() {
  if (drawingCanvas) return;
  drawingCanvas = document.createElement('canvas');
  drawingCanvas.className = 'presentation-drawing-canvas';
  
  const docSize = getScrollDocumentSize();
  drawingCanvas.width = docSize.width;
  drawingCanvas.height = docSize.height;
  document.body.appendChild(drawingCanvas);
  
  if (typeof rough !== 'undefined') {
    rc = rough.canvas(drawingCanvas);
  }
  
  pencilCursorEl = document.createElement('div');
  pencilCursorEl.className = 'presentation-pencil-cursor';
  pencilCursorEl.style.color = drawingColor;
  if (activeTool === 'rect') {
    pencilCursorEl.style.borderRadius = '4px';
  }
  document.body.appendChild(pencilCursorEl);

  window.addEventListener('resize', handleResize);
  document.addEventListener('mousedown', startDrawing);
  document.addEventListener('mouseup', stopDrawing);
}

function removePencilCanvas() {
  if (drawingCanvas) {
    drawingCanvas.remove();
    drawingCanvas = null;
  }
  if (pencilCursorEl) {
    pencilCursorEl.remove();
    pencilCursorEl = null;
  }
  rc = null;
  currentPath = [];
  currentRect = null;
  allPaths = [];
  redoPaths = [];
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('mousedown', startDrawing);
  document.removeEventListener('mouseup', stopDrawing);
}

function handleResize() {
  if (drawingCanvas) {
    const docSize = getScrollDocumentSize();
    drawingCanvas.width = docSize.width;
    drawingCanvas.height = docSize.height;
    redrawAll();
  }
}

// Distance calculation for smoother lines
function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
}

function startDrawing(e) {
  // Prevent drawing if clicking on the toolbar
  if (toolbarEl && toolbarEl.contains(e.target)) return;
  if ((activeTool !== 'pencil' && activeTool !== 'rect') || isDraggingToolbar) return;
  
  // Prevent text selection when drawing
  e.preventDefault();
  
  isDrawing = true;
  // Account for page scroll
  const x = e.clientX + window.scrollX;
  const y = e.clientY + window.scrollY;
  
  if (activeTool === 'pencil') {
    currentPath = [[x, y]];
  } else if (activeTool === 'rect') {
    currentRect = [x, y, 0, 0]; // x, y, width, height
  }
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  
  let addedPath = false;
  let pathObj = null;

  if (activeTool === 'pencil' && currentPath.length > 1) {
    pathObj = {
      type: 'pencil',
      points: [...currentPath],
      color: drawingColor,
      timestamp: Date.now()
    };
    addedPath = true;
  } else if (activeTool === 'rect' && currentRect && (Math.abs(currentRect[2]) > 5 || Math.abs(currentRect[3]) > 5)) {
    pathObj = {
      type: 'rect',
      rect: [...currentRect],
      color: drawingColor,
      timestamp: Date.now()
    };
    addedPath = true;
  }

  if (addedPath) {
    if (pathObj.type === 'rect') {
      redoPaths = []; // clear redo history when a new rect is drawn
    }
    allPaths.push(pathObj);
    // Auto-remove after 30 seconds
    setTimeout(() => {
      allPaths = allPaths.filter(p => p !== pathObj);
      redrawAll();
    }, 30000);
  }
  
  currentPath = [];
  currentRect = null;
  redrawAll();
}

function undoRect() {
  // Find the last rect in allPaths
  for (let i = allPaths.length - 1; i >= 0; i--) {
    if (allPaths[i].type === 'rect') {
      const rectPath = allPaths.splice(i, 1)[0];
      redoPaths.push(rectPath);
      redrawAll();
      break;
    }
  }
}

function redoRect() {
  if (redoPaths.length > 0) {
    const rectPath = redoPaths.pop();
    rectPath.timestamp = Date.now(); // reset timestamp so it doesn't immediately vanish
    allPaths.push(rectPath);
    
    // Set up auto-remove timeout for redone path
    setTimeout(() => {
      allPaths = allPaths.filter(p => p !== rectPath);
      redrawAll();
    }, 30000);
    
    redrawAll();
  }
}

function redrawAll() {
  if (!drawingCanvas || !rc) return;
  const ctx = drawingCanvas.getContext('2d');
  ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  
  const now = Date.now();
  
  // Draw stored paths
  allPaths.forEach(path => {
    // Fade out effect in the last 2 seconds
    const age = now - path.timestamp;
    let opacity = 1;
    if (age > 28000) {
      opacity = Math.max(0, 1 - ((age - 28000) / 2000));
    }
    
    if (opacity > 0) {
      ctx.globalAlpha = opacity;
      if (path.type === 'pencil' && path.points.length > 1) {
        rc.curve(path.points, {
          stroke: path.color,
          strokeWidth: 6,
          roughness: 0.3,
          bowing: 0.3,
          seed: path.timestamp
        });
      } else if (path.type === 'rect') {
        const [x, y, w, h] = path.rect;
        // Normalize rect coordinates for drawing
        const drawX = w < 0 ? x + w : x;
        const drawY = h < 0 ? y + h : y;
        const drawW = Math.abs(w);
        const drawH = Math.abs(h);
        rc.rectangle(drawX, drawY, drawW, drawH, {
          stroke: path.color,
          strokeWidth: 6,
          roughness: 0.5,
          bowing: 0,
          seed: path.timestamp
        });
      }
      ctx.globalAlpha = 1;
    }
  });

  // Draw current
  if (isDrawing) {
    if (activeTool === 'pencil' && currentPath.length > 1) {
      rc.curve(currentPath, {
        stroke: drawingColor,
        strokeWidth: 6,
        roughness: 0.3,
        bowing: 0.3,
        seed: 1
      });
    } else if (activeTool === 'rect' && currentRect) {
      const [x, y, w, h] = currentRect;
      const drawX = w < 0 ? x + w : x;
      const drawY = h < 0 ? y + h : y;
      const drawW = Math.abs(w);
      const drawH = Math.abs(h);
      rc.rectangle(drawX, drawY, drawW, drawH, {
        stroke: drawingColor,
        strokeWidth: 6,
        roughness: 0.5,
        bowing: 0,
        seed: 1
      });
    }
  }
  
  // Continuously request animation frame if there are paths to animate fade out
  if (allPaths.length > 0) {
    requestAnimationFrame(redrawAll);
  }
}

function onMouseMove(e) {
  if (activeTool === 'none' || isDraggingToolbar) return;
  
  if (activeTool === 'laser' && laserEl) {
    laserEl.style.left = e.clientX + 'px';
    laserEl.style.top = e.clientY + 'px';
  } else if (activeTool === 'pencil' || activeTool === 'rect') {
    if (pencilCursorEl) {
      pencilCursorEl.style.left = e.clientX + 'px';
      pencilCursorEl.style.top = e.clientY + 'px';
    }
    
    if (isDrawing) {
      // Prevent text selection
      e.preventDefault();
      
      const newX = e.clientX + window.scrollX;
      const newY = e.clientY + window.scrollY;
      
      if (activeTool === 'pencil') {
        const lastPoint = currentPath[currentPath.length - 1];
        if (getDistance(lastPoint, [newX, newY]) > 2) {
          currentPath.push([newX, newY]);
          redrawAll();
        }
      } else if (activeTool === 'rect') {
        currentRect[2] = newX - currentRect[0];
        currentRect[3] = newY - currentRect[1];
        redrawAll();
      }
    }
  }
}

// Floating Toolbar Setup
let toolbarEl = null;

// SVGs inline for perfect cross-site visibility without CDN/CORS issues
const SVGS = {
  grip: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0M7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0M7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg>`,
  mouse: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z"/></svg>`,
  laser: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>`,
  rect: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1"/></svg>`,
  undo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/></svg>`,
  redo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278z"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>`
};



function createToolbar() {
  if (toolbarEl) return;
  
  // Use HTML template to create toolbar
  toolbarEl = createElementFromHTML(HTML_TEMPLATES.toolbar);
  
  // Setup drag handle
  const dragHandle = toolbarEl.querySelector('.presentation-toolbar-drag');
  setupDraggable(toolbarEl, dragHandle);
  
  // Setup tool buttons
  const toolBtns = toolbarEl.querySelectorAll('[data-tool]');
  toolBtns.forEach(btn => {
    btn.onclick = () => setTool(btn.dataset.tool);
  });
  
  // Setup color buttons
  const colorBtns = toolbarEl.querySelectorAll('[data-color]');
  colorBtns.forEach(btn => {
    btn.onclick = () => {
      drawingColor = btn.dataset.color;
      if (pencilCursorEl) pencilCursorEl.style.color = drawingColor;
      updateToolbarState();
    };
  });
  
  // Setup undo/redo buttons
  toolbarEl.querySelector('#presentation-undo-btn').onclick = () => undoRect();
  toolbarEl.querySelector('#presentation-redo-btn').onclick = () => redoRect();
  

  
  // Setup theme button
  const themeBtn = toolbarEl.querySelector('#presentation-theme-btn');
  themeBtn.onclick = () => {
    theme = theme === 'light' ? 'dark' : 'light';
    if (theme === 'dark') {
      toolbarEl.classList.add('dark-theme');
      document.body.classList.add('presentation-dark-mode');
      // Update SVG to sun
      themeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/></svg>`;
    } else {
      toolbarEl.classList.remove('dark-theme');
      document.body.classList.remove('presentation-dark-mode');
      // Update SVG to moon
      themeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278z"/></svg>`;
    }
  };
  
  document.body.appendChild(toolbarEl);
  updateToolbarState();
}

function updateToolbarState() {
  if (!toolbarEl) return;
  
  // Update tool buttons based on activeTool
  const toolBtns = toolbarEl.querySelectorAll('[data-tool]');
  toolBtns.forEach(btn => {
    if (btn.dataset.tool === activeTool) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update color buttons based on drawingColor
  const colorBtns = toolbarEl.querySelectorAll('[data-color]');
  colorBtns.forEach(btn => {
    const btnColor = btn.dataset.color;
    if (btnColor === drawingColor || rgbToHex(btn.style.backgroundColor) === drawingColor) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (pencilCursorEl) {
    if (activeTool === 'rect') {
      pencilCursorEl.style.borderRadius = '4px';
    } else {
      pencilCursorEl.style.borderRadius = '50%';
    }
  }
}

function rgbToHex(rgb) {
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return rgb;
  function hex(x) {
    return ("0" + parseInt(x).toString(16)).slice(-2);
  }
  return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
}

function setupDraggable(element, handle) {
  let initialMouseX, initialMouseY;
  let initialElementX, initialElementY;

  handle.addEventListener("mousedown", dragStart);
  document.addEventListener("mouseup", dragEnd);
  document.addEventListener("mousemove", drag);

  function dragStart(e) {
    if (e.target === handle || handle.contains(e.target)) {
      isDraggingToolbar = true;
      element.classList.add('dragging');
      
      const rect = element.getBoundingClientRect();
      initialMouseX = e.clientX;
      initialMouseY = e.clientY;
      initialElementX = rect.left;
      initialElementY = rect.top;
      
      // Fix the position to left/top to avoid layout shifts when dragging starts
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.transform = 'none';
      element.style.left = initialElementX + 'px';
      element.style.top = initialElementY + 'px';
      
      // If we were drawing, cancel it
      if (isDrawing) {
        stopDrawing();
      }
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function dragEnd(e) {
    if (isDraggingToolbar) {
      element.classList.remove('dragging');
      // Delay setting isDraggingToolbar to false slightly so the mouseup event 
      // from dragging doesn't immediately trigger a draw action if releasing 
      // over the canvas.
      setTimeout(() => {
        isDraggingToolbar = false;
      }, 50);
    }
  }

  function drag(e) {
    if (isDraggingToolbar) {
      e.preventDefault();
      const dx = e.clientX - initialMouseX;
      const dy = e.clientY - initialMouseY;
      
      element.style.left = (initialElementX + dx) + 'px';
      element.style.top = (initialElementY + dy) + 'px';
    }
  }
}

function setTool(tool) {
  // Clean up old tool
  if (activeTool === 'laser') {
    document.body.classList.remove('laser-active');
    removeLaser();
  } else if (activeTool === 'pencil' || activeTool === 'rect') {
    document.body.classList.remove('pencil-active');
    removePencilCanvas();
  }
  
  if (activeTool !== 'none' && tool === 'none') {
    document.removeEventListener('mousemove', onMouseMove);
  }

  activeTool = tool;
  updateToolbarState();

  // Setup new tool
  if (tool === 'laser') {
    document.body.classList.add('laser-active');
    createLaser();
  } else if (tool === 'pencil' || tool === 'rect') {
    document.body.classList.add('pencil-active');
    createPencilCanvas();
  }
  
  if (tool !== 'none') {
    document.addEventListener('mousemove', onMouseMove, { passive: false });
  }
}

// Ensure toolbar is created when content script loads
createToolbar();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setTool") {
    setTool(request.tool);
    sendResponse({activeTool: activeTool});
  } else if (request.action === "setColor") {
    drawingColor = request.color;
    if (pencilCursorEl) {
      pencilCursorEl.style.color = drawingColor;
    }
    sendResponse({success: true});
  } else if (request.action === "getState") {
    sendResponse({activeTool: activeTool, color: drawingColor});
  }
  return true;
});