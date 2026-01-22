/**
 * Content Script
 * 注入到每个页面，负责监听快捷键并渲染标签页切换 UI
 */

// 状态变量
let isOverlayVisible = false
let tabsList = []
let selectedIndex = 0
let overlayElement = null
let shadowRoot = null

/**
 * 初始化 Overlay 容器 (Shadow DOM)
 */
function initOverlay() {
  if (overlayElement) return

  overlayElement = document.createElement('div')
  overlayElement.id = 'quick-tab-switcher-host'

  // 使用 Shadow DOM 隔离样式
  shadowRoot = overlayElement.attachShadow({mode: 'closed'})

  // 注入样式
  const styleLink = document.createElement('link')
  styleLink.rel = 'stylesheet'
  styleLink.href = chrome.runtime.getURL('style.css')
  shadowRoot.appendChild(styleLink)

  const container = document.createElement('div')
  container.id = 'switcher-container'
  container.className = 'hidden'

  // 标题区域
  const titleArea = document.createElement('div')
  titleArea.id = 'switcher-title'
  titleArea.textContent = 'Quick Tab Switcher'

  // 列表区域
  const listArea = document.createElement('div')
  listArea.id = 'switcher-list'

  container.appendChild(titleArea)
  container.appendChild(listArea)
  shadowRoot.appendChild(container)

  document.body.appendChild(overlayElement)
}

/**
 * 显示切换器
 */
function showSwitcher() {
  if (isOverlayVisible) return

  // 请求标签页数据
  chrome.runtime.sendMessage({action: 'GET_TABS'}, (response) => {
    if (response && response.tabs) {
      tabsList = response.tabs
      // 找到当前激活的标签页索引
      const activeTab = tabsList.find((t) => t.active)
      // 默认选中下一个，如果当前是最后一个则选中第一个
      selectedIndex = activeTab ? (tabsList.indexOf(activeTab) + 1) % tabsList.length : 0

      renderTabs()

      const container = shadowRoot.getElementById('switcher-container')
      container.classList.remove('hidden')
      isOverlayVisible = true
    }
  })
}

/**
 * 隐藏切换器并切换标签页
 */
function hideSwitcherAndSwitch() {
  if (!isOverlayVisible) return

  const container = shadowRoot.getElementById('switcher-container')
  container.classList.add('hidden')
  isOverlayVisible = false

  const targetTab = tabsList[selectedIndex]
  if (targetTab) {
    chrome.runtime.sendMessage({action: 'SWITCH_TAB', tabId: targetTab.id})
  }
}

/**
 * 仅隐藏切换器 (取消操作)
 */
function hideSwitcherOnly() {
  if (!isOverlayVisible) return
  const container = shadowRoot.getElementById('switcher-container')
  container.classList.add('hidden')
  isOverlayVisible = false
}

/**
 * 渲染标签页列表
 */
function renderTabs() {
  const listArea = shadowRoot.getElementById('switcher-list')
  listArea.innerHTML = ''

  // 默认地球图标 SVG (用于 Favicon 失败或缩略图失败时的回退)
  const defaultIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY2NiI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0xIDE3LjkzYy0zLjk1LS40OS03LTMuODUtNy03LjkzIDAtLjYyLjA4LTEuMjEuMjEtMS43OUw5IDE1djFjMCAxLjEuOSAyIDIgMnYxLjkzem02LjktMi41NGMtLjI2LS44MS0xLTEuMzktMS45LTEuMzloLTF2LTNjMC0uNTUtLjQ1LTEtMS0xSDh2LTJoMmMuNTUgMCAxLS40NSAxLTFWN2gyYzEuMSAwIDItLjkgMi0ydi0uNDFjMi45MyAxLjE5IDUgNC4wNiA1IDcuNDEgMCAyLjA4LS44IDMuOTctMi4xIDUuMzl6Ii8+PC9zdmc+'

  tabsList.forEach((tab, index) => {
    const item = document.createElement('div')
    item.className = `tab-item ${index === selectedIndex ? 'selected' : ''}`

    // --- 上半部分：缩略图 ---
    const imgContainer = document.createElement('div')
    imgContainer.className = 'tab-thumbnail'

    if (tab.thumbnail) {
      const img = document.createElement('img')
      img.src = tab.thumbnail
      imgContainer.appendChild(img)
    } else {
      // 没有截图时显示一个占位背景，中间放一个大图标
      const icon = document.createElement('img')
      icon.src = tab.favIconUrl || defaultIcon
      icon.className = 'tab-favicon-large'
      icon.onerror = () => {
        icon.src = defaultIcon
      }
      imgContainer.appendChild(icon)
    }

    // --- 下半部分：信息栏 (Favicon + 标题) ---
    const infoContainer = document.createElement('div')
    infoContainer.className = 'tab-info'

    // 小 Favicon
    const favicon = document.createElement('img')
    favicon.className = 'tab-favicon-small'
    favicon.src = tab.favIconUrl || defaultIcon
    favicon.onerror = () => {
      favicon.src = defaultIcon
    }

    // 标题文本
    const title = document.createElement('span')
    title.className = 'tab-title'
    title.textContent = tab.title

    infoContainer.appendChild(favicon)
    infoContainer.appendChild(title)

    item.appendChild(imgContainer)
    item.appendChild(infoContainer)
    listArea.appendChild(item)
  })

  // 滚动到选中项
  const selectedEl = listArea.children[selectedIndex]
  if (selectedEl) {
    selectedEl.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'})
  }
}

