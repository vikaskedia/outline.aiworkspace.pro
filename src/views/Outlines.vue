<template>
  <!-- Not authenticated message -->
  <div v-if="!isAuthenticated" class="not-auth-message">
    <h2>Sign in required</h2>
    <p>Please log in to view and edit this workspace outline.</p>
  </div>

  <!-- Outline content only when authenticated -->
  <div v-else class="outline-container">
    <!-- Breadcrumbs -->
    <div v-if="breadcrumbPath.length" class="outline-breadcrumbs">
      <template v-for="(node, idx) in breadcrumbPath" :key="node.id">
        <span 
          v-if="idx < breadcrumbPath.length - 1"
          class="breadcrumb-link"
          @click="handleBreadcrumb(node, idx)"
        >
          {{ getBreadcrumbText(node.text) }}
        </span>
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

    <!-- Version History Dialog -->
    <el-dialog v-model="historyDialogVisible" title="Outline Version History" width="700px">
      <el-table :data="versionHistory" style="width: 100%" v-loading="loadingHistory">
        <el-table-column prop="version" label="Version" width="80" />
        <el-table-column prop="created_at" label="Date" width="160" :formatter="(row) => formatDate(row.created_at)" />
        <el-table-column prop="changes_summary" label="Summary" />
        <el-table-column fixed="right" label="Actions" width="100">
          <template #default="{ row }">
            <el-button @click="viewVersion(row)" size="small">View</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="historyDialogVisible = false">Close</el-button>
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
</template>

<script>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElNotification, ElMessageBox } from 'element-plus';
import { Clock, Refresh, Search, Back, Loading, Warning, Check } from '@element-plus/icons-vue';
import { supabase } from '../supabase';
import OutlinePointsCt from '../components/OutlinePointsCt.vue';
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

