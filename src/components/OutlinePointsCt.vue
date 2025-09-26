<template>
  <li 
    class="outline-item" 
    :data-id="item.id"
    :class="{ 
      'dragging': isDragging,
      'search-match': searchQuery && item.text && item.text.toLowerCase().includes(searchQuery.toLowerCase()),
      'search-context': searchQuery && !item.text?.toLowerCase().includes(searchQuery.toLowerCase())
    }"
    @dragover.prevent.stop="handleDragOver"
    @dragenter.prevent.stop="handleDragEnter"
    @dragleave.prevent.stop="handleDragLeave"
    @drop.prevent.stop="handleDrop"
    @dragend.prevent.stop="handleDragEnd"
    tabindex="0"
  >
    <div class="outline-row">
      <!-- Collapse Toggle -->
      <span 
        class="collapse-toggle"
        :class="{ collapsed: effectiveCollapsed }"
        @click="toggleCollapse" 
      >
        <el-icon v-if="effectiveCollapsed && hasChildren"><CaretRight /></el-icon>
        <el-icon v-else-if="hasChildren"><CaretBottom /></el-icon>
        <el-icon v-else style="display: none;"><CaretBottom /></el-icon>
      </span>

      <!-- Bullet Point -->
      <div 
        class="outline-bullet"
        :class="{ 'focusable': hasChildren }"
        @click="handleBulletClick"
        draggable="true"
        @dragstart="handleDragStart"
      ></div>

      <!-- Three Dot Menu -->
      <el-dropdown 
        class="three-dot-menu"
        @command="handleCommand"
        trigger="click"
        placement="bottom-start"
      >
        <div class="three-dots">
          <el-icon><MoreFilled /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="add-child">
              <el-icon><Plus /></el-icon>
              Add Child
            </el-dropdown-item>
            <el-dropdown-item command="add-sibling">
              <el-icon><Plus /></el-icon>
              Add Sibling Below
            </el-dropdown-item>
            <el-dropdown-item command="indent">➡️ Indent</el-dropdown-item>
            <el-dropdown-item command="outdent">⬅️ Outdent</el-dropdown-item>
            <el-dropdown-item v-if="hasChildren" command="collapse">
              <el-icon>
                <CaretRight v-if="effectiveCollapsed" />
                <CaretBottom v-else />
              </el-icon>
              {{ effectiveCollapsed ? 'Expand' : 'Collapse' }}
            </el-dropdown-item>
            <el-dropdown-item v-if="hasChildren" command="drilldown">
              <el-icon><Right /></el-icon>
              Focus on this
            </el-dropdown-item>
            <el-dropdown-item command="comment">
              <el-icon><ChatDotRound /></el-icon>
              Comment ({{ comments.length }})
            </el-dropdown-item>
            <el-dropdown-item command="copy-link">
              <el-icon><Link /></el-icon>
              Copy Internal Link
            </el-dropdown-item>
            <el-dropdown-item command="copy-point">
              <el-icon><DocumentCopy /></el-icon>
              Copy Point
            </el-dropdown-item>
            <el-dropdown-item divided disabled class="info-divider">
              <div class="item-info-inline">
                <div v-if="getCreatedInfo().date" class="info-line">
                  <small>Created by {{ getCreatedInfo().by }} on {{ getCreatedInfo().date }}</small>
                </div>
                <div v-if="item.updated_at && getLastModifiedBy()" class="info-line">
                  <small>Modified by {{ getLastModifiedBy() }} on {{ formatDate(item.updated_at) }}</small>
                </div>
              </div>
            </el-dropdown-item>
            <el-dropdown-item divided command="delete">
              <el-icon><Delete /></el-icon>
              Delete
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- Text Content -->
      <div 
        v-if="!editing"
        class="outline-text"
        @click="handleTextClick"
        @dblclick="startEdit"
        v-html="renderedText"
      ></div>

      <textarea
        v-else
        ref="textarea"
        v-model="editText"
        class="outline-textarea"
        @blur="finishEdit"
        @keydown.enter.exact="handleEnter"
        @keydown.tab.prevent="handleIndent"
        @keydown.shift.tab.prevent="handleOutdent"
        @keydown.backspace="handleBackspace"
        @keydown.meta.b.prevent="handleBold"
        @keydown.ctrl.b.prevent="handleBold"
        @keydown.meta.u.prevent="handleUnderline"
        @keydown.ctrl.u.prevent="handleUnderline"
        @input="handleTextChange"
        @paste="handlePaste"
        @drop="handleFileDrop"
        @mouseup="handleSelection"
        @keyup="handleSelection"
        rows="1"
        placeholder="Type your outline item..."
      />

      <!-- Selection Tooltip -->
      <div
        v-if="selectionTooltipVisible"
        class="selection-tooltip"
        :style="selectionTooltipStyle"
        @mousedown.prevent
      >
        <button class="tooltip-button" @click="handleBold" title="Bold (⌘+B)">
          <strong>B</strong>
        </button>
        <button class="tooltip-button" @click="handleUnderline" title="Underline (⌘+U)">
          <u>U</u>
        </button>
        <button class="tooltip-button" @click="openLinkDialog" title="Add link (⌘+K)">🔗 Link</button>
        <button class="tooltip-button" @click="clearSelection" title="Close">✕</button>
      </div>

      <!-- Link Dialog -->
      <el-dialog v-model="linkDialogVisible" title="Create Link" width="380px" @close="resetLinkDialog">
        <div class="link-dialog-body">
          <p class="selected-text" v-if="selectedText">Selected: <strong>{{ selectedText }}</strong></p>
          <el-input v-model="linkUrl" placeholder="https://example.com" />
        </div>
        <template #footer>
          <el-button @click="linkDialogVisible=false">Cancel</el-button>
          <el-button type="primary" :disabled="!validLink" @click="applyLink">Insert</el-button>
        </template>
      </el-dialog>

      <!-- Comment Icon -->
      <el-icon 
        v-if="hasComments" 
        class="comment-icon"
        @click="openCommentDialog"
        color="#ff9800"
      >
        <ChatDotRound />
      </el-icon>
    </div>

    <!-- Drop Indicators -->
    <div
      v-show="isDragOverTop"
      class="drop-indicator indicator-top"
    ></div>
    <div
      v-show="isDragOverBottom"
      class="drop-indicator indicator-bottom"
    ></div>
    <div
      v-show="isDragOverChild && hasChildren"
      class="drop-indicator indicator-child"
    ></div>

    <!-- File Preview Section -->
    <div v-if="item.fileUrl" class="file-preview">
      <img 
        v-if="isImageFile(item.text)" 
        :src="imageSrc" 
        :alt="getFileName(item.text)"
        class="preview-image"
        @click="openImagePreview"
      />
      <div v-else class="file-info">
        <span class="file-name">{{ getFileName(item.text) }}</span>
        <el-button size="small" @click="downloadFile">Download</el-button>
      </div>
    </div>

    <!-- Comment Dialog -->
    <el-dialog v-model="commentDialogVisible" title="Comments" width="350px">
      <div class="comments-list">
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <div v-if="comment.editing">
            <el-input
              v-model="comment.text"
              type="textarea"
              :rows="2"
              class="comment-edit-textarea"
            />
            <div class="comment-actions">
              <el-button size="small" @click="saveComment(comment)">Save</el-button>
              <el-button size="small" @click="cancelEditComment(comment)">Cancel</el-button>
            </div>
          </div>
          <div v-else>
            <p>{{ comment.text }}</p>
            <div class="comment-actions">
              <el-button size="small" @click="editComment(comment)">Edit</el-button>
              <el-button size="small" type="danger" @click="deleteComment(comment.id)">Delete</el-button>
            </div>
          </div>
        </div>
      </div>
      <div class="add-comment-section">
        <el-input
          v-model="newCommentText"
          type="textarea"
          :rows="2"
          placeholder="Add a comment..."
          class="comment-add-textarea"
        />
        <el-button @click="addComment" :disabled="!newCommentText.trim()">Add Comment</el-button>
      </div>
    </el-dialog>

    <!-- Image Preview Dialog -->
    <el-dialog
      v-model="imagePreviewVisible"
      :show-close="true"
      class="image-preview-dialog"
      width="80%"
    >
      <img 
        v-if="item.fileUrl && isImageFile(item.text)" 
        :src="imageSrc" 
        class="preview-image-full"
        :alt="getFileName(item.text)"
      />
    </el-dialog>

    <!-- Child Items -->
    <ul v-if="hasChildren && !effectiveCollapsed" class="outline-list">
      <OutlinePointsCt
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :readonly="readonly"
        :auto-focus="child.autoFocus"
        :collapsed="isNodeCollapsed(child.id)"
        :is-node-collapsed="isNodeCollapsed"
        :check-version-before-edit="checkVersionBeforeEdit"
        :handle-version-conflict="handleVersionConflict"
        :search-query="searchQuery"
        :outline-metadata="outlineMetadata"
        :user-info="userInfo"
        @update="updateChild"
        @move="handleMove"
        @delete="handleDelete"
        @drilldown="handleDrilldown"
        @navigate="handleNavigate"
        @indent="handleIndent"
        @outdent="handleOutdent"
        @add-sibling="handleAddSibling"
        @collapse-toggle="handleCollapseToggle"
      />
    </ul>
  </li>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Plus, Delete, MoreFilled, ChatDotRound, Link, Right, Back, CaretRight, CaretBottom, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { dragState } from './dragState.js'

