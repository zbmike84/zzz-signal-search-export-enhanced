<template>
  <div class="collection">
    <div class="bar">
      <p class="sub">{{ fmt(text.collection.summary, { n: items.length, f: items.filter(e => e.cons === 6).length, p: totalPulls.toLocaleString() }) }}</p>
      <el-radio-group v-model="sort" size="small">
        <el-radio-button label="recent">{{ text.collection.sortRecent }}</el-radio-button>
        <el-radio-button label="cons">{{ text.collection.sortCons }}</el-radio-button>
        <el-radio-button label="pulls">{{ text.collection.sortPulls }}</el-radio-button>
      </el-radio-group>
    </div>
    <p class="sub hint">{{ text.collection.hint }}</p>
    <div class="grid">
      <div v-for="e of sorted" :key="e.name" class="card">
        <div class="top">
          <img v-if="icons[e.itemId]" class="av" :src="icons[e.itemId]" alt="">
          <span v-else class="av"></span>
          <div class="who">
            <div class="name">{{ e.name }}</div>
            <div class="cons">
              <span class="pips" :aria-label="fmt(text.collection.cons, { n: e.cons })">
                <i v-for="k in 7" :key="k" :class="{ on: k <= e.copies }"></i>
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
          <span v-else class="m">{{ text.collection.noPulls }}</span>
        </div>
        <div v-if="e.otherCopies && e.upCopies" class="line m">{{ fmt(text.collection.other, { k: e.otherCopies }) }}</div>
        <div class="line m date">{{ e.first.slice(0, 10) }}<template v-if="e.last.slice(0, 10) !== e.first.slice(0, 10)"> – {{ e.last.slice(0, 10) }}</template></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fmt } from '../analysisUi'

const props = defineProps({ items: Array, icons: Object, text: Object })
const sort = ref('recent')
const totalPulls = computed(() => props.items.reduce((s, e) => s + e.pulls, 0))
const sorted = computed(() => {
  const list = [...props.items]
  if (sort.value === 'cons') return list.sort((a, b) => b.copies - a.copies || b.last.localeCompare(a.last))
  if (sort.value === 'pulls') return list.sort((a, b) => b.pulls - a.pulls || b.copies - a.copies)
  return list.sort((a, b) => b.last.localeCompare(a.last))
})
</script>

<style scoped>
.collection { padding: 12px 0 16px }
.bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 16px }
.sub { margin: 0; font-size: 12px; color: #909399 }
.hint { margin: 6px 0 12px }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px }
.card { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid #ebeef5; border-radius: 8px; min-width: 0 }
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
</style>
