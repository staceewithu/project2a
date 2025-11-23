let readyStatus = document.querySelector('#readyStatus')
let notReadyStatus = document.querySelector('#notReadyStatus')
let myForm = document.querySelector('#myForm')
let contentArea = document.querySelector('#contentArea')
let formDialog = document.querySelector('#formDialog')
let createButton = document.querySelector('#createButton')
let formHeading = document.querySelector('#formDialog h2')

let itemsCache = []

// from chatgpt/vs code robot 1(start)
const openButton = document.createElement('button')
openButton.id = 'openButton'
openButton.textContent = 'Open'
openButton.style.display = 'none'

createButton.insertAdjacentElement('beforebegin', openButton)

const showRandomItem = () => {
    if (!itemsCache || itemsCache.length === 0) return
    const idx = Math.floor(Math.random() * itemsCache.length)
    const item = itemsCache[idx]
    contentArea.innerHTML = ''
    const itemDiv = renderItem(item)
    contentArea.appendChild(itemDiv)
}

openButton.addEventListener('click', showRandomItem)
// from chatgpt/vs code robot 1(end)

// Get form data and process each type of input
// Prepare the data as JSON with a proper set of types
// e.g. Booleans, Numbers, Dates
const getFormData = () => {
    // FormData gives a baseline representation of the form
    // with all fields represented as strings
    const formData = new FormData(myForm)
    const json = Object.fromEntries(formData)

    // Handle checkboxes, dates, and numbers
    myForm.querySelectorAll('input').forEach(el => {
        const value = json[el.name]
        const isEmpty = !value || value.trim() === ''

        // Represent checkboxes as a Boolean value (true/false)
        if (el.type === 'checkbox') {
            json[el.name] = el.checked
        }
        // Represent number and range inputs as actual numbers
        else if (el.type === 'number' || el.type === 'range') {
            json[el.name] = isEmpty ? null : Number(value)
        }
        // Represent all date inputs in ISO-8601 DateTime format
        else if (el.type === 'date') {
            json[el.name] = isEmpty ? null : new Date(value).toISOString()
        }
        else if (!myForm.description.checkValidity()) {
            alert('Please provide a description of at least 20 characters.')
            return
        }


    })
    return json
}


// listen for form submissions  
myForm.addEventListener('submit', async event => {
    // prevent the page from reloading when the form is submitted.
    event.preventDefault()
    const data = getFormData()
    await saveItem(data)
    myForm.reset()
    if (formDialog && typeof formDialog.close === 'function') formDialog.close()
})


// Save item (Create or Update)
const saveItem = async (data) => {
    console.log('Saving:', data)

    // Determine if this is an update or create
    const endpoint = data.id ? `/data/${data.id}` : '/data'
    const method = data.id ? "PUT" : "POST"

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
            try {
                const errorData = await response.json()
                console.error('Error:', errorData)
                alert(errorData.error || response.statusText)
            }
            catch (err) {
                console.error(response.statusText)
                alert('Failed to save: ' + response.statusText)
            }
            return
        }

        const result = await response.json()
        console.log('Saved:', result)


        // Refresh the data list
        getData()
    }
    catch (err) {
        console.error('Save error:', err)
        alert('An error occurred while saving')
    }
}


// Edit item - populate form with existing data
const editItem = (data) => {
    console.log('Editing:', data)

    // Populate the form with data to be edited
    Object.keys(data).forEach(field => {
        const element = myForm.elements[field]
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = data[field]
            } else if (element.type === 'date') {
                // Extract yyyy-mm-dd from ISO date string (avoids timezone issues)
                element.value = data[field] ? data[field].substring(0, 10) : ''
            } else {
                element.value = data[field]
            }
        }
    })

    // Update the heading to indicate edit mode
    formHeading.textContent = 'Edit Message'

    // Show the popover
    if (formDialog && typeof formDialog.showModal === 'function') formDialog.showModal()
}

// Delete item
const deleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this cat?')) {
        return
    }

    const endpoint = `/data/${id}`
    const options = { method: "DELETE" }

    try {
        const response = await fetch(endpoint, options)

        if (response.ok) {
            const result = await response.json()
            console.log('Deleted:', result)
            // Refresh the data list
            getData()
        }
        else {
            const errorData = await response.json()
            alert(errorData.error || 'Failed to delete item')
        }
    } catch (error) {
        console.error('Delete error:', error)
        alert('An error occurred while deleting')
    }
}


const calendarWidget = (date) => {
    if (!date) return ''
    const month = new Date(date).toLocaleString("en-CA", { month: 'short', timeZone: "UTC" })
    const day = new Date(date).toLocaleString("en-CA", { day: '2-digit', timeZone: "UTC" })
    const year = new Date(date).toLocaleString("en-CA", { year: 'numeric', timeZone: "UTC" })
    return ` <div class="calendar">
                <div class="born"><img src="./assets/birthday.svg" /></div>
                <div class="month">${month}</div>
                <div class="day">${day}</div> 
                <div class="year">${year}</div>
            </div>`

}

// Render a single Message item
const renderItem = (item) => {
    const div = document.createElement('div')
    div.classList.add('item-card')
    div.setAttribute('data-id', item.id)

    const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : ''

    const template = /*html*/`
    <div class="item-heading">
        <h3>${item.ageGroup || '—'}</h3>
        <div class="meta">${item.gender || '—'} • ${created}</div>
    </div>

    <section class="description" style="${item.description ? '' : 'display:none;'}">
        <p>${item.description || ''}</p>
    </section>

    <div class="item-actions">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
    </div>
    `

    div.innerHTML = DOMPurify.sanitize(template)

    // Add event listeners to buttons
    div.querySelector('.edit-btn').addEventListener('click', () => editItem(item))
    div.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.id))

    return div
}

// fetch items from API endpoint and populate the content div
const getData = async () => {
    try {
        const response = await fetch('/data')

        if (response.ok) {
            readyStatus.style.display = 'block'
            notReadyStatus.style.display = 'none'

            const data = await response.json()
            console.log('Fetched data:', data)

            // Cache the fetched items so the Open button can pick one at random
            itemsCache = Array.isArray(data) ? data : []

            if (itemsCache.length == 0) {
                contentArea.innerHTML = '<p><i>No data found in the database.</i></p>'
                openButton.style.display = 'none'
                return
            }
            else {
                // Show a single random item initially
                openButton.style.display = 'inline-block'
                showRandomItem()
            }
        }
        else {
            // If the request failed, show the "not ready" status
            // to inform users that there may be a database connection issue
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

// Revert to the default form title on reset
myForm.addEventListener('reset', () => formHeading.textContent = 'Drop a Drift Bottle')

// Open the form popover for creating a new Message
createButton.addEventListener('click', () => {
    myForm.reset()
    formHeading.textContent = 'Drop a Drift Bottle'
    if (formDialog && typeof formDialog.showModal === 'function') formDialog.showModal()
})


// Wire cancel button (closes the dialog)
const cancelButton = document.querySelector('#cancelButton')
if (cancelButton) {
    cancelButton.addEventListener('click', () => {
        if (formDialog && typeof formDialog.close === 'function') formDialog.close()
    })
}

// Load initial data
getData()



