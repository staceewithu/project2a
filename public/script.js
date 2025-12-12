let readyStatus = document.querySelector('#readyStatus')
let notReadyStatus = document.querySelector('#notReadyStatus')
let myForm = document.querySelector('#myForm')
let contentArea = document.querySelector('#contentArea')
let formDialog = document.querySelector('#formDialog')
let createButton = document.querySelector('#createButton')
let formHeading = document.querySelector('#formDialog h2')

// 新增：登录 / 注册 / 状态 / 历史 DOM
let authStatus = document.querySelector('#authStatus')
let loginButton = document.querySelector('#loginButton')
let logoutButton = document.querySelector('#logoutButton')
let historyText = document.querySelector('#historyText')
let historyArea = document.querySelector('#historyArea')

let itemsCache = []
let currentUserEmail = null

// ----------------- Auth 相关 -----------------
const updateAuthUI = () => {
  if (currentUserEmail) {
    authStatus.textContent = `Logged in as ${currentUserEmail}`
    createButton.style.display = 'inline-block'
    historyText.style.display = 'inline-block'
    if (loginButton) {
      loginButton.style.display = 'none';
      loginButton.removeEventListener('click', () => {
        window.location.href = '/login'
      })
    }
    if (logoutButton) {
      logoutButton.style.display = 'inline-block';
      logoutButton.addEventListener('click', () => {
        window.location.href = '/logout'
      })
    }
  } else {
    authStatus.textContent = 'You are browsing as a guest.'
    createButton.style.display = 'none'
    historyText.style.display = 'none'
    if (logoutButton) {
      logoutButton.style.display = 'none';
      logoutButton.removeEventListener('click', () => {
        window.location.href = '/logout'
      })
    }
    if (loginButton) {
      loginButton.style.display = 'inline-block';
      loginButton.addEventListener('click', () => {
        window.location.href = '/login'
      })
    }
    if (formDialog && typeof formDialog.close === 'function') formDialog.close()
    if (historyArea) {
      historyArea.innerHTML = '<p><i>Log in to see your drift bottle history and drop your own drift bottle.</i></p>'
    }
  }
}

const checkAuth = async () => {
  try {
    const res = await fetch('/profile')
    if (res.ok) {
      const data = await res.json()
      currentUserEmail = data.email || null
    } else {
      currentUserEmail = null
    }
  } catch (err) {
    console.error('checkAuth error:', err)
    currentUserEmail = null
  }
  updateAuthUI()
  getMyBottles()
}

// if (loginForm) {
//   loginForm.addEventListener('submit', async (e) => {
//     e.preventDefault()
//     const formData = new FormData(loginForm)
//     const payload = Object.fromEntries(formData)

//     try {
//       const res = await fetch('/login', {
//         method: 'GET',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload)
//       })

//       const data = await res.json()
//       if (!res.ok || !data.ok) {
//         alert(data.error || 'Login failed.')
//         return
//       }

//       currentUser = data.user
//       loginForm.reset()
//       updateAuthUI()
//       getMyBottles()
//     } catch (err) {
//       console.error('Login error:', err)
//       alert('Login error.')
//     }
//   })
// }

// if (registerForm) {
//   registerForm.addEventListener('submit', async (e) => {
//     e.preventDefault()
//     const formData = new FormData(registerForm)
//     const payload = Object.fromEntries(formData)

//     try {
//       const res = await fetch('/register', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload)
//       })

//       const data = await res.json()
//       if (!res.ok || !data.ok) {
//         alert(data.error || 'Register failed.')
//         return
//       }

//       currentUser = data.user
//       registerForm.reset()
//       updateAuthUI()
//       getMyBottles()
//     } catch (err) {
//       console.error('Register error:', err)
//       alert('Register error.')
//     }
//   })
// }

// if (logoutButton) {
//   logoutButton.addEventListener('click', async () => {
//     try {
//       await fetch('/logout', { method: 'POST' })
//     } catch (err) {
//       console.error('Logout error:', err)
//     }
//     currentUser = null
//     updateAuthUI()
//   })
// }

// ----------------- Open 按钮（随机漂流瓶） -----------------
const openButton = document.createElement('button')
openButton.id = 'openButton'
openButton.textContent = 'Open'
openButton.style.display = 'none'

// 插在 Drop 按钮上面
createButton.insertAdjacentElement('beforebegin', openButton)

const showRandomItem = () => {
  if (!itemsCache || itemsCache.length === 0) return
  const idx = Math.floor(Math.random() * itemsCache.length)
  const item = itemsCache[idx]

  contentArea.innerHTML = ''
  // 如果是当前用户的瓶子，可以编辑 / 删除
  const isOwner = !!(currentUserEmail && item.user && item.user.email === currentUserEmail)
  const itemDiv = renderItem(item, isOwner, 'item-display')
  contentArea.appendChild(itemDiv)
}

openButton.addEventListener('click', showRandomItem)

// ----------------- 表单 → JSON -----------------
const getFormData = () => {
  const formData = new FormData(myForm)
  const json = Object.fromEntries(formData)

  myForm.querySelectorAll('input').forEach(el => {
    const value = json[el.name]
    const isEmpty = !value || value.trim() === ''

    if (el.type === 'checkbox') {
      json[el.name] = el.checked
    } else if (el.type === 'number' || el.type === 'range') {
      json[el.name] = isEmpty ? null : Number(value)
    } else if (el.type === 'date') {
      json[el.name] = isEmpty ? null : new Date(value).toISOString()
    } else if (!myForm.description.checkValidity()) {
      alert('Please provide a description of at least 20 characters.')
      return
    }
  })
  return json
}

