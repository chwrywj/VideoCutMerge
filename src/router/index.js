import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'video-cut-merge',
      component: () => import('../views/VideoCutMerge.vue')
    }
  ]
})

export default router
