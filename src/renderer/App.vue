<template>
  <div v-if="ui" class="relative">
    <div class="flex justify-between">
      <div class="space-x-3">
        <el-button
          type="primary"
          :icon="state.status === 'init' ? 'milk-tea' : 'refresh-right'"
          class="focus:outline-none"
          :disabled="!allowClick()"
          plain
          @click="fetchData()"
          :loading="state.status === 'loading'"
          >{{
            state.status === "init" ? ui.button.load : ui.button.update
          }}</el-button
        >
        <el-dropdown :disabled="!gachaData" @command="exportCommand">
          <el-button
            :disabled="!gachaData"
            icon="folder-opened"
            class="focus:outline-none"
            type="success"
            plain
          >
            {{ ui.button.files }}
            <el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="excel">{{
                ui.button.excel
              }}</el-dropdown-item>
              <el-dropdown-item command="uigf-json">{{
                ui.button.uigf
              }}</el-dropdown-item>
              <el-dropdown-item command="import-json" divided>{{
                ui.button.import
              }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-tooltip
          v-if="detail && state.status !== 'loading'"
          :content="ui.hint.newAccount"
          placement="bottom"
        >
          <el-button
            @click="newUser()"
            plain
            icon="plus"
            class="focus:outline-none"
          ></el-button>
        </el-tooltip>
        <el-tooltip
          v-if="state.status === 'updated'"
          :content="ui.hint.relaunchHint"
          placement="bottom"
        >
          <el-button
            @click="relaunch()"
            type="success"
            icon="refresh"
            class="focus:outline-none"
            style="margin-left: 48px"
            >{{ ui.button.directUpdate }}</el-button
          >
        </el-tooltip>
      </div>
      <div class="flex gap-2">
        <el-select
          v-if="
            state.status !== 'loading' &&
            dataMap &&
            (dataMap.size > 1 || (dataMap.size === 1 && state.current === 0))
          "
          class="w-44"
          @change="changeCurrent"
          v-model="uidSelectText"
        >
          <el-option
            v-for="item of dataMap"
            :key="item[0]"
            :label="maskUid(item[0])"
            :value="item[0]"
          >
          </el-option>
        </el-select>
        <el-dropdown @command="optionCommand">
          <el-button
            @click="showSetting(true)"
            class="focus:outline-none"
            plain
            type="info"
            icon="more"
            >{{ ui.button.option }}</el-button
          >
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="setting" icon="setting">{{
                ui.button.setting
              }}</el-dropdown-item>
              <el-dropdown-item
                :disabled="!allowClick() || state.status === 'loading'"
                command="url"
                icon="link"
                >{{ ui.button.url }}</el-dropdown-item
              >
              <el-dropdown-item command="copyUrl" icon="DocumentCopy">{{
                ui.button.copyUrl
              }}</el-dropdown-item>
              <el-dropdown-item command="copyApiUrl" icon="Link">{{
                ui.button.copyApiUrl
              }}</el-dropdown-item>
              <el-dropdown-item
                :disabled="!allowClick() || state.status === 'loading'"
                command="proxy"
                icon="position"
                >{{ ui.button.startProxy }}</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <p class="text-gray-400 my-2 text-xs">
      {{ hint
      }}<el-button
        @click="state.showCacheCleanDlg = true"
        v-if="state.authkeyTimeout"
        style="margin-left: 8px"
        size="small"
        plain
        round
        >{{ ui.button.solution }}</el-button
      >
    </p>
    <div v-if="gachaData && aText" class="flex flex-col gap-4 pb-6">
      <template v-if="analysis">
        <el-alert v-if="analysis.issues.length" type="warning" :closable="false" show-icon
                  :title="fmt(aText.issues, { n: analysis.issues.length })"></el-alert>
        <status-tiles :analysis="analysis" :typeMap="typeMap" :text="aText"></status-tiles>
        <luck-summary :analysis="analysis" :typeMap="typeMap" :text="aText"></luck-summary>
        <pity-ledger :analysis="analysis" :typeMap="typeMap" :text="aText" :icons="state.icons"></pity-ledger>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <pity-distribution :analysis="analysis" :typeMap="typeMap" :text="aText"></pity-distribution>
          <luck-panel :analysis="analysis" :text="aText"></luck-panel>
        </div>
        <version-chart :analysis="analysis" :typeMap="typeMap" :text="aText" :icons="state.icons"></version-chart>
      </template>
      <el-collapse v-if="detail">
        <el-collapse-item :title="aText.classic.title" name="classic">
          <div class="gap-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
            <div v-for="(item, i) of detail" :key="i" :class="{ hidden: state.config.hideStandard && item[0] === '1' }">
              <p class="text-center text-gray-600 my-2">{{ typeMap.get(item[0]) }}</p>
              <gacha-detail :i18n="state.i18n" :data="item" :typeMap="typeMap"></gacha-detail>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
    <Setting
      v-show="state.showSetting"
      :i18n="state.i18n"
      :gacha-data-info="dataInfo"
      @refreshData="readData()"
      @changeLang="getI18nData()"
      @close="showSetting(false)"
    ></Setting>

    <el-dialog
      :title="ui.urlDialog.title"
      v-model="state.showUrlDlg"
      width="90%"
      class="max-w-md"
    >
      <p class="mb-4 text-gray-500">{{ ui.urlDialog.hint }}</p>
      <el-input
        type="textarea"
        :autosize="{ minRows: 4, maxRows: 6 }"
        :placeholder="ui.urlDialog.placeholder"
        v-model="state.urlInput"
        spellcheck="false"
      ></el-input>
      <template #footer>
        <span class="dialog-footer">
          <el-button
            @click="state.showUrlDlg = false"
            class="focus:outline-none"
            >{{ ui.common.cancel }}</el-button
          >
          <el-button
            type="primary"
            @click="(state.showUrlDlg = false), fetchData(state.urlInput)"
            class="focus:outline-none"
            >{{ ui.common.ok }}</el-button
          >
        </span>
      </template>
    </el-dialog>

    <el-dialog
      :title="ui.button.solution"
      v-model="state.showCacheCleanDlg"
      width="90%"
      class="max-w-md cache-clean-dialog"
    >
      <el-button plain icon="folder" type="success" @click="openCacheFolder">{{
        ui.button.cacheFolder
      }}</el-button>
      <p class="my-2 flex flex-col text-teal-800 text-[13px]">
        <span class="my-1" v-for="txt of cacheCleanTextList">{{ txt }}</span>
      </p>
      <p class="my-2 text-gray-500 text-xs">{{ ui.extra.findCacheFolder }}</p>
      <template #footer>
        <div class="dialog-footer text-center">
          <el-button
            type="primary"
            @click="state.showCacheCleanDlg = false"
            class="focus:outline-none"
            >{{ ui.common.ok }}</el-button
          >
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
const { ipcRenderer } = require("electron");
import { reactive, computed, watch, onMounted } from "vue";
import StatusTiles from "./components/StatusTiles.vue";
import LuckSummary from "./components/LuckSummary.vue";
import PityLedger from "./components/PityLedger.vue";
import PityDistribution from "./components/PityDistribution.vue";
import LuckPanel from "./components/LuckPanel.vue";
import VersionChart from "./components/VersionChart.vue";
import { analyse } from "./analysis.js";
import { fmt } from "./analysisUi";
import bannerData from "../data/banners.json";
import GachaDetail from "./components/GachaDetail.vue";
import Setting from "./components/Setting.vue";
import gachaDetail from "./gachaDetail";
import { version } from "../../package.json";
import gachaType from "../gachaType.json";
import { ElMessage, ElMessageBox } from "element-plus";

const state = reactive({
  status: "init",
  log: "",
  data: null,
  dataMap: new Map(),
  icons: {},
  current: 0,
  showSetting: false,
  i18n: null,
  showUrlDlg: false,
  showCacheCleanDlg: false,
  urlInput: "",
  authkeyTimeout: false,
  config: {},
});

const dataMap = computed(() => {
  const result = new Map();
  for (let [uid, data] of state.dataMap) {
    if (!data.deleted) {
      result.set(uid, data);
    }
  }
  return result;
});

const dataInfo = computed(() => {
  const result = [];
  for (let [uid, data] of state.dataMap) {
    result.push({
      uid,
      time: data.time,
      deleted: data.deleted,
    });
  }
  return result;
});

const ui = computed(() => {
  if (state.i18n) {
    return state.i18n.ui;
  }
});

const cacheCleanTextList = computed(() => {
  if (ui.value) {
    return ui.value.extra?.cacheClean?.split("\n");
  }
  return [];
});

const gachaData = computed(() => {
  return state.dataMap.get(state.current);
});

const uidSelectText = computed(() => {
  if (state.current === 0) {
    return state.i18n.ui.select.newAccount;
  } else {
    return state.current;
  }
});

const allowClick = () => {
  const data = state.dataMap.get(state.current);
  if (!data) return true;
  if (Date.now() - data.time < 1000 * 10) {
    return false;
  }
  return true;
};

const hint = computed(() => {
  const data = state.dataMap.get(state.current);
  if (!state.i18n) {
    return "Loading...";
  }
  const { hint } = state.i18n.ui;
  const { colon } = state.i18n.symbol;
  if (state.status === "init") {
    return hint.init;
  } else if (state.status === "loaded") {
    return `${hint.lastUpdate}${colon}${new Date(data.time).toLocaleString()}`;
  } else if (state.status === "loading") {
    return state.log || "Loading...";
  } else if (state.status === "updated") {
    return state.log;
  } else if (state.status === "failed") {
    return state.log + ` - ${hint.failed}`;
  }
  return "　";
});

const detail = computed(() => {
  const data = dataMap.value.get(state.current);
  if (data) {
    return gachaDetail(data.result);
  }
});

const analysis = computed(() => {
  const data = state.dataMap.get(state.current);
  if (!data) return null;
  try {
    return analyse(data, bannerData);
  } catch (e) {
    console.error(e);
    return null;
  }
});

const aText = computed(() => state.i18n?.ui?.analysis);

// icons for every S-rank on screen (cached on disk by the main process): cached first, then downloads
watch(analysis, async (a) => {
  if (!a) return;
  const want = new Map();
  for (const p of Object.values(a.pools)) {
    for (const f of p.fives) if (f.itemId && !state.icons[f.itemId]) want.set(f.itemId, { id: f.itemId });
  }
  if (!want.size) return;
  try {
    const cached = await ipcRenderer.invoke("GET_ICONS", [...want.values()], { offline: true });
    state.icons = { ...state.icons, ...cached };
    const missing = [...want.values()].filter((i) => !cached[i.id]);
    if (missing.length) {
      const got = await ipcRenderer.invoke("GET_ICONS", missing);
      state.icons = { ...state.icons, ...got };
    }
  } catch (e) {
    console.error(e);
  }
}, { immediate: true });

const typeMap = computed(() => {
  const gachaTypeMap = new Map(gachaType);
  const type = gachaTypeMap.get(state.config.lang);
  const result = new Map();
  if (type) {
    for (let { key, name } of type) {
      result.set(key, name);
    }
  }
  return result;
});

const fetchData = async (url) => {
  state.log = "";
  state.status = "loading";
  const data = await ipcRenderer.invoke("FETCH_DATA", url);
  if (data) {
    state.dataMap = data.dataMap;
    state.current = data.current;
    state.status = "loaded";
  } else {
    state.status = "failed";
  }
};

const readData = async () => {
  const data = await ipcRenderer.invoke("READ_DATA");
  if (data) {
    state.dataMap = data.dataMap;
    state.current = data.current;
    if (data.dataMap.get(data.current)) {
      state.status = "loaded";
    }
  }
};

const getI18nData = async () => {
  const data = await ipcRenderer.invoke("I18N_DATA");
  if (data) {
    state.i18n = data;
    setTitle();
  }
};

const saveExcel = async () => {
  await ipcRenderer.invoke("SAVE_EXCEL");
};

const exportUIGFJSON = () => {
  let uidList = [];
  dataMap.value.forEach((item) => {
    uidList.push(item.uid);
  });

  ElMessageBox({
    title: state.i18n.ui.uigf.title,
    message: `
      <div>
        ${uidList
          .map(
            (uid) => `
          <div>
            <input type="checkbox" id="${uid}" value="${uid}" />
            <label for="${uid}">${uid}</label>
          </div>
        `
          )
          .join("")}
      </div>
    `,
    dangerouslyUseHTMLString: true,
    showCancelButton: true,
    confirmButtonText: state.i18n.ui.common.ok,
    cancelButtonText: state.i18n.ui.common.cancel,
    beforeClose: (action, instance, done) => {
      if (action === "confirm") {
        const selected_uids = uidList.filter(
          (uid) => document.getElementById(uid).checked
        );
        ipcRenderer.invoke("EXPORT_UIGF_JSON", selected_uids);
      }
      done();
    },
  })
    .then(() => {})
    .catch(() => {});
};

const importData = async () => {
  state.status = "loading";
  const data = await ipcRenderer.invoke("IMPORT_UIGF_JSON");
  if (data) {
    state.dataMap = data.dataMap;
    state.current = data.current;
    state.status = "loaded";
  } else {
    state.status = "failed";
  }
};

const exportCommand = (type) => {
  if (type === "excel") {
    saveExcel();
  } else if (type === "uigf-json") {
    exportUIGFJSON();
  } else if (type === "import-json") {
    importData();
  }
};
const openCacheFolder = async () => {
  await ipcRenderer.invoke("OPEN_CACHE_FOLDER");
};

const changeCurrent = async (uid) => {
  if (uid === 0) {
    state.status = "init";
  } else {
    state.status = "loaded";
  }
  state.current = uid;
  await ipcRenderer.invoke("CHANGE_UID", uid);
};

const newUser = async () => {
  await changeCurrent(0);
};

const relaunch = async () => {
  await ipcRenderer.invoke("RELAUNCH");
};

const maskUid = (uid) => {
  return `${uid}`.replace(/(.{3})(.+)(.{3})$/, "$1***$3");
};

const showSetting = (show) => {
  if (show) {
    state.showSetting = true;
  } else {
    state.showSetting = false;
    updateConfig();
  }
};

const optionCommand = (type) => {
  if (type === "setting") {
    showSetting(true);
  } else if (type === "url") {
    state.urlInput = "";
    state.showUrlDlg = true;
  } else if (type === "proxy") {
    fetchData("proxy");
  } else if (type === "copyUrl") {
    copyUrl();
  } else if (type === "copyApiUrl") {
    copyApiUrl();
  }
};

const setTitle = () => {
  document.title = `${state.i18n.ui.win.title} - v${version}`;
};

const updateConfig = async () => {
  state.config = await ipcRenderer.invoke("GET_CONFIG");
};

const copyUrl = async () => {
  const successed = await ipcRenderer.invoke("COPY_URL");
  if (successed) {
    ElMessage.success(ui.value.extra.urlCopied);
  } else {
    ElMessage.error(state.i18n.log.url.notFound);
  }
};

const copyApiUrl = async () => {
  const successed = await ipcRenderer.invoke("COPY_API_URL");
  if (successed) {
    ElMessage.success(ui.value.extra.apiUrlCopied);
  } else {
    ElMessage.error(state.i18n.log.url.notFound);
  }
};

onMounted(async () => {
  await readData();
  await getI18nData();

  ipcRenderer.on("LOAD_DATA_STATUS", (event, message) => {
    state.log = message;
  });

  ipcRenderer.on("ERROR", (event, err) => {
    console.error(err);
  });

  ipcRenderer.on("UPDATE_HINT", (event, message) => {
    state.log = message;
    state.status = "updated";
  });

  ipcRenderer.on("AUTHKEY_TIMEOUT", (event, message) => {
    state.authkeyTimeout = message;
  });

  await updateConfig();
});
</script>
