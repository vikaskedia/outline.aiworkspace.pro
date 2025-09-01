<template>
  <header class="app-header">
    <div v-if="isAuthenticated" class="header-content">
      <!-- Left side - Logo and Workspace -->
      <div class="header-left">
        <div class="logo-section">
          <div class="logo-icon">
            <span>AI</span>
          </div>
          <h1>AI Workspace</h1>
        </div>
      </div>

      <!-- Center - Navigation -->
      <div class="header-center">
        <nav class="main-navigation">
          <!-- Workspace selector -->
          <el-dropdown @command="handleNavCommand" trigger="hover">
            <span class="nav-item">
              {{ currentWorkspace?.title || 'Select Workspace' }}
              <el-icon class="nav-arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu class="workspace-tree-dropdown">
                <!-- All workspace option -->
                <el-dropdown-item command="all-workspace">
                  <a
                    class="workspace-dropdown-item workspace-dropdown-link"
                    :href="'https://all-ws-dashboard.aiworkspace.pro/all-workspace/dashboard'"
                    @click.prevent="() => { window.location.href = 'https://all-ws-dashboard.aiworkspace.pro/all-workspace/dashboard' }"
                  >
                    <span class="workspace-icon">🌐</span>
                    <span>All workspace</span>
                  </a>
                </el-dropdown-item>
                <el-dropdown-item v-if="flattenedWorkspaces.length > 0" divided disabled>
                  <!-- Divider -->
                </el-dropdown-item>
                <el-dropdown-item 
                  v-for="w in flattenedWorkspaces" 
                  :key="w.id"
                >
                  <a
                    class="workspace-dropdown-item workspace-dropdown-link"
                    :style="{ paddingLeft: (w.level * 16) + 'px' }"
                    :href="getWorkspaceHref(w)"
                    @click.prevent="() => switchWorkspace(w)"
                  >
                    <span class="workspace-icon">{{ w.children && w.children.length ? '📁' : '📄' }}</span>
                    <span>{{ w.title }}</span>
                    <el-tag v-if="w.id === currentWorkspace?.id" size="small" type="success">Current</el-tag>
                  </a>
                </el-dropdown-item>
                <el-dropdown-item v-if="flattenedWorkspaces.length === 0" disabled>
                  <span>No workspaces</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <span class="nav-divider">/</span>

          <!-- Static secondary navigation -->
          <el-dropdown trigger="hover">
            <span class="nav-item">
              {{ currentSectionLabel }}
              <el-icon class="nav-arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="item in secondaryNavItems" :key="item.label" :class="{ active: item.active }">
                    <a
                      class="nav-link"
                      :href="getSecondaryHref(item)"
                      @click.prevent="() => handleSecondaryNavClick(item)"
                    >
                      {{ item.label }}
                    </a>
                  </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </nav>
      </div>

      <!-- Right side - User info and notifications -->
      <div class="header-right">
        <!-- Notifications -->
        <!--div class="notification-icon">
          <el-badge :value="notificationCount" :hidden="notificationCount === 0">
            <el-icon size="20"><Bell /></el-icon>
          </el-badge>
        </div-->

        <!-- User Profile -->
        <el-dropdown @command="handleUserCommand" trigger="click" placement="bottom-end">
          <div class="user-profile">
            <div class="user-info">
              <span class="user-name">{{ userInfo.name }}</span>
            </div>
            <div class="user-avatar">
              <img v-if="userInfo.avatar" :src="userInfo.avatar" :alt="userInfo.name" />
              <span v-else class="avatar-placeholder">{{ userInfo.initials }}</span>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">Profile Settings</el-dropdown-item>
              <el-dropdown-item command="workspaces">Switch Workspace</el-dropdown-item>
              <el-dropdown-item divided command="logout">Sign Out</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <div v-else class="unauth-message">
      <div class="unauth-inner">
        <strong>Authentication required.</strong> Please log in to access the workspace.
      </div>
    </div>

    <!-- Workspace Switcher Modal -->
    <el-dialog 
      v-if="isAuthenticated"
      v-model="workspaceSwitcherVisible" 
      title="Switch Workspace" 
      width="500px"
      @close="workspaceSwitcherVisible = false"
    >
      <div class="workspace-list">
        <div 
          v-for="workspace in availableWorkspaces" 
          :key="workspace.id"
          class="workspace-item"
          :class="{ active: workspace.id === currentWorkspace?.id }"
          @click="switchWorkspace(workspace)"
        >
          <div class="workspace-icon">
            {{ workspace.icon || '📋' }}
          </div>
          <div class="workspace-details">
            <h3>{{ workspace.title }}</h3>
            <p>{{ workspace.description }}</p>
            <span class="workspace-members">{{ workspace.memberCount || 0 }} members</span>
          </div>
          <div v-if="workspace.id === currentWorkspace?.id" class="current-indicator">
            <el-icon><Check /></el-icon>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="workspaceSwitcherVisible = false">Cancel</el-button>
        <el-button type="primary" @click="createNewWorkspace">Create New Workspace</el-button>
      </template>
    </el-dialog>
  </header>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Bell, Check } from '@element-plus/icons-vue'
