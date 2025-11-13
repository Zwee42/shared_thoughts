// Global variables
const defaultLayout = "list";
let thoughtInput, currentLayout = defaultLayout, socket;

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
    
    // Submit on Enter (Shift+Enter for new line)
    thoughtInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitThought();
        }
    });
    
    // Auto-resize textarea as user types
    thoughtInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
    
    // Get layout from URL parameter, default to spiral
    const urlParams = new URLSearchParams(window.location.search);
    const layoutParam = urlParams.get('layout');
    const selectedLayout = layoutParam || defaultLayout; // === 'list' ? 'list' : 'spiral';
    setLayout(selectedLayout);
    
    // Load existing thoughts
    loadThoughts();
}

function initWebSocket() {
    // Initialize Socket.IO connection
    socket = io();
    
    socket.emit('join_board', { board_id: window.boardId });
    
    socket.on('new_thought', function(thought) {
        addThoughtToBoard(thought, true);
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
    thoughtBoard.classList.remove('grid-layout', 'spiral-layout', 'list-layout');
    
    // Add new layout class
    thoughtBoard.classList.add(layout + '-layout');
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
        
        const position = findNextSpiralPosition(placedThoughts, centerX, centerY, i, thoughtWidth, thoughtHeight);
        
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
    const minDistance = 15; // Minimum space between thoughts
    
    // Start close to center and spiral outward using golden angle
    let radius = 60 + (index * 12);
    let angle = index * 2.399; // Golden angle in radians (137.5 degrees)
    let attempts = 0;
    const maxAttempts = 40;
    
    while (attempts < maxAttempts) {
        // Convert polar to cartesian
        const x = centerX + (radius * Math.cos(angle)) - (thoughtWidth / 2);
        const y = centerY + (radius * Math.sin(angle)) - (thoughtHeight / 2);
        
        // Check bounds
        if (x < 10 || y < 10 || x + thoughtWidth > centerX * 2 - 10 || y + thoughtHeight > centerY * 2 - 10) {
            angle += 0.3;
            if (angle > 2 * Math.PI) {
                angle = 0;
                radius += 15;
            }
            attempts++;
            continue;
        }
        
        // Check for overlaps with existing thoughts
        let overlaps = false;
        for (let placed of placedThoughts) {
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
                rotation: Math.sin(angle) * 3 // Subtle rotation based on angle
            };
        }
        
        // If overlap, try next position
        angle += 0.4;
        if (angle > 2 * Math.PI) {
            angle = 0;
            radius += 18;
        }
        attempts++;
    }
    
    // Fallback - place at increasing radius
    const fallbackAngle = index * 2.399;
    const fallbackRadius = 60 + (index * 20);
    return {
        x: centerX + (fallbackRadius * Math.cos(fallbackAngle)) - (thoughtWidth / 2),
        y: centerY + (fallbackRadius * Math.sin(fallbackAngle)) - (thoughtHeight / 2),
        rotation: Math.sin(fallbackAngle) * 3
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
        
        // Reposition if in spiral mode
        if (currentLayout === 'spiral') {
                repositionThoughts();
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

// Cleanup when leaving the page
window.addEventListener('beforeunload', function() {
    if (socket && window.boardId) {
        socket.emit('leave_board', { board_id: window.boardId });
    }
});
