/**
 * Options Page Logic
 * 处理快捷键的录制和保存
 */

// 默认快捷键配置
const DEFAULT_TAB_SHORTCUT = {
  modifiers: ['altKey'],
  key: 'Backquote',
  code: 'Backquote',
  display: 'Option + ~',
}

const DEFAULT_SEARCH_SHORTCUT = {
  modifiers: ['altKey'],
  key: 'd',
  code: 'KeyD',
  display: 'Option + D',
}

// 状态
let shortcuts = {
  tab: {...DEFAULT_TAB_SHORTCUT},
  search: {...DEFAULT_SEARCH_SHORTCUT},
}

let recordingTarget = null // 'tab' or 'search'

// DOM 元素
const recorderTab = document.getElementById('recorder-tab')
const displayTab = document.getElementById('shortcut-display-tab')
const recorderSearch = document.getElementById('recorder-search')
const displaySearch = document.getElementById('shortcut-display-search')
const saveBtn = document.getElementById('save')
const statusMsg = document.getElementById('status')

/**
 * 将修饰键和按键转换为可读字符串
 * @param {Object} shortcut
 * @returns {string}
 */
function formatShortcut(shortcut) {
  const parts = []
  if (shortcut.modifiers.includes('metaKey')) parts.push('Command')
  if (shortcut.modifiers.includes('ctrlKey')) parts.push('Ctrl')
  if (shortcut.modifiers.includes('altKey')) parts.push('Option')
  if (shortcut.modifiers.includes('shiftKey')) parts.push('Shift')

  let keyDisplay = shortcut.key
  if (shortcut.code === 'Backquote') keyDisplay = '~'
  if (shortcut.key === ' ') keyDisplay = 'Space'

  parts.push(keyDisplay.toUpperCase())
  return parts.join(' + ')
}

const searchEngineUrlInput = document.getElementById('search-engine-url')

/**
 * 初始化：加载已保存的设置
 */
function init() {
  applyI18n()
  chrome.storage.sync.get(['shortcut', 'searchShortcut', 'searchEngineUrl'], (result) => {
    if (result.shortcut) {
      shortcuts.tab = result.shortcut
    }
    if (result.searchShortcut) {
      shortcuts.search = result.searchShortcut
    }
    if (result.searchEngineUrl) {
      searchEngineUrlInput.value = result.searchEngineUrl
    }
    updateDisplay()
  })
}

function updateDisplay() {
  displayTab.textContent = shortcuts.tab.display || formatShortcut(shortcuts.tab)
  displaySearch.textContent = shortcuts.search.display || formatShortcut(shortcuts.search)
}

/**
 * 启动录制
 * @param {string} target 'tab' or 'search'
 */
function startRecording(target) {
  recordingTarget = target
  const recorder = target === 'tab' ? recorderTab : recorderSearch
  const display = target === 'tab' ? displayTab : displaySearch

  // 重置另一个录制器的状态
  if (target === 'tab') {
    recorderSearch.classList.remove('recording')
    displaySearch.textContent = shortcuts.search.display || formatShortcut(shortcuts.search)
  } else {
    recorderTab.classList.remove('recording')
    displayTab.textContent = shortcuts.tab.display || formatShortcut(shortcuts.tab)
  }

  recorder.classList.add('recording')
  display.textContent = chrome.i18n.getMessage('recording')
}

/**
 * 处理录制点击
 */
recorderTab.addEventListener('click', () => startRecording('tab'))
recorderSearch.addEventListener('click', () => startRecording('search'))

/**
 * 监听键盘事件进行录制
 */
document.addEventListener('keydown', (e) => {
  if (!recordingTarget) return

  // 仅当焦点在录制区域或 body 时才处理 (防止意外触发)
  // 但由于我们点击了 div，div 获取了 focus (tabindex=0)，所以直接监听 document 也可以，
  // 只要我们判断 recordingTarget 即可。

  e.preventDefault()
  e.stopPropagation()

  // 忽略单独按下的修饰键
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
    return
  }

  const modifiers = []
  if (e.metaKey) modifiers.push('metaKey')
  if (e.ctrlKey) modifiers.push('ctrlKey')
  if (e.altKey) modifiers.push('altKey')
  if (e.shiftKey) modifiers.push('shiftKey')

  // 如果没有修饰键，或者只有 Shift (除非是功能键)，提示用户
  const display = recordingTarget === 'tab' ? displayTab : displaySearch
  if (modifiers.length === 0) {
    display.textContent = '请包含至少一个修饰键 (Option/Alt, Ctrl, Command)'
    return
  }

  const newShortcut = {
    modifiers: modifiers,
    key: e.key,
    code: e.code,
    display: '',
  }

  newShortcut.display = formatShortcut(newShortcut)

  // 更新暂存状态
  shortcuts[recordingTarget] = newShortcut
  updateDisplay()

  // 结束录制
  const recorder = recordingTarget === 'tab' ? recorderTab : recorderSearch
  recorder.classList.remove('recording')
  recorder.blur()
  recordingTarget = null
})

/**
 * 国际化处理
 */
function applyI18n() {
  document.querySelectorAll('[id^="i18n-"]').forEach((el) => {
    const key = el.id.replace('i18n-', '')
    const msg = chrome.i18n.getMessage(key)
    if (msg) el.textContent = msg
  })

  if (saveBtn) saveBtn.textContent = chrome.i18n.getMessage('save')
  if (searchEngineUrlInput) searchEngineUrlInput.placeholder = chrome.i18n.getMessage('searchEngineHint')

  // 显式设置 document.title 以防 HTML 自动替换失效
  document.title = chrome.i18n.getMessage('settingsTitle')
}

/**
 * 保存设置
 */
saveBtn.addEventListener('click', () => {
  const engineUrl = searchEngineUrlInput.value.trim()

  chrome.storage.sync.set(
    {
      shortcut: shortcuts.tab,
      searchShortcut: shortcuts.search,
      searchEngineUrl: engineUrl,
    },
    () => {
      statusMsg.classList.add('show')
      // 动态获取保存成功消息，防止语言切换后文字不更新
      const successText = statusMsg.querySelector('#i18n-saved')
      if (successText) successText.textContent = chrome.i18n.getMessage('saved')

      setTimeout(() => {
        statusMsg.classList.remove('show')
      }, 2000)
    },
  )
})

// 点击外部取消录制
document.addEventListener('click', (e) => {
  if (recordingTarget) {
    const recorder = recordingTarget === 'tab' ? recorderTab : recorderSearch
    if (!recorder.contains(e.target)) {
      recordingTarget = null
      recorder.classList.remove('recording')
      updateDisplay()
    }
  }
})

init()