// 监听表单提交
myForm.addEventListener('submit', async event => {
  event.preventDefault()
  const data = getFormData()
  await saveItem(data)
  myForm.reset()
  if (formDialog && typeof formDialog.close === 'function') formDialog.close()
})

// ----------------- 保存 / 更新漂流瓶 -----------------
const saveItem = async (data) => {
  console.log('Saving:', data)

  const endpoint = data.id ? `/data/${data.id}` : '/data'
  const method = data.id ? 'PUT' : 'POST'

  const options = {
    method: method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }

  try {
    const response = await fetch(endpoint, options)

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error('Error:', errorData || response.statusText)
      alert((errorData && errorData.error) || response.statusText)
      return
    }

    const result = await response.json()
    console.log('Saved:', result)

    // 刷新列表 & 我的历史
    getData()
    getMyBottles()
  }
  catch (err) {
    console.error('Save error:', err)
    alert('An error occurred while saving')
  }
}

// ----------------- 编辑 / 删除 -----------------
const editItem = (data) => {
  console.log('Editing:', data)

  Object.keys(data).forEach(field => {
    const element = myForm.elements[field]
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = data[field]
      } else if (element.type === 'date') {
        element.value = data[field] ? data[field].substring(0, 10) : ''
      } else {
        element.value = data[field]
      }
    }
  })

  formHeading.textContent = 'Edit Message'

  if (formDialog && typeof formDialog.showModal === 'function') formDialog.showModal()
}

const deleteItem = async (id) => {
  if (!confirm('Are you sure you want to delete this bottle?')) {
    return
  }

  const endpoint = `/data/${id}`
  const options = { method: 'DELETE' }

  try {
    const response = await fetch(endpoint, options)

    if (response.ok) {
      const result = await response.json()
      console.log('Deleted:', result)
      getData()
      getMyBottles()
    }
    else {
      const errorData = await response.json().catch(() => null)
      alert((errorData && errorData.error) || 'Failed to delete item')
    }
  } catch (error) {
    console.error('Delete error:', error)
    alert('An error occurred while deleting')
  }
}

// ----------------- 渲染卡片 -----------------
const renderItem = (item, isOwner = false, cardName = 'item-card') => {
  const div = document.createElement('div')
  div.classList.add(cardName)
  div.setAttribute('data-id', item.id)

  const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : ''
  const authorName = item.user?.nickname || 'Someone'

  const template = /*html*/`
    <div class="item-heading">
        <h3>${item.ageGroup || '—'}</h3>
        <div class="meta">${item.gender || '—'} • ${created}</div>
        <div class="author">From: ${authorName}</div>
    </div>

    <section class="description" style="${item.description ? '' : 'display:none;'}">
        <p>${item.description || ''}</p>
    </section>

    ${isOwner
      ? `<div class="item-actions">
              <button class="edit-btn">Edit</button>
              <button class="delete-btn">Delete</button>
           </div>`
      : ''
    }
    `

  div.innerHTML = DOMPurify.sanitize(template)

  if (isOwner) {
    const editBtn = div.querySelector('.edit-btn')
    const deleteBtn = div.querySelector('.delete-btn')
    if (editBtn) editBtn.addEventListener('click', () => editItem(item))
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.id))
  }

  return div
}

// 渲染历史区块
const renderHistory = (items) => {
  if (!historyArea) return

  historyArea.innerHTML = ''
  if (!items || items.length === 0) {
    historyArea.innerHTML = '<p><i>You have not dropped any bottles yet.</i></p>'
    return
  }

  items.forEach(item => {
    const card = renderItem(item, true) // 历史里的都是自己的
    historyArea.appendChild(card)
  })
}

// ----------------- 从 API 读取数据 -----------------
const getData = async () => {
  try {
    const response = await fetch('/data')

    if (response.ok) {
      readyStatus.style.display = 'block'
      notReadyStatus.style.display = 'none'

      const data = await response.json()
      console.log('Fetched data:', data)

      itemsCache = Array.isArray(data) ? data : []

      if (itemsCache.length === 0) {
        contentArea.innerHTML = '<p><i>No data found in the database.</i></p>'
        openButton.style.display = 'none'
        return
      }
      else {
        openButton.style.display = 'inline-block'
        showRandomItem()
      }
    }
    else {
      notReadyStatus.style.display = 'block'
      readyStatus.style.display = 'none'
      createButton.style.display = 'none'
      contentArea.style.display = 'none'
    }
  } catch (error) {
    console.error('Error fetching data:', error)
    notReadyStatus.style.display = 'block'
  }
}

// 读取当前用户的历史瓶子
const getMyBottles = async () => {
  if (!currentUserEmail) {
    return
  }
  try {
    const res = await fetch('/my-bottles')
    if (!res.ok) {
      return
    }
    const data = await res.json()
    renderHistory(data)
  } catch (err) {
    console.error('getMyBottles error:', err)
  }
}

// Reset 时恢复标题
myForm.addEventListener('reset', () => formHeading.textContent = 'Drop a Drift Bottle')

// 打开表单弹窗（新建漂流瓶）
createButton.addEventListener('click', () => {
  if (!currentUserEmail) {
    alert('Please log in before dropping a drift bottle.')
    return
  }
  myForm.reset()
  formHeading.textContent = 'Drop a Drift Bottle'
  if (formDialog && typeof formDialog.showModal === 'function') formDialog.showModal()
})

// Cancel 关闭 dialog
const cancelButton = document.querySelector('#cancelButton')
if (cancelButton) {
  cancelButton.addEventListener('click', () => {
    if (formDialog && typeof formDialog.close === 'function') formDialog.close()
  })
}

// 初始化：先检查登录状态，再拉数据
checkAuth()
getData()
