/**
 * Search UI Logic
 * 负责渲染搜索框、处理输入和列表展示
 */

class SearchUI {
  constructor(root) {
    this.root = root
    this.isVisible = false
    this.items = []
    this.selectedIndex = 0
    this.container = null
    this.input = null
    this.list = null

    this.init()
  }

  getHistoryIcon() {
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY2NiI+PHBhdGggZD0iTTEzIDNmM2MyLjIxIDAgNCAxLjc5IDQgNGgwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0aDAgM3YyaDJ6bS0xIDVoMnY2aC0yem0xLTEwYy00Ljk3IDAtOSA0LjAzLTkgOXM0LjAzIDkgOSA5IDktNC4wMyA5LTktNC4wMy05LTktOXptMCAxNmMtMy44NyAwLTctMy4xMy03LTdzMy4xMy03IDctNyA3IDMuMTMgNyA3LTMuMTMgNy03IDd6Ii8+PC9zdmc+'
  }

  getSearchIcon() {
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY2NiI+PHBhdGggZD0iTTE1LjUgMTRoLS43OWwtLjI4LS4yN0E2LjQ3MSA2LjQ3MSAwIDAgMCAxNiA5LjUgNi41IDYuNSAwIDEgMCA5LjUgMTZjMS42MSAwIDMuMDktLjU5IDQuMjMtMS41N2wuMjcuMjh2Ljc5bDUgNC45OUwyMC40OSAxOWwtNC45OS01em0tNiAwQzcuMDEgMTQgNSAxMS45OSA1IDkuNVM3LjAxIDUgOS41IDUgMTQgNy4wMSAxNCA5LjUgMTEuOTkgMTQgOS41IDE0eiIvPjwvc3ZnPg=='
  }

  init() {
    // 创建容器
    this.container = document.createElement('div')
    this.container.id = 'search-container'
    this.container.className = 'hidden'

    // 注入样式
    const styleLink = document.createElement('link')
    styleLink.rel = 'stylesheet'
    styleLink.href = chrome.runtime.getURL('search.css')
    this.root.appendChild(styleLink)

    // 构建 HTML 结构
    this.container.innerHTML = `
      <div class="search-header">
        <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <input type="text" id="search-input" placeholder="${chrome.i18n.getMessage('searchPlaceholder')}" autocomplete="off">
      </div>
      <div id="search-list"></div>
    `

    this.root.appendChild(this.container)

    this.input = this.container.querySelector('#search-input')
    this.list = this.container.querySelector('#search-list')

    this.bindEvents()
  }

