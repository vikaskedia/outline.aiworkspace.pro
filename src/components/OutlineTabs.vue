<template>
  <div class="outline-tabs-container">
    <!-- Tab Navigation -->
    <div class="tabs-header">
      <div class="tabs-nav">
        <!-- Tabs Container -->
        <div class="tabs-container">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-item"
            :class="{ active: activeTabId === tab.id }"
            @click="switchTab(tab.id)"
            @contextmenu.prevent="openTabContextMenu($event, tab)"
          >
            <!-- Tab Title (editable) -->
            <div
              v-if="!tab.editing"
              class="tab-title"
              @dblclick="startEditTab(tab)"
            >
              {{ tab.title }}
            </div>
            <el-input
              v-else
              ref="tabInput"
              v-model="tab.editTitle"
              class="tab-input"
              size="small"
              @blur="finishEditTab(tab)"
              @keydown.enter="finishEditTab(tab)"
              @keydown.esc="cancelEditTab(tab)"
            />
            
            <!-- Close Button -->
            <el-icon
              v-if="tabs.length > 1"
              class="tab-close"
              @click.stop="confirmDeleteTab(tab)"
            >
              <Close />
            </el-icon>
          </div>
        </div>
        
        <!-- Add New Tab Button -->
        <div class="tab-add" @click="showCreateTabDialog">
          <el-icon><Plus /></el-icon>
        </div>
      </div>
    </div>

    <!-- Tab Context Menu -->
    <el-dropdown
      ref="tabContextMenu"
      class="tab-context-menu"
      trigger="manual"
      :teleported="false"
      @command="handleTabCommand"
    >
      <div></div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="rename">
            <el-icon><Edit /></el-icon>
            Rename Tab
          </el-dropdown-item>
          <el-dropdown-item command="duplicate">
            <el-icon><DocumentCopy /></el-icon>
            Duplicate Tab
          </el-dropdown-item>
          <el-dropdown-item divided command="move-left" :disabled="!canMoveLeft">
            <el-icon><ArrowLeft /></el-icon>
            Move Left
          </el-dropdown-item>
          <el-dropdown-item command="move-right" :disabled="!canMoveRight">
            <el-icon><ArrowRight /></el-icon>
            Move Right
          </el-dropdown-item>
          <el-dropdown-item v-if="tabs.length > 1" divided command="delete">
            <el-icon><Delete /></el-icon>
            Delete Tab
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- Create New Tab Dialog -->
    <el-dialog v-model="createTabDialogVisible" title="Create New Tab" width="400px">
      <div class="create-tab-dialog">
        <el-form @submit.prevent="createNewTab">
          <el-form-item label="Tab Name">
            <el-input
              ref="tabNameInput"
              v-model="newTabName"
              placeholder="Enter tab name..."
              maxlength="50"
              show-word-limit
              @keydown.enter="createNewTab"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createTabDialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="createNewTab" :disabled="!newTabName.trim()">
            Create Tab
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Loading State -->
    <div v-if="loading" class="tab-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      Loading tabs...
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="tab-error">
      <el-icon><Warning /></el-icon>
      {{ error }}
      <el-button size="small" @click="loadTabs">Retry</el-button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Close, Edit, Delete, DocumentCopy, ArrowLeft, ArrowRight, Loading, Warning } from '@element-plus/icons-vue'
import { supabase } from '../supabase'

