<template>
  <div class="home">
    <div class="hero-section">
      <h1>Welcome to Outline Workspace Pro</h1>
      <p class="hero-description">
        A powerful, collaborative outline editor built with Vue 3 and Vite. 
        Create, organize, and share your ideas with hierarchical outlines, 
        real-time collaboration, and advanced features.
      </p>
      <div class="hero-actions">
        <el-button type="primary" size="large" @click="navigateToWorkspace">
          Start Working
        </el-button>
        <el-button size="large" @click="showWorkspaceSwitcher">
          Choose Workspace
        </el-button>
      </div>
    </div>

    <div class="features-section">
      <h2>Features</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">📝</div>
          <h3>Hierarchical Editing</h3>
          <p>Create nested outlines with unlimited depth. Indent and outdent with Tab/Shift+Tab.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔍</div>
          <h3>Powerful Search</h3>
          <p>Find any content instantly with real-time search and highlighting.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <h3>Focus Mode</h3>
          <p>Drill down into any section to focus on specific parts of your outline.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📱</div>
          <h3>Drag & Drop</h3>
          <p>Easily reorganize your outline by dragging items to new positions.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💬</div>
          <h3>Comments & Collaboration</h3>
          <p>Add comments to any outline item and collaborate with your team.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📷</div>
          <h3>File Attachments</h3>
          <p>Attach images and files directly to outline items with preview support.</p>
        </div>
      </div>
    </div>

    <div class="demo-info">
      <h3>Demo Information</h3>
      <p>
        This is a demonstration of the outline editing interface. 
        The data is stored locally in your browser and includes all the 
        advanced features from the original application including:
      </p>
      <ul>
        <li>Real-time collaborative editing interface</li>
        <li>Version history and conflict resolution</li>
        <li>Advanced keyboard shortcuts (Ctrl/Cmd+S to save, Ctrl/Cmd+F to search)</li>
        <li>Collapsible outline sections with state persistence</li>
        <li>Comment system for collaborative feedback</li>
        <li>File attachment and image preview capabilities</li>
      </ul>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '../store/workspace'
import { ElMessage } from 'element-plus'

export default {
  name: 'Home',
  setup() {
    const router = useRouter()
    const workspaceStore = useWorkspaceStore()

    const navigateToWorkspace = () => {
      // Navigate to the current workspace or default workspace
      const currentWorkspace = workspaceStore.currentWorkspace
      if (currentWorkspace) {
        router.push(`/single-workspace/${currentWorkspace.id}/outlines`)
      } else {
        // Default to workspace 9 if no current workspace
        router.push('/single-workspace/9/outlines')
      }
    }

    const showWorkspaceSwitcher = () => {
      // This would trigger the workspace switcher in the header
      // For now, just show a message
      ElMessage.info('Use the user menu in the header to switch workspaces')
    }

    return {
      navigateToWorkspace,
      showWorkspaceSwitcher
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.hero-section {
  text-align: center;
  margin-bottom: 4rem;
  padding: 2rem 0;
}

.hero-section h1 {
  font-size: 3rem;
  color: #2c3e50;
  margin-bottom: 1rem;
  font-weight: 700;
}

.hero-description {
  font-size: 1.2rem;
  color: #666;
  line-height: 1.6;
  max-width: 800px;
  margin: 0 auto 2rem auto;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.features-section {
  margin-bottom: 4rem;
}

.features-section h2 {
  text-align: center;
  font-size: 2.5rem;
  color: #2c3e50;
  margin-bottom: 2rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.feature-card p {
  color: #666;
  line-height: 1.6;
}

.demo-info {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #007bff;
}

.demo-info h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
}

.demo-info p {
  color: #666;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.demo-info ul {
  color: #666;
  line-height: 1.6;
  text-align: left;
}

.demo-info li {
  margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .home {
    padding: 1rem;
  }
  
  .hero-section h1 {
    font-size: 2rem;
  }
  
  .hero-description {
    font-size: 1.1rem;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .feature-card {
    padding: 1.5rem;
  }
}
</style>
