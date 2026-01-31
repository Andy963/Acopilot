import { ref } from 'vue'
import type FilePickerPanel from './FilePickerPanel.vue'
import type InputBox from './InputBox.vue'

export function useAtFilePicker() {
  const showFilePicker = ref(false)
  const filePickerQuery = ref('')
  const inputBoxRef = ref<InstanceType<typeof InputBox> | null>(null)
  const filePickerRef = ref<InstanceType<typeof FilePickerPanel> | null>(null)

  function handleTriggerAtPicker(query: string, _triggerPosition: number) {
    filePickerQuery.value = query
    showFilePicker.value = true
  }

  function handleAtQueryChange(query: string) {
    filePickerQuery.value = query
  }

  function handleCloseAtPicker() {
    showFilePicker.value = false
    filePickerQuery.value = ''
  }

  function handleSelectFile(path: string) {
    if (inputBoxRef.value) {
      inputBoxRef.value.insertFilePath(path)
    }
    showFilePicker.value = false
    filePickerQuery.value = ''
  }

  function handleAtPickerKeydown(key: string) {
    if (!showFilePicker.value || !filePickerRef.value) return

    if (key === 'ArrowUp') {
      filePickerRef.value.handleKeydown({ key: 'ArrowUp', preventDefault: () => {} } as KeyboardEvent)
    } else if (key === 'ArrowDown') {
      filePickerRef.value.handleKeydown({ key: 'ArrowDown', preventDefault: () => {} } as KeyboardEvent)
    } else if (key === 'Enter') {
      filePickerRef.value.selectCurrent()
    }
  }

  return {
    showFilePicker,
    filePickerQuery,
    inputBoxRef,
    filePickerRef,
    handleTriggerAtPicker,
    handleAtQueryChange,
    handleCloseAtPicker,
    handleSelectFile,
    handleAtPickerKeydown
  }
}
