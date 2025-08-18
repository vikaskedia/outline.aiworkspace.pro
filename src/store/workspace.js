import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../supabase'

export const useWorkspaceStore = defineStore('workspace', () => {
  const currentWorkspace = ref(null)
  const workspaces = ref([])
  const user = ref(null)

  const setCurrentWorkspace = (workspace) => {
    currentWorkspace.value = workspace
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
    const storedWorkspace = localStorage.getItem('current_workspace')
    if (storedWorkspace) {
      try { currentWorkspace.value = JSON.parse(storedWorkspace) } catch (error) { console.error('Error loading persisted workspace:', error) }
    }
    const storedWorkspaces = localStorage.getItem('available_workspaces')
    if (storedWorkspaces) {
      try { workspaces.value = JSON.parse(storedWorkspaces) } catch (error) { console.error('Error loading persisted workspaces:', error) }
    }
    const storedUser = localStorage.getItem('user_info')
    if (storedUser) {
      try { user.value = JSON.parse(storedUser) } catch (error) { console.error('Error loading persisted user:', error) }
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

  // Updated: load workspaces with access + parent chain similar to old app
  const loadWorkspaces = async (includeArchived = false) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return []

      let query = supabase
        .from('workspaces')
        .select(`
          id, title, description, parent_workspace_id, created_by, archived, created_at,
          workspace_access!inner ( access_type, shared_with_user_id ),
          workspace_activities!left ( updated_at )
        `)
        .eq('workspace_access.shared_with_user_id', authUser.id)

      if (!includeArchived) query = query.eq('archived', false)

      const { data: userWorkspaces, error: userError } = await query
      if (userError) throw userError

      // Build access map
      const userAccess = new Map()
      ;(userWorkspaces || []).forEach(w => {
        ;(w.workspace_access || []).forEach(acc => {
          if (acc.shared_with_user_id === authUser.id) {
            userAccess.set(w.id, acc)
          }
        })
      })

      // Collect parent IDs missing
      const parentIds = [...new Set(
        (userWorkspaces || [])
          .filter(w => w.parent_workspace_id)
          .map(w => w.parent_workspace_id)
          .filter(pid => !userAccess.has(pid))
      )]

      let parentWorkspaces = []
      if (parentIds.length) {
        let parentQuery = supabase
          .from('workspaces')
          .select('id, title, description, parent_workspace_id, created_by, archived, created_at')
          .in('id', parentIds)
        if (!includeArchived) parentQuery = parentQuery.eq('archived', false)
        const { data: parents, error: parentError } = await parentQuery
        if (parentError) throw parentError
        parentWorkspaces = parents || []
      }

      const combined = [...(userWorkspaces || []), ...parentWorkspaces]

      const processed = combined.map(w => ({
        id: w.id,
        title: w.title,
        description: w.description || 'No description',
        parent_workspace_id: w.parent_workspace_id,
        created_by: w.created_by,
        archived: w.archived,
        created_at: w.created_at,
        latest_activity: w.workspace_activities?.[0]?.updated_at || w.created_at,
        hasAccess: userAccess.has(w.id),
        accessType: userAccess.get(w.id)?.access_type || null
      }))

      processed.sort((a, b) => new Date(b.latest_activity) - new Date(a.latest_activity))

      setWorkspaces(processed)
      return processed
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
