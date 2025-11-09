// Global variables
let thoughtInput, currentLayout = 'spiral', socket;

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a board page
    if (window.boardId) {
        initBoard();
        initWebSocket();
    }
});

function initBoard() {
    // Get input elements
    thoughtInput = document.getElementById('thought-input');
    
    // Event listeners
    document.getElementById('submit-thought').addEventListener('click', submitThought);
    
    // Submit on Enter
    thoughtInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitThought();
        }
    });
    
    // Get layout from URL parameter, default to spiral
    const urlParams = new URLSearchParams(window.location.search);
    const layoutParam = urlParams.get('layout');
    const allowed = ['list', 'cloud', 'force'];
    const selectedLayout = allowed.includes(layoutParam) ? layoutParam : 'spiral';
    setLayout(selectedLayout);
    
    // Load existing thoughts
    loadThoughts();
}

function initWebSocket() {
    // Initialize Socket.IO connection
    socket = io();
    
    socket.emit('join_board', { board_id: window.boardId });
    
    socket.on('new_thought', function(thought) {
        // For D3-powered layouts, reload all thoughts to re-render the visualization
        if (currentLayout === 'cloud' || currentLayout === 'force') {
            loadThoughts();
        } else {
            addThoughtToBoard(thought, true);
        }
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
    });
    
    // Handle reconnection
    socket.on('connect', function() {
        console.log('Connected to server');
        // Rejoin the board room on reconnect
        socket.emit('join_board', { board_id: window.boardId });
    });
}

function setLayout(layout) {
    currentLayout = layout;
    const thoughtBoard = document.getElementById('thought-board');
    
    // Remove existing layout classes
    thoughtBoard.classList.remove('grid-layout', 'spiral-layout', 'list-layout', 'cloud-layout', 'force-layout');

    // Add new layout class
    thoughtBoard.classList.add(layout + '-layout');

    // Clear any existing D3 visualizations when switching layouts
    clearVisualization();
}

function clearVisualization() {
    const thoughtBoard = document.getElementById('thought-board');
    // Remove any SVG or canvas added by D3
    const svgs = thoughtBoard.querySelectorAll('svg');
    svgs.forEach(s => s.remove());
    // Remove any absolute-positioned inline styles on children
    thoughtBoard.querySelectorAll('.thought').forEach(t => {
        t.style.left = '';
        t.style.top = '';
        t.style.transform = '';
    });
}

function repositionThoughts() {
    const thoughts = document.querySelectorAll('.thought');
    
    if (currentLayout === 'spiral') {
        positionThoughtsInSpiral(thoughts);
    } else {
        // Grid and list layouts don't need repositioning - CSS handles it
        thoughts.forEach(thought => {
            thought.style.left = '';
            thought.style.top = '';
            thought.style.transform = '';
        });
    }
}

function positionThoughtsInSpiral(thoughts) {
    const board = document.getElementById('thought-board');
    const boardRect = board.getBoundingClientRect();
    const centerX = boardRect.width / 2;
    const centerY = boardRect.height / 2;
    
    // NOTE: removed automatic pre-checks — allow spiral placement for all sizes
    // Place first thought at center
    if (thoughts.length === 0) return;
    
    // Get actual dimensions after rendering
    const placedThoughts = [];
    
    // Position first thought at center
    const firstThought = thoughts[0];
    firstThought.style.left = '0px';
    firstThought.style.top = '0px';
    firstThought.style.transform = 'rotate(0deg)';
    
    // Force a layout to get actual dimensions
    const firstRect = firstThought.getBoundingClientRect();
    const firstWidth = firstRect.width;
    const firstHeight = firstRect.height;
    
    firstThought.style.left = (centerX - firstWidth / 2) + 'px';
    firstThought.style.top = (centerY - firstHeight / 2) + 'px';
    
    placedThoughts.push({
        x: centerX - firstWidth / 2,
        y: centerY - firstHeight / 2,
        width: firstWidth,
        height: firstHeight
    });
    
    // For subsequent thoughts, build outward avoiding overlaps
    for (let i = 1; i < thoughts.length; i++) {
        const thought = thoughts[i];
        
        // Get actual dimensions
        thought.style.left = '0px';
        thought.style.top = '0px';
        const thoughtRect = thought.getBoundingClientRect();
        const thoughtWidth = thoughtRect.width;
        const thoughtHeight = thoughtRect.height;
        
        // No bail-out for large boxes; attempt to place all items in spiral

        const position = findNextSpiralPosition(placedThoughts, centerX, centerY, i, thoughtWidth, thoughtHeight);

        // Place at the computed position (findNextSpiralPosition always returns a position)
        thought.style.left = position.x + 'px';
        thought.style.top = position.y + 'px';
        thought.style.transform = `rotate(${position.rotation}deg)`;

        // Add to placed thoughts for collision detection
        placedThoughts.push({
            x: position.x,
            y: position.y,
            width: thoughtWidth,
            height: thoughtHeight
        });
    }
}

