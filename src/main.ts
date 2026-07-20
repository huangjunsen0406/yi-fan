import { createApp } from "vue";
import { createPinia } from "pinia";
import ArcoVue from "@arco-design/web-vue";
import "@arco-design/web-vue/dist/arco.css";
// Bundle Phosphor icons locally (CDN blocked by Tauri CSP in production)
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import App from "./App.vue";
import router from "./router";
import "./styles/fonts.css";
import "./styles.css";

import { useSettingsStore } from "./stores/settings";
import { initTheme } from "./services/theme";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(ArcoVue);
app.use(router);

// Theme before paint of routed views (async store load may lag one frame)
void initTheme();

// Initialize settings store (load saved API keys)
const settings = useSettingsStore();
settings.init();

app.mount("#app");
