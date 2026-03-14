import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../layouts/DefaultLayout.vue'),
    children: [
      {
        path: '',
        name: 'Translate',
        component: () => import('../views/TranslateView.vue'),
      },
    ],
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
  },
  {
    path: '/screenshot',
    name: 'Screenshot',
    component: () => import('../views/ScreenshotView.vue'),
  },
  {
    path: '/recognize',
    name: 'Recognize',
    component: () => import('../views/RecognizeView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
