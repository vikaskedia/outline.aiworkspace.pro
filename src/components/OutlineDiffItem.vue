<template>
  <div class="diff-item" :class="diffTypeClass">
    <div class="item-content">
      <div class="item-indent" :style="{ marginLeft: depth * 20 + 'px' }">
        <div class="item-marker">
          <span v-if="diffType === 'added'" class="marker added">+</span>
          <span v-else-if="diffType === 'removed'" class="marker removed">-</span>
          <span v-else-if="diffType === 'modified'" class="marker modified">~</span>
          <span v-else class="marker unchanged">•</span>
        </div>
        
        <div class="item-text" v-html="highlightedText"></div>
      </div>
    </div>
    
    <!-- Render children recursively -->
    <div v-if="item.children && item.children.length > 0" class="item-children">
      <OutlineDiffItem
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :diff-type="childDiffType(child)"
        :depth="depth + 1"
        :old-items-map="oldItemsMap"
        :new-items-map="newItemsMap"
        :side="side"
      />
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'OutlineDiffItem',
  props: {
    item: {
      type: Object,
      required: true
    },
    diffType: {
      type: String,
      default: 'unchanged',
      validator: (value) => ['added', 'removed', 'modified', 'unchanged'].includes(value)
    },
    depth: {
      type: Number,
      default: 0
    },
    oldItemsMap: {
      type: Map,
      default: () => new Map()
    },
    newItemsMap: {
      type: Map,
      default: () => new Map()
    },
    side: {
      type: String,
      default: 'old',
      validator: (value) => ['old', 'new'].includes(value)
    }
  },
  setup(props) {
    const diffTypeClass = computed(() => {
      return `diff-${props.diffType}`
    })
    
    const highlightedText = computed(() => {
      if (!props.item.text) return 'Untitled'
      
      // Escape HTML and apply basic formatting
      const escapedText = escapeHtml(props.item.text)
      
      // Apply linkification (simplified version)
      return linkify(escapedText)
    })
    
    function escapeHtml(text) {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }
    
    function linkify(text) {
      // Basic URL detection and linking
      return text.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      )
    }
    
    function childDiffType(child) {
      if (!child.id) return 'unchanged'
      
      const isOldSide = props.side === 'old'
      const currentMap = isOldSide ? props.oldItemsMap : props.newItemsMap
      const otherMap = isOldSide ? props.newItemsMap : props.oldItemsMap
      
      const currentItem = currentMap.get(child.id)
      const otherItem = otherMap.get(child.id)
      
      if (!currentItem) return 'unchanged'
      
      if (!otherItem) {
        return isOldSide ? 'removed' : 'added'
      }
      
      // More robust text comparison
      const currentText = (currentItem.text || '').trim()
      const otherText = (otherItem.text || '').trim()
      
      if (currentText !== otherText) {
        return 'modified'
      }
      
      return 'unchanged'
    }
    
    return {
      diffTypeClass,
      highlightedText,
      childDiffType
    }
  }
}
</script>

<style scoped>
.diff-item {
  margin-bottom: 2px;
  border-radius: 3px;
  transition: background-color 0.2s ease;
}

.item-content {
  display: flex;
  align-items: flex-start;
  padding: 0.25rem 0;
}

.item-indent {
  display: flex;
  align-items: flex-start;
  width: 100%;
  gap: 0.5rem;
}

.item-marker {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: bold;
  margin-top: 1px;
}

.marker {
  display: inline-block;
  line-height: 1;
}

.marker.added {
  color: #28a745;
  background-color: rgba(40, 167, 69, 0.1);
}

.marker.removed {
  color: #dc3545;
  background-color: rgba(220, 53, 69, 0.1);
}

.marker.modified {
  color: #ffc107;
  background-color: rgba(255, 193, 7, 0.1);
}

.marker.unchanged {
  color: #6c757d;
  background-color: rgba(108, 117, 125, 0.1);
}

.item-text {
  flex: 1;
  font-size: 0.9rem;
  line-height: 1.4;
  word-wrap: break-word;
  padding-top: 1px;
}

/* Diff type specific styles */
.diff-added {
  background-color: rgba(40, 167, 69, 0.05);
  border-left: 3px solid #28a745;
  padding-left: 0.5rem;
}

.diff-removed {
  background-color: rgba(220, 53, 69, 0.05);
  border-left: 3px solid #dc3545;
  padding-left: 0.5rem;
  opacity: 0.7;
}

.diff-modified {
  background-color: rgba(255, 193, 7, 0.05);
  border-left: 3px solid #ffc107;
  padding-left: 0.5rem;
}

/* .diff-unchanged items have no special styling */
/* .item-children inherit the overall structure */

/* Link styling within diff items */
.item-text :deep(a) {
  color: #0066cc;
  text-decoration: none;
}

.item-text :deep(a:hover) {
  text-decoration: underline;
}

/* Ensure proper spacing for nested items */
.diff-item .diff-item {
  margin-top: 1px;
  margin-bottom: 1px;
}
</style>