import { useWorkspaceStore } from '../store/workspace'
import { supabase } from '../supabase'

export default {
  name: 'AppHeader',
  components: {
    ArrowDown,
    Bell,
    Check
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const workspaceStore = useWorkspaceStore()
    
    const workspaceSwitcherVisible = ref(false)
    const notificationCount = ref(3)
    const availableWorkspaces = ref([])
    const assignedWorkspaces = ref([])
    const userInfo = ref({ name: '', email: '', avatar: null, initials: '' })
    const workspaceTree = ref([])
    const flattenedWorkspaces = ref([])
    const isAuthenticated = ref(false)

    const currentWorkspace = computed(() => workspaceStore.currentWorkspace)

    // Static secondary nav items 
    const secondaryNavItems = ref([
      { label: 'Dashboard', key: 'dashboard' },
      { label: 'Goals', key: 'goals' },
      { label: 'Tasks', key: 'tasks' },
      { label: 'Events', key: 'events' },
      { label: 'Drive', key: 'files' },
      { label: 'Outlines', key: 'outlines' },
      { label: 'Communications', key: 'communications' },
      { label: 'Canvas', key: 'canvas' },
      { label: 'AI Phone', key: 'ai_phone' },
      { label: 'AI Intake', key: 'ai_intake' },
      { label: 'AI Fax', key: 'ai_fax' },
      { label: 'AI Portfolios', key: 'ai-portfolios' },
      { label: 'AI Fund Analyst', key: 'ai_fund_analyst' },
      { label: 'Contacts', key: 'contacts' },
      { label: 'Settings', key: 'settings' }
    ])

    const currentSectionLabel = computed(() => {
      const path = route.path.toLowerCase()
      const match = secondaryNavItems.value.find(item => {
        return path.includes(item.key)
      })
      return match ? match.label : 'Outlines'
    })

    // Mark active item
    const updateActiveSecondary = () => {
      const path = route.path.toLowerCase()
      secondaryNavItems.value.forEach(item => {
        item.active = path.includes(item.key)
      })
    }

    watch(route, () => updateActiveSecondary())
    watch(currentWorkspace, () => updateActiveSecondary())

    // Load user info from Supabase session
    const loadUserInfo = async () => {
      // First check Supabase session (highest priority)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session && session.user) {
          const user = session.user
          const userData = {
            id: user.id,
            name: user.user_metadata?.name || user.user_metadata?.user_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email,
            avatar: user.user_metadata?.avatar_url || null,
            initials: (user.user_metadata?.name || user.email?.split('@')[0] || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2)
          }
          userInfo.value = userData
          workspaceStore.setUser(userData)
          isAuthenticated.value = true
          // Load other persisted data only after successful authentication
          workspaceStore.loadPersistedData()
          return
        }
      } catch (e) { console.error('Error getting Supabase session:', e) }

      // Second check login cookies
      const getCookie = (name) => { const value = `; ${document.cookie}`; const parts = value.split(`; ${name}=`); if (parts.length === 2) return parts.pop().split(';').shift(); return null }
      const userName = getCookie('user_name'); const userEmail = getCookie('user_email')
      if (userName || userEmail) {
        const userData = { name: userName || 'User', email: userEmail || 'user@example.com', avatar: null, initials: (userName || 'U').split(' ').map(n=>n[0]).join('').toUpperCase() }
        userInfo.value = { ...userInfo.value, ...userData }
        workspaceStore.setUser(userData)
        isAuthenticated.value = true
        // Load other persisted data only after successful authentication
        workspaceStore.loadPersistedData()
        return
      }

      // Last check localStorage (only load workspace data, not user data)
      const storedWorkspace = localStorage.getItem('current_workspace')
      const storedWorkspaces = localStorage.getItem('available_workspaces')
      if (storedWorkspace) {
        try { workspaceStore.currentWorkspace = JSON.parse(storedWorkspace) } catch (error) { console.error('Error loading persisted workspace:', error) }
      }
      if (storedWorkspaces) {
        try { workspaceStore.workspaces = JSON.parse(storedWorkspaces) } catch (error) { console.error('Error loading persisted workspaces:', error) }
      }

      // No valid authentication found, clear any persisted user info from localStorage
      workspaceStore.clearData()
      // Explicitly remove user_info from localStorage to ensure it's cleared
      localStorage.removeItem('user_info')
      // No demo user; remain unauthenticated
      isAuthenticated.value = false
    }

    // Helper: build tree from flat list
    const buildWorkspaceTree = (list) => {
      const nodeMap = new Map()
      list.forEach(w => {
        nodeMap.set(w.id, { ...w, children: [] })
      })
      const roots = []
      nodeMap.forEach(node => {
        if (node.parent_workspace_id && nodeMap.has(node.parent_workspace_id)) {
          nodeMap.get(node.parent_workspace_id).children.push(node)
        } else {
          roots.push(node)
        }
      })
      // Optional sort
      const sortNodes = (nodes) => {
        nodes.sort((a,b)=>a.title.localeCompare(b.title))
        nodes.forEach(n=> sortNodes(n.children))
      }
      sortNodes(roots)
      return roots
    }

    const flattenTree = (nodes, level = 0, acc = []) => {
      nodes.forEach(n => {
        acc.push({ ...n, level })
        if (n.children && n.children.length) flattenTree(n.children, level + 1, acc)
      })
      return acc
    }

    // Load hierarchical workspaces via store
    const loadWorkspaces = async () => {
      try {
        const list = await workspaceStore.loadWorkspaces()
        workspaceTree.value = buildWorkspaceTree(list)
        flattenedWorkspaces.value = flattenTree(workspaceTree.value)
        assignedWorkspaces.value = flattenedWorkspaces.value // keep old ref for modal logic
        availableWorkspaces.value = flattenedWorkspaces.value

        // Set current workspace from route if present
        const workspaceId = (route.params.workspace_id || route.params.workspaceId || '').toString()
        if (workspaceId) {
          const found = flattenedWorkspaces.value.find(w => w.id.toString() === workspaceId)
          if (found) {
            workspaceStore.setCurrentWorkspace(found)
          }
        } else if (!currentWorkspace.value && flattenedWorkspaces.value.length) {
          workspaceStore.setCurrentWorkspace(flattenedWorkspaces.value[0])
        }
      } catch (e) {
        console.error('loadWorkspaces (header) error', e)
      }
    }

    // Handle navigation commands
    const handleNavCommand = (command) => {
      console.log('Navigation command:', command)
      
      // Handle all workspace navigation
      if (command === 'all-workspace') {
        window.location.href = 'https://all-ws-dashboard.aiworkspace.pro/all-workspace/dashboard'
        return
      }
      
      // Handle workspace switching from assigned workspaces dropdown
      if (command.startsWith('workspace-')) {
        const workspaceId = command.replace('workspace-', '')
        const workspace = assignedWorkspaces.value.find(w => w.id === parseInt(workspaceId))
        if (workspace) {
          switchWorkspace(workspace)
        }
        return
      }
      
      switch (command) {
        case 'outlines-all':
          if (currentWorkspace.value) {
            router.push(`/single-workspace/${currentWorkspace.value.id}/outlines`)
          }
          break
        case 'outlines-recent':
          // Navigate to recent outlines
          ElMessage.info('Recent outlines feature coming soon')
          break
        case 'outlines-shared':
          // Navigate to shared outlines
          ElMessage.info('Shared outlines feature coming soon')
          break
      }
    }

    // Handle secondary navigation clicks
    const handleSecondaryNavClick = (item) => {
      const workspace = currentWorkspace.value
      
      switch (item.key) {
        case 'outlines':
          // Stay in current app for outlines
          if (workspace) {
            router.push(`/single-workspace/${workspace.id}/outlines`)
          } else {
            router.push('/outlines')
          }
          break

        case 'ai-portfolios':
          // Redirect to spreadsheet.aiworkspace.pro
          if (workspace) {
            const spreadsheetUrl = `https://spreadsheet.aiworkspace.pro/single-workspace/${workspace.id}/ai-portfolios`
            window.location.href = spreadsheetUrl
          } else {
            window.location.href = 'https://spreadsheet.aiworkspace.pro'
          }
          break
        
        case 'canvas':
          // Redirect to canvas.aiworkspace.pro
          if (workspace) {
            const canvasUrl = `https://canvas.aiworkspace.pro/single-workspace/${workspace.id}/canvas`
            window.location.href = canvasUrl
          } else {
            window.location.href = 'https://canvas.aiworkspace.pro'
          }
          break

        case 'files':
          // Redirect to files.aiworkspace.pro
          if (workspace) {
            const filesUrl = `https://drive.aiworkspace.pro/single-workspace/${workspace.id}/files`
            window.location.href = filesUrl
          } else {
            window.location.href = 'https://drive.aiworkspace.pro'
          }
          break

        case 'tasks':
          // Redirect to tasks.aiworkspace.pro
          if (workspace) {
            const tasksUrl = `https://tasks.aiworkspace.pro/single-workspace/${workspace.id}/tasks`
            window.location.href = tasksUrl
          } else {
            window.location.href = 'https://tasks.aiworkspace.pro'
          }
          break

        case 'dashboard':
          // Redirect to dashboard.aiworkspace.pro
          if (workspace) {
            const dashboardUrl = `https://single-ws-dashboard.aiworkspace.pro/single-workspace/${workspace.id}/dashboard`
            window.location.href = dashboardUrl
          } else {
            window.location.href = 'https://single-ws-dashboard.aiworkspace.pro'
          }
          break

        default:
          // Redirect to main app.aiworkspace.pro for all other items
          if (workspace) {
            const mainAppUrl = `https://app.aiworkspace.pro/single-workspace/${workspace.id}/${item.key}`
            window.location.href = mainAppUrl
          } else {
            const mainAppUrl = `https://app.aiworkspace.pro/${item.key}`
            window.location.href = mainAppUrl
          }
          break
      }
    }

    // Handle user menu commands
    const handleUserCommand = (command) => {
      switch (command) {
        case 'profile':
          ElMessage.info('Profile settings coming soon')
          break
        case 'workspaces':
          workspaceSwitcherVisible.value = true
          break
        case 'logout':
          handleLogout()
          break
      }
    }

    // Switch workspace
    const switchWorkspace = (workspace) => {
      workspaceStore.setCurrentWorkspace(workspace)
      workspaceSwitcherVisible.value = false
      
      // Navigate to the new workspace
      router.push(`/single-workspace/${workspace.id}/outlines`)
      
      ElMessage.success(`Switched to ${workspace.title}`)
    }

    // Create new workspace
    const createNewWorkspace = () => {
      ElMessageBox.prompt('Enter workspace name:', 'Create New Workspace', {
        confirmButtonText: 'Create',
        cancelButtonText: 'Cancel',
        inputPattern: /\S/,
        inputErrorMessage: 'Workspace name cannot be empty'
      }).then(({ value }) => {
        const newWorkspace = {
          id: Date.now().toString(),
          title: value,
          description: 'New workspace',
          icon: '📋',
          memberCount: 1
        }
        
        availableWorkspaces.value.push(newWorkspace)
        workspaceStore.setWorkspaces(availableWorkspaces.value)
        switchWorkspace(newWorkspace)
        
        ElMessage.success(`Created workspace: ${value}`)
      }).catch(() => {
        // User cancelled
      })
    }

    // Handle logout
    const handleLogout = () => {
      ElMessageBox.confirm(
        'Are you sure you want to sign out?',
        'Sign Out',
        {
          confirmButtonText: 'Sign Out',
          cancelButtonText: 'Cancel',
          type: 'warning'
        }
      ).then(() => {
        // Clear all data from store and localStorage
        workspaceStore.clearData()
        
        // Clear cookies (if any)
        document.cookie.split(";").forEach((c) => {
          const eqPos = c.indexOf("=")
          const name = eqPos > -1 ? c.substr(0, eqPos) : c
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"
        })
        
        // TODO: Call Supabase logout API
        
        ElMessage.success('Signed out successfully')
        router.push('/')
      }).catch(() => {
        // User cancelled
      })
    }

    // Helpers to provide hrefs for anchors in dropdowns
    const getWorkspaceHref = (w) => {
      // Use absolute app URL so opening in new tab goes to the right workspace
      return `https://outline.aiworkspace.pro/single-workspace/${w.id}/outlines`
    }

    const getSecondaryHref = (item) => {
      const workspace = currentWorkspace.value
      switch (item.key) {
        case 'ai-portfolios':
          return workspace ? `https://spreadsheet.aiworkspace.pro/single-workspace/${workspace.id}/ai-portfolios` : 'https://spreadsheet.aiworkspace.pro'
        case 'canvas':
          return workspace ? `https://canvas.aiworkspace.pro/single-workspace/${workspace.id}/canvas` : 'https://canvas.aiworkspace.pro'
        case 'files':
          return workspace ? `https://drive.aiworkspace.pro/single-workspace/${workspace.id}/files` : 'https://drive.aiworkspace.pro'
        case 'tasks':
          return workspace ? `https://tasks.aiworkspace.pro/single-workspace/${workspace.id}/tasks` : 'https://tasks.aiworkspace.pro'
        case 'dashboard':
          return workspace ? `https://single-ws-dashboard.aiworkspace.pro/single-workspace/${workspace.id}/dashboard` : 'https://single-ws-dashboard.aiworkspace.pro'
        default:
          return workspace ? `https://app.aiworkspace.pro/single-workspace/${workspace.id}/${item.key}` : `https://app.aiworkspace.pro/${item.key}`
      }
    }

    onMounted(async () => {
      await loadUserInfo()
      if (!isAuthenticated.value) return
      await loadWorkspaces()
      updateActiveSecondary()
    })

    // Watch for route changes to update current workspace
    watch(() => route.params.workspace_id, (newId) => {
      if (!isAuthenticated.value || !newId) return
      const w = flattenedWorkspaces.value.find(x => x.id.toString() === newId)
      if (w) workspaceStore.setCurrentWorkspace(w)
    })

    return { 
      isAuthenticated,
      currentWorkspace,
      workspaceSwitcherVisible,
      notificationCount,
      availableWorkspaces,
      assignedWorkspaces,
      userInfo,
      workspaceTree,
      flattenedWorkspaces,
      handleNavCommand,
      handleUserCommand,
      handleSecondaryNavClick,
      switchWorkspace,
      createNewWorkspace,
  getWorkspaceHref,
  getSecondaryHref,
      secondaryNavItems,
      currentSectionLabel
    }
  }
}
</script>

