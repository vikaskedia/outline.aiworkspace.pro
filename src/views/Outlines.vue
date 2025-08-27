<template>
  <!-- Not authenticated message (shown immediately before auth check completes) -->
  <div v-if="!isAuthenticated && authCheckDone" class="not-auth-message">
    <h2>Sign in required</h2>
    <p>Please log in to view and edit this workspace outline.</p>
    <p>
      <a href="https://login.aiworkspace.pro" rel="noopener" class="login-link">
        Sign in at login.aiworkspace.pro
      </a>
    </p>
  </div>
  <div v-else-if="!authCheckDone" class="not-auth-message">
    <h2>Loading...</h2>
    <p>Checking your session.</p>
  </div>

  <!-- Outline content only when authenticated -->
  <div v-else class="outline-container">
    <!-- Outline Tabs -->
    <OutlineTabs
      :workspace-id="workspaceId"
      :active-tab-id="currentOutlineId"
      :user-info="userInfo"
      @tab-changed="handleTabChanged"
      @tab-created="handleTabCreated"
      @tab-deleted="handleTabDeleted"
      @tab-updated="handleTabUpdated"
    />
    
    <!-- Breadcrumbs -->
    <div v-if="breadcrumbPath.length" class="outline-breadcrumbs">
      <template v-for="(node, idx) in breadcrumbPath" :key="node.id">
        <a
          v-if="idx < breadcrumbPath.length - 1"
          class="breadcrumb-link"
          :href="breadcrumbHref(node, idx)"
        >
          {{ getBreadcrumbText(node.text) }}
        </a>
        <span 
          v-else
          style="font-weight: bold; color: #23272f;"
        >
          {{ getBreadcrumbText(node.text) }}
        </span>
        <span v-if="idx < breadcrumbPath.length - 1"> > </span>
      </template>
    </div>

    <!-- Header with actions and search -->
    <div class="outline-header-wrapper">
      <div class="outline-header">
      <div class="outline-actions">
        <!-- Search -->
        <div class="search-container">
          <el-input
            v-model="searchQuery"
            placeholder="Search outline..."
            :prefix-icon="Search"
            size="small"
            style="width: 200px;"
            class="search-input"
            clearable
          />
          <div v-if="searchQuery && searchStats.items > 0" class="search-stats">
            {{ searchStats.matches }} matches in {{ searchStats.items }} items
          </div>
        </div>

        <!-- Back button for drilldown -->
        <el-button 
          v-if="focusedId"
          @click="handleBack"
          :icon="Back"
          size="small"
        >
          Back
        </el-button>

        <!-- Manual refresh -->
        <el-button 
          @click="manualRefresh"
          :icon="Refresh"
          :loading="refreshing"
          size="small"
        >
          {{ refreshing ? 'Syncing...' : 'Sync' }}
        </el-button>

        <!-- Version history -->
        <el-button 
          @click="openHistoryDialog"
          :icon="Clock"
          size="small"
        >
          History
        </el-button>
      </div>

      <div class="sync-status">
        <span v-if="saving" style="color: #f39c12;">
          <el-icon class="is-loading"><Loading /></el-icon>
          Saving...
        </span>
        <span v-else-if="hasChanges" style="color: #e67e22;">
          <el-icon><Warning /></el-icon>
          Unsaved changes
        </span>
        <span v-else-if="lastSaveTime" style="color: #27ae60;">
          <el-icon><Check /></el-icon>
          Synced {{ formatDate(lastSaveTime) }}
        </span>
        <span style="color: #7f8c8d; margin-left: 10px;">
          <el-tag 
            type="success" 
            size="small"
            effect="light"
          >
            v{{ displayVersion }}
          </el-tag>
        </span>
      </div>
    </div>
    </div>

    <!-- Version History Dialog -->
    <el-dialog v-model="historyDialogVisible" title="Outline Version History" width="900px">
      <div class="history-dialog-content">
        <!-- Version table when no comparison is active -->
        <el-table 
          v-if="!showDiff" 
          :data="versionHistory" 
          style="width: 100%" 
          v-loading="loadingHistory"
          @row-click="compareWithPrevious"
          class="version-table"
        >
          <el-table-column prop="version" label="Version" width="80" />
          <el-table-column prop="created_at" label="Date" width="160" :formatter="(row) => formatDate(row.created_at)" />
          <el-table-column prop="comment" label="Summary" />
          <el-table-column fixed="right" label="Actions" width="120">
            <template #default="{ row }">
              <el-button @click.stop="viewVersion(row)" size="small">View</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- Diff view when comparison is active -->
        <div v-if="showDiff" class="diff-view-container">
          <div class="diff-header-bar">
            <span class="diff-title">
              Comparing v{{ selectedOldVersion }} → v{{ selectedNewVersion }}
            </span>
            <el-button @click="closeDiff" size="small" type="text">
              <el-icon><Close /></el-icon>
              Back to List
            </el-button>
          </div>
          <OutlineDiff 
            :old-version="getVersionByNumber(selectedOldVersion)"
            :new-version="getVersionByNumber(selectedNewVersion)"
          />
        </div>
      </div>

      <template #footer>
        <div class="history-dialog-footer">
          <div class="footer-info">
            <span class="table-info">
              {{ versionHistory.length }} version{{ versionHistory.length !== 1 ? 's' : '' }} available
              <span v-if="versionHistory.length >= MAX_HISTORY_VERSIONS" class="limit-hint">(showing last {{ MAX_HISTORY_VERSIONS }})</span>
              <span v-if="!showDiff" class="click-hint">• Click any version to see changes</span>
            </span>
          </div>
          <el-button @click="historyDialogVisible = false">Close</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Version Content Dialog -->
    <el-dialog v-model="viewVersionDialogVisible" title="Version Content" width="800px">
      <div v-if="selectedVersion" class="version-content">
        <div class="version-info">
          <p><strong>Version:</strong> {{ selectedVersion.version }}</p>
          <p><strong>Date:</strong> {{ formatDate(selectedVersion.created_at) }}</p>
          <p><strong>Changes:</strong> {{ selectedVersion.changes_summary }}</p>
        </div>
        
        <div class="version-outline">
          <h3>Content:</h3>
          <pre>{{ selectedVersion.content }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="viewVersionDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>
    
    <!-- Search Results Header -->
    <div v-if="searchQuery && searchQuery.trim()" class="search-results-header">
      <el-icon class="search-icon"><Search /></el-icon>
      <span class="search-results-text">
        Showing <strong>{{ searchStats.matches }}</strong> search results 
        <span v-if="searchStats.items !== searchStats.matches">
          across <strong>{{ searchStats.items }}</strong> items
        </span>
        for "<strong>{{ searchQuery }}</strong>"
      </span>
      <el-button 
        class="clear-search-btn"
        @click="clearSearch"
        size="small"
        text
      >
        Clear
      </el-button>
    </div>
    
    <!-- Outline Content -->
    <div class="outline-content">
      <ul class="outline-list">
        <OutlinePointsCt
        v-for="item in getFilteredOutline()"
        :key="item.id"
        :item="item"
        :readonly="false"
        :auto-focus="item.autoFocus"
        :collapsed="isNodeCollapsed(item.id)"
        :is-node-collapsed="isNodeCollapsed"
        :check-version-before-edit="checkVersionBeforeEdit"
        :handle-version-conflict="handleVersionConflict"
        :search-query="searchQuery"
        :outline-metadata="outlineMetadata"
        :user-info="userInfo"
        @update="onOutlineUpdate"
        @move="handleMove"
        @delete="handleDelete"
        @drilldown="handleDrilldown"
        @navigate="handleNavigate"
        @indent="handleIndent"
        @outdent="handleOutdent"
        @add-sibling="handleAddSiblingRoot"
        @collapse-toggle="handleCollapseToggle"
        />
      </ul>

      <!-- Empty state (only when authenticated) -->
      <div v-if="isAuthenticated && !outline.length" class="empty-state">
        <p>Start building your outline...</p>
        <el-button @click="addFirstItem" type="primary">Add First Item</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElNotification, ElMessageBox } from 'element-plus';
import { Clock, Refresh, Search, Back, Loading, Warning, Check, Close } from '@element-plus/icons-vue';
import { supabase } from '../supabase';
import OutlinePointsCt from '../components/OutlinePointsCt.vue';
import OutlineDiff from '../components/OutlineDiff.vue';
import OutlineTabs from '../components/OutlineTabs.vue';
import { updateWorkspaceActivity } from '../utils/workspaceActivity';
import { setOutlineTitle, getCleanText } from '../utils/page-title';
import { useWorkspaceStore } from '../store/workspace';

