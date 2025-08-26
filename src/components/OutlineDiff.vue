<template>
  <div class="outline-diff">
    <div v-if="!oldVersion || !newVersion" class="no-diff">
      <p>Select two versions to compare</p>
    </div>
    <div v-else class="diff-container">
      <div class="diff-header">
        <div class="version-info">
          <div class="old-version">
            <h4>Version {{ oldVersion.version }}</h4>
            <p>{{ formatDate(oldVersion.created_at) }}</p>
          </div>
          <div class="arrow">→</div>
          <div class="new-version">
            <h4>Version {{ newVersion.version }}</h4>
            <p>{{ formatDate(newVersion.created_at) }}</p>
          </div>
        </div>
        <div class="diff-stats">
          <span v-if="diffStats.added > 0" class="stat added">+{{ diffStats.added }}</span>
          <span v-if="diffStats.removed > 0" class="stat removed">-{{ diffStats.removed }}</span>
          <span v-if="diffStats.modified > 0" class="stat modified">~{{ diffStats.modified }}</span>
        </div>
      </div>
      
      <div class="diff-content">
        <div class="diff-view">
          <div class="diff-side old-side">
            <h5>Previous Version</h5>
                    <div class="outline-tree">
          <OutlineDiffItem
            v-for="item in oldItems"
            :key="`old-${item.id}`"
            :item="item"
            :diff-type="getDiffType(item, 'old')"
            :depth="0"
            :old-items-map="oldItemsMap"
            :new-items-map="newItemsMap"
            :side="'old'"
          />
        </div>
          </div>
          
          <div class="diff-side new-side">
            <h5>Current Version</h5>
            <div class="outline-tree">
              <OutlineDiffItem
                v-for="item in newItems"
                :key="`new-${item.id}`"
                :item="item"
                :diff-type="getDiffType(item, 'new')"
                :depth="0"
                :old-items-map="oldItemsMap"
                :new-items-map="newItemsMap"
                :side="'new'"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import OutlineDiffItem from './OutlineDiffItem.vue'

