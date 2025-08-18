# Outline Workspace Pro

A sophisticated Vue 3 application built with Vite for collaborative outline editing and workspace management. This application replicates the advanced features of a professional outline editing tool with real-time collaboration capabilities.

## ✨ Features

### Core Outline Editing
- **Hierarchical Structure**: Create nested outlines with unlimited depth
- **Drag & Drop**: Reorganize items by dragging them to new positions
- **Keyboard Shortcuts**: 
  - Tab/Shift+Tab for indent/outdent
  - Enter to create new items
  - Backspace on empty items to delete
  - Ctrl/Cmd+S to save
  - Ctrl/Cmd+F to search

### Advanced Features
- **Focus Mode**: Drill down into specific sections with breadcrumb navigation
- **Real-time Search**: Find content instantly with highlighting
- **Collapsible Sections**: Expand/collapse outline sections with state persistence
- **Comments System**: Add collaborative comments to any outline item
- **File Attachments**: Attach and preview images and files
- **Version History**: Track changes and view previous versions
- **Auto-save**: Automatic saving with conflict resolution
- **Responsive Design**: Works seamlessly on desktop and mobile

### Collaboration Features
- **Version Conflict Detection**: Handles concurrent editing gracefully
- **Real-time Updates**: See changes as they happen (simulated in demo)
- **Workspace Management**: Multiple isolated workspaces
- **Activity Tracking**: Monitor workspace usage and changes

## 🚀 Technology Stack

- **Vue 3** with Composition API
- **Vite** for fast development and building
- **Element Plus** for professional UI components
- **Vue Router** for dynamic routing with workspace parameters
- **Pinia** for state management
- **Supabase** integration ready (configured but not connected in demo)

## 📁 Project Structure

```
src/
├── main.js                    # Application entry point
├── App.vue                    # Root component with navigation
├── supabase.js               # Database configuration
├── style.css                 # Global styles
├── components/
│   └── single-workspace/
│       ├── OutlinePointsCt.vue    # Individual outline item component
│       └── dragState.js           # Drag & drop state management
├── router/
│   └── index.js              # Vue Router configuration
├── store/
│   └── workspace.js          # Workspace state management
├── utils/
│   ├── workspaceActivity.js  # Activity tracking utilities
│   └── page-title.js         # Page title management
└── views/
    ├── Home.vue              # Landing page with feature overview
    └── Outlines.vue          # Main outline editing interface
```

## 🛣️ Routes

- `/` - Home page with feature overview and workspace navigation
- `/single-workspace/:workspace_id/outlines` - Dynamic workspace outline editor

## 🎮 Demo URLs

- Home: `http://localhost:81/`
- Workspace 9: `http://localhost:81/single-workspace/9/outlines`
- Workspace 1: `http://localhost:81/single-workspace/1/outlines`
- Workspace 5: `http://localhost:81/single-workspace/5/outlines`

## 💻 Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎯 Usage Guide

### Basic Editing
1. Click on any bullet point to start editing
2. Press Enter to create a new item
3. Use Tab to indent, Shift+Tab to outdent
4. Drag items to reorder them

### Advanced Features
- **Search**: Use the search box or Ctrl/Cmd+F to find content
- **Focus Mode**: Click the arrow icon or "Focus on this" to drill down
- **Comments**: Use the three-dot menu to add comments
- **Collapse**: Click the arrow next to items with children to collapse/expand
- **History**: Click the "History" button to view version history

### Keyboard Shortcuts
- `Ctrl/Cmd + S` - Save outline
- `Ctrl/Cmd + F` - Focus search box
- `Tab` - Indent current item
- `Shift + Tab` - Outdent current item
- `Enter` - Create new sibling item
- `Backspace` - Delete empty item

## 🔧 Configuration

The application is configured to run on port 80 by default (falls back to 81 if 80 is in use). You can modify this in `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 80,
    host: true
  }
})
```

## 📦 Dependencies

### Core Dependencies
- `vue` - Vue.js framework
- `vue-router` - Official router for Vue.js
- `pinia` - State management
- `element-plus` - Vue 3 component library
- `@element-plus/icons-vue` - Icon components
- `@supabase/supabase-js` - Database client

### Development Dependencies
- `vite` - Build tool and dev server
- `@vitejs/plugin-vue` - Vue support for Vite

## 🎨 UI/UX Features

- **Professional Design**: Clean, modern interface inspired by leading outline tools
- **Responsive Layout**: Optimized for both desktop and mobile devices
- **Accessibility**: Keyboard navigation and focus management
- **Visual Feedback**: Hover effects, loading states, and status indicators
- **Consistent Theming**: Professional color scheme and typography

## 🚧 Demo Limitations

This is a demo version with the following characteristics:
- Data is stored in browser localStorage (no server persistence)
- Supabase integration is configured but not active
- Real-time collaboration is simulated
- File uploads are simulated (no actual storage)

## 🔮 Production Ready Features

The codebase includes infrastructure for:
- Real-time collaborative editing with Supabase
- File upload and storage
- User authentication and permissions
- Workspace sharing and collaboration
- Advanced version control and conflict resolution

This implementation demonstrates a production-ready outline editing application with all the sophisticated features expected in a professional tool.
