// Online H-Index Calculator Front-End
// Built exclusively with vanille components (no index.html changes)

import { div, h1, h2, p, button, input, span, hr, br } from './vanille/components.js'

// ------------------------------ Data Layer

const LS_KEY = 'hindex_articles_v2'
const DEFAULT_COLLECTION = 'My Collection'
let uiReady = false

function migrateLegacy(data) {
    if (Array.isArray(data)) {
        return {
            version: 2,
            current: DEFAULT_COLLECTION,
            collections: {
                [DEFAULT_COLLECTION]: data.map(a => ({ title: a.title ?? '', citations: Number(a.citations) || 0 }))
            }
        }
    }
    return null
}

function loadState() {
    try {
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) {
            // Attempt legacy key
            const legacyRaw = localStorage.getItem('hindex_articles_v1')
            if (legacyRaw) {
                const legacyData = JSON.parse(legacyRaw)
                const migrated = migrateLegacy(legacyData)
                if (migrated) return migrated
            }
            return {
                version: 2,
                current: DEFAULT_COLLECTION,
                collections: { [DEFAULT_COLLECTION]: [] }
            }
        }
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return migrateLegacy(parsed) // unexpected legacy shape
        if (parsed && parsed.collections && parsed.current) {
            // sanitize entries
            for (const k of Object.keys(parsed.collections)) {
                parsed.collections[k] = (parsed.collections[k] || []).map(a => ({ title: a.title ?? '', citations: Number(a.citations) || 0 }))
            }
            if (!parsed.collections[parsed.current]) parsed.current = Object.keys(parsed.collections)[0] || DEFAULT_COLLECTION
            return parsed
        }
    } catch (_) { }
    return {
        version: 2,
        current: DEFAULT_COLLECTION,
        collections: { [DEFAULT_COLLECTION]: [] }
    }
}

let state = loadState()
let articles = state.collections[state.current] // active collection reference
let focusLastArticleTitle = false // Flag to focus title of the last-added article after render
let focusFirstAfterSwitch = false // focus first title when switching collection
var __collectionStylesAdded = false // style injection flag (var to allow early reference)

function persist() {
    // write back current articles array into state
    state.collections[state.current] = articles
    localStorage.setItem(LS_KEY, JSON.stringify(state))
    if (uiReady) renderAll()
}

function clearAll() {
    if (!confirm('Clear all stored articles in this collection?')) return
    articles.length = 0
    persist()
}

function addArticle(prefill = {}) {
    articles.push({ title: prefill.title || '', citations: prefill.citations || 0 })
    persist()
}

function addCollection(name) {
    name = (name || '').trim()
    if (!name) {
        let i = 2
        while (state.collections[`Collection ${i}`]) i++
        name = `Collection ${i}`
    }
    if (state.collections[name]) {
        alert('Collection name already exists.')
        return
    }
    state.collections[name] = []
    state.current = name
    articles = state.collections[state.current]
    focusLastArticleTitle = false
    focusFirstAfterSwitch = false
    persist()
}

function deleteCollection(name) {
    if (!state.collections[name]) return
    if (!confirm(`Delete collection "${name}"?`)) return
    delete state.collections[name]
    if (Object.keys(state.collections).length === 0) {
        state.collections[DEFAULT_COLLECTION] = []
        state.current = DEFAULT_COLLECTION
    } else if (state.current === name) {
        state.current = Object.keys(state.collections)[0]
    }
    articles = state.collections[state.current]
    focusFirstAfterSwitch = true
    persist()
}

function switchCollection(name) {
    if (name === state.current || !state.collections[name]) return
    state.current = name
    articles = state.collections[state.current]
    focusFirstAfterSwitch = true
    persist()
}

function renameCollection(name, newName) {
    if (!state.collections[name]) return
    newName = (newName || '').trim()
    if (!newName) return
    if (state.collections[newName]) {
        alert('A collection with that name already exists.')
        return
    }
    state.collections[newName] = state.collections[name]
    delete state.collections[name]
    if (state.current === name) state.current = newName
    articles = state.collections[state.current]
    persist()
}

// Seed a few examples if empty (helps first-time users)
if (articles.length === 0) {
    articles.push(
        { title: 'Deep Learning Overview', citations: 123 },
        { title: 'Graph Algorithms', citations: 47 },
        { title: 'Untitled', citations: 5 },
    )
    persist()
}

// ------------------------------ Computation

function computeHIndex(list) {
    const sorted = [...list.map(a => a.citations)].sort((a, b) => b - a)
    let h = 0
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] >= i + 1) h = i + 1; else break
    }
    return { h, sorted }
}

// ------------------------------ UI Elements

const root = div().set_style({
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    padding: '16px 26px 40px',
    lineHeight: '1.32'
})