export default {
  name: 'OutlineDiff',
  components: {
    OutlineDiffItem
  },
  props: {
    oldVersion: {
      type: Object,
      default: null
    },
    newVersion: {
      type: Object,
      default: null
    }
  },
  setup(props) {
    const diffStats = ref({ added: 0, removed: 0, modified: 0 })
    
    const oldItems = computed(() => {
      return props.oldVersion?.content || []
    })
    
    const newItems = computed(() => {
      return props.newVersion?.content || []
    })
    
    // Create lookup maps for diff detection
    const oldItemsMap = computed(() => {
      const map = new Map()
      flattenItems(oldItems.value, map)
      return map
    })
    
    const newItemsMap = computed(() => {
      const map = new Map()
      flattenItems(newItems.value, map)
      return map
    })
    
    function flattenItems(items, map) {
      if (!Array.isArray(items)) return
      
      for (const item of items) {
        if (item.id) {
          map.set(item.id, {
            id: item.id,
            text: (item.text || '').trim(),
            parentId: null // We could track hierarchy if needed
          })
        }
        if (item.children && item.children.length > 0) {
          flattenItems(item.children, map)
        }
      }
    }
    
    function getDiffType(item, side) {
      if (!item.id) return 'unchanged'
      
      const isOldSide = side === 'old'
      const currentMap = isOldSide ? oldItemsMap.value : newItemsMap.value
      const otherMap = isOldSide ? newItemsMap.value : oldItemsMap.value
      
      const currentItem = currentMap.get(item.id)
      const otherItem = otherMap.get(item.id)
      
      if (!currentItem) return 'unchanged'
      
      if (!otherItem) {
        return isOldSide ? 'removed' : 'added'
      }
      
      // More robust text comparison
      const currentText = (currentItem.text || '').trim()
      const otherText = (otherItem.text || '').trim()
      
      if (currentText !== otherText) {
        // For complete text replacements, show as removal/addition instead of modification
        const textSimilarity = calculateTextSimilarity(currentText, otherText)
        
        // If texts are completely different (less than 30% similarity), treat as remove/add
        if (textSimilarity < 0.3) {
          return isOldSide ? 'removed' : 'added'
        }
        
        // Otherwise show as modification
        return 'modified'
      }
      
      return 'unchanged'
    }
    
    function calculateTextSimilarity(text1, text2) {
      if (!text1 && !text2) return 1.0
      if (!text1 || !text2) return 0.0
      
      // Simple similarity calculation based on common words
      const words1 = text1.toLowerCase().split(/\s+/)
      const words2 = text2.toLowerCase().split(/\s+/)
      
      if (words1.length === 0 && words2.length === 0) return 1.0
      if (words1.length === 0 || words2.length === 0) return 0.0
      
      const commonWords = words1.filter(word => words2.includes(word))
      const totalWords = Math.max(words1.length, words2.length)
      
      return commonWords.length / totalWords
    }
    
    function calculateDiffStats() {
      if (!props.oldVersion || !props.newVersion) {
        diffStats.value = { added: 0, removed: 0, modified: 0 }
        return
      }
      
      const oldIds = new Set(oldItemsMap.value.keys())
      const newIds = new Set(newItemsMap.value.keys())
      
      let added = 0, removed = 0, modified = 0
      
      // Count additions
      for (const id of newIds) {
        if (!oldIds.has(id)) {
          added++
        }
      }
      
      // Count removals
      for (const id of oldIds) {
        if (!newIds.has(id)) {
          removed++
        }
      }
      
      // Count modifications
      for (const id of newIds) {
        if (oldIds.has(id)) {
          const oldItem = oldItemsMap.value.get(id)
          const newItem = newItemsMap.value.get(id)
          if (oldItem.text !== newItem.text) {
            modified++
          }
        }
      }
      
      diffStats.value = { added, removed, modified }
    }
    
    function formatDate(dateString) {
      if (!dateString) return ''
      try {
        const date = new Date(dateString)
        return date.toLocaleString()
      } catch {
        return 'Invalid date'
      }
    }
    
    // Recalculate stats when versions change
    watch([() => props.oldVersion, () => props.newVersion], calculateDiffStats, { immediate: true })
    
    return {
      diffStats,
      oldItems,
      newItems,
      oldItemsMap,
      newItemsMap,
      getDiffType,
      calculateTextSimilarity,
      formatDate
    }
  }
}
</script>

<style scoped>
.outline-diff {
  width: 100%;
  height: 100%;
}

.no-diff {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.diff-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e1e8ed;
  background: #f8f9fa;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.old-version, .new-version {
  text-align: center;
}

.old-version h4, .new-version h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.old-version p, .new-version p {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

.arrow {
  font-size: 1.2rem;
  color: #666;
  font-weight: bold;
}

.diff-stats {
  display: flex;
  gap: 0.5rem;
}

.stat {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.stat.added {
  background: #d4edda;
  color: #155724;
}

.stat.removed {
  background: #f8d7da;
  color: #721c24;
}

.stat.modified {
  background: #fff3cd;
  color: #856404;
}

.diff-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.diff-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100%;
  min-height: 400px;
  overflow: hidden;
}

.diff-side {
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid #e1e8ed;
  padding: 1rem;
  max-height: 100%;
}

.diff-side:last-child {
  border-right: none;
}

.diff-side h5 {
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e1e8ed;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
}

.outline-tree {
  font-family: inherit;
}

@media (max-width: 768px) {
  .diff-view {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
    min-height: 500px;
  }
  
  .diff-side {
    border-right: none;
    border-bottom: 1px solid #e1e8ed;
    max-height: 250px;
  }
  
  .diff-side:last-child {
    border-bottom: none;
  }
}
</style>
