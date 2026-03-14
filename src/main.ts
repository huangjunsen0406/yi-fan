import { createApp } from "vue";
import { createPinia } from "pinia";
import ArcoVue from "@arco-design/web-vue";
import "@arco-design/web-vue/dist/arco.css";
import App from "./App.vue";
import router from "./router";
import "./styles.css";

import { useSettingsStore } from "./stores/settings";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(ArcoVue);
app.use(router);

// Initialize settings store (load saved API keys)
const settings = useSettingsStore();
settings.init();

app.mount("#app");