export default {
  name: 'OutlineTabs',
  components: { Plus, Close, Edit, Delete, DocumentCopy, ArrowLeft, ArrowRight, Loading, Warning },
  props: {
    workspaceId: {
      type: String,
      required: true
    },
    activeTabId: {
      type: [String, Number],
      default: null
    },
    userInfo: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['tab-changed', 'tab-created', 'tab-deleted', 'tab-updated'],
  setup(props, { emit }) {
    const tabs = ref([])
    const loading = ref(false)
    const error = ref(null)
    const contextMenuTab = ref(null)
    const tabContextMenu = ref(null)
    const tabInput = ref(null)
    const createTabDialogVisible = ref(false)
    const newTabName = ref('')
    const tabNameInput = ref(null)

    const canMoveLeft = computed(() => {
      if (!contextMenuTab.value) return false
      const index = tabs.value.findIndex(t => t.id === contextMenuTab.value.id)
      return index > 0
    })

    const canMoveRight = computed(() => {
      if (!contextMenuTab.value) return false
      const index = tabs.value.findIndex(t => t.id === contextMenuTab.value.id)
      return index < tabs.value.length - 1
    })

    // Load all outline tabs for the workspace
    const loadTabs = async () => {
      if (!props.workspaceId) return
      
      loading.value = true
      error.value = null
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          error.value = 'Not authenticated'
          return
        }

        const { data: outlines, error: outlineError } = await supabase
          .from('outlines')
          .select('id, title, tab_order, is_default, created_at')
          .eq('workspace_id', props.workspaceId)
          .not('title', 'like', 'Task_%')
          .order('tab_order', { ascending: true })

        if (outlineError) {
          throw outlineError
        }

        if (outlines && outlines.length > 0) {
          tabs.value = outlines.map(outline => ({
            id: outline.id,
            title: outline.title,
            tabOrder: outline.tab_order,
            isDefault: outline.is_default,
            createdAt: outline.created_at,
            editing: false,
            editTitle: outline.title
          }))
        } else {
          // No tabs exist, create the first default tab
          await createDefaultTab()
        }
      } catch (err) {
        console.error('Error loading tabs:', err)
        error.value = 'Failed to load tabs'
      } finally {
        loading.value = false
      }
    }

    // Create the first default tab
    const createDefaultTab = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const defaultOutline = [
          {
            id: 1,
            text: 'Welcome to your outline workspace!',
            children: [
              {
                id: 2,
                text: 'Click on any bullet point to start editing',
                children: []
              },
              {
                id: 3,
                text: 'Use Tab to indent, Shift+Tab to outdent',
                children: []
              }
            ]
          },
          {
            id: 4,
            text: 'Drag and drop to reorganize items',
            children: []
          },
          {
            id: 5,
            text: 'Use the search box to find specific content',
            children: []
          }
        ]

        const { data: created, error: createErr } = await supabase
          .from('outlines')
          .insert([{
            workspace_id: props.workspaceId,
            title: 'Main Outline',
            content: defaultOutline,
            tab_order: 0,
            is_default: true,
            created_by: user.id
          }])
          .select('id, title, tab_order, is_default, created_at')
          .single()

        if (createErr) throw createErr

        const newTab = {
          id: created.id,
          title: created.title,
          tabOrder: created.tab_order,
          isDefault: created.is_default,
          createdAt: created.created_at,
          editing: false,
          editTitle: created.title
        }

        tabs.value = [newTab]
        emit('tab-created', newTab)
        return newTab
      } catch (err) {
        console.error('Error creating default tab:', err)
        throw err
      }
    }

    // Switch to a different tab
    const switchTab = (tabId) => {
      const tab = tabs.value.find(t => t.id === tabId)
      if (tab) {
        emit('tab-changed', tab)
      }
    }

    // Show create tab dialog
    const showCreateTabDialog = () => {
      newTabName.value = ''
      createTabDialogVisible.value = true
      nextTick(() => {
        if (tabNameInput.value) {
          tabNameInput.value.focus()
        }
      })
    }

    // Create a new outline tab with default content
    const createNewTab = async () => {
      if (!newTabName.value.trim()) {
        ElMessage.warning('Please enter a tab name')
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          ElMessage.error('Authentication required')
          return
        }

        const nextOrder = Math.max(...tabs.value.map(t => t.tabOrder), -1) + 1
        
        // Default content for new tabs
        const baseId = Date.now()
        const defaultContent = [
          {
            id: baseId + 1,
            text: 'Welcome to your new outline!',
            children: [
              {
                id: baseId + 2,
                text: 'Start adding your content here',
                children: []
              },
              {
                id: baseId + 3,
                text: 'Use Tab to indent, Shift+Tab to outdent',
                children: []
              }
            ]
          },
          {
            id: baseId + 4,
            text: 'Click on any bullet point to start editing',
            children: []
          }
        ]

        const { data: created, error: createErr } = await supabase
          .from('outlines')
          .insert([{
            workspace_id: props.workspaceId,
            title: newTabName.value.trim(),
            content: defaultContent,
            tab_order: nextOrder,
            is_default: false,
            created_by: user.id
          }])
          .select('id, title, tab_order, is_default, created_at')
          .single()

        if (createErr) throw createErr

        const newTab = {
          id: created.id,
          title: created.title,
          tabOrder: created.tab_order,
          isDefault: created.is_default,
          createdAt: created.created_at,
          editing: false,
          editTitle: created.title
        }

        tabs.value.push(newTab)
        emit('tab-created', newTab)
        switchTab(newTab.id)
        
        // Close dialog and reset form
        createTabDialogVisible.value = false
        newTabName.value = ''

        ElMessage.success('New tab created')
      } catch (err) {
        console.error('Error creating new tab:', err)
        ElMessage.error('Failed to create new tab')
      }
    }

    // Start editing tab title
    const startEditTab = (tab) => {
      tab.editing = true
      tab.editTitle = tab.title
      nextTick(() => {
        const input = tabInput.value?.[0]?.input || tabInput.value?.input
        if (input) {
          input.focus()
          input.select()
        }
      })
    }

    // Finish editing tab title
    const finishEditTab = async (tab) => {
      if (!tab.editTitle || !tab.editTitle.trim()) {
        cancelEditTab(tab)
        return
      }

      try {
        const newTitle = tab.editTitle.trim()
        
        const { error: updateErr } = await supabase
          .from('outlines')
          .update({ title: newTitle })
          .eq('id', tab.id)

        if (updateErr) throw updateErr

        tab.title = newTitle
        tab.editing = false
        emit('tab-updated', tab)

        ElMessage.success('Tab renamed')
      } catch (err) {
        console.error('Error updating tab title:', err)
        ElMessage.error('Failed to rename tab')
        cancelEditTab(tab)
      }
    }

    // Cancel editing tab title
    const cancelEditTab = (tab) => {
      tab.editing = false
      tab.editTitle = tab.title
    }

    // Open tab context menu
    const openTabContextMenu = (event, tab) => {
      contextMenuTab.value = tab
      // Element Plus dropdown manual trigger is complex, using a simple approach
      setTimeout(() => {
        if (tabContextMenu.value) {
          tabContextMenu.value.handleOpen()
        }
      }, 100)
    }

    // Handle tab context menu commands
    const handleTabCommand = async (command) => {
      if (!contextMenuTab.value) return

      try {
        switch (command) {
          case 'rename':
            startEditTab(contextMenuTab.value)
            break
          case 'duplicate':
            await duplicateTab(contextMenuTab.value)
            break
          case 'move-left':
            await moveTab(contextMenuTab.value, 'left')
            break
          case 'move-right':
            await moveTab(contextMenuTab.value, 'right')
            break
          case 'delete':
            await confirmDeleteTab(contextMenuTab.value)
            break
        }
      } finally {
        contextMenuTab.value = null
      }
    }

    // Duplicate a tab
    const duplicateTab = async (tab) => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // Get the full outline content
        const { data: originalOutline, error: fetchErr } = await supabase
          .from('outlines')
          .select('content')
          .eq('id', tab.id)
          .single()

        if (fetchErr) throw fetchErr

        const nextOrder = Math.max(...tabs.value.map(t => t.tabOrder), -1) + 1
        const newTitle = `${tab.title} (Copy)`

        const { data: created, error: createErr } = await supabase
          .from('outlines')
          .insert([{
            workspace_id: props.workspaceId,
            title: newTitle,
            content: originalOutline.content,
            tab_order: nextOrder,
            is_default: false,
            created_by: user.id
          }])
          .select('id, title, tab_order, is_default, created_at')
          .single()

        if (createErr) throw createErr

        const newTab = {
          id: created.id,
          title: created.title,
          tabOrder: created.tab_order,
          isDefault: created.is_default,
          createdAt: created.created_at,
          editing: false,
          editTitle: created.title
        }

        tabs.value.push(newTab)
        emit('tab-created', newTab)

        ElMessage.success('Tab duplicated')
      } catch (err) {
        console.error('Error duplicating tab:', err)
        ElMessage.error('Failed to duplicate tab')
      }
    }

    // Move tab left or right
    const moveTab = async (tab, direction) => {
      const currentIndex = tabs.value.findIndex(t => t.id === tab.id)
      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
      
      if (targetIndex < 0 || targetIndex >= tabs.value.length) return

      try {
        const targetTab = tabs.value[targetIndex]
        
        // Swap tab orders
        const { error: updateErr1 } = await supabase
          .from('outlines')
          .update({ tab_order: targetTab.tabOrder })
          .eq('id', tab.id)

        const { error: updateErr2 } = await supabase
          .from('outlines')
          .update({ tab_order: tab.tabOrder })
          .eq('id', targetTab.id)

        if (updateErr1 || updateErr2) {
          throw updateErr1 || updateErr2
        }

        // Update local state
        const tempOrder = tab.tabOrder
        tab.tabOrder = targetTab.tabOrder
        targetTab.tabOrder = tempOrder

        // Re-sort tabs
        tabs.value.sort((a, b) => a.tabOrder - b.tabOrder)

        ElMessage.success('Tab moved')
      } catch (err) {
        console.error('Error moving tab:', err)
        ElMessage.error('Failed to move tab')
      }
    }

    // Confirm and delete a tab
    const confirmDeleteTab = async (tab) => {
      if (tabs.value.length <= 1) {
        ElMessage.warning('Cannot delete the last tab')
        return
      }

      try {
        await ElMessageBox.confirm(
          `Delete "${tab.title}"? This action cannot be undone.`,
          'Confirm Delete',
          {
            type: 'warning',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
          }
        )

        await deleteTab(tab)
      } catch (err) {
        // User cancelled
      }
    }

    // Delete a tab
    const deleteTab = async (tab) => {
      try {
        const { error: deleteErr } = await supabase
          .from('outlines')
          .delete()
          .eq('id', tab.id)

        if (deleteErr) throw deleteErr

        const index = tabs.value.findIndex(t => t.id === tab.id)
        tabs.value.splice(index, 1)

        emit('tab-deleted', tab)

        // Switch to another tab if this was the active one
        if (props.activeTabId === tab.id && tabs.value.length > 0) {
          const newActiveTab = tabs.value[Math.max(0, index - 1)]
          switchTab(newActiveTab.id)
        }

        ElMessage.success('Tab deleted')
      } catch (err) {
        console.error('Error deleting tab:', err)
        ElMessage.error('Failed to delete tab')
      }
    }

    // Watch for workspace changes
    watch(() => props.workspaceId, (newId) => {
      if (newId) {
        loadTabs()
      }
    }, { immediate: true })

    onMounted(() => {
      if (props.workspaceId) {
        loadTabs()
      }
    })

    return {
      tabs,
      loading,
      error,
      contextMenuTab,
      tabContextMenu,
      tabInput,
      createTabDialogVisible,
      newTabName,
      tabNameInput,
      canMoveLeft,
      canMoveRight,
      loadTabs,
      switchTab,
      showCreateTabDialog,
      createNewTab,
      startEditTab,
      finishEditTab,
      cancelEditTab,
      openTabContextMenu,
      handleTabCommand,
      confirmDeleteTab
    }
  }
}
</script>