function findNextSpiralPosition(placedThoughts, centerX, centerY, index, thoughtWidth, thoughtHeight) {
    const minDistance = 20; // Minimum space between thoughts
    const goldenAngle = 2.399963229728653; // More precise golden angle (137.5 degrees)
    
    // Average size for consistent spacing calculation
    const avgSize = 80; // Approximate average thought size
    const thoughtSize = Math.sqrt(thoughtWidth * thoughtHeight);
    
    // Use square root growth but with controlled parameters
    const startRadius = 60;
    const spacing = 30; // Pixels between each "ring"
    let radius = startRadius + (Math.sqrt(index) * spacing);
    let angle = index * goldenAngle;
    
    let attempts = 0;
    const maxAttempts = 5000; // allow many attempts to find non-overlapping positions
    let radiusIncrement = spacing * 0.5;
    
    while (attempts < maxAttempts) {
        // Convert polar to cartesian
        const x = centerX + (radius * Math.cos(angle)) - (thoughtWidth / 2);
        const y = centerY + (radius * Math.sin(angle)) - (thoughtHeight / 2);
        
        // Check bounds with some padding
        const padding = 10;
        const boardWidth = centerX * 2;
        const boardHeight = centerY * 2;
        
        if (x < padding || y < padding || 
            x + thoughtWidth > boardWidth - padding || 
            y + thoughtHeight > boardHeight - padding) {
            // Try next angle position before increasing radius
            angle += goldenAngle * 0.5;
            attempts++;
            
            // If we've tried many angles, increase radius
            if (attempts % 15 === 0) {
                radius += radiusIncrement;
            }
            continue;
        }
        
        // Check for overlaps with existing thoughts - check actual box boundaries
        let overlaps = false;
        for (let placed of placedThoughts) {
            const dx = (x + thoughtWidth / 2) - (placed.x + placed.width / 2);
            const dy = (y + thoughtHeight / 2) - (placed.y + placed.height / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minRequired = (Math.max(thoughtWidth, thoughtHeight) + Math.max(placed.width, placed.height)) / 2 + minDistance;
            
            // Also check rectangle overlap
            if (x < placed.x + placed.width + minDistance &&
                x + thoughtWidth + minDistance > placed.x &&
                y < placed.y + placed.height + minDistance &&
                y + thoughtHeight + minDistance > placed.y) {
                overlaps = true;
                break;
            }
        }
        
        if (!overlaps) {
            return {
                x: x,
                y: y,
                rotation: Math.sin(angle) * 2 // Subtle rotation based on angle
            };
        }
        
        // If overlap, try next position in the spiral
        angle += goldenAngle * 0.2;
        
        // Increase radius more gradually when finding overlaps
        if (attempts % 8 === 0) {
            radius += radiusIncrement;
        }
        
        attempts++;
    }
    
    // If we reached here, return a fallback position on the spiral so item is placed
    const fallbackRadius = startRadius + (Math.sqrt(index + 10) * spacing);
    const fallbackAngle = index * goldenAngle;
    return {
        x: centerX + (fallbackRadius * Math.cos(fallbackAngle)) - (thoughtWidth / 2),
        y: centerY + (fallbackRadius * Math.sin(fallbackAngle)) - (thoughtHeight / 2),
        rotation: Math.sin(fallbackAngle) * 2
    };
}

function submitThought() {
    const content = thoughtInput.value.trim();
    
    if (!content) {
        return; // Just don't submit if empty
    }
    
    // Disable submit button to prevent double submission
    const submitBtn = document.getElementById('submit-thought');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    
    // Parse texts if it's a JSON string
    const texts = typeof window.texts === 'string' ? JSON.parse(window.texts) : window.texts;
    console.log('Parsed texts:', texts);
    submitBtn.textContent = texts && texts.submitting_button ? texts.submitting_button : 'Sharing...';
        console.log('Submitting thought:', content);
        console.log('Submitting button text:', submitBtn.textContent);
    fetch('/add_thought', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            board_id: window.boardId,
            content: content
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            // Clear the input field - thought will be added via WebSocket
            thoughtInput.value = '';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to add thought. Please try again.');
    })
    .finally(() => {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    });
}