/**
 * 更新选中项
 * @param {number} direction -1 for left, 1 for right
 */
function moveSelection(direction) {
  selectedIndex = (selectedIndex + direction + tabsList.length) % tabsList.length
  renderTabs()
}

// 当前快捷键配置
let shortcuts = {
  tab: {
    modifiers: ['altKey'],
    key: 'Backquote',
    code: 'Backquote',
  },
  search: {
    modifiers: ['altKey'],
    key: 'd',
    code: 'KeyD',
  },
}

// 初始化时读取配置
chrome.storage.sync.get(['shortcut', 'searchShortcut'], (result) => {
  if (result.shortcut) {
    shortcuts.tab = result.shortcut
  }
  if (result.searchShortcut) {
    shortcuts.search = result.searchShortcut
  }
})

// 监听配置变更
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.shortcut) {
      shortcuts.tab = changes.shortcut.newValue
    }
    if (changes.searchShortcut) {
      shortcuts.search = changes.searchShortcut.newValue
    }
  }
})

/**
 * 检查事件是否匹配指定快捷键
 * @param {KeyboardEvent} event
 * @param {Object} shortcutConfig
 */
function isShortcutMatch(event, shortcutConfig) {
  // 检查按键是否匹配 (兼容 code 和 key)
  // 注意：对于字母键，event.key 可能是 'k' 或 'K'，取决于 Shift 状态，这里做不区分大小写比较更稳妥，或者依赖 code
  const keyMatch = event.code === shortcutConfig.code || event.key.toLowerCase() === shortcutConfig.key.toLowerCase()
  if (!keyMatch) return false

  // 检查修饰键
  const hasMeta = shortcutConfig.modifiers.includes('metaKey')
  const hasCtrl = shortcutConfig.modifiers.includes('ctrlKey')
  const hasAlt = shortcutConfig.modifiers.includes('altKey')
  const hasShift = shortcutConfig.modifiers.includes('shiftKey')

  return (
    event.metaKey === hasMeta && event.ctrlKey === hasCtrl && event.altKey === hasAlt && event.shiftKey === hasShift
  )
}

// 监听键盘事件
document.addEventListener('keydown', (event) => {
  // 1. 检查标签页切换快捷键
  if (isShortcutMatch(event, shortcuts.tab)) {
    event.preventDefault()
    if (!isOverlayVisible) {
      initOverlay() // 确保已初始化
      showSwitcher()
    } else {
      // 如果按住修饰键再次按主键，切换到下一个
      moveSelection(1)
    }
    return
  }

  // 2. 检查搜索面板快捷键
  if (isShortcutMatch(event, shortcuts.search)) {
    event.preventDefault()
    initSearchUI()
    return
  }

  if (isOverlayVisible) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveSelection(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveSelection(-1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      hideSwitcherOnly()
    }
  }
})

document.addEventListener('keyup', (event) => {
  if (isOverlayVisible) {
    // 检查是否释放了必要的修饰键 (仅针对标签页切换)
    // 如果配置中包含某个修饰键，且该修饰键被释放，则触发切换
    const modifierKeys = {
      Meta: 'metaKey',
      Control: 'ctrlKey',
      Alt: 'altKey',
      Shift: 'shiftKey',
    }

    // 如果释放的键是 Tab 切换快捷键要求的修饰键之一
    if (modifierKeys[event.key] && shortcuts.tab.modifiers.includes(modifierKeys[event.key])) {
      hideSwitcherAndSwitch()
    }
  }
})

// 移除旧的 message listener
let searchUI = null

function initSearchUI() {
  if (!searchUI) {
    if (typeof SearchUI === 'undefined') {
      console.error('SearchUI class not found. Make sure search-ui.js is loaded.')
      return
    }
    searchUI = new SearchUI(document.body)
  }
  searchUI.toggle()
}