<style scoped>
.app-header {
  background: #ffffff;
  border-bottom: 1px solid #e1e5e9;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
  min-height: 60px;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 250px;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: #2c3e50;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 14px;
}

.workspace-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #2c3e50;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.main-navigation {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  color: #666;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-weight: 500;
}

.nav-item:hover {
  color: #2c3e50;
  background-color: #f8f9fa;
}

.nav-arrow {
  font-size: 12px;
  transition: transform 0.2s ease;
}

.nav-divider {
  color: #ccc;
  margin: 0 0.5rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 250px;
  justify-content: flex-end;
}

.notification-icon {
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  color: #666;
}

.notification-icon:hover {
  background-color: #f8f9fa;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.user-profile:hover {
  background-color: #f8f9fa;
}

.user-info {
  text-align: right;
}

.user-name {
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.9rem;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: #007bff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 500;
  font-size: 0.9rem;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  color: white;
}

/* Workspace Switcher Styles */
.workspace-list {
  max-height: 400px;
  overflow-y: auto;
}

.workspace-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border: 2px solid transparent;
}

.workspace-item:hover {
  background-color: #f8f9fa;
}

.workspace-item.active {
  background-color: #e3f2fd;
  border-color: #007bff;
}

.workspace-icon {
  font-size: 24px;
  width: 40px;
  text-align: center;
}

