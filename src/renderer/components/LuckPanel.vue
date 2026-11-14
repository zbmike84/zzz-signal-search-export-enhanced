<template>
  <section class="panel">
    <h2>{{ text.luck.title }}</h2>
    <p class="sub">{{ text.luck.hint }}</p>
    <template v-if="rate && rate.n">
      <div class="rate">{{ (rate.rate * 100).toFixed(1) }}%</div>
      <p class="sub">
        {{ fmt(text.luck.counts, { w: rate.w, l: rate.n - rate.w }) }} ·
        {{ fmt(text.luck.ci, { lo: pct(rate.lo), hi: pct(rate.hi) }) }} · {{ rate.lo <= 0.5 && rate.hi >= 0.5 ? text.luck.inside : text.luck.outside }}
      </p>
      <div class="ci" role="img" :aria-label="`${(rate.rate * 100).toFixed(1)}% (${pct(rate.lo)}–${pct(rate.hi)}%)`">
        <div class="ax"></div>
        <div class="band" :style="{ left: pos(rate.lo), width: `calc(${pos(rate.hi)} - ${pos(rate.lo)})` }"></div>
        <div class="mid"></div>
        <div class="pt" :style="{ left: pos(rate.rate) }"></div>
      </div>
      <div class="ci-lab"><span>30%</span><span>50%</span><span>70%</span></div>
    </template>
    <p v-else class="sub">{{ text.luck.none }}</p>

    <template v-if="radiance && radianceTotal">
      <h3>{{ text.radiance.title }}</h3>
      <p class="sub">{{ text.radiance.hint }}</p>
      <div class="legend"><span><i class="dot win"></i>{{ text.result.win }}</span><span><i class="dot lose"></i>{{ text.result.lose }}</span></div>
      <div class="rad">
        <div v-for="b of radiance" :key="b.streak" class="r">
          <span class="k">{{ fmt(b.streak === 3 ? text.radiance.rowMax : text.radiance.row, { n: b.streak }) }}</span>
          <span class="stack">
            <i v-if="b.win" class="win" :style="{ flex: b.win }"></i>
            <i v-if="b.lose" class="lose" :style="{ flex: b.lose }"></i>
          </span>
          <span class="n">{{ b.win }}/{{ b.win + b.lose }} · {{ b.win + b.lose ? Math.round((b.win / (b.win + b.lose)) * 100) : 0 }}%</span>
        </div>
      </div>
      <p class="note">{{ note }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { fmt } from '../analysisUi'

const props = defineProps({ analysis: Object, text: Object })
const rate = computed(() => props.analysis.rate)
const radiance = computed(() => props.analysis.radiance)
const radianceTotal = computed(() => (radiance.value || []).reduce((s, b) => s + b.win + b.lose, 0))
const pct = v => (v * 100).toFixed(0)
const pos = v => `${(((Math.min(0.7, Math.max(0.3, v)) - 0.3) / 0.4) * 100).toFixed(2)}%`
const note = computed(() => {
  const r = radiance.value
  const lw = r[0].win + r[1].win, lt = lw + r[0].lose + r[1].lose
  const hw = r[2].win + r[3].win, ht = hw + r[2].lose + r[3].lose
  return fmt(props.text.radiance.note, { a: lt ? Math.round((lw / lt) * 100) : 0, b: ht ? Math.round((hw / ht) * 100) : 0, w: hw, t: ht })
})
</script>

<style scoped>
.panel { padding: 16px 18px; border: 1px solid #e4e7ed; border-radius: 8px; background: #fff; min-width: 0 }
h2 { margin: 0; font-size: 16px; font-weight: 600; color: #303133 }
h3 { margin: 22px 0 0; font-size: 14px; font-weight: 600; color: #303133 }
.sub { margin: 2px 0 0; font-size: 12px; color: #909399 }
.rate { margin-top: 10px; font-size: 32px; font-weight: 700; line-height: 1.1; color: #303133; font-variant-numeric: tabular-nums }
.ci { position: relative; height: 26px; margin-top: 6px }
.ci .ax { position: absolute; left: 0; right: 0; top: 12px; height: 2px; background: #f0f2f5 }
.ci .band { position: absolute; top: 8px; height: 10px; background: #909399; opacity: 0.35; border-radius: 3px }
.ci .mid { position: absolute; left: 50%; top: 2px; bottom: 2px; border-left: 1px dashed #606266 }
.ci .pt { position: absolute; top: 6px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #303133; border: 2px solid #fff }
.ci-lab { display: flex; justify-content: space-between; font-size: 11px; color: #909399 }
.legend { display: flex; gap: 14px; margin: 10px 0 8px; font-size: 12px; color: #606266 }
.legend span { display: inline-flex; align-items: center; gap: 6px }
.dot { width: 8px; height: 8px; border-radius: 50% }
.win { background: #1baf7a } .lose { background: #eb6834 }
.rad { display: flex; flex-direction: column; gap: 8px }
.r { display: grid; grid-template-columns: 8.5em minmax(0, 1fr) 6.8em; gap: 10px; align-items: center; font-size: 13px; color: #606266 }
.stack { display: flex; gap: 2px; height: 14px }
.stack i { display: block; height: 100%; min-width: 2px }
.stack i:first-child { border-radius: 4px 0 0 4px } .stack i:last-child { border-radius: 0 4px 4px 0 } .stack i:only-child { border-radius: 4px }
.n { text-align: right; font-variant-numeric: tabular-nums }
.note { margin: 12px 0 0; font-size: 12px; color: #909399; line-height: 1.6 }
</style>