// Generate unique render ID for this tab
function generateRenderID() {
  return 'render_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export default {
  name: 'OutlineCt',
  components: { OutlinePointsCt, Clock, Refresh, Search, Back, Loading, Warning, Check },
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

    // Function to update page title
    const updatePageTitle = () => {
      const focusedNode = focusedId.value ? findItemById(outline.value, focusedId.value) : null;
      const focusedText = focusedNode ? getCleanText(focusedNode.text) : undefined;
      setOutlineTitle(focusedText, workspaceName.value);
    };
    
    let refreshInterval = null;

    // Create debounced save function
    const debouncedSave = debounce(async () => {
      // Only save if there are changes and we're not already saving
      if (hasChanges.value && !saving.value) {
        await saveOutline();
      }
    }, 2000);

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
    function ensureAutoFocusProp(items) {
      for (const item of items) {
        if (item.autoFocus === undefined) {
          item.autoFocus = false;
        }
        if (item.children) {
          ensureAutoFocusProp(item.children);
        }
      }
    }

    // Load from Supabase or localStorage
    async function loadOutline() {
      if (!workspaceId.value) return;
      loadCollapsedState();
      const focusParam = route.query.focus; if (focusParam) focusedId.value = parseInt(focusParam);
      hasChanges.value = false;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        authCheckDone.value = true;
        if (!authUser) {
          isAuthenticated.value = false;
          outline.value = [];
          lastSavedContent.value = null;
          return; // Do not load defaults for unauthenticated users
        }
        isAuthenticated.value = true;

        const { data: existingOutline, error: outlineError } = await supabase
          .from('outlines')
          .select('id, content, version, title')
          .eq('workspace_id', workspaceId.value)
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (outlineError) console.warn('Outline fetch error', outlineError.message);
        if (existingOutline && existingOutline.content) {
          outlineId.value = existingOutline.id;
          outline.value = Array.isArray(existingOutline.content) ? existingOutline.content : [];
          ensureAutoFocusProp(outline.value);
          lastSavedContent.value = deepClone(outline.value);
          currentVersion.value = existingOutline.version || 1;
        } else {
          const initial = deepClone(defaultOutline);
          const { data: created, error: createErr } = await supabase
            .from('outlines')
            .insert([{ workspace_id: workspaceId.value, title: 'Outline', content: initial }])
            .select('id, version')
            .single();
          if (!createErr && created) {
            outlineId.value = created.id;
            outline.value = initial;
            ensureAutoFocusProp(outline.value);
            lastSavedContent.value = deepClone(outline.value);
            currentVersion.value = created.version || 1;
          } else if (createErr) {
            console.error('Create outline error', createErr.message);
            outline.value = deepClone(defaultOutline); ensureAutoFocusProp(outline.value);
          }
        }
      } catch (err) {
        console.error('Supabase outline load failed, falling back to localStorage', err);
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
    }

    onMounted(async () => {
      await loadOutline();
    });

    // Reload outline when workspace changes via navigation (same component instance)
    watch(workspaceId, async (newVal, oldVal) => {
      if (!newVal || newVal === oldVal) return;
      // Reset state before loading new workspace outline
      outline.value = [];
      outlineId.value = null;
      currentVersion.value = 1;
      lastSavedContent.value = null;
      focusedId.value = null;
      collapsedNodes.value = new Set();
      lastSaveTime.value = null;
      await loadOutline();
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
            const nextVersion = (currentVersion.value || 1) + 1;
            const { error: updateErr, data: updated } = await supabase
              .from('outlines')
              .update({ content: outline.value, updated_at: new Date().toISOString(), version: nextVersion })
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
      for (const item of items) {
        if (item.id === id) {
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
      for (const item of items) {
        if (item.id === id) {
          return parent;
        }
        if (item.children) {
          const found = findParentById(item.children, id, item);
          if (found) return found;
        }
      }
      return null;
    }

    function onOutlineUpdate({ id, text, comments, fileUrl, immediate }) {
      updateTextById(outline.value, id, text, { comments, fileUrl });
      hasChanges.value = checkForChanges(outline.value);
      debouncedSave();
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
      const beforeJson = JSON.stringify(outline.value);
      removeItemById(outline.value, id);
      if (beforeJson !== JSON.stringify(outline.value)) { hasChanges.value = true; debouncedSave(); }
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
      if (!focusedId.value) return outline.value;
      
      const focusedItem = findItemById(outline.value, focusedId.value);
      return focusedItem ? focusedItem.children || [] : outline.value;
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
      for (const item of items) {
        const currentPath = [...path, item];
        
        if (item.id === id) {
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
      return findPathToNode(outline.value, focusedId.value) || [];
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

    function getBreadcrumbText(text) {
      return getCleanText(text) || 'Untitled';
    }

    async function openHistoryDialog() {
      historyDialogVisible.value = true;
      loadingHistory.value = true;
      
      // Mock version history
      versionHistory.value = [
        {
          version: currentVersion.value,
          created_at: new Date().toISOString(),
          changes_summary: 'Current version'
        },
        {
          version: currentVersion.value - 1,
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          changes_summary: 'Added new items'
        }
      ];
      
      loadingHistory.value = false;
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
      if (asChild) {
        const target = findItemById(outline.value, id);
        if (!target) return;
        if (!target.children) target.children = [];
        const newId = Date.now();
        target.children.push({ id: newId, text: '', children: [], autoFocus: true });
        hasChanges.value = true; debouncedSave();
        return;
      }
      const parent = findParentById(outline.value, id);
      const parentArray = parent ? parent.children : outline.value;
      const itemIndex = parentArray.findIndex(item => item.id === id);
      const newId = Date.now();
      const newItem = { id: newId, text: '', children: [], autoFocus: true };
      parentArray.splice(itemIndex + 1, 0, newItem);
      hasChanges.value = true; debouncedSave();
    }

    // Manual refresh function for user-triggered sync
    async function manualRefresh() {
      if (refreshing.value) return;
      
      try {
        refreshing.value = true;
        
        // In a real app, fetch from Supabase here
        await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
        
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
      // In a real app, check against server version
      return { canEdit: true };
    }

    // Handle version conflict with user choice
    async function handleVersionConflict(versionCheck) {
      return new Promise((resolve) => {
        const conflictMessage = `The outline has been updated by another user while you were away.

**Your version:** ${versionCheck.currentVersion}
**Latest version:** ${versionCheck.serverVersion}

To prevent data loss and conflicts, you need to reload the latest changes before editing.`;

        ElMessageBox.confirm(
          conflictMessage,
          '🔄 Update Required - Reload Latest Version',
          {
            confirmButtonText: 'Reload Latest',
            cancelButtonText: 'Cancel',
            type: 'warning'
          }
        ).then(async () => {
          // User chose to reload
          try {
            await manualRefresh();
            resolve({ canEdit: true, reloaded: true });
          } catch (error) {
            resolve({ canEdit: false });
          }
        }).catch(() => {
          // User cancelled - no editing allowed
          ElNotification({
            title: 'Edit Cancelled',
            message: 'You need to sync with the latest version before editing.',
            type: 'info',
            duration: 4000
          });
          resolve({ canEdit: false });
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

    return { 
      workspaceId,
      outlineId,
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
      authCheckDone
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
  padding: 2rem;
  min-height: 200px;
  max-width: 1200px;
  margin: 2rem auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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
  margin-bottom: 16px;
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

@media (max-width: 768px) {
  .outline-container {
    padding: 1rem;
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
}
</style>
