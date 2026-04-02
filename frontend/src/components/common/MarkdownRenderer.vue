<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { renderMarkdownContent } from './markdownRendererContent'
import { createMarkdownRendererDomController } from './markdownRendererDom'

const props = withDefaults(defineProps<{
  content: string
  latexOnly?: boolean
  streaming?: boolean
}>(), {
  latexOnly: false,
  streaming: false
})

const containerRef = ref<HTMLElement | null>(null)
const domController = createMarkdownRendererDomController(() => containerRef.value)

const renderedContent = computed(() => {
  return renderMarkdownContent(props.content, props.latexOnly, props.streaming === true)
})

onMounted(() => {
  domController.mount()
  nextTick(() => domController.refresh())
})

watch(() => props.content, () => {
  nextTick(() => domController.refresh())
})

onUnmounted(() => {
  domController.unmount()
})
</script>

<template>
  <div ref="containerRef" class="markdown-content" v-html="renderedContent"></div>
</template>

<style scoped src="./MarkdownRenderer.css"></style>
