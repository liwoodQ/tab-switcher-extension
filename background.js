/**
 * Background Service Worker
 * 负责管理标签页信息、捕获截图以及处理来自 content script 的消息
 */

// 存储标签页截图的缓存: { tabId: dataUrl }
const screenshotCache = {}

/**
 * 获取当前所有标签页信息，并附带截图（如果有）
 * @returns {Promise<Array>} 标签页对象数组
 */
async function getAllTabs() {
  const tabs = await chrome.tabs.query({currentWindow: true})
  // 按索引排序 (默认行为，但明确一下更好)
  tabs.sort((a, b) => a.index - b.index)

  return tabs.map((tab) => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl,
    active: tab.active,
    // 如果有缓存的截图，则使用截图，否则前端可以使用默认图标
    thumbnail: screenshotCache[tab.id] || null,
  }))
}

/**
 * 捕获当前活动标签页的截图
 * 注意：只能捕获当前可见的标签页
 */
async function captureCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true})
    if (tabs.length === 0) return

    const activeTab = tabs[0]

    // 某些页面（如 chrome://）无法捕获，会抛出错误
    // format: 'jpeg', quality: 20 以减少内存占用
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {format: 'jpeg', quality: 20})

    if (dataUrl) {
      screenshotCache[activeTab.id] = dataUrl
      // 限制缓存大小，防止内存溢出 (简单的策略: 如果超过50个，清空一次)
      if (Object.keys(screenshotCache).length > 50) {
        // 简单粗暴清空，实际生产可以使用 LRU
        // 这里保留当前 activeTab 的
        const current = screenshotCache[activeTab.id]
        for (let key in screenshotCache) delete screenshotCache[key]
        screenshotCache[activeTab.id] = current
      }
    }
  } catch (error) {
    console.log('无法捕获截图 (可能是受限页面):', error)
  }
}

// 监听标签页更新，加载完成时尝试截图
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    captureCurrentTab()
  }
})

// 监听标签页激活，激活后稍作延迟截图（等待渲染）
chrome.tabs.onActivated.addListener((activeInfo) => {
  setTimeout(() => {
    captureCurrentTab()
  }, 500)
})

// 监听标签页关闭，清理缓存
chrome.tabs.onRemoved.addListener((tabId) => {
  if (screenshotCache[tabId]) {
    delete screenshotCache[tabId]
  }
})

// 监听来自 Content Script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_TABS') {
    getAllTabs().then((tabs) => {
      sendResponse({tabs})
    })
    return true // 保持消息通道开启以进行异步响应
  }

  // 获取所有标签页 (用于搜索初始化)
  if (request.action === 'GET_ALL_TABS') {
    chrome.tabs.query({}, (tabs) => {
      sendResponse({tabs})
    })
    return true
  }

  // 综合搜索 (标签页 + 书签 + 历史记录)
  if (request.action === 'SEARCH') {
    const query = request.query.toLowerCase()

    Promise.all([
      // 搜索标签页
      chrome.tabs.query({}),
      // 搜索书签
      chrome.bookmarks.search(query),
      // 搜索历史记录
      chrome.history.search({text: query, maxResults: 10}),
    ]).then(([tabs, bookmarks, history]) => {
      // 过滤标签页
      const matchedTabs = tabs.filter(
        (tab) =>
          (tab.title && tab.title.toLowerCase().includes(query)) || (tab.url && tab.url.toLowerCase().includes(query)),
      )

      // 过滤书签
      const matchedBookmarks = bookmarks.filter((bm) => bm.url) // 只要有 url 的书签

      // 过滤历史记录 (history.search 已经做了模糊匹配，这里简单处理)
      // 需要去重：如果历史记录已经在标签页或书签中出现，则移除
      const existingUrls = new Set([...matchedTabs.map((t) => t.url), ...matchedBookmarks.map((b) => b.url)])

      const matchedHistory = history.filter((h) => h.url && !existingUrls.has(h.url))

      sendResponse({
        tabs: matchedTabs.slice(0, 5), // 限制数量
        bookmarks: matchedBookmarks.slice(0, 5),
        history: matchedHistory.slice(0, 5),
      })
    })

    return true
  }

  if (request.action === 'SWITCH_TAB') {
    if (request.tabId) {
      chrome.tabs.update(request.tabId, {active: true})
      // 如果不在当前窗口，可能还需要切换窗口
      chrome.tabs.get(request.tabId, (tab) => {
        if (tab && tab.windowId !== chrome.windows.WINDOW_ID_CURRENT) {
          chrome.windows.update(tab.windowId, {focused: true})
        }
      })
    }
    sendResponse({success: true})
  }
})