// Add debounce utility with cancellation support
function debounce(func, wait) {
  let timeout;
  const executedFunction = function(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
  
  executedFunction.cancel = function() {
    clearTimeout(timeout);
  };
  
  return executedFunction;
}

// Constants
const MAX_HISTORY_VERSIONS = 50;

// Generate unique render ID for this tab
function generateRenderID() {
  return 'render_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Generate a summary of changes between two outline versions
function generateChangesSummary(oldOutline, newOutline) {
  if (!oldOutline && !newOutline) return 'No content';
  if (!oldOutline) return 'Initial content added';
  if (!newOutline) return 'Content removed';
  
  // Handle single content case (no comparison needed)
  if (!Array.isArray(oldOutline) || !Array.isArray(newOutline)) {
    return 'Content updated';
  }
  
  const changes = [];
  const oldItems = flattenOutlineForDiff(oldOutline);
  const newItems = flattenOutlineForDiff(newOutline);
  
  // Count additions and deletions
  const oldTexts = new Set(oldItems.map(item => item.text));
  const newTexts = new Set(newItems.map(item => item.text));
  
  const added = newItems.filter(item => !oldTexts.has(item.text));
  const removed = oldItems.filter(item => !newTexts.has(item.text));
  
  if (added.length > 0) {
    changes.push(`+${added.length} item${added.length > 1 ? 's' : ''}`);
  }
  if (removed.length > 0) {
    changes.push(`-${removed.length} item${removed.length > 1 ? 's' : ''}`);
  }
  
  // Check for modifications
  const modified = newItems.filter(newItem => {
    const oldItem = oldItems.find(old => old.id === newItem.id);
    return oldItem && oldItem.text !== newItem.text;
  });
  
  if (modified.length > 0) {
    changes.push(`~${modified.length} modified`);
  }
  
  return changes.length > 0 ? changes.join(', ') : 'Minor changes';
}

// Flatten outline structure for diff comparison
function flattenOutlineForDiff(outline) {
  const items = [];
  
  function traverse(items_array) {
    if (!Array.isArray(items_array)) return;
    for (const item of items_array) {
      if (item.text && item.text.trim()) {
        items.push({
          id: item.id,
          text: item.text.trim()
        });
      }
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }
  
  traverse(outline);
  return items;
}

export default {
  name: 'OutlineCt',
  components: { OutlinePointsCt, OutlineDiff, OutlineTabs, Clock, Refresh, Search, Back, Loading, Warning, Check, Close },
  props: {
    workspace_id: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const route = useRoute();
    const router = useRouter();
    const workspaceStore = useWorkspaceStore();
    const workspaceId = computed(() => props.workspace_id);
    const saving = ref(false);
    const refreshing = ref(false);
    const outline = ref([]);
    const outlineId = ref(null);
    const currentOutlineId = computed(() => outlineId.value);
    const currentVersion = ref(1);
    const hasChanges = ref(false);
    const lastSavedContent = ref(null);
    const focusedId = ref(null);
    const historyDialogVisible = ref(false);
    const viewVersionDialogVisible = ref(false);
    const versionHistory = ref([]);
    const loadingHistory = ref(false);
    const selectedVersion = ref(null);
    const realtimeSubscription = ref(null);
    const collapsedNodes = ref(new Set());
    const firstUpdateReceived = ref(false);
    const searchQuery = ref('');
    const searchStats = ref({ matches: 0, items: 0 });
    const lastSaveTime = ref(null);
    const isAuthenticated = ref(false);
    const authCheckDone = ref(false);
    const selectedOldVersion = ref(null);
    const selectedNewVersion = ref(null);
    
    // Generate unique render ID for this tab/component instance
    const outlineRenderID = ref(generateRenderID());

    // Remove mock workspace assignment; rely on store / route
    if (!workspaceStore.currentWorkspace && workspaceId.value) {
      // Attempt to set from existing store list if available
      const existing = workspaceStore.workspaces.find(w => w.id.toString() === workspaceId.value.toString())
      if (existing) {
        workspaceStore.setCurrentWorkspace(existing)
      }
    }

    // Computed property for current workspace
    const currentWorkspace = computed(() => workspaceStore.currentWorkspace);
    
    // Computed property for workspace name
    const workspaceName = computed(() => currentWorkspace.value?.title || 'Workspace');

    // Computed property for user info
    const userInfo = computed(() => workspaceStore.user || {});

    // Computed property for outline metadata (for showing creation/modification info)
    const outlineMetadata = computed(() => ({
      created_by: currentOutlineData.value?.created_by,
      created_at: currentOutlineData.value?.created_at,
      updated_at: currentOutlineData.value?.updated_at,
      version: currentVersion.value,
      users: currentOutlineData.value?.users || {},
      created_by_name: currentOutlineData.value?.created_by_name
    }));

    // Store current outline data for metadata
    const currentOutlineData = ref({});

    // Function to fetch user info for creator
    const fetchUserInfo = async (userId) => {
      if (!userId) return null
      try {
        // This would ideally be a user lookup service
        // For now, we'll try to use Supabase auth to get user info
        // but this might not work for other users
        return null
      } catch (error) {
        console.warn('Could not fetch user info:', error)
        return null
      }
    }

    // Function to update page title
    const updatePageTitle = () => {
      const focusedNode = focusedId.value ? findItemById(outline.value, focusedId.value) : null;
      const focusedText = focusedNode ? getCleanText(focusedNode.text) : undefined;
      setOutlineTitle(focusedText, workspaceName.value);
    };
    
    let refreshInterval = null;

    // Create debounced save function - saves after 1 second of inactivity
    const debouncedSave = debounce(async () => {
      // Only save if there are changes and we're not already saving
      if (hasChanges.value && !saving.value) {
        await saveOutline();
      }
    }, 1000);

    // Get localStorage keys for current workspace
    const getLocalStorageKey = () => `outline_${workspaceId.value}`;
    const getVersionKey = () => `outline_version_${workspaceId.value}`;
    const getCollapsedKey = () => `outline_collapsed_${workspaceId.value}_${window.location.pathname}`;

    // Function to check if content has changed
    const checkForChanges = (newContent) => {
      // If there's no saved content yet (new outline), any content represents changes
      if (!lastSavedContent.value) return newContent && newContent.length > 0;
      
      try {
        const newContentStr = JSON.stringify(newContent);
        const lastSavedStr = JSON.stringify(lastSavedContent.value);
        return newContentStr !== lastSavedStr;
      } catch (error) {
        console.error('Error checking for changes:', error);
        return false;
      }
    };

    // Helper to deep clone an object
    const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

    // Functions to handle collapsed state persistence
    const loadCollapsedState = () => {
      // First try to load from URL
      const urlCollapsed = route.query.collapsed;
      if (urlCollapsed) {
        const collapsedArray = urlCollapsed.split(',').filter(id => id.trim());
        collapsedNodes.value = new Set(collapsedArray);
        return;
      }

      // Fall back to localStorage
      const collapsedKey = getCollapsedKey();
      const stored = localStorage.getItem(collapsedKey);
      if (stored) {
        try {
          const collapsedArray = JSON.parse(stored);
          collapsedNodes.value = new Set(collapsedArray);
        } catch (error) {
          console.error('Error loading collapsed state:', error);
          collapsedNodes.value = new Set();
        }
      }
    };

    const saveCollapsedState = () => {
      const collapsedKey = getCollapsedKey();
      const collapsedArray = Array.from(collapsedNodes.value);
      localStorage.setItem(collapsedKey, JSON.stringify(collapsedArray));
      
      // Update URL
      const newQuery = { ...route.query };
      if (collapsedArray.length > 0) {
        newQuery.collapsed = collapsedArray.join(',');
      } else {
        delete newQuery.collapsed;
      }
      
      router.replace({
        query: newQuery
      });
    };

    const handleCollapseToggle = (nodeId, isCollapsed) => {
      //console.log('handleCollapseToggle called with:', { nodeId, isCollapsed, currentCollapsedNodes: Array.from(collapsedNodes.value) });
      if (isCollapsed) {
        collapsedNodes.value.add(nodeId.toString());
      } else {
        collapsedNodes.value.delete(nodeId.toString());
      }
      //console.log('After toggle, collapsedNodes:', Array.from(collapsedNodes.value));
      saveCollapsedState();
    };

    const isNodeCollapsed = (nodeId) => {
      const result = collapsedNodes.value.has(nodeId.toString());
      //console.log('isNodeCollapsed check for node:', nodeId, 'result:', result, 'collapsedNodes:', Array.from(collapsedNodes.value));
      return result;
    };

    // Computed property to ensure version is always displayed
    const displayVersion = computed(() => {
      return currentVersion.value || 1;
    });

    // Computed property for showing diff view
    const showDiff = computed(() => {
      return selectedOldVersion.value && selectedNewVersion.value && 
             selectedOldVersion.value !== selectedNewVersion.value;
    });

    // Default outline data
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
    ];

    // Helper to ensure all items have autoFocus: false
    function ensureAutoFocusProp(items, clearAutoFocus = false) {
      for (const item of items) {
        if (clearAutoFocus) {
          // Clear autoFocus for synced content to prevent conflicts
          item.autoFocus = false;
        } else if (item.autoFocus === undefined) {
          item.autoFocus = false;
        }
        if (item.children) {
          ensureAutoFocusProp(item.children, clearAutoFocus);
        }
      }
    }

    // Load a specific outline by ID or the first available outline
    async function loadOutline(specificOutlineId = null) {
      authCheckDone.value = false; // reset before each load
      if (!workspaceId.value) { authCheckDone.value = true; return; }
      loadCollapsedState();
      hasChanges.value = false;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          isAuthenticated.value = false;
          outline.value = [];
          lastSavedContent.value = null;
          authCheckDone.value = true;
          return;
        }
        isAuthenticated.value = true;

        console.log('🔍 Loading outline for workspace:', workspaceId.value, 'specific ID:', specificOutlineId);
        
        let query = supabase
          .from('outlines')
          .select('id, content, version, title, created_by, created_at, updated_at, tab_order')
          .eq('workspace_id', workspaceId.value)
          .not('title', 'like', 'Task_%');
        
        if (specificOutlineId) {
          query = query.eq('id', specificOutlineId);
        } else {
          query = query.order('tab_order', { ascending: true }).limit(1);
        }
        
        const { data: existingOutline, error: outlineError } = await query.maybeSingle();
        if (outlineError) console.warn('Outline fetch error', outlineError.message);
        console.log('📄 Loaded outline:', existingOutline ? 'Found' : 'Not found', existingOutline?.id);
        if (existingOutline && existingOutline.content) {
          outlineId.value = existingOutline.id;
          outline.value = Array.isArray(existingOutline.content) ? existingOutline.content : [];
          ensureAutoFocusProp(outline.value);
          lastSavedContent.value = deepClone(outline.value);
          currentVersion.value = existingOutline.version || 1;
          // Store metadata
          currentOutlineData.value = {
            created_by: existingOutline.created_by,
            created_at: existingOutline.created_at,
            updated_at: existingOutline.updated_at,
            users: {}, // We could populate this with user lookups if needed
            created_by_name: userInfo.value?.id === existingOutline.created_by ? userInfo.value.name || userInfo.value.email : null
          };
        } else if (!specificOutlineId) {
          console.log('📝 No existing outline found, tabs component will create default outline');
          // Don't create here, let the OutlineTabs component handle initial creation
          authCheckDone.value = true;
          return;
        }
      } catch (err) {
        console.error('Supabase outline load failed', err);
      }

      // Fallback to localStorage if still empty
      if (outline.value.length === 0) {
        const localStorageKey = getLocalStorageKey();
        const versionKey = getVersionKey();
        const data = localStorage.getItem(localStorageKey);
        const storedVersion = localStorage.getItem(versionKey);
        if (data) {
          try { const parsedData = JSON.parse(data); outline.value = Array.isArray(parsedData) ? parsedData : [parsedData]; ensureAutoFocusProp(outline.value); lastSavedContent.value = deepClone(outline.value); if (storedVersion) currentVersion.value = parseInt(storedVersion); } catch { outline.value = deepClone(defaultOutline); ensureAutoFocusProp(outline.value); }
        } else { outline.value = deepClone(defaultOutline); ensureAutoFocusProp(outline.value); }
      }

      updatePageTitle();
      
      // Validate and restore focus state after outline is fully loaded
      await validateAndRestoreFocus();
      
      authCheckDone.value = true;
      
      // Set up real-time subscription after loading outline
      if (outlineId.value && isAuthenticated.value) {
        await subscribeToChanges();
      }
    }

    onMounted(async () => {
      // If the route contains a tab id param, load that specific outline
      const paramTabId = route.params.tab_id || route.query.tab || null;
      await loadOutline(paramTabId);
      
      // Add localStorage cross-tab synchronization
      const handleStorageChange = (event) => {
        // Only respond to changes for our workspace
        const localStorageKey = getLocalStorageKey();
        const versionKey = getVersionKey();
        
        if (event.key === localStorageKey && event.newValue) {
          try {
            const newOutlineData = JSON.parse(event.newValue);
            console.log('📡 Cross-tab localStorage sync detected');
            
            // Only update if we don't have unsaved changes
            if (!hasChanges.value) {
              console.log('✅ Applying cross-tab outline update');
              outline.value = newOutlineData;
              ensureAutoFocusProp(outline.value, true);
              
              // Validate focus after cross-tab update
              validateAndRestoreFocus();
            } else {
              console.log('⚠️ Skipping cross-tab update - local changes exist');
            }
          } catch (error) {
            console.warn('⚠️ Error parsing cross-tab outline data:', error);
          }
        } else if (event.key === versionKey && event.newValue) {
          // Update version tracking from other tabs
          const newVersion = parseInt(event.newValue);
          if (newVersion > currentVersion.value) {
            console.log('📝 Updating version from cross-tab sync:', newVersion);
            currentVersion.value = newVersion;
          }
        }
      };
      
      // Listen for localStorage changes from other tabs
      window.addEventListener('storage', handleStorageChange);
      
      // Store handler for cleanup
      window.outlineStorageHandler = handleStorageChange;
    });

  // Reload outline when workspace changes via navigation (same component instance)
    watch(workspaceId, async (newVal, oldVal) => {
      if (!newVal || newVal === oldVal) return;
      
      // Cleanup existing subscription
      if (realtimeSubscription.value) {
        realtimeSubscription.value.unsubscribe();
        realtimeSubscription.value = null;
      }
      
      // Reset state before loading new workspace outline
      outline.value = [];
      outlineId.value = null;
      currentVersion.value = 1;
      lastSavedContent.value = null;
      focusedId.value = null;
      collapsedNodes.value = new Set();
      lastSaveTime.value = null;
      firstUpdateReceived.value = false;
      await loadOutline();
    });

    // Watch for route changes so we can load a specific tab when the URL changes
    watch(() => route.params.tab_id, async (newTabId, oldTabId) => {
      if (!newTabId) return;
      // Only act if the tab id actually changed
      if (newTabId !== oldTabId && newTabId !== outlineId.value) {
        await loadOutline(newTabId);
      }
    });

    // Cleanup real-time subscription on unmount
    onUnmounted(() => {
      if (realtimeSubscription.value) {
        realtimeSubscription.value.unsubscribe();
        realtimeSubscription.value = null;
      }
      
      // Cleanup localStorage event listener
      if (window.outlineStorageHandler) {
        window.removeEventListener('storage', window.outlineStorageHandler);
        delete window.outlineStorageHandler;
      }
    });

    async function saveOutline() {
      if (!isAuthenticated.value) return; // skip save if not logged in
      if (saving.value) return;
      try {
        saving.value = true;
        const localStorageKey = getLocalStorageKey(); const versionKey = getVersionKey();
        localStorage.setItem(localStorageKey, JSON.stringify(outline.value));
        // Persist to Supabase if outlineId exists
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          if (outlineId.value) {
            // Check current server version before saving to detect conflicts
            const { data: serverOutline, error: serverCheckError } = await supabase
              .from('outlines')
              .select('version')
              .eq('id', outlineId.value)
              .single();

            if (serverCheckError) {
              console.error('❌ Error checking server version:', serverCheckError);
              throw serverCheckError;
            }

            // Detect version conflict - if server has newer version, prevent save
            if (serverOutline.version > currentVersion.value) {
              console.log('⚠️ Version conflict detected during save - server version:', serverOutline.version, 'local version:', currentVersion.value);
              
              ElNotification({
                title: 'Save Conflict',
                message: `Cannot save: The outline was updated by another user (server version ${serverOutline.version}, your version ${currentVersion.value}). Please refresh and try again.`,
                type: 'warning',
                duration: 7000,
                showClose: true
              });
              
              // Update our version tracking but don't save
              currentVersion.value = serverOutline.version;
              return;
            }

            const nextVersion = (currentVersion.value || 1) + 1;
            
            // Save current version to history before updating
            // Always save version history for any content change, not just when lastSavedContent exists
            const contentToSave = lastSavedContent.value && lastSavedContent.value.length > 0 
              ? lastSavedContent.value 
              : outline.value; // Use current content if no previous saved content
              
            if (contentToSave && contentToSave.length > 0) {
              try {
                const { error: versionInsertError } = await supabase
                  .from('outline_versions')
                  .insert({
                    outline_id: outlineId.value,
                    content: contentToSave,
                    version: currentVersion.value,
                    created_by: authUser.id,
                    comment: generateChangesSummary(contentToSave, outline.value)
                  });
                
                if (versionInsertError) {
                  console.warn('Failed to save version history:', versionInsertError.message);
                }
              } catch (versionError) {
                console.warn('Error saving version history:', versionError);
              }
            }

            const { error: updateErr, data: updated } = await supabase
              .from('outlines')
              .update({ 
                content: outline.value, 
                updated_at: new Date().toISOString(), 
                version: nextVersion,
                render_id: outlineRenderID.value // Add render ID to track which tab made the change
              })
              .eq('id', outlineId.value)
              .select('version')
              .single();
            if (updateErr) {
              console.error('Outline update error', updateErr.message);
            } else {
              currentVersion.value = updated?.version || nextVersion;
            }
          }
        }
        const newVersion = currentVersion.value; // version from DB or previous
        localStorage.setItem(versionKey, newVersion.toString());
        lastSavedContent.value = deepClone(outline.value); hasChanges.value = false; lastSaveTime.value = new Date().toISOString();
        updateWorkspaceActivity(workspaceId.value);
      } catch (error) {
        console.error('Error saving outline:', error);
        ElNotification({ title: 'Save Failed', message: 'Could not save your changes. Please try again.', type: 'error' });
      } finally { saving.value = false; }
    }

    // Update outline text by id (recursive)
    function updateTextById(items, id, text, extra = {}) {
      for (const item of items) {
        if (item.id === id) {
          if (text !== undefined) item.text = text;
          if (extra.comments) item.comments = extra.comments;
          if (Object.prototype.hasOwnProperty.call(extra, 'fileUrl')) item.fileUrl = extra.fileUrl; // persist image data URL
          if (extra.updated_by) item.updated_by = extra.updated_by;
          if (extra.updated_by_name) item.updated_by_name = extra.updated_by_name;
          item.updated_at = new Date().toISOString();
          return true;
        }
        if (item.children && updateTextById(item.children, id, text, extra)) {
          return true;
        }
      }
      return false;
    }

    // Find and remove item by id (recursive)
    function removeItemById(items, id) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === id) {
          items.splice(i, 1);
          return true;
        }
        if (items[i].children && removeItemById(items[i].children, id)) {
          return true;
        }
      }
      return false;
    }

    // Find item by id (recursive)
    function findItemById(items, id) {
      if (!id) return null;
      
      for (const item of items) {
        // Check both number and string comparison for ID matching
        if (item.id == id || item.id === id || item.id.toString() === id.toString()) {
          return item;
        }
        if (item.children) {
          const found = findItemById(item.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    // Find parent of item by id (recursive)
    function findParentById(items, id, parent = null) {
      if (!id) return null;
      
      for (const item of items) {
        // Check both number and string comparison for ID matching
        if (item.id == id || item.id === id || item.id.toString() === id.toString()) {
          return parent;
        }
        if (item.children) {
          const found = findParentById(item.children, id, item);
          if (found) return found;
        }
      }
      return null;
    }

    function onOutlineUpdate({ id, text, comments, fileUrl, immediate, updated_by, updated_by_name }) {
      updateTextById(outline.value, id, text, { comments, fileUrl, updated_by, updated_by_name });
      hasChanges.value = checkForChanges(outline.value);
      
      // If immediate save is requested (e.g., during text changes), save immediately
      if (immediate && hasChanges.value && !saving.value) {
        // Cancel any pending debounced save and save immediately
        if (debouncedSave && debouncedSave.cancel) {
          debouncedSave.cancel();
        }
        console.log('Immediate save triggered from onOutlineUpdate');
        saveOutline();
      } else {
        // Otherwise, use debounced save
        debouncedSave();
      }
    }

    function handleMove({ draggedId, targetId, position }) {
      //console.log('Moving item:', { draggedId, targetId, position });
      const beforeJson = JSON.stringify(outline.value);
      const draggedItem = findItemById(outline.value, draggedId);
      if (!draggedItem) return;
      removeItemById(outline.value, draggedId);
      const targetItem = findItemById(outline.value, targetId);
      if (!targetItem) return;
      if (position === 'child') {
        if (!targetItem.children) { targetItem.children = []; }
        targetItem.children.push(draggedItem);
      } else {
        const targetParent = findParentById(outline.value, targetId);
        const targetArray = targetParent ? targetParent.children : outline.value;
        const targetIndex = targetArray.findIndex(item => item.id === targetId);
        if (position === 'top') { targetArray.splice(targetIndex, 0, draggedItem); } else { targetArray.splice(targetIndex + 1, 0, draggedItem); }
      }
      if (beforeJson !== JSON.stringify(outline.value)) {
        hasChanges.value = true; debouncedSave();
      }
    }

    function handleDelete(id) {
      const node = findItemById(outline.value, id)
      //console.log('handleDelete called for id:', id, 'node:', node, 'outline:', outline.value); return;
      if (!node) return
      const nodeText = (node.text || '').slice(0, 80) || 'this item'
      ElMessageBox.confirm(
        `Delete "${nodeText}" and all of its children?`,
        'Confirm Delete',
        { type: 'warning', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' }
      ).then(() => {
        const beforeJson = JSON.stringify(outline.value)
        removeItemById(outline.value, id)
        if (beforeJson !== JSON.stringify(outline.value)) {
          hasChanges.value = true
          debouncedSave()
        }
      }).catch(() => {})
    }

    function handleDrilldown(id) {
      focusedId.value = id;
      // Update URL
      router.push({
        query: { ...route.query, focus: id }
      });
    }

    function handleBack() {
      const focusedItem = findItemById(outline.value, focusedId.value);
      if (!focusedItem) {
        focusedId.value = null;
      } else {
        const parent = findParentById(outline.value, focusedId.value);
        focusedId.value = parent ? parent.id : null;
      }
      
      // Update URL
      const newQuery = { ...route.query };
      if (focusedId.value) {
        newQuery.focus = focusedId.value;
      } else {
        delete newQuery.focus;
      }
      router.push({ query: newQuery });
    }

    function getFocusedOutline() {
      console.log('🎯 getFocusedOutline called:', {
        focusedId: focusedId.value,
        outlineLength: outline.value.length
      });
      
      if (!focusedId.value) {
        console.log('📋 No focused ID - returning full outline');
        return outline.value;
      }
      
      const focusedItem = findItemById(outline.value, focusedId.value);
      console.log('🔍 Found focused item:', {
        found: !!focusedItem,
        hasChildren: focusedItem?.children?.length || 0,
        text: focusedItem?.text?.slice(0, 50)
      });
      
      const result = focusedItem ? focusedItem.children || [] : outline.value;
      console.log('📤 Returning focused outline with', result.length, 'items');
      return result;
    }

    function getFilteredOutline() {
      const baseOutline = getFocusedOutline();
      
      if (!searchQuery.value || !searchQuery.value.trim()) {
        return baseOutline;
      }
      
      // Filter items based on search query
      const query = searchQuery.value.toLowerCase();
      
      function filterItems(items) {
        return items.filter(item => {
          const textMatch = item.text && item.text.toLowerCase().includes(query);
          const hasMatchingChildren = item.children && filterItems(item.children).length > 0;
          
          return textMatch || hasMatchingChildren;
        }).map(item => ({
          ...item,
          children: item.children ? filterItems(item.children) : []
        }));
      }
      
      return filterItems(baseOutline);
    }

    // Helper to find the path from root to focused node
    function findPathToNode(items, id, path = []) {
      if (!id) return null;
      
      for (const item of items) {
        const currentPath = [...path, item];
        
        // Check both number and string comparison for ID matching
        if (item.id == id || item.id === id || item.id.toString() === id.toString()) {
          console.log('🎯 Found path to node:', {
            targetId: id,
            foundItemId: item.id,
            pathLength: currentPath.length,
            path: currentPath.map(p => ({ id: p.id, text: p.text?.slice(0, 20) }))
          });
          return currentPath;
        }
        
        if (item.children) {
          const found = findPathToNode(item.children, id, currentPath);
          if (found) return found;
        }
      }
      return null;
    }

    const breadcrumbPath = computed(() => {
      const path = findPathToNode(outline.value, focusedId.value) || [];
      console.log('🍞 Breadcrumb path computed:', {
        focusedId: focusedId.value,
        pathLength: path.length,
        path: path.map(p => ({ id: p.id, text: p.text?.slice(0, 30) }))
      });
      return path;
    });

    function handleBreadcrumb(node, idx) {
      focusedId.value = idx === 0 ? null : node.id;
      
      // Update URL
      const newQuery = { ...route.query };
      if (focusedId.value) {
        newQuery.focus = focusedId.value;
      } else {
        delete newQuery.focus;
      }
      router.push({ query: newQuery });
    }

    // Return an href for breadcrumb anchor tags that mirrors handleBreadcrumb behavior
    function breadcrumbHref(node, idx) {
      const newQuery = { ...route.query };
      const val = idx === 0 ? null : node.id;
      if (val) {
        newQuery.focus = val;
      } else {
        delete newQuery.focus;
      }
      // Build full path using current route path and updated query
      return router.resolve({ path: route.path, query: newQuery }).href;
    }

    function getBreadcrumbText(text) {
      return getCleanText(text) || 'Untitled';
    }

    async function openHistoryDialog() {
      historyDialogVisible.value = true;
      loadingHistory.value = true;
      
      try {
        if (!outlineId.value) {
          versionHistory.value = [];
          return;
        }

        // Load version history from database (limit to recent versions)
        const { data: versions, error: versionsError } = await supabase
          .from('outline_versions')
          .select('*')
          .eq('outline_id', outlineId.value)
          .order('version', { ascending: false })
          .limit(MAX_HISTORY_VERSIONS);

        if (versionsError) {
          console.warn('Version history not available:', versionsError.message);
          // Fall back to showing just current version if outline_versions table doesn't exist
          if (versionsError.code === 'PGRST116' || versionsError.message.includes('relation') || versionsError.message.includes('does not exist')) {
            console.log('outline_versions table not available, showing current version only');
            const currentVersionData = {
              id: 'current',
              version: currentVersion.value,
              created_at: lastSaveTime.value || new Date().toISOString(),
              comment: 'Current version (history not available)',
              content: outline.value,
              created_by: userInfo.value?.id
            };
            versionHistory.value = [currentVersionData];
            return;
          }
          
          // For other errors, show notification
          ElNotification({
            title: 'Version History Limited',
            message: 'Could not load full version history. Showing current version only.',
            type: 'warning',
            duration: 4000
          });
          
          const currentVersionData = {
            id: 'current',
            version: currentVersion.value,
            created_at: lastSaveTime.value || new Date().toISOString(),
            comment: 'Current version',
            content: outline.value,
            created_by: userInfo.value?.id
          };
          versionHistory.value = [currentVersionData];
          return;
        }

        // Add current version to the list
        const currentVersionData = {
          id: 'current',
          version: currentVersion.value,
          created_at: lastSaveTime.value || new Date().toISOString(),
          comment: 'Current version',
          content: outline.value,
          created_by: userInfo.value?.id
        };

        versionHistory.value = [currentVersionData, ...(versions || [])];
        
      } catch (error) {
        console.error('Error in openHistoryDialog:', error);
        ElNotification({
          title: 'Load Failed',
          message: 'Could not load version history',
          type: 'error'
        });
        versionHistory.value = [];
      } finally {
        loadingHistory.value = false;
      }
    }

    function viewVersion(versionRow) {
      selectedVersion.value = {
        ...versionRow,
        content: JSON.stringify(outline.value, null, 2)
      };
      viewVersionDialogVisible.value = true;
    }

    function formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleString();
    }

    function getVersionByNumber(versionNumber) {
      return versionHistory.value.find(v => v.version === versionNumber) || null;
    }

    function compareWithPrevious(row) {
      const currentIndex = versionHistory.value.findIndex(v => v.version === row.version);
      const previousVersion = versionHistory.value[currentIndex + 1]; // Next in array (older version)
      
      if (!previousVersion) {
        ElNotification({
          title: 'No Previous Version',
          message: 'This is the oldest version available',
          type: 'info',
          duration: 3000
        });
        return;
      }
      
      selectedOldVersion.value = previousVersion.version;
      selectedNewVersion.value = row.version;
    }

    function closeDiff() {
      selectedOldVersion.value = null;
      selectedNewVersion.value = null;
    }

    // --- Keyboard navigation logic ---
    function flattenOutline(items, result = []) {
      for (const item of items) {
        result.push(item);
        if (item.children && !isNodeCollapsed(item.id)) {
          flattenOutline(item.children, result);
        }
      }
      return result;
    }

    function handleNavigate({ id, direction }) {
      const flatItems = flattenOutline(getFocusedOutline());
      const currentIndex = flatItems.findIndex(item => item.id === id);
      
      let targetIndex;
      if (direction === 'up') {
        targetIndex = Math.max(0, currentIndex - 1);
      } else if (direction === 'down') {
        targetIndex = Math.min(flatItems.length - 1, currentIndex + 1);
      }
      
      if (targetIndex !== undefined && flatItems[targetIndex]) {
        // Focus on the target item
        //console.log('Navigate to:', flatItems[targetIndex].id);
      }
    }

    // --- Indent/Outdent logic ---
    // Helper to get parent array and index for a node id
    function findParentArrayAndIndex(id, items = outline.value, parent = null) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.id === id) {
          return { parent, array: items, index: i };
        }
        if (item.children && item.children.length) {
          const found = findParentArrayAndIndex(id, item.children, item);
          if (found) return found;
        }
      }
      return null;
    }

    function setExclusiveAutoFocus(id) {
      const walk = (items) => {
        for (const item of items) {
          item.autoFocus = item.id === id;
          if (item.children) walk(item.children);
        }
      };
      walk(outline.value);
    }

    function handleIndent({ id }) {
      const ctx = findParentArrayAndIndex(id);
      if (!ctx) return;
      const { array: parentArray, index } = ctx;
      if (index === 0) return; // cannot indent first item in a group
      const item = parentArray[index];
      const previousItem = parentArray[index - 1];
      // Remove from current siblings
      parentArray.splice(index, 1);
      if (!previousItem.children) previousItem.children = [];
      previousItem.children.push(item);
      // Ensure the new parent is expanded if it was collapsed so user sees the result
      if (collapsedNodes.value.has(previousItem.id.toString())) {
        collapsedNodes.value.delete(previousItem.id.toString());
        saveCollapsedState();
      }
      setExclusiveAutoFocus(id);
      hasChanges.value = true; debouncedSave();
    }

    function handleOutdent({ id }) {
      const ctx = findParentArrayAndIndex(id);
      if (!ctx) return;
      const { parent, array: parentArray, index } = ctx;
      if (!parent) return; // already root
      const item = parentArray.splice(index, 1)[0];
      // Find grandparent context
      const grandCtx = findParentArrayAndIndex(parent.id);
      const grandArray = grandCtx ? grandCtx.array : outline.value;
      const parentIndex = grandCtx ? grandCtx.index : outline.value.findIndex(i => i.id === parent.id);
      grandArray.splice(parentIndex + 1, 0, item);
      // If parent was collapsed, still fine because item is now sibling and visible; no change needed
      setExclusiveAutoFocus(id);
      hasChanges.value = true; debouncedSave();
    }

    function handleAddSiblingRoot({ id, asChild }) {
      const currentTime = new Date().toISOString();
      const creatorId = userInfo.value?.id;
      const creatorName = userInfo.value?.name || userInfo.value?.email;
      
      if (asChild) {
        const target = findItemById(outline.value, id);
        if (!target) return;
        if (!target.children) target.children = [];
        const newId = Date.now();
        const newItem = { 
          id: newId, 
          text: '', 
          children: [], 
          autoFocus: true,
          created_at: currentTime,
          created_by: creatorId,
          created_by_name: creatorName
        };
        target.children.push(newItem);
        hasChanges.value = true; 
        // Immediate save for new items to ensure proper sync
        if (!saving.value) {
          console.log('Immediate save triggered for new child item');
          saveOutline();
        }
        return;
      }
      const parent = findParentById(outline.value, id);
      const parentArray = parent ? parent.children : outline.value;
      const itemIndex = parentArray.findIndex(item => item.id === id);
      const newId = Date.now();
      const newItem = { 
        id: newId, 
        text: '', 
        children: [], 
        autoFocus: true,
        created_at: currentTime,
        created_by: creatorId,
        created_by_name: creatorName
      };
      parentArray.splice(itemIndex + 1, 0, newItem);
      hasChanges.value = true; 
      // Immediate save for new items to ensure proper sync
      if (!saving.value) {
        console.log('Immediate save triggered for new sibling item');
        saveOutline();
      }
    }

    // Manual refresh function for user-triggered sync
    async function manualRefresh() {
      if (refreshing.value) return;
      
      try {
        refreshing.value = true;
        
        // Actually reload from Supabase
        await loadOutline();
        
        ElNotification({
          title: 'Synced',
          message: 'Outline synchronized with server',
          type: 'success'
        });
        
      } catch (error) {
        console.error('Error during refresh:', error);
        ElNotification({
          title: 'Sync Failed',
          message: 'Could not sync with server. Please try again.',
          type: 'error'
        });
      } finally {
        refreshing.value = false;
      }
    }

    // Check if current version matches server version
    async function checkVersionBeforeEdit() {
      if (!outlineId.value) {
        // No outline saved yet, safe to edit
        return { canEdit: true };
      }

      try {
        // Check server version before allowing edit
        const { data: serverOutline, error: serverCheckError } = await supabase
          .from('outlines')
          .select('version')
          .eq('id', outlineId.value)
          .single();

        if (serverCheckError) {
          console.error('❌ Error checking server version before edit:', serverCheckError);
          // Allow editing but warn user
          return { 
            canEdit: true, 
            warning: 'Could not verify latest version. Your changes might conflict with others.' 
          };
        }

        if (serverOutline.version > currentVersion.value) {
          console.log('⚠️ Outdated version detected before edit - server:', serverOutline.version, 'local:', currentVersion.value);
          return {
            canEdit: false,
            isOutdated: true,
            serverVersion: serverOutline.version,
            currentVersion: currentVersion.value,
            message: `Outline update required: ${serverOutline.version - currentVersion.value} new changes detected.`
          };
        }

        // Version is current, safe to edit
        return { canEdit: true };
      } catch (error) {
        console.error('❌ Error in version check before edit:', error);
        // Allow editing but warn user
        return { 
          canEdit: true, 
          warning: 'Could not verify latest version. Your changes might conflict with others.' 
        };
      }
    }

    // Handle version conflict with user choice
    async function handleVersionConflict(versionCheck) {
      return new Promise((resolve) => {
        const conflictMessage = `⚠️ **IMMEDIATE RELOAD REQUIRED**

The outline has been updated by another user and your version is outdated.

**Your version:** ${versionCheck.currentVersion}
**Latest version:** ${versionCheck.serverVersion}
**Changes behind:** ${versionCheck.serverVersion - versionCheck.currentVersion}

🚨 You MUST reload immediately to get the latest changes before editing.
This prevents data loss and conflicts.`;

        ElMessageBox.alert(
          conflictMessage,
          '🔄 RELOAD IMMEDIATELY - Outdated Version',
          {
            confirmButtonText: '🔄 Reload Now',
            type: 'warning',
            showClose: false,
            closeOnClickModal: false,
            closeOnPressEscape: false,
            center: true,
            customStyle: {
              width: '500px'
            }
          }
        ).then(async () => {
          // User clicked reload - immediately refresh
          try {
            refreshing.value = true;
            await loadOutline(); // Reload the entire outline
            ElNotification({
              title: '✅ Reloaded Successfully',
              message: 'Outline has been reloaded with the latest changes. You can now edit safely.',
              type: 'success',
              duration: 4000
            });
            resolve({ canEdit: true, reloaded: true });
          } catch (error) {
            console.error('❌ Failed to reload:', error);
            ElNotification({
              title: '❌ Reload Failed',
              message: 'Could not reload latest version. Please refresh the page manually.',
              type: 'error',
              duration: 7000,
              showClose: true
            });
            resolve({ canEdit: false });
          } finally {
            refreshing.value = false;
          }
        });
      });
    }

    // Search functionality
    function clearSearch() {
      searchQuery.value = '';
    }

    function updateSearchStats() {
      if (!searchQuery.value || !searchQuery.value.trim()) {
        searchStats.value = { matches: 0, items: 0 };
        return;
      }

      const query = searchQuery.value.toLowerCase();
      let matches = 0;
      let items = 0;

      function countMatches(itemArray) {
        for (const item of itemArray) {
          items++;
          if (item.text && item.text.toLowerCase().includes(query)) {
            matches++;
          }
          if (item.children) {
            countMatches(item.children);
          }
        }
      }

      countMatches(outline.value);
      searchStats.value = { matches, items };
    }

    function addFirstItem() {
      const newItem = {
        id: Date.now(),
        text: 'Your first outline item',
        children: [],
        autoFocus: true
      };
      outline.value.push(newItem);
    }

    // Helper function to get all item IDs for debugging
    function getAllItemIds(items) {
      const ids = [];
      function collectIds(itemArray) {
        for (const item of itemArray) {
          ids.push(item.id);
          if (item.children && item.children.length) {
            collectIds(item.children);
          }
        }
      }
      collectIds(items);
      return ids;
    }

    // Function to validate and restore focus state
    async function validateAndRestoreFocus() {
      const focusParam = route.query.focus;
      if (!focusParam) {
        focusedId.value = null;
        return;
      }

      // Try both string and number formats since IDs can be either
      const targetIdNum = parseInt(focusParam);
      const targetIdStr = focusParam.toString();
      
      if (isNaN(targetIdNum)) {
        console.warn('Invalid focus parameter:', focusParam);
        focusedId.value = null;
        return;
      }

      // Check if the focused item exists in the loaded outline (try both formats)
      console.log('🔍 Validating focus for item:', targetIdNum, '(string:', targetIdStr, ') Outline length:', outline.value.length);
      let focusedItem = findItemById(outline.value, targetIdNum);
      if (!focusedItem) {
        focusedItem = findItemById(outline.value, targetIdStr);
      }
      if (focusedItem) {
        console.log('✅ Restoring focus to item:', targetIdNum, focusedItem.text?.slice(0, 50));
        focusedId.value = targetIdNum;
        
        // Force UI update by triggering reactivity
        await nextTick();
        console.log('🎯 Focus state after restoration:', {
          focusedId: focusedId.value,
          hasChildren: focusedItem.children?.length || 0,
          breadcrumbPath: breadcrumbPath.value.length
        });
        
        // Update page title for the focused item
        updatePageTitle();
      } else {
        console.warn('⚠️ Focused item not found in outline:', targetIdNum, 'Available IDs:', getAllItemIds(outline.value));
        // Clear invalid focus from URL
        const newQuery = { ...route.query };
        delete newQuery.focus;
        router.replace({ query: newQuery });
        focusedId.value = null;
      }
    }

    // Function to subscribe to real-time changes
    async function subscribeToChanges() {
      if (!workspaceId.value || !outlineId.value) return;

      // Unsubscribe from any existing subscription
      if (realtimeSubscription.value) {
        realtimeSubscription.value.unsubscribe();
      }

      // Subscribe to changes on the outlines table
      realtimeSubscription.value = supabase
        .channel(`outline_changes_${outlineId.value}_${outlineRenderID.value}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'outlines',
            filter: `id=eq.${outlineId.value}`
          },
          async (payload) => {
            console.log('🔄 Received real-time update:', {
              eventType: payload.eventType,
              newVersion: payload.new?.version,
              currentLocalVersion: currentVersion.value,
              updateRenderID: payload.new?.render_id,
              ourRenderID: outlineRenderID.value,
              isSaving: saving.value
            });
            
            // Check if this update came from our own tab
            const updateRenderID = payload.new?.render_id;
            const updateVersion = payload.new?.version;
            
            if (updateRenderID === outlineRenderID.value) {
              console.log('⏭️ Skipping update - this came from our own tab (renderID match)');
              // Update our local version tracking to stay in sync
              if (updateVersion && updateVersion > currentVersion.value) {
                currentVersion.value = updateVersion;
                localStorage.setItem(getVersionKey(), updateVersion.toString());
              }
              return;
            }
            
            // If we're currently saving, skip processing to avoid race conditions
            if (saving.value) {
              console.log('⏭️ Skipping update - currently saving (avoiding race condition)');
              return;
            }
            
            // If we just saved recently (within 2 seconds), skip processing
            if (lastSaveTime.value && (Date.now() - new Date(lastSaveTime.value).getTime()) < 2000) {
              console.log('⏭️ Skipping update - recent save detected (avoiding post-save conflict)');
              // Still update version tracking if the received version is higher
              if (updateVersion && updateVersion > currentVersion.value) {
                console.log('📝 Updating version after recent save:', updateVersion);
                currentVersion.value = updateVersion;
                localStorage.setItem(getVersionKey(), updateVersion.toString());
              }
              return;
            }

            // Add a small delay to avoid immediate notifications after saves
            await new Promise(resolve => setTimeout(resolve, 300));

            // Skip notifications for the first update after page load to avoid spam
            const isFirstUpdate = !firstUpdateReceived.value;
            firstUpdateReceived.value = true;

            try {
              // For UPDATE events
              if (payload.eventType === 'UPDATE') {
                const newContent = payload.new.content;
                const newVersion = payload.new.version;

                console.log('📊 Version check:', {
                  current: currentVersion.value,
                  received: newVersion,
                  updateRenderID,
                  ourRenderID: outlineRenderID.value
                });

                // Always update version tracking, regardless of content merge
                const versionIsNewer = newVersion > currentVersion.value;
                const versionIsSame = newVersion === currentVersion.value;
                
                if (versionIsNewer || versionIsSame) {
                  console.log('🔄 Processing update from another tab');
                  
                  // Safe content comparison with error handling
                  let currentContentStr, newContentStr, contentIsDifferent;
                  try {
                    // Create a deep clone to avoid reactive object issues during comparison
                    const currentContentSnapshot = JSON.parse(JSON.stringify(outline.value));
                    currentContentStr = JSON.stringify(currentContentSnapshot);
                    newContentStr = JSON.stringify(newContent);
                    contentIsDifferent = currentContentStr !== newContentStr;
                  } catch (serializationError) {
                    console.warn('⚠️ Content comparison failed, assuming content is different:', serializationError);
                    // If serialization fails, assume content is different and proceed safely
                    contentIsDifferent = true;
                    currentContentStr = '';
                    newContentStr = JSON.stringify(newContent);
                  }
                  
                  if (contentIsDifferent) {
                    console.log('📝 Content is different, deciding how to merge...');
                    
                    if (!hasChanges.value) {
                      // No local changes - safe to update completely
                      console.log('✅ No local changes - applying remote update');
                      const freshContent = JSON.parse(JSON.stringify(newContent));
                      
                      // Update local state
                      try {
                        await nextTick(() => {
                          // Clear autoFocus properties from synced content to prevent conflicts
                          ensureAutoFocusProp(freshContent, true);
                          outline.value = freshContent;
                          currentVersion.value = newVersion;
                          lastSavedContent.value = JSON.parse(JSON.stringify(freshContent));
                          hasChanges.value = false;
                          
                          // Validate focus after sync update
                          validateAndRestoreFocus();
                        });
                      } catch (updateError) {
                        console.warn('⚠️ Error updating local state, applying manually:', updateError);
                        // Fallback to direct assignment if nextTick fails
                        ensureAutoFocusProp(freshContent, true);
                        outline.value = freshContent;
                        currentVersion.value = newVersion;
                        lastSavedContent.value = JSON.parse(JSON.stringify(freshContent));
                        hasChanges.value = false;
                        
                        // Validate focus after sync update
                        validateAndRestoreFocus();
                      }

                      // Update localStorage
                      try {
                        const localStorageKey = getLocalStorageKey();
                        const versionKey = getVersionKey();
                        localStorage.setItem(localStorageKey, JSON.stringify(freshContent));
                        localStorage.setItem(versionKey, newVersion.toString());
                        localStorage.setItem(`${localStorageKey}_last_saved`, JSON.stringify(freshContent));
                      } catch (storageError) {
                        console.warn('⚠️ Failed to update localStorage:', storageError);
                        // Continue execution even if localStorage fails
                      }

                      // Only show notification if this is a significant structural change
                      // and it's not the first update after page load
                      const currentItemCount = JSON.stringify(outline.value).split('"id":').length - 1;
                      const newItemCount = JSON.stringify(freshContent).split('"id":').length - 1;
                      const hasStructuralChanges = currentItemCount !== newItemCount;
                      
                      if (hasStructuralChanges && !isFirstUpdate) {
                        ElNotification({
                          title: 'Outline Updated',
                          message: 'The outline structure has been updated from another tab',
                          type: 'success',
                          duration: 3000
                        });
                      }
                    } else {
                      // We have local changes - check if they're actually conflicting
                      console.log('⚠️ Local changes detected - checking for actual conflicts');
                      
                      // Check if our local changes are the same as what we're receiving
                      let localChangesStr, remoteChangesStr;
                      try {
                        const localSnapshot = JSON.parse(JSON.stringify(outline.value));
                        localChangesStr = JSON.stringify(localSnapshot);
                        remoteChangesStr = JSON.stringify(newContent);
                      } catch (comparisonError) {
                        console.warn('⚠️ Local changes comparison failed, treating as conflict:', comparisonError);
                        // If comparison fails, treat as a conflict to be safe
                        localChangesStr = 'local_error';
                        remoteChangesStr = 'remote_content';
                      }
                      
                      if (localChangesStr === remoteChangesStr) {
                        // Our local changes match the remote content - this is a sync, not a conflict
                        console.log('✅ Local changes match remote content - applying sync');
                        
                        // Update local state to match the server
                        try {
                          await nextTick(() => {
                            const syncedContent = JSON.parse(JSON.stringify(newContent));
                            ensureAutoFocusProp(syncedContent, true);
                            outline.value = syncedContent;
                            currentVersion.value = newVersion;
                            lastSavedContent.value = JSON.parse(JSON.stringify(newContent));
                            hasChanges.value = false;
                            
                            // Validate focus after sync update
                            validateAndRestoreFocus();
                          });
                        } catch (syncUpdateError) {
                          console.warn('⚠️ Error updating state during sync, applying manually:', syncUpdateError);
                          // Fallback to direct assignment if nextTick fails
                          const syncedContent = JSON.parse(JSON.stringify(newContent));
                          ensureAutoFocusProp(syncedContent, true);
                          outline.value = syncedContent;
                          currentVersion.value = newVersion;
                          lastSavedContent.value = JSON.parse(JSON.stringify(newContent));
                          hasChanges.value = false;
                          
                          // Validate focus after sync update
                          validateAndRestoreFocus();
                        }

                        // Update localStorage
                        try {
                          const localStorageKey = getLocalStorageKey();
                          const versionKey = getVersionKey();
                          localStorage.setItem(localStorageKey, JSON.stringify(newContent));
                          localStorage.setItem(versionKey, newVersion.toString());
                          localStorage.setItem(`${localStorageKey}_last_saved`, JSON.stringify(newContent));
                        } catch (syncStorageError) {
                          console.warn('⚠️ Failed to update localStorage during sync:', syncStorageError);
                          // Continue execution even if localStorage fails
                        }

                        // Silently sync - no notification needed for seamless sync
                        console.log('✅ Changes synchronized between tabs');
                      } else {
                        // Actual conflict - local changes are different from remote
                        console.log('⚠️ Actual conflict detected - preserving local changes');
                        
                        // Update version and saved content reference for conflict tracking
                        currentVersion.value = newVersion;
                        lastSavedContent.value = JSON.parse(JSON.stringify(newContent));
                        
                        // Recalculate hasChanges based on new remote content
                        hasChanges.value = checkForChanges(outline.value);
                        
                        // Update localStorage with remote version info but keep local content
                        try {
                          const versionKey = getVersionKey();
                          localStorage.setItem(versionKey, newVersion.toString());
                          localStorage.setItem(`${getLocalStorageKey()}_last_saved`, JSON.stringify(newContent));
                        } catch (conflictStorageError) {
                          console.warn('⚠️ Failed to update localStorage during conflict handling:', conflictStorageError);
                          // Continue execution even if localStorage fails
                        }
                        
                        // Show conflict notification only for real conflicts, but only if not first update
                        if (!isFirstUpdate) {
                          ElNotification({
                            title: 'Sync Conflict Detected',
                            message: 'Another user updated the outline while you have different unsaved changes. Your changes are preserved.',
                            type: 'warning',
                            duration: 5000,
                            showClose: true
                          });
                        }
                      }
                    }
                  } else {
                    // Content is the same, just update version tracking
                    console.log('📄 Content is identical - updating version only');
                    currentVersion.value = newVersion;
                    lastSavedContent.value = JSON.parse(JSON.stringify(newContent));
                    hasChanges.value = checkForChanges(outline.value);
                    
                    // Update localStorage version
                    try {
                      const versionKey = getVersionKey();
                      localStorage.setItem(versionKey, newVersion.toString());
                    } catch (versionStorageError) {
                      console.warn('⚠️ Failed to update version in localStorage:', versionStorageError);
                      // Continue execution even if localStorage fails
                    }
                  }
                } else {
                  console.log('⏪ Received older version - ignoring');
                }
              }
            } catch (error) {
              console.error('❌ Error handling real-time update:', error);
              
              // Try to recover by refreshing the outline
              try {
                await loadOutline();
                console.log('🔄 Successfully recovered from sync error');
              } catch (recoveryError) {
                console.error('❌ Failed to recover from sync error:', recoveryError);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to outline changes');
          } else if (status === 'CLOSED') {
            console.log('❌ Subscription closed - attempting to reconnect...');
            // Retry subscription after a delay
            setTimeout(() => {
              if (outlineId.value && workspaceId.value) {
                subscribeToChanges();
              }
            }, 2000);
          } else {
            console.log('📡 Subscription status changed:', status);
          }
        });
    }

    // Tab event handlers
    const handleTabChanged = async (tab) => {
      console.log('🔄 Switching to tab:', tab.id, tab.title);
      // Update URL to include selected tab so reload preserves it
      try {
        const currentPath = router.currentRoute.value.path.replace(/\/tab\/.*$/, '');
        router.replace({ path: `${currentPath}/tab/${tab.id}` }).catch(() => {});
      } catch (e) {
        // ignore router errors
      }

      if (outlineId.value !== tab.id) {
        await loadOutline(tab.id);
      }
    }

    const handleTabCreated = async (tab) => {
      console.log('➕ New tab created:', tab.id, tab.title);
      // Switch to the new tab
      try {
        const currentPath = router.currentRoute.value.path.replace(/\/tab\/.*$/, '');
        router.replace({ path: `${currentPath}/tab/${tab.id}` }).catch(() => {});
      } catch (e) {}
      await loadOutline(tab.id);
    }

    const handleTabDeleted = (tab) => {
      console.log('🗑️ Tab deleted:', tab.id, tab.title);
      // If this was the current tab, loadOutline will be called by the tabs component
      // when it switches to another tab
    }

    const handleTabUpdated = (tab) => {
      console.log('✏️ Tab updated:', tab.id, tab.title);
      // Update page title if this is the current tab
      if (outlineId.value === tab.id) {
        updatePageTitle();
      }
    }

    return { 
      workspaceId,
      outlineId,
      currentOutlineId,
      // expose icons to template for :icon / :prefix-icon bindings
      Search,
      Refresh,
      Clock,
      Back,
      Loading,
      Warning,
      Check,
      outline, 
      saving,
      refreshing,
      hasChanges,
      outlineRenderID,
      displayVersion,
      lastSaveTime,
      currentWorkspace,
      workspaceName,
      updatePageTitle,
      onOutlineUpdate, 
      handleMove, 
      handleDelete,
      saveOutline,
      manualRefresh,
      checkVersionBeforeEdit,
      handleVersionConflict,
      // Drilldown
      focusedId,
      handleDrilldown,
      handleBack,
      getFocusedOutline,
      getFilteredOutline,
      // Breadcrumbs
      breadcrumbPath,
      handleBreadcrumb,
  breadcrumbHref,
      getBreadcrumbText,
      openHistoryDialog,
      historyDialogVisible,
      viewVersionDialogVisible,
      versionHistory,
      loadingHistory,
      selectedVersion,
      viewVersion,
      formatDate,
      handleNavigate,
      handleIndent,
      handleOutdent,
      handleAddSiblingRoot,
      isNodeCollapsed,
      handleCollapseToggle,
      // Search
      searchQuery,
      searchStats,
      clearSearch,
      updateSearchStats,
      addFirstItem,
      isAuthenticated,
      authCheckDone,
      userInfo,
      outlineMetadata,
      // Diff functionality
      selectedOldVersion,
      selectedNewVersion,
      showDiff,
      getVersionByNumber,
      compareWithPrevious,
      closeDiff,
      MAX_HISTORY_VERSIONS,
      // Tab handlers
      handleTabChanged,
      handleTabCreated,
      handleTabDeleted,
      handleTabUpdated
    };
  }
};
</script>

<style scoped>
.not-auth-message {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 3rem 2rem;
  max-width: 700px;
  margin: 3rem auto;
  text-align: center;
}
.not-auth-message h2 {
  margin: 0 0 0.75rem;
  font-size: 1.6rem;
  color: #23272f;
}
.not-auth-message p {
  margin: 0;
  color: #555;
  font-size: 1rem;
}

.outline-container {
  background: white;
  border-radius: 8px;
  padding: 0;
  min-height: 200px;
  max-width: 1200px;
  margin: 0.75rem auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.outline-header-wrapper {
  padding: 1rem 2rem 0 2rem;
}

.outline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.outline-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  flex-shrink: 0;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.search-input :deep(.el-input__wrapper):hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.search-stats {
  font-size: 0.85em;
  color: #666;
  white-space: nowrap;
  background: #f0f2f5;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.sync-status {
  display: flex;
  align-items: center;
  font-size: 0.9em;
  gap: 0.5rem;
}

.outline-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.outline-breadcrumbs {
  margin-bottom: 1rem;
  font-size: 0.95rem;
  color: #888;
  padding: 0 2rem;
}

.breadcrumb-link {
  cursor: pointer;
  color: #1976d2;
  text-decoration: none;
}

.breadcrumb-link:hover {
  text-decoration: underline;
}

.version-content {
  max-height: 600px;
  overflow-y: auto;
}

.version-info {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f5f7fa;
  border-radius: 4px;
}

.version-info p {
  margin: 0.5rem 0;
}

.version-outline {
  margin-top: 1rem;
}

.search-results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  margin: 0 2rem 16px 2rem;
  font-size: 0.9em;
}

.search-icon {
  color: #6c757d;
  font-size: 16px;
}

.search-results-text {
  flex: 1;
  color: #495057;
}

.search-results-text strong {
  color: #212529;
  font-weight: 600;
}

.clear-search-btn {
  font-size: 0.85em;
  padding: 4px 8px;
}

.empty-state {
  text-align: left;
  padding: 3rem;
  color: #666;
}

.empty-state p {
  font-size: 1.1em;
  margin-bottom: 1rem;
}

/* History dialog styles */
.history-dialog-content {
  max-height: 70vh;
  min-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.diff-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e1e8ed;
  background: #f8f9fa;
}

.diff-title {
  font-weight: 600;
  color: #1976d2;
  font-size: 1rem;
}

.version-table {
  flex: 1;
  overflow: auto;
}

.version-table :deep(.el-table__row) {
  cursor: pointer;
}

.version-table :deep(.el-table__row:hover) {
  background-color: #f0f2f5;
}

.diff-view-container {
  flex: 1;
  overflow: auto;
  border: 1px solid #e1e8ed;
  border-radius: 6px;
  background: white;
  display: flex;
  flex-direction: column;
}

.history-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-info {
  flex: 1;
}

.diff-info {
  font-weight: 600;
  color: #1976d2;
}

.table-info {
  color: #666;
  font-size: 0.9rem;
}

.click-hint {
  color: #999;
  font-style: italic;
}

.limit-hint {
  color: #f39c12;
  font-weight: 500;
}

@media (max-width: 768px) {
  .outline-container {
    padding: 0.75rem;
  }
  
  .outline-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .outline-actions {
    justify-content: center;
  }
  
  .sync-status {
    justify-content: center;
  }
  
  .diff-header-bar {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>
