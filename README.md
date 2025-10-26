# Shared Thoughts

An anonymous thought-sharing web application where people can post thoughts on different boards.

## Features

-  Anonymous thought sharing
-  Separate boards for different topics (e.g., `/abc`, `/my-thoughts`)
-  Visual thought map with colorful sticky notes
-  Responsive design for mobile and desktop
-  Real-time updates (auto-refresh every 30 seconds)
-  SQLite database for persistence

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open your browser and go to `http://localhost:5000`

## Usage

- Navigate to any URL like `/abc` or `/my-thoughts` to create a unique thought board
- Click "Add Thought" to share anonymous thoughts
- Each board maintains its own collection of thoughts

## Technical Details

- **Backend**: Flask (Python)
- **Database**: SQLite
- **Frontend**: HTML, CSS, JavaScript
- **Features**: Real-time updates, responsive design, thought positioning