<template>
  <section class="panel">
    <div class="head">
      <div>
        <h2>{{ text.dist.title }}</h2>
        <p class="sub">{{ text.dist.hint }}</p>
      </div>
      <el-radio-group v-model="pool" size="small">
        <el-radio-button v-for="k of pools" :key="k" :label="k">{{ typeMap.get(k) || k }}</el-radio-button>
      </el-radio-group>
    </div>
    <div ref="chart" class="chart"></div>
    <div class="stats">
      <span><b>{{ stats.avg }}</b>{{ fmt(text.dist.avg, { e: model.mean.toFixed(1) }) }}</span>
      <span><b>{{ stats.pastSoft }}%</b>{{ fmt(text.dist.pastSoft, { e: (model.pastSoft * 100).toFixed(0) }) }}</span>
      <span><b>{{ stats.n }}</b>{{ text.dist.count }}</span>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { use, init } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import throttle from 'lodash-es/throttle'
import { fmt, COLORS } from '../analysisUi'
import { pityModel } from '../analysis'

use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer])

const props = defineProps({ analysis: Object, typeMap: Map, text: Object })
const pools = computed(() => ['2', '3', '5'].filter(k => props.analysis.pools[k]?.fives.length))
const pool = ref('2')
watch(pools, ps => { if (!ps.includes(pool.value) && ps.length) pool.value = ps[0] }, { immediate: true })

const p = computed(() => props.analysis.pools[pool.value])
const model = computed(() => pityModel(p.value?.kind || 'character'))
const counts = computed(() => {
  const c = new Array(model.value.cap).fill(0)
  for (const f of p.value?.fives || []) c[Math.min(f.pity, model.value.cap) - 1]++
  return c
})
const stats = computed(() => {
  const fives = p.value?.fives || []
  const n = fives.length
  return {
    n,
    avg: n ? (fives.reduce((s, f) => s + f.pity, 0) / n).toFixed(1) : '–',
    pastSoft: n ? Math.round((fives.filter(f => f.pity >= model.value.soft).length / n) * 100) : 0,
  }
})

const chart = ref(null)
let ec = null
function render() {
  if (!ec) return
  const m = model.value, n = stats.value.n, t = props.text.dist
  const xs = Array.from({ length: m.cap }, (_, i) => i + 1)
  ec.setOption({
    animation: false,
    grid: { left: 36, right: 12, top: 44, bottom: 26 },
    legend: { top: 0, left: 0, itemWidth: 14, itemHeight: 8, textStyle: { color: '#606266', fontSize: 12 },
      data: [{ name: t.yours, icon: 'roundRect' }, { name: t.theory, icon: 'path://M0,4 L14,4 L14,6 L0,6 Z' }] },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: ps => {
        const i = ps[0].dataIndex
        return `<b>${fmt(t.tipTitle, { n: i + 1 })}</b><br>${fmt(t.tipYours, { v: counts.value[i] })}<br>` +
          `<span style="color:#909399">${fmt(t.tipTheory, { v: (m.pmf[i] * n).toFixed(1) })}</span>`
      },
    },
    xAxis: { type: 'category', data: xs, axisTick: { show: false }, axisLine: { lineStyle: { color: '#c0c4cc' } },
      axisLabel: { color: '#909399', interval: i => (i + 1) % 15 === 0 || i === 0 } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#ebeef5' } }, axisLabel: { color: '#909399' } },
    series: [
      { name: t.yours, type: 'bar', data: counts.value, barCategoryGap: '15%', itemStyle: { color: COLORS.bar, borderRadius: [2, 2, 0, 0] },
        markLine: { silent: true, symbol: 'none', label: { formatter: `${props.text.ledger.softPity} ${m.soft}`, color: '#909399', position: 'end', distance: 4 },
          lineStyle: { color: '#909399', type: 'dashed' }, data: [{ xAxis: String(m.soft) }] } },
      { name: t.theory, type: 'line', data: m.pmf.map(v => +(v * n).toFixed(2)), showSymbol: false, smooth: false,
        lineStyle: { color: '#303133', width: 2 }, itemStyle: { color: '#303133' } },
    ],
  }, true)
}
const resize = throttle(() => ec?.resize(), 100)
onMounted(() => {
  ec = init(chart.value)
  render()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => { window.removeEventListener('resize', resize); ec?.dispose() })
watch([pool, () => props.analysis, () => props.text], render)
</script>

<style scoped>
.panel { padding: 16px 18px; border: 1px solid #e4e7ed; border-radius: 8px; background: #fff; min-width: 0 }
.head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 10px 16px; margin-bottom: 8px }
h2 { margin: 0; font-size: 16px; font-weight: 600; color: #303133 }
.sub { margin: 2px 0 0; font-size: 12px; color: #909399 }
.chart { height: 240px }
.stats { display: flex; flex-wrap: wrap; gap: 6px 22px; margin-top: 8px; font-size: 13px; color: #606266 }
.stats b { margin-right: 4px; font-size: 16px; color: #303133; font-variant-numeric: tabular-nums }
</style>