.workspace-details {
  flex: 1;
}

.workspace-details h3 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: #2c3e50;
}

.workspace-details p {
  margin: 0 0 4px 0;
  font-size: 0.85rem;
  color: #666;
}

.workspace-members {
  font-size: 0.8rem;
  color: #999;
}

.current-indicator {
  color: #007bff;
  font-size: 18px;
}

.workspace-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

/* Ensure anchor-based dropdown items keep the app's color and hover styles (not default blue link color) */
.workspace-dropdown-link {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-decoration: none;
  color: inherit;
  border-radius: 6px;
}
.workspace-dropdown-link:hover {
  background-color: #f8f9fa;
  color: #2c3e50;
}

.workspace-dropdown-item .workspace-icon {
  font-size: 16px;
}

/* Tree view specific styles */
.workspace-tree-dropdown {
  max-height: 400px;
  overflow-y: auto;
  min-width: 280px;
}

.workspace-dropdown-item { display:flex; align-items:center; gap:8px; }
.workspace-dropdown-item .workspace-icon { width:18px; text-align:center; }

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    padding: 0 1rem;
  }
  
  .header-left,
  .header-right {
    min-width: auto;
  }
  
  .workspace-title {
    font-size: 1.1rem;
  }
  
  .user-info {
    display: none;
  }
  
  .main-navigation {
    gap: 0.5rem;
  }
  
  .nav-item {
    padding: 6px 8px;
    font-size: 0.9rem;
  }
}

.nav-link { 
  display: block; 
  width: 100%; 
  text-decoration: none; 
  color: inherit; 
  cursor: pointer;
  padding: 0 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.nav-link:hover { 
  color: #2c3e50; 
  background-color: #f8f9fa;
}
.el-dropdown-menu .active > .nav-link { font-weight:600; }
/* Remove blue focus outline/border on dropdown triggers */
.nav-item:focus,
.nav-item:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
:deep(.el-dropdown .el-tooltip__trigger:focus),
:deep(.el-dropdown .el-tooltip__trigger:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}
:deep(.el-dropdown .el-tooltip__trigger) {
  box-shadow: none !important;
}

.unauth-message { display:flex; align-items:center; justify-content:center; height:60px; font-size:0.9rem; color:#c0392b; background:#fff5f5; border-bottom:1px solid #f2d7d5; }
.unauth-inner { max-width:1400px; width:100%; padding:0 2rem; }
</style>
