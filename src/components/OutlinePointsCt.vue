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
        @click="startEdit"
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
        @input="handleTextChange"
        @paste="handlePaste"
        @drop="handleFileDrop"
        rows="1"
        placeholder="Type your outline item..."
      />

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
import { Plus, Delete, MoreFilled, ChatDotRound, Link, Right, Back, CaretRight, CaretBottom } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { dragState } from './dragState.js'

export default {
  name: 'OutlinePointsCt',
  components: { Plus, Delete, MoreFilled, ChatDotRound, Link, Right, Back, CaretRight, CaretBottom },
  props: {
    item: { type: Object, required: true },
    readonly: { type: Boolean, default: false },
    autoFocus: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    isNodeCollapsed: { type: Function, default: () => () => false },
    checkVersionBeforeEdit: { type: Function, default: () => async () => ({ canEdit: true }) },
    handleVersionConflict: { type: Function, default: () => async () => ({ canEdit: true }) },
    searchQuery: { type: String, default: '' }
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

    const renderedText = computed(() => {
      const base = linkify(props.item.text || 'Click to edit...')
      return applySearchHighlight(base)
    })

    const handleTextClick = (e) => {
      if (e.target.closest('a')) return
      startEdit()
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
        emit('update', {
          id: props.item.id,
          text: editText.value,
          immediate: true
        })
      }
    }

    const handleTextChange = () => {
      autoResize()
      // Emit update immediately for real-time collaboration
      emit('update', {
        id: props.item.id,
        text: editText.value,
        immediate: true
      })
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
        emit('update', { id: props.item.id, text: giteaResult.filename, fileUrl: giteaResult.url, immediate: true })
        ElMessage.success('Image uploaded')
        return
      }
      if (giteaResult.reason === 'missing-config') {
        try {
          const reader = new FileReader()
          reader.onload = () => {
            const ext = (file.name.split('.').pop() || 'png').toLowerCase()
            const fileName = `pasted-image-${Date.now()}.${ext}`
            emit('update', { id: props.item.id, text: fileName, fileUrl: reader.result, immediate: true })
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
          handleDelete()
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

    const handleDelete = () => {
      ElMessageBox.confirm('Are you sure you want to delete this item?', 'Confirm Delete', {
        type: 'warning'
      }).then(() => {
        emit('delete', props.item.id)
      }).catch(() => {
        // User cancelled
      })
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
      // Persist to parent outline
      emit('update', { id: props.item.id, text: props.item.text, comments: comments.value, immediate: true })
      ElMessage.success('Comment added')
    }

    const editComment = (comment) => {
      comment.editing = true
      comment.originalText = comment.text
    }

    const saveComment = (comment) => {
      comment.editing = false
      delete comment.originalText
      emit('update', { id: props.item.id, text: props.item.text, comments: comments.value, immediate: true })
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
        emit('update', { id: props.item.id, text: props.item.text, comments: comments.value, immediate: true })
        ElMessage.success('Comment deleted')
      }
    }

    // File handling
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items || [];
      for (let item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) await processImageFile(file); // now uploads to Gitea
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

    onMounted(() => {
      if (props.autoFocus) {
        startEdit()
      }
      // Initialize comments from item so icon shows immediately
      if (props.item.comments && Array.isArray(props.item.comments)) {
        try { comments.value = JSON.parse(JSON.stringify(props.item.comments)); } catch { comments.value = [...props.item.comments]; }
      }
    })

    // Sync if parent updates comments reference later
    watch(() => props.item.comments, (newVal) => {
      if (Array.isArray(newVal)) {
        try { comments.value = JSON.parse(JSON.stringify(newVal)); } catch { comments.value = [...newVal]; }
      }
    }, { deep: true })

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
      handleTextClick,
      startEdit,
      finishEdit,
      handleTextChange,
      autoResize,
      handleEnter,
      handleIndent,
      handleOutdent,
      handleBackspace,
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
      processImageFile,
      handleTextClick
    }
  }
}
</script>

<style scoped>
.outline-item {
  display: block;
  margin: 0 2rem;
  position: relative;
  max-width: 100%;
  transition: all 0.2s ease;
  margin-right: 0px;
}

.outline-row {
  position: relative;
  display: flex;
  align-items: center;
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
  margin-top: 0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.outline-bullet:hover {
  background: #23272f;
  border-color: #4B5155;
  transform: scale(1.2);
}

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
</style>

<!-- Fix rows prop bindings in template -->
<!--
Replace: rows="2" with :rows="2" in el-input components (comment dialogs)
-->
