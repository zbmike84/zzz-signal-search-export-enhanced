<template>
  <div class="collection">
    <div class="bar">
      <p class="sub">{{ fmt(text.collection.summary, { n: items.length, f: items.filter(e => e.cons === 6).length, p: totalPulls.toLocaleString() }) }}</p>
      <div class="tools">
        <el-select v-model="adding" size="small" filterable clearable :placeholder="text.collection.add" class="add" @change="add">
          <el-option v-for="c of addable" :key="c.id" :label="c.name" :value="c.id"></el-option>
        </el-select>
        <el-radio-group v-model="sort" size="small">
          <el-radio-button label="recent">{{ text.collection.sortRecent }}</el-radio-button>
          <el-radio-button label="cons">{{ text.collection.sortCons }}</el-radio-button>
          <el-radio-button label="pulls">{{ text.collection.sortPulls }}</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <p class="sub hint">{{ text.collection.hint }}</p>
    <div class="grid">
      <div v-for="e of sorted" :key="e.itemId || e.name" class="card">
        <div class="top">
          <img v-if="icons[e.itemId]" class="av" :src="icons[e.itemId]" alt="">
          <span v-else class="av"></span>
          <div class="who">
            <div class="name">{{ e.name }}</div>
            <div class="cons">
              <span class="pips" :aria-label="fmt(text.collection.cons, { n: e.cons })">
                <!-- one pip per constellation level 1-6; owning the character at all is level 0 -->
                <i v-for="k in 6" :key="k" :class="{ on: k <= e.cons }"></i>
              </span>
              <b>{{ fmt(text.collection.cons, { n: e.cons }) }}</b>
              <span v-if="e.extra" class="extra">{{ fmt(text.collection.extra, { n: e.extra }) }}</span>
            </div>
          </div>
        </div>
        <div class="line">
          <template v-if="e.upCopies">
            <b>{{ e.pulls.toLocaleString() }}</b> {{ fmt(text.collection.pulls, { u: e.upCopies }) }}
            <span class="m">· {{ fmt(text.collection.avg, { a: e.avg.toFixed(1) }) }}</span>
          </template>
          <span v-else-if="e.otherCopies" class="m">{{ text.collection.noPulls }}</span>
          <span v-else class="m">{{ text.collection.onlyExtra }}</span>
        </div>
        <div v-if="e.otherCopies && e.upCopies" class="line m">{{ fmt(text.collection.other, { k: e.otherCopies }) }}</div>
        <div v-if="e.first" class="line m date">{{ e.first.slice(0, 10) }}<template v-if="e.last.slice(0, 10) !== e.first.slice(0, 10)"> – {{ e.last.slice(0, 10) }}</template></div>
        <div class="gift" :class="{ set: e.extraCopies }">
          <span>{{ text.collection.extraLabel }}</span>
          <button type="button" :disabled="!e.extraCopies" :aria-label="`${text.collection.extraLabel} −1`" @click="set(e, e.extraCopies - 1)">−</button>
          <b>{{ e.extraCopies }}</b>
          <button type="button" :aria-label="`${text.collection.extraLabel} +1`" @click="set(e, e.extraCopies + 1)">＋</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fmt } from '../analysisUi'

const props = defineProps({ items: Array, icons: Object, text: Object, characters: Array })
const emit = defineEmits(['set-extra'])
const sort = ref('recent')
const adding = ref('')
const totalPulls = computed(() => props.items.reduce((s, e) => s + e.pulls, 0))
const sorted = computed(() => {
  const list = [...props.items]
  const last = e => e.last || ''
  if (sort.value === 'cons') return list.sort((a, b) => b.copies - a.copies || last(b).localeCompare(last(a)))
  if (sort.value === 'pulls') return list.sort((a, b) => b.pulls - a.pulls || b.copies - a.copies)
  return list.sort((a, b) => last(b).localeCompare(last(a)))
})
// characters not listed yet (e.g. a standard 5★ from an anniversary selector)
const addable = computed(() => {
  const have = new Set(props.items.map(e => e.itemId))
  return (props.characters || []).filter(c => !have.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))
})
const set = (e, n) => emit('set-extra', e.itemId, Math.max(0, n))
const add = id => { if (id) emit('set-extra', id, 1); adding.value = '' }
</script>

<style scoped>
.collection { padding: 12px 0 16px }
.bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 16px }
.tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center }
.add { width: 190px }
.sub { margin: 0; font-size: 12px; color: #909399 }
.hint { margin: 6px 0 12px }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px }
.card { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 8px; border: 1px solid #ebeef5; border-radius: 8px; min-width: 0 }
.top { display: flex; gap: 10px; align-items: center; margin-bottom: 2px }
.av { width: 44px; height: 44px; border-radius: 8px; background: #f0f2f5; flex: none; object-fit: contain }
.who { min-width: 0 }
.name { font-weight: 600; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.cons { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #303133 }
.pips { display: inline-flex; gap: 3px }
.pips i { width: 7px; height: 7px; border-radius: 50%; border: 1px solid #c0c4cc; background: #fff }
.pips i.on { border-color: #d4a72c; background: #e6b422 }
.extra { color: #b88230; font-weight: 600 }
.line { font-size: 12px; color: #606266; font-variant-numeric: tabular-nums }
.line b { color: #303133; font-size: 14px }
.m { color: #909399 }
.date { font-size: 11px }
.gift { display: flex; align-items: center; gap: 6px; margin-top: auto; padding-top: 6px; border-top: 1px dashed #ebeef5; font-size: 11px; color: #c0c4cc }
.gift.set { color: #b88230 }
.gift span { margin-right: auto }
.gift b { min-width: 1.2em; text-align: center; font-variant-numeric: tabular-nums }
.gift button { width: 20px; height: 20px; padding: 0; border: 1px solid #dcdfe6; border-radius: 4px; background: #fff; color: #606266; font-size: 13px; line-height: 1; cursor: pointer }
.gift button:hover:not(:disabled) { border-color: #409eff; color: #409eff }
.gift button:disabled { opacity: 0.4; cursor: default }
.gift button:focus-visible { outline: 2px solid #409eff; outline-offset: 1px }
</style>