function loadThoughts() {
    fetch(`/get_thoughts/${window.boardId}`)
    .then(response => response.json())
    .then(thoughts => {
        const thoughtBoard = document.getElementById('thought-board');
        // Clear existing thoughts
        thoughtBoard.innerHTML = '';
        
        // Add each thought to the board
        thoughts.forEach(thought => {
            addThoughtToBoard(thought, false);
        });
        
        // Layout-specific handling
        if (currentLayout === 'spiral') {
            repositionThoughts();
        } else if (currentLayout === 'cloud') {
            renderD3Cloud(thoughts);
        } else if (currentLayout === 'force') {
            renderForceLayout(thoughts);
        }
    })
    .catch(error => {
        console.error('Error loading thoughts:', error);
    });
}

function addThoughtToBoard(thought, isNew = false) {
    const thoughtBoard = document.getElementById('thought-board');
    const thoughtElement = document.createElement('div');
    thoughtElement.className = 'thought' + (isNew ? ' new' : '');
    thoughtElement.style.backgroundColor = thought.color;
    
    thoughtElement.innerHTML = `
        <div class="thought-content">${escapeHtml(thought.content)}</div>
    `;
    
    thoughtBoard.appendChild(thoughtElement);
    
    // If in spiral mode, reposition all thoughts
    if (currentLayout === 'spiral') {
        repositionThoughts();
    }
    
    if (isNew) {
            thoughtElement.classList.remove('new');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render a simple D3 cloud using d3-cloud. This uses truncated text and sizes by content length.
function renderD3Cloud(thoughts) {
    const thoughtBoard = document.getElementById('thought-board');
    clearVisualization();

    const width = thoughtBoard.clientWidth || 800;
    const height = Math.max(400, thoughtBoard.clientHeight || 600);

    // Prepare words: use full content for labels and size proportionally to length
    const words = thoughts.map(t => {
        const label = t.content;
        // size proportional to length (no hard upper cap)
        const size = Math.max(10, Math.round(label.length / 3));
        return { text: label, size: size, id: t.id };
    });

    const svg = d3.select('#thought-board').append('svg')
        .attr('width', width)
        .attr('height', height);

    const layout = d3.layout.cloud()
        .size([width, height])
        .words(words)
        .padding(6)
        .rotate(() => 0)
        .font('Impact')
        .fontSize(d => d.size)
        .on('end', draw)
        .start();

    function draw(words) {
        svg.append('g')
            .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
            .selectAll('text')
            .data(words)
            .enter().append('text')
            .style('font-family', 'Impact')
            .style('font-size', d => d.size + 'px')
            .style('fill', (d, i) => 'hsl(' + (i * 30 % 360) + ',70%,60%)')
            .attr('text-anchor', 'middle')
            .attr('transform', d => 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')')
            .text(d => d.text);
    }
}

// Render a force-directed layout using d3-force. Nodes sized by content length; collision prevents overlap.
function renderForceLayout(thoughts) {
    const thoughtBoard = document.getElementById('thought-board');
    clearVisualization();
    console.log("Rendering force layout with thoughts:", thoughts);

    const width = thoughtBoard.clientWidth || 900;
    const height = Math.max(500, thoughtBoard.clientHeight || 700);

    const nodes = thoughts.map(t => {
        const label = t.content; // use full content
        // radius proportional to label length (no hard upper cap)
        const radius = Math.max(8, Math.round(label.length / 4));
        return { id: t.id, label: label, radius: radius, color: t.color };
    });

    const svg = d3.select('#thought-board').append('svg')
        .attr('width', width)
        .attr('height', height);

    const node = svg.selectAll('g')
        .data(nodes)
        .enter().append('g')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    node.append('circle')
        .attr('r', d => d.radius)
        .attr('fill', d => d.color || '#ffc')
        .attr('stroke', '#333');

    node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .style('font-size', d => Math.min(14, Math.max(10, d.radius / 3)) + 'px')
        .text(d => d.label);

    const simulation = d3.forceSimulation(nodes)
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('charge', d3.forceManyBody().strength(-30))
        .force('collision', d3.forceCollide().radius(d => d.radius + 6).iterations(2))
        .on('tick', ticked);

    function ticked() {
        node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
    }

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

// Cleanup when leaving the page
window.addEventListener('beforeunload', function() {
    if (socket && window.boardId) {
        socket.emit('leave_board', { board_id: window.boardId });
    }
});