// Global body style (allowed via JS)
document.body.style.margin = '0'
document.body.style.background = '#f5f7fa'
document.body.style.minHeight = '100vh'
document.body.style.color = '#222'

const header = div().add(
    h1('Online H-Index Calculator').set_style({
        margin: '0 0 4px',
        fontSize: '1.9rem',
        fontWeight: '600',
        letterSpacing: '.5px',
        color: '#1e293b'
    }),
    p('Compute and explore your publication H-index locally (data never leaves your browser).').set_style({
        margin: '0 0 16px',
        fontSize: '.85rem',
        color: '#475569',
        maxWidth: '780px'
    })
).set_style({ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px' })

// Layout principal 2 colonnes
const mainLayout = div().set_style({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '30px'
})
mainLayout.classList.add('main-layout')

// Colonne gauche : liste articles
const listCard = div().set_style({
    ...cardStyle(),
    flex: '1 1 55%',
    maxWidth: '780px',
    padding: '14px 16px 10px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 190px)',
    overflowY: 'auto'
})
listCard.classList.add('list-card')

// Colonne droite : stats
const statsColumn = div().set_style({
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: '1 1 40%',
    minWidth: '340px'
})
statsColumn.classList.add('stats-column')

const hIndexCard = div().set_style(cardStyle())
hIndexCard.classList.add('hindex-card')
const chartCard = div().set_style({
    ...cardStyle(),
    minHeight: '240px',
    display: 'flex',
    flexDirection: 'column'
})
chartCard.classList.add('chart-card')

const actionsBar = div().set_style({
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid #e2e8f0'
})

// Reusable simple styles
function cardStyle() {
    return {
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '16px 18px 18px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        position: 'relative'
    }
}

function pillButtonStyle(colorA = '#2563eb', colorB = '#1d4ed8') {
    return {
        background: colorA,
        color: '#fff',
        border: '1px solid ' + colorB,
        padding: '6px 14px',
        fontSize: '.65rem',
        lineHeight: '1',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
        letterSpacing: '.25px',
        transition: 'background .15s ease, filter .15s ease'
    }
}

function subtleButtonStyle() {
    return {
        background: '#f1f5f9',
        color: '#1e293b',
        border: '1px solid #d8e0e8',
        padding: '6px 10px',
        fontSize: '.6rem',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '500',
        letterSpacing: '.25px',
        transition: 'background .15s ease, color .15s ease'
    }
}

// Animated hover interactions (delegated)
document.addEventListener('mouseover', evt => {
    if (evt.target.tagName === 'BUTTON' && !evt.target.classList.contains('collection-btn') && !evt.target.classList.contains('collection-add-btn') && !evt.target.classList.contains('collection-mgmt-btn') && !evt.target.classList.contains('collection-mgmt-danger')) {
        evt.target.style.filter = 'brightness(1.05)'
        evt.target.style.transform = 'translateY(-2px)'
    }
})
document.addEventListener('mouseout', evt => {
    if (evt.target.tagName === 'BUTTON' && !evt.target.classList.contains('collection-btn') && !evt.target.classList.contains('collection-add-btn') && !evt.target.classList.contains('collection-mgmt-btn') && !evt.target.classList.contains('collection-mgmt-danger')) {
        evt.target.style.filter = ''
        evt.target.style.transform = ''
    }
})

// ------------------------------ Rendering

function renderHIndex() {
    const { h, sorted } = computeHIndex(articles)
    hIndexCard.clear().add(
        h2('H-index').set_style({ margin: '0 0 6px', fontSize: '1rem', fontWeight: '600', letterSpacing: '.5px', color: '#334155' }),
        div().add(
            span(h.toString()).set_style({
                display: 'inline-block',
                fontSize: '3.1rem',
                fontWeight: '600',
                lineHeight: 1,
                color: '#0f172a'
            }),
            br(),
            span(`${articles.length} article${articles.length !== 1 ? 's' : ''}`).set_style({
                fontSize: '.6rem',
                letterSpacing: '.4px',
                color: '#64748b'
            })
        )
    )

    // Chart
    chartCard.clear().add(
        h2('Citation Distribution').set_style({ margin: '0 0 6px', fontSize: '.9rem', fontWeight: '600', letterSpacing: '.4px', color: '#334155' }),
        buildChart(sorted, h)
    )
}

function buildChart(sorted, h) {
    const max = Math.max(10, ...sorted)
    const chartHeight = 180
    const chart = div().set_style({
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        flex: '1',
        height: chartHeight + 'px',
        padding: '10px 6px 8px',
        overflowX: 'auto',
        background: 'repeating-linear-gradient(180deg,#f1f5f9,#f1f5f9 24px,#e2e8f0 25px)',
        border: '1px solid #e2e8f0',
        borderRadius: '6px'
    })
    sorted.forEach((cits, idx) => {
        const contributing = idx < h
        const bar = div().set_style({
            height: Math.max(2, (cits / max * chartHeight)).toFixed(2) + 'px',
            width: '20px',
            background: contributing ? 'linear-gradient(180deg,#2563eb,#1d4ed8)' : 'linear-gradient(180deg,#cbd5e1,#94a3b8)',
            borderRadius: '4px 4px 3px 3px',
            boxShadow: '0 2px 4px rgba(15,23,42,0.12)',
            border: '1px solid ' + (contributing ? '#1e40af' : '#94a3b8'),
            position: 'relative',
            flexShrink: '0'
        })
        bar.set_attributes({ title: `${cits} citation${cits !== 1 ? 's' : ''}` })
        const label = span(cits).set_style({
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translate(-50%, -4px)',
            fontSize: '.55rem',
            padding: '2px 3px',
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid #e2e8f0',
            borderRadius: '3px',
            color: '#0f172a',
            fontWeight: '500'
        })
        bar.add(label)
        chart.add(bar)
    })
    return chart
}

function renderList() {
    listCard.clear().add(
        buildCollectionsBar(),
        h2('Articles').set_style({ margin: '8px 0 6px', fontSize: '.7rem', fontWeight: '600', letterSpacing: '.5px', color: '#334155', textTransform: 'uppercase' }),
        buildRows(),
        actionsBar
    )
    if (focusLastArticleTitle) {
        const titleInputs = listCard.querySelectorAll('input[type="text"]')
        const last = titleInputs[titleInputs.length - 1]
        if (last) setTimeout(() => { last.focus(); try { if (last.value) last.select() } catch (_) { } }, 0)
        focusLastArticleTitle = false
    }
    if (focusFirstAfterSwitch) {
        const first = listCard.querySelector('input[type="text"]')
        if (first) setTimeout(() => first.focus(), 0)
        focusFirstAfterSwitch = false
    }
}

function buildRows() {
    const wrap = div().set_style({ display: 'flex', flexDirection: 'column', gap: '4px' })
    if (articles.length === 0) {
        wrap.add(p('No articles yet. Click "Add Article" to begin.').set_style({ fontSize: '.85rem', color: '#475569', fontStyle: 'italic' }))
        return wrap
    }
    articles.forEach((art, index) => {
        const row = div().set_style({
            display: 'flex',
            gap: '6px',
            flexWrap: 'nowrap',
            alignItems: 'center',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '4px 6px',
            borderRadius: '6px',
            position: 'relative',
            minHeight: '32px'
        })
        const titleInp = input(art.title, 'text', val => { art.title = val; persist() })
            .set_style(fieldStyle('Title'))
        titleInp.set_attributes({ placeholder: 'Title (optional)' })

        // Pass use_enter_key = false so our custom Enter handler (below) is the only one firing
        const citInp = input(art.citations, 'number', val => {
            art.citations = Math.max(0, parseInt(val || '0'))
            persist()
        }, false).set_style({
            ...fieldStyle('Citations'),
            maxWidth: '70px',
            flex: '0 0 70px'
        })
        citInp.set_attributes({ placeholder: 'Citations', min: '0' })
        // Enter dans citations -> créer article + focus nouveau titre (via flag)
        citInp.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault()
                focusLastArticleTitle = true
                addArticle() // persist() déclenchera render + focus flag
            }
        })

        const delBtn = button('✕', () => {
            articles.splice(index, 1)
            persist()
        }).set_style({
            ...subtleButtonStyle(),
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '.65rem',
            fontWeight: '600',
            background: '#fff5f5',
            border: '1px solid #fecaca',
            color: '#b91c1c'
        })
        delBtn.set_attributes({ title: 'Remove article' })

        row.add(
            span(String(index + 1) + '.').set_style({ width: '16px', textAlign: 'right', fontSize: '.55rem', color: '#475569', fontWeight: '600', opacity: .8 }),
            titleInp,
            citInp,
            delBtn,
        )
        wrap.add(row)
    })
    return wrap
}

