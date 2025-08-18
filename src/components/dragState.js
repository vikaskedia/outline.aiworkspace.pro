import { reactive } from 'vue'

export const dragState = reactive({
  draggedId: null,
  hoveredId: null,
  hoveredPosition: null, // 'top', 'bottom', 'child'
  isDragging: false
})
