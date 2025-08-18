import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'

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

  // New: load workspaces with hierarchy and access info
  const loadWorkspaces = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return []

      // Assigned workspaces (shared)
      const { data: assigned } = await supabase
        .from('workspace_access')
        .select(`
          workspace_id,
          access_type,
          workspaces (
            id, title, description, parent_workspace_id, created_by
          )
        `)
        .eq('shared_with_user_id', authUser.id)

      // Owned workspaces
      const { data: owned } = await supabase
        .from('workspaces')
        .select('id, title, description, parent_workspace_id, created_by')
        .eq('created_by', authUser.id)

      const map = new Map()

      ;(assigned || []).forEach(row => {
        if (!row.workspaces) return
        const w = row.workspaces
        map.set(w.id, {
          id: w.id,
          title: w.title,
            description: w.description || 'No description',
          parent_workspace_id: w.parent_workspace_id,
          created_by: w.created_by,
          hasAccess: true,
          accessType: row.access_type
        })
      })

      ;(owned || []).forEach(w => {
        map.set(w.id, {
          id: w.id,
          title: w.title,
          description: w.description || 'No description',
          parent_workspace_id: w.parent_workspace_id,
          created_by: w.created_by,
          hasAccess: true,
          accessType: 'edit'
        })
      })

      const list = Array.from(map.values())
        .sort((a,b) => a.title.localeCompare(b.title))

      setWorkspaces(list)
      return list
    } catch (e) {
      console.error('loadWorkspaces error', e)
      return []
    }
  }

  return {
    currentWorkspace,
    workspaces,
    user,
    setCurrentWorkspace,
    setWorkspaces,
    setUser,
    loadPersistedData,
    clearData,
    loadWorkspaces
  }
})