function fieldStyle(ph) {
    return {
        padding: '4px 6px',
        fontSize: '.6rem',
        borderRadius: '4px',
        border: '1px solid #cbd5e1',
        outline: 'none',
        background: '#fff',
        flex: '1 1 200px'
    }
}

function renderActions() {
    actionsBar.clear().add(
        button('Add Article', () => addArticle()).set_style(pillButtonStyle('#334155', '#1e293b')),
        button('Add Sample', () => addSample()).set_style(subtleButtonStyle()),
        button('Download JSON', () => downloadData()).set_style(subtleButtonStyle()),
    )
}

function downloadData() {
    const blob = new Blob([JSON.stringify(articles, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'hindex_articles.json'
    a.click()
    URL.revokeObjectURL(a.href)
}

function addSample() {
    addArticle({ title: 'New Article', citations: Math.floor(Math.random() * 50) })
}

function renderAll() {
    renderHIndex()
    renderList()
    renderActions()
}

// Compose root
statsColumn.add(hIndexCard, chartCard)
mainLayout.add(listCard, statsColumn)
root.add(header, mainLayout)

    // Responsive styles injection
    ; (function ensureResponsiveStyles() {
        if (document.getElementById('hindex-responsive-styles')) return
        const st = document.createElement('style')
        st.id = 'hindex-responsive-styles'
        st.textContent = `@media (max-width: 860px){
        .main-layout{ flex-direction:column; }
        .stats-column{ order:1; width:100%; min-width:unset; }
        .hindex-card{ order:1; }
        .chart-card{ display:none !important; }
        .list-card{ order:2; max-height:unset; width:100%; }
    }`
        document.head.appendChild(st)
    })()
document.body.appendChild(root)

uiReady = true
renderAll()

// Accessibility / keyboard quick add (Ctrl+Enter)
document.addEventListener('keydown', evt => {
    if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) addArticle()
})

// Provide a simple API in console for power users
window.hindexApp = {
    add: addArticle,
    clear: clearAll,
    list: () => articles.slice(),
    compute: () => computeHIndex(articles),
    addCollection,
    deleteCollection,
    switch: switchCollection,
    rename: renameCollection,
    collections: () => ({ ...state.collections }),
    current: () => state.current,
}

// ------------------------------ Collections Bar UI

function buildCollectionsBar() {
    ensureCollectionStyles()
    const bar = div().set_style({ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '2px' })
    Object.keys(state.collections).forEach(name => {
        const isActive = name === state.current
        const btnEl = button(name, () => switchCollection(name))
        btnEl.classList.add('collection-btn')
        if (isActive) btnEl.classList.add('active')
        btnEl.set_style({ fontSize: '.7rem', padding: '8px 14px', borderRadius: '8px' })
        bar.add(btnEl)
    })
    const addBtn = button('+', () => {
        const name = prompt('New collection name:')
        addCollection(name || '')
    })
    addBtn.classList.add('collection-add-btn')
    addBtn.set_style({ fontSize: '.9rem', fontWeight: '600', width: '32px', height: '32px', borderRadius: '8px' })
    bar.add(addBtn)

    // Management line (rename/delete current)
    const mgmt = div().set_style({ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' })
    const renameBtn = button('Rename', () => {
        const newName = prompt('Rename collection:', state.current)
        if (newName && newName !== state.current) renameCollection(state.current, newName)
    })
    renameBtn.classList.add('collection-mgmt-btn')
    renameBtn.set_style({ fontSize: '.6rem', padding: '6px 10px', borderRadius: '6px' })
    const deleteBtn = button('Delete', () => deleteCollection(state.current))
    deleteBtn.classList.add('collection-mgmt-danger')
    deleteBtn.set_style({ fontSize: '.6rem', padding: '6px 10px', borderRadius: '6px' })
    mgmt.add(renameBtn, deleteBtn)
    return div().add(bar, mgmt)
}

function ensureCollectionStyles() {
    if (__collectionStylesAdded) return
    const st = document.createElement('style')
    st.textContent = `
    .collection-btn, .collection-add-btn, .collection-mgmt-btn, .collection-mgmt-danger { 
        background:#f1f5f9; border:1px solid #d8e0e8; color:#1e293b; cursor:pointer; transition:background .15s,color .15s,border-color .15s; 
    }
    .collection-btn.active { background:#334155; color:#fff; border-color:#334155; }
    .collection-btn:hover:not(.active){ background:#e2e8f0 !important; }
    .collection-btn.active:hover { background:#1e293b !important; }
    .collection-btn, .collection-add-btn, .collection-mgmt-btn, .collection-mgmt-danger { transition:background .15s, color .15s, border-color .15s, transform .15s; }
    .collection-btn:hover, .collection-add-btn:hover, .collection-mgmt-btn:hover, .collection-mgmt-danger:hover { transform: translateY(-1px); }
    .collection-add-btn { background:#334155; color:#fff; border-color:#334155; }
    .collection-add-btn:hover { background:#1e293b; }
    .collection-mgmt-btn { background:#e2e8f0; }
    .collection-mgmt-btn:hover { background:#cbd5e1; }
    .collection-mgmt-danger { background:#fff5f5; border-color:#fecaca; color:#b91c1c; }
    .collection-mgmt-danger:hover { background:#b91c1c; color:#fff; border-color:#b91c1c; }
    `
    document.head.appendChild(st)
    __collectionStylesAdded = true
}

