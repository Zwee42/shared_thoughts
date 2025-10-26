// Global variables
let thoughtInput, currentLayout = 'spiral';

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a board page
    if (window.boardId) {
        initBoard();
        initSettings();
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
    
    // Load saved layout preference
    const savedLayout = 'spiral';
    setLayout(savedLayout);
    
    // Load existing thoughts
    loadThoughts();
    
    // Auto-refresh thoughts every 30 seconds
    setInterval(loadThoughts, 500);
}

function initSettings() {
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsContent = document.getElementById('settings-content');
    const layoutRadios = document.querySelectorAll('input[name="layout"]');
    
    // Toggle settings panel
    settingsToggle.addEventListener('click', function() {
        settingsContent.classList.toggle('open');
    });
    
    // Close settings when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.settings-panel')) {
            settingsContent.classList.remove('open');
        }
    });
    
    // Layout change handlers
    layoutRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                setLayout(this.value);
                localStorage.setItem('thoughtLayout', this.value);
                repositionThoughts();
            }
        });
    });
    
    // Set initial radio state
    const savedLayout = localStorage.getItem('thoughtLayout') || 'spiral,';
    document.querySelector(`input[value="${savedLayout}"]`).checked = true;
}

function setLayout(layout) {
    currentLayout = layout;
    const thoughtBoard = document.getElementById('thought-board');
    
    // Remove existing layout classes
    thoughtBoard.classList.remove('grid-layout', 'spiral-layout');
    
    // Add new layout class
    thoughtBoard.classList.add(layout + '-layout');
}

function repositionThoughts() {
    const thoughts = document.querySelectorAll('.thought');
    
    if (currentLayout === 'spiral') {
        positionThoughtsInSpiral(thoughts);
    } else {
        // Grid layout doesn't need repositioning - CSS handles it
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
    
    if (content.length > 500) {
        alert('Thought is too long! Please keep it under 500 characters.');
        return;
    }
    
    // Disable submit button to prevent double submission
    const submitBtn = document.getElementById('submit-thought');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sharing...';
    
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
            // Add the new thought to the board
            addThoughtToBoard(data, true);
            // Clear the input field
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
        submitBtn.textContent = 'Share';
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

// Add some visual feedback when hovering over thoughts
document.addEventListener('mouseover', function(e) {
    if (e.target.closest('.thought')) {
        const thought = e.target.closest('.thought');
        // No special z-index handling needed with flexbox
    }
});

document.addEventListener('mouseout', function(e) {
    if (e.target.closest('.thought')) {
        const thought = e.target.closest('.thought');
        // No special z-index handling needed with flexbox
    }
});