  bindEvents() {
    // 输入事件
    this.input.addEventListener('input', (e) => {
      this.handleSearch(e.target.value)
    })

    // 键盘导航
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        this.moveSelection(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        this.moveSelection(-1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        this.executeAction()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.hide()
      }
    })
  }

  show() {
    if (this.isVisible) return

    this.isVisible = true
    this.container.classList.remove('hidden')
    this.input.value = ''
    this.input.focus()

    // 加载初始数据 (当前打开的标签页)
    this.loadInitialData()
  }

  hide() {
    if (!this.isVisible) return

    this.isVisible = false
    this.container.classList.add('hidden')
    // 聚焦回主页面
    window.focus()
  }

  toggle() {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }

  async loadInitialData() {
    // 获取当前标签页
    chrome.runtime.sendMessage({action: 'GET_ALL_TABS'}, (response) => {
      if (response && response.tabs) {
        this.renderList(
          response.tabs.map((tab) => ({
            type: 'tab',
            id: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl,
          })),
        )
      }
    })
  }

  async handleSearch(query) {
    if (!query) {
      this.loadInitialData()
      return
    }

    // 搜索标签页和书签
    chrome.runtime.sendMessage({action: 'SEARCH', query}, (response) => {
      const results = []

      // 1. 如果是 URL，添加打开选项
      if (this.isUrl(query)) {
        results.push({
          type: 'url',
          title: query,
          url: query,
          favIconUrl: 'default', // 使用默认图标
        })
      }

      // 2. 标签页结果
      if (response.tabs) {
        results.push(
          ...response.tabs.map((tab) => ({
            type: 'tab',
            id: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl,
          })),
        )
      }

      // 3. 书签结果
      if (response.bookmarks) {
        results.push(
          ...response.bookmarks.map((bm) => ({
            type: 'bookmark',
            id: bm.id,
            title: bm.title,
            url: bm.url,
            favIconUrl: 'bookmark',
          })),
        )
      }

      // 4. 历史记录结果
      if (response.history) {
        results.push(
          ...response.history.map((h) => ({
            type: 'history',
            id: h.id,
            title: h.title || h.url, // 历史记录可能没有标题
            url: h.url,
            favIconUrl: 'history', // 使用历史记录图标
          })),
        )
      }

      // 5. 始终添加搜索引擎选项 (如果有查询词)
      if (query.trim()) {
        const searchItem = {
          type: 'search-engine',
          title: query, // 仅显示查询词
          url: query,
          favIconUrl: 'search',
        }

        // 如果有结果，插入到第二位 (索引1)
        if (results.length > 0) {
          results.splice(1, 0, searchItem)
        } else {
          // 如果没有结果，作为第一位
          results.push(searchItem)
        }
      }

      this.renderList(results)
    })
  }

  renderList(items) {
    this.items = items
    this.selectedIndex = 0
    this.list.innerHTML = ''

    if (items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'search-item'
      empty.style.justifyContent = 'center'
      empty.style.color = '#9ca3af'
      empty.textContent = chrome.i18n.getMessage('noResults')
      this.list.appendChild(empty)
      return
    }

    items.forEach((item, index) => {
      const el = document.createElement('div')
      el.className = `search-item ${index === 0 ? 'selected' : ''}`

      // 图标处理
      let iconSrc = item.favIconUrl
      // 如果是书签或历史记录且没有 favicon (或默认图标)，使用 Google Favicon 服务
      if (
        (item.type === 'bookmark' || item.type === 'history') &&
        (!iconSrc || iconSrc === 'bookmark' || iconSrc === 'history')
      ) {
        if (item.url) {
          iconSrc = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(item.url)}&sz=32`
        } else {
          iconSrc = item.type === 'bookmark' ? this.getBookmarkIcon() : this.getHistoryIcon()
        }
      } else if (item.type === 'search-engine') {
        iconSrc = this.getSearchIcon()
      } else if (!iconSrc || iconSrc === 'default') {
        iconSrc = this.getDefaultIcon()
      }

      // 操作文本
      let actionText = chrome.i18n.getMessage('switchToTab')
      if (item.type === 'bookmark' || item.type === 'url' || item.type === 'history')
        actionText = chrome.i18n.getMessage('openLink')
      if (item.type === 'search-engine') actionText = chrome.i18n.getMessage('searchWeb')

      // 构建内容 HTML
      let contentHtml = ''
      if (item.type === 'tab') {
        // 标签页：只显示标题
        contentHtml = `<div class="search-item-title">${this.escapeHtml(item.title)}</div>`
      } else if (item.type === 'search-engine') {
        // 搜索引擎：仅显示查询词 (标题)
        contentHtml = `<div class="search-item-title">${this.escapeHtml(item.title)}</div>`
      } else {
        // 其他：显示标题 + 弱化 URL
        contentHtml = `
          <div class="search-item-title">${this.escapeHtml(item.title)}</div>
          <div class="search-item-url">${this.escapeHtml(item.url)}</div>
        `
      }

      el.innerHTML = `
        <img class="search-item-icon" src="${iconSrc}" onerror="this.src='${this.getDefaultIcon()}'">
        <div class="search-item-content">
          ${contentHtml}
        </div>
        <div class="search-item-action">
          <span>${actionText}</span>
          <svg class="action-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </div>
      `

      el.addEventListener('click', () => {
        this.selectedIndex = index
        this.executeAction()
      })

      this.list.appendChild(el)
    })
  }

  moveSelection(direction) {
    if (this.items.length === 0) return

    const items = this.list.children
    items[this.selectedIndex].classList.remove('selected')

    this.selectedIndex = (this.selectedIndex + direction + this.items.length) % this.items.length

    const newSelected = items[this.selectedIndex]
    newSelected.classList.add('selected')
    newSelected.scrollIntoView({block: 'nearest'})
  }

  executeAction() {
    const item = this.items[this.selectedIndex]
    if (!item) return

    if (item.type === 'tab') {
      chrome.runtime.sendMessage({action: 'SWITCH_TAB', tabId: item.id})
    } else if (item.type === 'bookmark' || item.type === 'url' || item.type === 'history') {
      // 检查 URL 是否带协议，如果没有默认加 https
      let url = item.url
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url
      }
      window.open(url, '_blank')
    } else if (item.type === 'search-engine') {
      // 1. 获取配置的搜索引擎 URL (默认 Google)
      chrome.storage.sync.get(['searchEngineUrl'], (result) => {
        let engineUrl = result.searchEngineUrl || 'https://www.google.com/search?q=%s'

        // 2. 替换占位符
        const query = item.url // 这里我们将 query 存在了 url 字段
        const targetUrl = engineUrl.replace('%s', encodeURIComponent(query))

        window.open(targetUrl, '_blank')
      })
    }

    this.hide()
  }

  isUrl(string) {
    // 简单的 URL 检测
    if (/^https?:\/\//.test(string)) return true
    if (/^[\w.-]+\.[a-z]{2,}/.test(string)) return true
    return false
  }

  escapeHtml(text) {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  getDefaultIcon() {
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY2NiI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0xIDE3LjkzYy0zLjk1LS40OS03LTMuODUtNy03LjkzIDAtLjYyLjA4LTEuMjEuMjEtMS43OUw5IDE1djFjMCAxLjEuOSAyIDIgMnYxLjkzem02LjktMi41NGMtLjI2LS44MS0xLTEuMzktMS45LTEuMzloLTF2LTNjMC0uNTUtLjQ1LTEtMS0xSDh2LTJoMmMuNTUgMCAxLS40NSAxLTFWN2gyYzEuMSAwIDItLjkgMi0ydi0uNDFjMi45MyAxLjE5IDUgNC4wNiA1IDcuNDEgMCAyLjA4LS44IDMuOTctMi4xIDUuMzl6Ii8+PC9zdmc+'
  }

  getBookmarkIcon() {
    // 简单的书签图标 svg data url
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTE3IDMzYzAgLjU1LS40NSAxLTEgMUg4Yy0uNTUgMC0xLS40NS0xLTFWN2gyYzEuMSAwIDItLjkgMi0ydi0uNDFjMi45MyAxLjE5IDUgNC4wNiA1IDcuNDEgMCAyLjA4LS44IDMuOTctMi4xIDUuMzl6IiBmaWxsPSIjRkZDMTA3IiBkPSJNMTcgM0g3YTIgMiAwIDAgMC0yIDJ2MTZsNy0zIDcgM1Y1YTIgMiAwIDAgMC0yLTJ6Ii8+PC9zdmc+'
  }
}
