import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useWorkspaceStore = defineStore('workspace', () => {
  const currentWorkspace = ref(null)
  const workspaces = ref([])
  const user = ref(null)

  const setCurrentWorkspace = (workspace) => {
    currentWorkspace.value = workspace
    // Store in localStorage for persistence
    localStorage.setItem('current_workspace', JSON.stringify(workspace))
  }

  const setWorkspaces = (newWorkspaces) => {
    workspaces.value = newWorkspaces
    localStorage.setItem('available_workspaces', JSON.stringify(newWorkspaces))
  }

  const setUser = (userData) => {
    user.value = userData
    localStorage.setItem('user_info', JSON.stringify(userData))
  }

  const loadPersistedData = () => {
    // Load current workspace
    const storedWorkspace = localStorage.getItem('current_workspace')
    if (storedWorkspace) {
      try {
        currentWorkspace.value = JSON.parse(storedWorkspace)
      } catch (error) {
        console.error('Error loading persisted workspace:', error)
      }
    }

    // Load available workspaces
    const storedWorkspaces = localStorage.getItem('available_workspaces')
    if (storedWorkspaces) {
      try {
        workspaces.value = JSON.parse(storedWorkspaces)
      } catch (error) {
        console.error('Error loading persisted workspaces:', error)
      }
    }

    // Load user info
    const storedUser = localStorage.getItem('user_info')
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser)
      } catch (error) {
        console.error('Error loading persisted user:', error)
      }
    }
  }

  const clearData = () => {
    currentWorkspace.value = null
    workspaces.value = []
    user.value = null
    localStorage.removeItem('current_workspace')
    localStorage.removeItem('available_workspaces')
    localStorage.removeItem('user_info')
  }

  return {
    currentWorkspace,
    workspaces,
    user,
    setCurrentWorkspace,
    setWorkspaces,
    setUser,
    loadPersistedData,
    clearData
  }
})
