import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Outlines from '../views/Outlines.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/single-workspace/:workspace_id/outlines',
    name: 'Outlines',
    component: Outlines,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
