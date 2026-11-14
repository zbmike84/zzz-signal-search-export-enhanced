<template>
  <div class="tiles">
    <div v-for="t of tiles" :key="t.key" class="tile">
      <div class="label">{{ t.name }}</div>
      <div class="big">{{ t.pity }}<small>/ {{ t.cap }} {{ text.tiles.pulls }}</small></div>
      <div class="meter" role="img" :aria-label="`${text.tiles.pulled} ${t.pity} / ${t.cap}`">
        <i :style="{ width: `${(t.pity / t.cap) * 100}%` }"></i>
        <b :style="{ left: `${((t.soft - 1) / t.cap) * 100}%` }"></b>
      </div>
      <div class="line">
        <span class="pill"><i class="dot" :class="t.dot"></i>{{ t.next }}</span>
        <span v-if="t.radiance !== null">{{ fmt(text.tiles.radiance, { n: t.radiance }) }}</span>
      </div>
      <div class="line">{{ fmt(text.tiles.summary, { n: t.count, avg: t.avg }) }}</div>
      <div v-if="t.upAvg" class="line">{{ t.upAvg }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fmt, POOL_ORDER } from '../analysisUi'
import { pityModel } from '../analysis'
import { upAverage, expectedUpAverage } from '../luck.js'

const props = defineProps({ analysis: Object, typeMap: Map, text: Object })

// wishes you never pulled on (e.g. reruns) get no tile
const tiles = computed(() => POOL_ORDER.filter(k => props.analysis.pools[k]?.total).map(k => {
  const p = props.analysis.pools[k]
  const m = pityModel(p.kind)
  const t = props.text.tiles
  let next, dot = ''
  if (p.kind === 'standard' || p.kind === 'bangboo') next = t.noUp
  else if (p.guaranteed) { next = t.nextGuaranteed; dot = 'guar' }
  else next = p.kind === 'character' ? t.next5050 : t.nextOpen
  const avg = p.fives.length ? (p.fives.reduce((s, f) => s + f.pity, 0) / p.fives.length).toFixed(1) : '–'
  // pulls per rate-up 5★, character and weapon event wishes only
  let upAvg = null
  const exp = expectedUpAverage(p.kind)
  const u = upAverage(p)
  if (exp && u.avg) {
    const lo = Math.round(Math.min(exp.pre, exp.post)), hi = Math.round(Math.max(exp.pre, exp.post))
    upAvg = fmt(t.upAvg, { v: u.avg.toFixed(1), e: lo === hi ? lo : `${lo}–${hi}` })
  }
  return {
    key: k, name: props.typeMap.get(k) || k, pity: p.pity, cap: m.cap, soft: m.soft, next, dot,
    radiance: null, count: p.fives.length, avg, upAvg,
  }
}))
</script>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px }
@media (max-width: 1000px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
.tile { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid #e4e7ed; border-radius: 8px; background: #fff }
.label { font-size: 12px; letter-spacing: 0.04em; color: #909399 }
.big { font-size: 30px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: #303133 }
.big small { font-size: 13px; font-weight: 400; color: #909399; margin-left: 4px }
.meter { position: relative; height: 6px; background: #f0f2f5; border-radius: 3px }
.meter i { position: absolute; inset: 0 auto 0 0; background: #606266; border-radius: 3px }
.meter b { position: absolute; top: -2px; bottom: -2px; width: 1px; background: #909399 }
.line { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; color: #606266 }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 1px 9px 1px 7px; border: 1px solid #e4e7ed; border-radius: 999px; font-size: 12px; color: #303133; white-space: nowrap }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #a3a9b2; flex: none }
.dot.guar { background: #2a78d6 }
</style>