<style scoped>
.outline-tabs-container {
  width: 100%;
  background: white;
  border-bottom: 1px solid #e4e7ed;
}

.tabs-header {
  padding: 0 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e4e7ed;
}

.tabs-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  justify-content: space-between;
}

.tabs-container {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  min-width: 80px;
  max-width: 180px;
  position: relative;
  font-size: 13px;
}

.tab-item:hover {
  background: #f5f7fa;
  border-color: #c0c4cc;
  transform: translateY(-1px);
}

.tab-item.active {
  background: white;
  border-color: #1976d2;
  border-bottom: 2px solid white;
  margin-bottom: -2px;
  z-index: 1;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.tab-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.tab-input {
  flex: 1;
  min-width: 80px;
}

.tab-input :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none;
  padding: 2px 4px;
  font-size: 14px;
}

.tab-close {
  font-size: 12px;
  color: #909399;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 1px;
  border-radius: 2px;
  opacity: 0.7;
}

.tab-close:hover {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
  opacity: 1;
  transform: scale(1.1);
}

.tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #606266;
  font-size: 1.4rem;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.tab-add:hover {
  color: #1976d2;
  background: rgba(25, 118, 210, 0.1);
  transform: scale(1.1);
}

.tab-loading,
.tab-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: #606266;
  font-size: 12px;
}

.tab-error {
  color: #f56c6c;
}

.tab-context-menu {
  display: none;
}

/* Create Tab Dialog */
.create-tab-dialog {
  padding: 8px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Responsive design */
@media (max-width: 768px) {
  .tabs-nav {
    padding: 2px 0;
  }
  
  .tab-item {
    padding: 5px 8px;
    min-width: 60px;
    max-width: 120px;
    font-size: 12px;
  }
  
  .tab-add {
    width: 20px;
    height: 20px;
    font-size: 1.2rem;
  }

  .tabs-header {
    padding: 0 0.5rem;
  }
}
</style>