export default {
  name: 'OutlinePointsCt',
  components: { Plus, Delete, MoreFilled, ChatDotRound, Link, Right, Back, CaretRight, CaretBottom, DocumentCopy },
  props: {
    item: { type: Object, required: true },
    readonly: { type: Boolean, default: false },
    autoFocus: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    isNodeCollapsed: { type: Function, default: () => () => false },
    checkVersionBeforeEdit: { type: Function, default: () => async () => ({ canEdit: true }) },
    handleVersionConflict: { type: Function, default: () => async () => ({ canEdit: true }) },
    searchQuery: { type: String, default: '' },
    outlineMetadata: { type: Object, default: () => ({}) },
    userInfo: { type: Object, default: () => ({}) }
  },
  emits: ['update', 'move', 'delete', 'drilldown', 'navigate', 'indent', 'outdent', 'add-sibling', 'collapse-toggle'],
  setup(props, { emit }) {
    const editing = ref(false)
    const editText = ref('')
    const textarea = ref(null)
    const commentDialogVisible = ref(false)
    const imagePreviewVisible = ref(false)
    const comments = ref([])
    const newCommentText = ref('')
    const isDragging = ref(false)

    const selectionTooltipVisible = ref(false)
    const selectionStart = ref(null)
    const selectionEnd = ref(null)
    const selectionTooltipStyle = ref({})
    const linkDialogVisible = ref(false)
    const linkUrl = ref('')
    const selectedText = ref('')

    const hasChildren = computed(() => {
      return props.item.children && props.item.children.length > 0
    })

    const effectiveCollapsed = computed(() => {
      return props.isNodeCollapsed(props.item.id)
    })

    const isDragOverTop = computed(() => {
      return dragState.hoveredId === props.item.id && dragState.hoveredPosition === 'top'
    })

    const isDragOverBottom = computed(() => {
      return dragState.hoveredId === props.item.id && dragState.hoveredPosition === 'bottom'
    })

    const isDragOverChild = computed(() => {
      return dragState.hoveredId === props.item.id && dragState.hoveredPosition === 'child'
    })

    const hasComments = computed(() => {
      return comments.value && comments.value.length > 0
    })

    const validLink = computed(() => /^(https?:\/\/).+/i.test(linkUrl.value.trim()))


    const escapeHtml = (str = '') => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

    const linkify = (text = '') => {
      if (!text) return ''
      // Escape first
      let html = escapeHtml(text)
      
      // Process bold formatting **text** and __text__
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/__(.*?)__/g, '<strong>$1</strong>')
      
      // Process underline formatting _u_text_/u_ (match your handleUnderline function)
      html = html.replace(/_u_(.*?)_\/u_/g, '<u>$1</u>')
      
      // Markdown links [title](http://url)
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, label, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
      })
      // Plain URLs (avoid ones already inside an anchor)
      html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)(?![^<]*?>)/g, (m, prefix, url) => {
        return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      })
      return html
    }

    const applySearchHighlight = (html) => {
      if (!props.searchQuery) return html
      const q = props.searchQuery.trim()
      if (!q) return html
      // Simple highlight outside of tags
      // Split by tags
      return html.split(/(<[^>]+?>)/g).map(segment => {
        if (segment.startsWith('<')) return segment
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')
        return segment.replace(regex, match => `<span class="search-highlight">${match}</span>`)
      }).join('')
    }

    // Date formatting helper
    const formatDate = (dateString) => {
      if (!dateString) return 'Unknown'
      try {
        const date = new Date(dateString)
        return date.toLocaleString()
      } catch {
        return 'Invalid date'
      }
    }

    // Get user name by ID from outline metadata  
    const getUserNameById = (userId) => {
      if (!userId) return 'Unknown user'
      
      // Check if we have user info in outlineMetadata
      if (props.outlineMetadata?.users && props.outlineMetadata.users[userId]) {
        return props.outlineMetadata.users[userId].name || props.outlineMetadata.users[userId].email || 'Unknown user'
      }
      
      // Check if it's the current user
      if (props.userInfo?.id === userId) {
        return props.userInfo.name || props.userInfo.email || 'You'
      }
      
      // For creator, try to get name from outline metadata
      if (userId === props.outlineMetadata?.created_by && props.outlineMetadata?.created_by_name) {
        return props.outlineMetadata.created_by_name
      }
      
      // For UUID format, show a more user-friendly format
      if (userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        //return `User ${userId.substring(0, 8)}...`
        return `Someone`
      }
      
      // Return the original if it's not a UUID
      return userId
    }

    // Get creation information
    const getCreatedInfo = () => {
      // Check if this item has individual creation info first
      if (props.item.created_at && props.item.created_by) {
        // Prioritize stored name, then try to resolve by ID
        const creatorName = props.item.created_by_name || getUserNameById(props.item.created_by) || 'Unknown'
        return {
          date: formatDate(props.item.created_at),
          by: creatorName
        }
      }
      
      // Fallback to outline's creation info for older items
      const outlineCreatedAt = props.outlineMetadata?.created_at
      const outlineCreatedBy = props.outlineMetadata?.created_by
      
      if (outlineCreatedAt && outlineCreatedBy) {
        return {
          date: formatDate(outlineCreatedAt),
          by: getUserNameById(outlineCreatedBy)
        }
      }
      
      return { date: null, by: null }
    }

    // Get last modified by user - check for stored editor info
    const getLastModifiedBy = () => {
      // First check if we have stored editor information on the item
      if (props.item.updated_by_name) {
        return props.item.updated_by_name
      }
      
      if (props.item.updated_by) {
        return getUserNameById(props.item.updated_by)
      }
      
      // Check if the item has been specifically modified (has updated_at but different from creation time)
      if (props.item.updated_at && props.outlineMetadata?.created_at) {
        const itemModified = new Date(props.item.updated_at).getTime()
        const outlineCreated = new Date(props.outlineMetadata.created_at).getTime()
        
        // If the item was modified after outline creation, it was actually edited
        if (itemModified > outlineCreated + 1000) { // 1 second buffer for timing differences
          // If no specific editor info, fallback to creator name
          const creatorInfo = getCreatedInfo()
          if (creatorInfo.by) {
            return creatorInfo.by
          }
          return 'Someone'
        }
      }
      
      // If no specific modification, don't show a modifier
      return null
    }

    const renderedText = computed(() => {
      const base = linkify(props.item.text || 'Click to edit...')
      return applySearchHighlight(base)
    })

    const handleTextClick = (e) => {
      if (e.target.closest('a')) return
      startEdit()
    }

    const handleBulletClick = () => {
      // If item has children, trigger drilldown (focus)
      if (hasChildren.value) {
        emit('drilldown', props.item.id)
      } else {
        // If no children, start editing as before
        startEdit()
      }
    }

    const startEdit = async () => {
      if (props.readonly) return
      
      const versionCheck = await props.checkVersionBeforeEdit()
      if (!versionCheck.canEdit) {
        const conflictResult = await props.handleVersionConflict(versionCheck)
        if (!conflictResult.canEdit) return
      }

      editing.value = true
      editText.value = props.item.text || ''
      
      // Focus textarea on next tick
      setTimeout(() => {
        if (textarea.value) {
          textarea.value.focus()
          autoResize()
        }
      }, 0)
    }

    const finishEdit = () => {
      if (!editing.value) return
      
      editing.value = false
      if (editText.value !== props.item.text) {
        const updatePayload = {
          id: props.item.id,
          text: editText.value,
          immediate: true
        }
        
        // Preserve fileUrl if it exists (important for image uploads)
        if (props.item.fileUrl) {
          updatePayload.fileUrl = props.item.fileUrl
        }
        
        // Add editor info if we have current user info
        if (props.userInfo?.id) {
          updatePayload.updated_by = props.userInfo.id
          updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
        }
        
        emit('update', updatePayload)
      }
    }

    const handleTextChange = () => {
      autoResize()
      // Track who is editing this item
      const updatePayload = {
        id: props.item.id,
        text: editText.value
        // Removed immediate: true to use debounced saving (1 second after stopping typing)
      }
      
      // Preserve fileUrl if it exists (important for image uploads)
      if (props.item.fileUrl) {
        updatePayload.fileUrl = props.item.fileUrl
      }
      
      // Add editor info if we have current user info
      if (props.userInfo?.id) {
        updatePayload.updated_by = props.userInfo.id
        updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
      }
      
      // Emit update for debounced save (saves after 1 second of inactivity)
      emit('update', updatePayload)
    }

    const autoResize = () => {
      if (textarea.value) {
        textarea.value.style.height = 'auto'
        textarea.value.style.height = textarea.value.scrollHeight + 'px'
      }
    }

    const handleEnter = () => {
      finishEdit()
      emit('add-sibling', { id: props.item.id })
    }

    // Adjust indent/outdent to allow pass-through from children
    const handleIndent = (payload) => {
      if (payload && payload.id && payload.id !== props.item.id) {
        // Forward child indent event
        emit('indent', payload)
        return
      }
      emit('indent', { id: props.item.id })
    }

    const handleOutdent = (payload) => {
      if (payload && payload.id && payload.id !== props.item.id) {
        emit('outdent', payload)
        return
      }
      emit('outdent', { id: props.item.id })
    }

    const handleBackspace = (e) => {
      if (editText.value === '' && e.target.selectionStart === 0) {
        e.preventDefault()
        finishEdit()
        emit('delete', props.item.id)
      }
    }

    const imageSrc = computed(() => {
      if (!props.item.fileUrl) return ''
      const token = import.meta.env.VITE_GITEA_TOKEN
      if (!token) return props.item.fileUrl
      const hasQuery = props.item.fileUrl.includes('?')
      return props.item.fileUrl + (hasQuery ? '&' : '?') + 'token=' + encodeURIComponent(token)
    })

    // --- Gitea Image Upload Helpers (updated to work with only host + token) ---
    const giteaState = { ensured: false, owner: null, repo: null }

    const readFileAsBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = reader.result || ''
            const base64 = result.split(',')[1] || ''
            resolve(base64)
          } catch (err) { reject(err) }
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }

    const buildGiteaRawUrl = ({ host, owner, repo, branch, path, downloadUrl }) => {
      if (downloadUrl) return downloadUrl
      return `${host.replace(/\/$/, '')}/api/v1/repos/${owner}/${repo}/raw/${branch}/${path}`
    }

    const ensureGiteaRepo = async () => {
      if (giteaState.ensured && giteaState.owner && giteaState.repo) return giteaState
      const host = import.meta.env.VITE_GITEA_HOST || import.meta.env.VITE_GITEA_BASE_URL
      const token = import.meta.env.VITE_GITEA_TOKEN
      const desiredRepo = import.meta.env.VITE_GITEA_REPO_NAME || 'outline-assets'
      const branch = import.meta.env.VITE_GITEA_REPO_BRANCH || 'main'
      if (!host || !token) return { error: 'missing-config' }
      try {
        // Get current user login
        const userRes = await fetch(`${host.replace(/\/$/, '')}/api/v1/user`, { headers: { Authorization: `token ${token}` } })
        if (!userRes.ok) {
          return { error: 'user-fetch-failed', status: userRes.status }
        }
        const userJson = await userRes.json()
        const owner = userJson.login
        // Check repo existence
        const repoRes = await fetch(`${host.replace(/\/$/, '')}/api/v1/repos/${owner}/${desiredRepo}`, { headers: { Authorization: `token ${token}` } })
        if (repoRes.status === 404) {
          // Create repo
          const createRes = await fetch(`${host.replace(/\/$/, '')}/api/v1/user/repos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `token ${token}` },
            body: JSON.stringify({ name: desiredRepo, private: true, description: 'Outline image assets', auto_init: false })
          })
          if (!createRes.ok) {
            console.error('Failed to create repo', await createRes.text())
            return { error: 'repo-create-failed' }
          }
        } else if (!repoRes.ok && repoRes.status !== 200) {
          return { error: 'repo-check-failed', status: repoRes.status }
        }
        giteaState.ensured = true
        giteaState.owner = owner
        giteaState.repo = desiredRepo
        return { owner, repo: desiredRepo, branch, host }
      } catch (e) {
        console.error('ensureGiteaRepo error', e)
        return { error: 'exception', detail: e }
      }
    }

    const uploadImageToGitea = async (file) => {
      const host = import.meta.env.VITE_GITEA_HOST || import.meta.env.VITE_GITEA_BASE_URL
      const token = import.meta.env.VITE_GITEA_TOKEN
      const branch = import.meta.env.VITE_GITEA_REPO_BRANCH || 'main'
      if (!host || !token) {
        return { success: false, reason: 'missing-config' }
      }
      const ensure = await ensureGiteaRepo()
      if (ensure.error) {
        if (ensure.error === 'missing-config') return { success: false, reason: 'missing-config' }
        console.warn('Repo ensure failed, fallback to inline', ensure)
        return { success: false, reason: 'ensure-failed', detail: ensure.error }
      }
      const { owner, repo } = ensure
      try {
        const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'image.png'
        const ts = Date.now()
        const rand = Math.random().toString(36).slice(2, 8)
        const ext = (safeOriginal.split('.').pop() || 'png').toLowerCase()
        const path = `outline-images/${ts}-${rand}.${ext}`
        const base64 = await readFileAsBase64(file)
        const apiUrl = `${host.replace(/\/$/, '')}/api/v1/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`
        const res = await fetch(apiUrl, {
          method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `token ${token}`
            },
            body: JSON.stringify({ content: base64, message: `Add outline image ${safeOriginal}`, branch })
        })
        const json = await res.json()
        if (!res.ok) {
          console.error('Gitea upload failed', json)
          return { success: false, reason: 'upload-failed', error: json }
        }
        const downloadUrl = json?.content?.download_url
        const rawUrl = buildGiteaRawUrl({ host, owner, repo, branch, path, downloadUrl })
        return { success: true, url: rawUrl, filename: path }
      } catch (err) {
        console.error('Gitea upload error', err)
        return { success: false, reason: 'exception', error: err }
      }
    }

    // Replace previous data-URL only implementation (updated)
    const processImageFile = async (file) => {
      ElMessage.info('Uploading image...')
      const giteaResult = await uploadImageToGitea(file)
      if (giteaResult.success) {
        // Use a more user-friendly filename for display
        const displayName = file.name || giteaResult.filename
        const updatePayload = { 
          id: props.item.id, 
          text: displayName, 
          fileUrl: giteaResult.url, 
          immediate: true,
          isImageUpload: true // Add flag to identify image uploads
        }
        
        // Add editor info if we have current user info
        if (props.userInfo?.id) {
          updatePayload.updated_by = props.userInfo.id
          updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
        }
        
        console.log('🖼️ Image upload successful, emitting update:', updatePayload)
        emit('update', updatePayload)
        ElMessage.success('Image uploaded')
        return
      }
      if (giteaResult.reason === 'missing-config') {
        try {
          const reader = new FileReader()
          reader.onload = () => {
            const ext = (file.name.split('.').pop() || 'png').toLowerCase()
            const fileName = file.name || `pasted-image-${Date.now()}.${ext}`
            const updatePayload = { 
              id: props.item.id, 
              text: fileName, 
              fileUrl: reader.result, 
              immediate: true,
              isImageUpload: true // Add flag to identify image uploads
            }
            
            // Add editor info if we have current user info
            if (props.userInfo?.id) {
              updatePayload.updated_by = props.userInfo.id
              updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
            }
            
            emit('update', updatePayload)
            ElMessage.success('Image added (inline)')
          }
          reader.readAsDataURL(file)
        } catch (e) {
          ElMessage.error('Image add failed')
        }
      } else {
        ElMessage.error('Upload failed; check console')
      }
    }

    const handleCommand = (command) => {
      switch (command) {
        case 'delete':
          handleDelete(props.item.id)
          break
        case 'drilldown':
          emit('drilldown', props.item.id)
          break
        case 'comment':
          openCommentDialog()
          break
        case 'add-sibling':
          emit('add-sibling', { id: props.item.id })
          break
        case 'add-child':
          emit('add-sibling', { id: props.item.id, asChild: true })
          break
        case 'indent':
          emit('indent', { id: props.item.id });
          break
        case 'outdent':
          emit('outdent', { id: props.item.id });
          break
        case 'collapse':
          toggleCollapse()
          break
        case 'copy-link':
          copyInternalLink()
          break
        case 'copy-point':
          copyPoint()
          break
      }
    }

    // placeholder copy link implementation
    const copyInternalLink = () => {
      try {
        const url = window.location.origin + '#outline-' + props.item.id
        navigator.clipboard.writeText(url)
        ElMessage.success('Link copied')
      } catch (e) {
        ElMessage.error('Copy failed')
      }
    }

    // Copy point with all children
    const copyPoint = () => {
      try {
        // Create a deep copy of the item with all its children
        const copyData = {
          type: 'outline-point',
          data: JSON.parse(JSON.stringify(props.item)),
          timestamp: Date.now(),
          workspaceId: props.outlineMetadata?.workspaceId || null
        }
        
        // Store in clipboard as JSON
        const clipboardData = JSON.stringify(copyData)
        navigator.clipboard.writeText(clipboardData)
        
        // Also store in localStorage for cross-tab access
        localStorage.setItem('outline-copied-point', clipboardData)
        
        ElMessage.success(`Copied "${props.item.text?.slice(0, 50) || 'point'}" with ${hasChildren.value ? props.item.children.length : 0} children`)
      } catch (e) {
        console.error('Copy point failed:', e)
        ElMessage.error('Copy failed')
      }
    }


    const deleteGuard = ref({ lastId: null, ts: 0 })

    const handleDelete = (id) => {
      //if (e) e.stopPropagation()
      const now = Date.now()
      // Ignore if same id emitted within 300ms
      if (deleteGuard.value.lastId === id && (now - deleteGuard.value.ts) < 300) {
        return
      }
      deleteGuard.value = { lastId: id, ts: now }
      console.log('Delete item (guarded):', id)
      emit('delete', id)
    }

    const toggleCollapse = () => {
      emit('collapse-toggle', props.item.id, !props.collapsed)
    }

    // Drag and Drop handlers
    const handleDragStart = (e) => {
      dragState.draggedId = props.item.id
      dragState.isDragging = true
      isDragging.value = true
      e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragEnd = (e) => {
      dragState.draggedId = null
      dragState.hoveredId = null
      dragState.hoveredPosition = null
      dragState.isDragging = false
      isDragging.value = false
    }

    const handleDragEnter = (e) => {
      if (dragState.draggedId === props.item.id) return
      
      dragState.hoveredId = props.item.id
      dragState.hoveredPosition = getDropPosition(e)
    }

    const handleDragOver = (e) => {
      if (dragState.draggedId === props.item.id) return
      
      dragState.hoveredPosition = getDropPosition(e)
    }

    const handleDragLeave = (e) => {
      // Only clear if we're leaving the entire item
      if (!e.currentTarget.contains(e.relatedTarget)) {
        dragState.hoveredId = null
        dragState.hoveredPosition = null
      }
    }

    const handleDrop = (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        const fileList = Array.from(e.dataTransfer.files);
        const imageFile = fileList.find(f => f.type.startsWith('image/'));
        if (imageFile) {
          e.preventDefault();
          e.stopPropagation();
          processImageFile(imageFile); // now uploads to Gitea
          dragState.hoveredId = null;
          dragState.hoveredPosition = null;
          return;
        }
      }
      if (dragState.draggedId === props.item.id) return
      const position = getDropPosition(e)
      emit('move', { draggedId: dragState.draggedId, targetId: props.item.id, position })
      dragState.hoveredId = null
      dragState.hoveredPosition = null
    }

    const getDropPosition = (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const height = rect.height
      
      if (y < height * 0.25) {
        return 'top'
      } else if (y > height * 0.75) {
        return 'bottom'
      } else {
        return 'child'
      }
    }

    // Comment functionality
    const openCommentDialog = () => {
      commentDialogVisible.value = true
      loadComments()
    }

    const loadComments = () => {
      // Load existing comments from item if present
      if (props.item.comments) {
        try {
          comments.value = JSON.parse(JSON.stringify(props.item.comments))
        } catch {
          comments.value = [...props.item.comments]
        }
      } else {
        comments.value = []
      }
    }

    const addComment = () => {
      if (!newCommentText.value.trim()) return
      const newComment = { id: Date.now(), text: newCommentText.value.trim(), editing: false }
      comments.value.push(newComment)
      newCommentText.value = ''
      // Persist to parent outline with editor tracking
      const updatePayload = { 
        id: props.item.id, 
        text: props.item.text, 
        comments: comments.value, 
        immediate: true 
      }
      
      // Add editor info if we have current user info
      if (props.userInfo?.id) {
        updatePayload.updated_by = props.userInfo.id
        updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
      }
      
      emit('update', updatePayload)
      ElMessage.success('Comment added')
    }

    const editComment = (comment) => {
      comment.editing = true
      comment.originalText = comment.text
    }

    const saveComment = (comment) => {
      comment.editing = false
      delete comment.originalText
      const updatePayload = { 
        id: props.item.id, 
        text: props.item.text, 
        comments: comments.value, 
        immediate: true 
      }
      
      // Add editor info if we have current user info
      if (props.userInfo?.id) {
        updatePayload.updated_by = props.userInfo.id
        updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
      }
      
      emit('update', updatePayload)
      ElMessage.success('Comment updated')
    }

    const cancelEditComment = (comment) => {
      comment.editing = false
      comment.text = comment.originalText
      delete comment.originalText
    }

    const deleteComment = (commentId) => {
      const index = comments.value.findIndex(c => c.id === commentId)
      if (index > -1) {
        comments.value.splice(index, 1)
        const updatePayload = { 
          id: props.item.id, 
          text: props.item.text, 
          comments: comments.value, 
          immediate: true 
        }
        
        // Add editor info if we have current user info
        if (props.userInfo?.id) {
          updatePayload.updated_by = props.userInfo.id
          updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
        }
        
        emit('update', updatePayload)
        ElMessage.success('Comment deleted')
      }
    }

    // File handling
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items || [];
      for (let item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            try {
              // Prevent default browser handling when we handle an image
              if (e && typeof e.preventDefault === 'function') {
                e.preventDefault()
                e.stopPropagation()
              }
            } catch (_) {}
            await processImageFile(file); // now uploads to Gitea
            return
          }
        }
      }
    };

    const handleFileDrop = async (fileOrEvent) => {
      let file = null;
      if (fileOrEvent instanceof File) {
        file = fileOrEvent;
      } else if (fileOrEvent?.dataTransfer?.files?.length) {
        file = Array.from(fileOrEvent.dataTransfer.files).find(f => f.type.startsWith('image/'));
      }
      if (!file) return;
      await processImageFile(file); // now uploads to Gitea
    };

    const isImageFile = (text) => {
      if (!text) return false
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
      const fileName = text.replace('📎', '').trim()
      return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext))
    }

    const getFileName = (text) => {
      return text.replace('📎', '').trim()
    }

    const openImagePreview = () => {
      imagePreviewVisible.value = true
    }

    const downloadFile = () => {
      if (props.item.fileUrl) {
        window.open(props.item.fileUrl, '_blank')
      }
    }

    // Pass-through event handlers
    const updateChild = (payload) => {
      emit('update', payload)
    }

    const handleMove = (payload) => {
      emit('move', payload)
    }

    const handleDrilldown = (id) => {
      emit('drilldown', id)
    }

    const handleNavigate = (payload) => {
      emit('navigate', payload)
    }

    const handleAddSibling = (payload) => {
      emit('add-sibling', payload)
    }

    const handleCollapseToggle = (nodeId, isCollapsed) => {
      emit('collapse-toggle', nodeId, isCollapsed)
    }

    const updateTooltipPosition = () => {
      // If editing a textarea selection we need manual measurement (textarea has no DOM ranges)
      if (editing.value && textarea.value && selectionStart.value != null && selectionEnd.value != null) {
        const rect = computeTextareaSelectionRect()
        if (rect) {
          selectionTooltipStyle.value = {
            position: 'fixed',
            top: (rect.top - 44) + 'px', // place above selection
            left: (rect.left + rect.width / 2) + 'px',
            transform: 'translate(-50%, 0)'
          }
          return
        }
      }
      // Fallback (e.g. non-textarea selection)
      try {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        const domRect = range.getBoundingClientRect()
        if (!domRect || (domRect.x === 0 && domRect.y === 0 && domRect.width === 0)) return
        selectionTooltipStyle.value = {
          position: 'fixed',
          top: (domRect.top - 44) + 'px',
          left: (domRect.left + domRect.width / 2) + 'px',
          transform: 'translate(-50%, 0)'
        }
      } catch (_) {}
    }

    const computeTextareaSelectionRect = () => {
      const ta = textarea.value
      if (!ta) return null
      const start = selectionStart.value
      const end = selectionEnd.value
      if (start == null || end == null) return null
      const value = ta.value
      // Mirror div
      const div = document.createElement('div')
      const cs = window.getComputedStyle(ta)
      const props = ['fontSize','fontFamily','fontWeight','fontStyle','letterSpacing','textTransform','textAlign','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing','wordBreak','whiteSpace']
      props.forEach(p => { div.style[p] = cs[p] })
      div.style.position = 'absolute'
      div.style.visibility = 'hidden'
      div.style.whiteSpace = 'pre-wrap'
      div.style.wordWrap = 'break-word'
      div.style.top = '0'
      div.style.left = '-9999px'
      div.style.width = ta.clientWidth + 'px'
      const escape = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const before = escape(value.substring(0, start)).replace(/\n/g,'<br/>')
      let selText = value.substring(start, Math.max(start+1, end)) || ' '
      // Only first line of selection for positioning
      selText = selText.split('\n')[0] || ' '
      const selHtml = escape(selText)
      div.innerHTML = before + '<span id="__caret_marker__">' + selHtml + '</span>'
      document.body.appendChild(div)
      const span = div.querySelector('#__caret_marker__')
      if (!span) { document.body.removeChild(div); return null }
      const spanRect = span.getBoundingClientRect()
      const taRect = ta.getBoundingClientRect()
      const top = taRect.top + (spanRect.top - div.getBoundingClientRect().top) - ta.scrollTop
      const left = taRect.left + (spanRect.left - div.getBoundingClientRect().left) - ta.scrollLeft
      const rect = { top, left, width: spanRect.width, height: spanRect.height }
      document.body.removeChild(div)
      return rect
    }

    // Add missing clearSelection helper
    const clearSelection = () => {
      selectionTooltipVisible.value = false
      selectionStart.value = null
      selectionEnd.value = null
      if (textarea.value) {
        const pos = textarea.value.selectionEnd
        textarea.value.setSelectionRange(pos, pos)
      }
    }

    // --- Link dialog helpers (added) ---
    const openLinkDialog = () => {
      if (!editing.value) return
      if (selectionStart.value == null || selectionEnd.value == null || selectionStart.value === selectionEnd.value) return
      // Pre-fill URL if selection itself looks like a URL
      const sel = selectedText.value.trim()
      if (/^https?:\/\//i.test(sel)) {
        linkUrl.value = sel
      } else {
        linkUrl.value = ''
      }
      linkDialogVisible.value = true
    }

    const applyLink = () => {
      const url = linkUrl.value.trim()
      if (!/^(https?:\/\/).+/i.test(url)) return
      if (selectionStart.value == null || selectionEnd.value == null) return
      const start = selectionStart.value
      const end = selectionEnd.value
      const original = editText.value
      const label = selectedText.value || url
      const markdown = `[${label}](${url})`
      editText.value = original.slice(0, start) + markdown + original.slice(end)
      // Move caret to end of inserted markdown
      const newPos = start + markdown.length
      if (textarea.value) {
        textarea.value.focus()
        textarea.value.setSelectionRange(newPos, newPos)
      }
      // Emit update since we changed text programmatically
      emit('update', { id: props.item.id, text: editText.value, immediate: true })
      linkDialogVisible.value = false
      clearSelection()
      resetLinkDialog()
      requestAnimationFrame(autoResize)
    }

    const resetLinkDialog = () => {
      linkUrl.value = ''
    }

    // Global click handler to hide tooltip when clicking outside
    const globalClickHandler = (e) => {
      if (!selectionTooltipVisible.value) return
      if (linkDialogVisible.value) return // keep while dialog open
      if (textarea.value && (e.target === textarea.value || textarea.value.contains(e.target))) return
      if (e.target.closest && e.target.closest('.selection-tooltip')) return
      selectionTooltipVisible.value = false
    }

    // Handle paste at window level for cases when textarea isn't focused
    const globalPasteHandler = async (e) => {
      try {
        const active = document.activeElement
        const tag = active && active.tagName && active.tagName.toLowerCase()
        const isEditable = tag === 'textarea' || tag === 'input' || (active && active.isContentEditable)
        
        // Check for outline-point data in clipboard text
        const clipboardText = e.clipboardData?.getData('text/plain') || ''
        if (clipboardText.trim()) {
          try {
            const parsed = JSON.parse(clipboardText)
            if (parsed.type === 'outline-point' && parsed.data) {
              // Found outline-point data, handle it
              e.preventDefault()
              e.stopPropagation()
              
              // Store the copied data in localStorage
              localStorage.setItem('outline-copied-point', clipboardText)
              
              // If we're not in an editable field, paste as sibling of the current item
              if (!isEditable) {
                await pastePoint(false) // asChild = false (paste as sibling)
                return
              }
            }
          } catch (parseError) {
            // Not JSON or not outline-point data, continue with normal paste handling
          }
        }
        
        // If user is focused in an input/textarea/contenteditable, let the element handle paste
        if (isEditable) return

        const items = e.clipboardData?.items || []
        for (let item of items) {
          if (item.type && item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) {
              try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
              await processImageFile(file)
              return
            }
          }
        }
      } catch (err) {
        console.error('Global paste handler error:', err)
      }
    }

    const handleSelection = () => {
      if (!editing.value) return
      if (!textarea.value) return
      const el = textarea.value
      const start = el.selectionStart
      const end = el.selectionEnd
      if (start === end) {
        selectionTooltipVisible.value = false
        return
      }
      selectionStart.value = start
      selectionEnd.value = end
      selectedText.value = editText.value.substring(start, end)
      selectionTooltipVisible.value = true
      requestAnimationFrame(updateTooltipPosition)
    }

    const onWindowScroll = () => {
      if (selectionTooltipVisible.value) updateTooltipPosition()
    }

    onMounted(() => {
      if (props.autoFocus) {
        startEdit()
      }
      // Initialize comments from item so icon shows immediately
      if (props.item.comments && Array.isArray(props.item.comments)) {
        try { comments.value = JSON.parse(JSON.stringify(props.item.comments)); } catch { comments.value = [...props.item.comments]; }
      }
      window.addEventListener('click', globalClickHandler)
  window.addEventListener('paste', globalPasteHandler)
      window.addEventListener('scroll', onWindowScroll, true)
    })

    onBeforeUnmount(() => {
      // Ensure any pending edits are saved before unmounting
      if (editing.value) {
        finishEdit()
      }
      
      window.removeEventListener('click', globalClickHandler)
      window.removeEventListener('paste', globalPasteHandler)
      window.removeEventListener('scroll', onWindowScroll, true)
    })

    // Sync if parent updates comments reference later
    watch(() => props.item.comments, (newVal) => {
      if (Array.isArray(newVal)) {
        try { comments.value = JSON.parse(JSON.stringify(newVal)); } catch { comments.value = [...newVal]; }
      }
    }, { deep: true })

    // Add the handleBold function
    const handleBold = () => {
      if (!editing.value) return
      if (selectionStart.value == null || selectionEnd.value == null || selectionStart.value === selectionEnd.value) return
      
      const start = selectionStart.value
      const end = selectionEnd.value
      const original = editText.value
      const selectedText = original.slice(start, end)
      
      // Check if the selected text is already bold (has ** around it)
      const beforeSelection = original.slice(Math.max(0, start - 2), start)
      const afterSelection = original.slice(end, Math.min(original.length, end + 2))
      
      let newText
      let newCursorPos
      
      if (beforeSelection === '**' && afterSelection === '**') {
        // Remove bold formatting
        newText = original.slice(0, start - 2) + selectedText + original.slice(end + 2)
        newCursorPos = { start: start - 2, end: end - 2 }
      } else {
        // Add bold formatting
        const boldText = `**${selectedText}**`
        newText = original.slice(0, start) + boldText + original.slice(end)
        newCursorPos = { start: start + 2, end: end + 2 }
      }
      
      editText.value = newText
      
      // Update cursor position
      if (textarea.value) {
        textarea.value.focus()
        // Use setTimeout to ensure the text is updated first
        setTimeout(() => {
          if (textarea.value) {
            textarea.value.setSelectionRange(newCursorPos.start, newCursorPos.end)
          }
        }, 0)
      }
      
      // Emit update since we changed text programmatically
      const updatePayload = {
        id: props.item.id,
        text: editText.value,
        immediate: true
      }
      
      // Preserve fileUrl if it exists
      if (props.item.fileUrl) {
        updatePayload.fileUrl = props.item.fileUrl
      }
      
      // Add editor info if we have current user info
      if (props.userInfo?.id) {
        updatePayload.updated_by = props.userInfo.id
        updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
      }
      
      emit('update', updatePayload)
      
      // Clear selection tooltip
      selectionTooltipVisible.value = false
      
      // Auto-resize textarea
      requestAnimationFrame(autoResize)
    }

    // Add the handleUnderline function
    const handleUnderline = () => {
      if (!editing.value) return
      if (selectionStart.value == null || selectionEnd.value == null || selectionStart.value === selectionEnd.value) return
      
      const start = selectionStart.value
      const end = selectionEnd.value
      const original = editText.value
      const selectedText = original.slice(start, end)
      
      // Check if the selected text is already underlined (has _u_ around it)
      const beforeSelection = original.slice(Math.max(0, start - 3), start)
      const afterSelection = original.slice(end, Math.min(original.length, end + 4))
      
      let newText
      let newCursorPos
      
      if (beforeSelection === '_u_' && afterSelection === '_/u_') {
        // Remove underline formatting
        newText = original.slice(0, start - 3) + selectedText + original.slice(end + 4)
        newCursorPos = { start: start - 3, end: end - 3 }
      } else {
        // Add underline formatting
        const underlineText = `_u_${selectedText}_/u_`
        newText = original.slice(0, start) + underlineText + original.slice(end)
        newCursorPos = { start: start + 3, end: end + 3 }
      }
      
      editText.value = newText
      
      // Update cursor position
      if (textarea.value) {
        textarea.value.focus()
        // Use setTimeout to ensure the text is updated first
        setTimeout(() => {
          if (textarea.value) {
            textarea.value.setSelectionRange(newCursorPos.start, newCursorPos.end)
          }
        }, 0)
      }
      
      // Emit update since we changed text programmatically
      const updatePayload = {
        id: props.item.id,
        text: editText.value,
        immediate: true
      }
      
      // Preserve fileUrl if it exists
      if (props.item.fileUrl) {
        updatePayload.fileUrl = props.item.fileUrl
      }
      
      // Add editor info if we have current user info
      if (props.userInfo?.id) {
        updatePayload.updated_by = props.userInfo.id
        updatePayload.updated_by_name = props.userInfo.name || props.userInfo.email
      }
      
      emit('update', updatePayload)
      
      // Clear selection tooltip
      selectionTooltipVisible.value = false
      
      // Auto-resize textarea
      requestAnimationFrame(autoResize)
    }

    return {
      editing,
      editText,
      textarea,
      commentDialogVisible,
      imagePreviewVisible,
      comments,
      newCommentText,
      isDragging,
      hasChildren,
      effectiveCollapsed,
      isDragOverTop,
      isDragOverBottom,
      isDragOverChild,
      hasComments,
      renderedText,
      selectionTooltipVisible,
      selectionTooltipStyle,
      handleTextClick,
      handleBulletClick,
      startEdit,
      finishEdit,
      handleTextChange,
      autoResize,
      handleEnter,
      handleIndent,
      handleOutdent,
      handleBackspace,
      handleBold, // ← Make sure this is included in the return
      handleUnderline,
      handleCommand,
      handleDelete,
      toggleCollapse,
      handleDragStart,
      handleDragEnd,
      handleDragEnter,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      getDropPosition,
      openCommentDialog,
      loadComments,
      addComment,
      editComment,
      saveComment,
      cancelEditComment,
      deleteComment,
      handlePaste,
      handleFileDrop,
      isImageFile,
      getFileName,
      openImagePreview,
      downloadFile,
      updateChild,
      handleMove,
      handleDrilldown,
      handleNavigate,
      handleAddSibling,
      handleCollapseToggle,
      imageSrc,
      copyInternalLink,
      copyPoint,
      processImageFile,
      handleSelection,
      clearSelection,
      openLinkDialog,
      linkDialogVisible,
      linkUrl,
      selectedText,
      validLink,
      applyLink,
      resetLinkDialog,
      updateTooltipPosition,
      formatDate,
      getUserNameById,
      getCreatedInfo,
      getLastModifiedBy
    }
  }
}
</script>

<style scoped>
.outline-item {
  display: block;
  margin: 5px 2rem;
  position: relative;
  max-width: 100%;
  transition: all 0.2s ease;
  margin-right: 0px;
}

.outline-row {
  position: relative;
  display: flex;
  min-height: 24px;
}
.outline-item ul {
    margin-left: 5px;
    padding-left: 0;
    border-left: 1px solid #ECEEF0;
}
.outline-text,
.outline-textarea {
  padding-right: 32px;
}

.drop-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #1976d2;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.drop-indicator.indicator-top {
  top: -1px;
  opacity: 1;
}

.drop-indicator.indicator-bottom {
  bottom: -1px;
  opacity: 1;
}

.drop-indicator.indicator-child {
  left: 0;
  right: 0;
  width: auto;
  bottom: -1px;
  height: 2px;
  background: #1976d2;
  opacity: 1;
  border-radius: 2px;
}

.outline-item.dragging {
  opacity: 0.5;
  cursor: move;
}

.outline-bullet {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4B5155;
  display: inline-block;
  margin-right: 9px;
  vertical-align: top;
  border: 2px solid #e3eaf6;
  margin-left: -22px;
  margin-top: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.outline-bullet:hover {
  background: #23272f;
  border-color: #4B5155;
  transform: scale(1.2);
}

/*.outline-bullet.focusable {
  background: #1976d2;
  border-color: #0d47a1;
}

.outline-bullet.focusable:hover {
  background: #0d47a1;
  border-color: #1976d2;
  transform: scale(1.3);
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.4);
}*/

.collapse-toggle {
  display: inline-block;
  width: 20px;
  cursor: pointer;
  user-select: none;
  margin-left: -3px;
  font-size: 16px;
  vertical-align: baseline;
  margin-right: 20px;
  margin-top: 0;
  color: #4B5155;
  transition: transform 0.2s ease;
}

.collapse-toggle.collapsed {
  transform: none;
}

.outline-text {
  display: inline-block;
  width: calc(90% - 50px);
  font-size: 0.90rem;
  font-weight: normal;
  color: #2a3135;
  cursor: pointer;
  vertical-align: baseline;
  line-height: 1.4;
  margin: 0;
}

.outline-textarea {
  display: inline-block;
  width: calc(90% - 50px);
  max-width: 90%;
  font-size: 1rem;
  font-weight: normal;
  color: #2a3135;
  border: 0px;
  margin: 0;
  outline: none;
  min-width: 100px;
  margin-bottom: 0.1rem;
  vertical-align: baseline;
  resize: none;
  overflow: hidden;
  line-height: 1.2;
  padding: 0;
  font-family: inherit;
  background: transparent;
}

.three-dot-menu {
  margin-right: 36px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
  margin-top: 0;
  margin-left: -60px;
}

.outline-row:hover .three-dot-menu {
  opacity: 1;
}

.three-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  color: #666;
  font-size: 14px;
}

.three-dots:hover {
  background-color: #f5f5f5;
  color: #333;
}

.comment-icon {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
  cursor: pointer;
  font-size: 1.1em;
  vertical-align: middle;
  z-index: 2;
}

.file-preview {
  margin: 8px 0;
  padding: 8px;
  border-radius: 4px;
  background: transparent;
  width: auto;
}

.preview-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.preview-image:hover {
  transform: scale(1.02);
}

.preview-image-full {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.file-name {
  flex: 1;
  color: #606266;
}

.comments-list {
  margin-bottom: 10px;
}

.comment-item {
  margin-bottom: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 6px;
}

.comment-edit-textarea {
  width: 100%;
  font-size: 0.95em;
  margin-bottom: 8px;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
  resize: vertical;
  padding: 8px;
}

.comment-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.add-comment-section {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comment-add-textarea {
  width: 100%;
  font-size: 0.95em;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
  resize: vertical;
  margin-bottom: 4px;
}

/* Search highlighting styles */
.search-highlight {
  background-color: #ffeb3b;
  color: #000;
  font-weight: 600;
  padding: 1px 2px;
  border-radius: 2px;
}

.outline-text.search-match {
  background-color: rgba(255, 235, 59, 0.1);
  border-radius: 3px;
  padding: 1px 3px;
}

.outline-text.search-context {
  opacity: 0.7;
}

.selection-tooltip {
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  padding: 4px 6px;
  display: flex;
  gap: 4px;
  z-index: 2000;
  animation: fadeIn 120ms ease;
}
.tooltip-button {
  background: transparent;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  border-radius: 4px;
}
.tooltip-button:hover { background: #f2f3f5; }
.link-dialog-body { display: flex; flex-direction: column; gap: 10px; }
.selected-text { font-size: 12px; color: #606266; margin: 0; }
@keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -4px);} to { opacity:1; transform: translate(-50%, -8px);} }

/* Item Info Dialog Styles */
.item-info-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-section {
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 12px;
}

.info-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.info-text {
  margin: 0;
  font-size: 13px;
  color: #606266;
  word-break: break-word;
}

.info-subtext {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #909399;
  font-style: italic;
}

/* Inline info in dropdown styles */
.item-info-inline {
  padding: 4px 0;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
}

.info-line {
  margin: 2px 0;
}

.info-line small {
  font-size: 11px;
  color: #999;
  font-style: italic;
  line-height: 1.3;
}

.info-divider {
  cursor: default !important;
  background: #fafafa !important;
}

.info-divider:hover {
  background: #fafafa !important;
}

/* Bold text styling in rendered text */
.outline-text :deep(strong) {
  font-weight: 700;
  color: #1a1a1a;
}

/* Selection tooltip bold button styling */
.tooltip-button strong {
  font-weight: 700;
  font-size: 12px;
}

/* Underline text styling in rendered text */
.outline-text :deep(u) {
  text-decoration: underline;
  color: #1a1a1a;
}

/* Selection tooltip underline button styling */
.tooltip-button u {
  text-decoration: underline;
  font-size: 12px;
}
</style>

<!-- Fix rows prop bindings in template -->
<!--
Replace: rows="2" with :rows="2" in el-input components (comment dialogs)
-->
