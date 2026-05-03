// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = '/api';
let authToken   = localStorage.getItem('bora_token');
let currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
let allItems    = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 12;
let selectedItemForSwap  = null;
let currentDetailItem    = null;

const SUPABASE_URL       = document.querySelector('meta[name="supabase-url"]')?.getAttribute('content') || '';
const SUPABASE_ANON_KEY  = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content') || '';
const CLOUDINARY_CLOUD   = document.querySelector('meta[name="cloudinary-cloud-name"]')?.getAttribute('content') || '';
const UPLOAD_PRESET      = document.querySelector('meta[name="cloudinary-upload-preset"]')?.getAttribute('content') || '';
const CLOUDINARY_URL     = document.querySelector('meta[name="cloudinary-url"]')?.getAttribute('content') || '';

let supabase;
if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const itemsGrid        = document.getElementById('items-grid');
const createModal      = document.getElementById('create-modal');
const detailModal      = document.getElementById('detail-modal');
const createBtn        = document.getElementById('create-item-btn');
const closeCreateModal = document.getElementById('close-create-modal');
const closeDetailModal = document.getElementById('close-detail-modal');
const closeModalBtn    = document.getElementById('close-modal-btn');
const createItemForm   = document.getElementById('create-item-form');
const userGreeting     = document.getElementById('user-greeting');
const itemsCount       = document.getElementById('items-count');
const loadMoreContainer = document.getElementById('load-more-container');
const searchInput      = document.querySelector('input[type="text"]');
const categoryFilter   = document.querySelectorAll('select')[0];
const sortFilter       = document.querySelectorAll('select')[1];
const userMenuBtn      = document.getElementById('user-menu-btn');
const userDropdown     = document.getElementById('user-dropdown');
const logoutBtn        = document.getElementById('logout-btn');

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!authToken) { window.location.href = 'auth.html'; return; }

    if (userGreeting && currentUser.username) {
        userGreeting.textContent = `Welcome back, ${currentUser.username}`;
        userGreeting.classList.remove('hidden');
    }
    const avatarLetter = document.getElementById('user-avatar-letter');
    if (avatarLetter && currentUser.username) {
        avatarLetter.textContent = currentUser.username.charAt(0).toUpperCase();
    }

    setupEventListeners();
    loadItems();
    loadUnreadBadge();
    initializeFilters();
});

// ─── Unread notification badge ────────────────────────────────────────────────
async function loadUnreadBadge() {
    if (!supabase || !currentUser.id) return;
    const { data } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('read', false);
    if (data && data.length > 0) {
        const notifLink = document.querySelector('a[href="notifications.html"]');
        if (notifLink) {
            notifLink.innerHTML += ` <span class="inline-block w-2 h-2 bg-[#FFD700] rounded-full ml-1"></span>`;
        }
    }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
    if (createBtn)        createBtn.addEventListener('click', showCreateModal);
    if (closeCreateModal) closeCreateModal.addEventListener('click', hideCreateModal);
    if (closeDetailModal) closeDetailModal.addEventListener('click', hideDetailModal);
    if (closeModalBtn)    closeModalBtn.addEventListener('click', hideDetailModal);
    if (createItemForm)   createItemForm.addEventListener('submit', handleCreateItem);
    if (logoutBtn)        logoutBtn.addEventListener('click', handleLogout);

    // User dropdown
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', e => {
            e.stopPropagation();
            const isHidden = userDropdown.classList.toggle('hidden');
            userMenuBtn.setAttribute('aria-expanded', !isHidden);
        });

        // Close the dropdown if the user clicks anywhere else on the page
        document.addEventListener('click', e => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.add('hidden');
                userMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Close modals on backdrop click
    if (createModal) {
        createModal.addEventListener('click', e => {
            if (e.target === createModal) hideCreateModal();
        });
    }
    
    if (detailModal) {
        detailModal.addEventListener('click', e => {
            if (e.target === detailModal) hideDetailModal();
        });
    }

    // Close modals on Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { 
            hideCreateModal(); 
            hideDetailModal(); 
            hideSwapModal(); 
        }
    });

    // Propose swap button
    const proposeSwapBtn = document.getElementById('propose-swap-btn');
    if (proposeSwapBtn) {
        proposeSwapBtn.addEventListener('click', () => {
            if (currentDetailItem) showSwapModal(currentDetailItem.id);
        });
    }

    // Confirm swap button
    const confirmSwapBtn = document.getElementById('confirm-swap-btn');
    if (confirmSwapBtn) {
        confirmSwapBtn.addEventListener('click', submitBidProposal);
    }
}

function initializeFilters() {
    if (searchInput)   searchInput.addEventListener('input', debounce(filterItems, 300));
    if (categoryFilter) categoryFilter.addEventListener('change', filterItems);
    if (sortFilter)     sortFilter.addEventListener('change', filterItems);
    loadMoreContainer?.addEventListener('click', loadMoreItems);
}

// ─── Load Items ───────────────────────────────────────────────────────────────
async function loadItems() {
    if (!itemsGrid || !supabase) return;
    showLoadingState();
    try {
        const { data: items, error } = await supabase
            .from('items')
            .select('*, profiles(*)')
            .eq('status', 'available')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allItems    = items || [];
        currentPage = 1;
        displayItems(allItems.slice(0, ITEMS_PER_PAGE));
        updateItemsCount(allItems.length);
        if (loadMoreContainer) {
            loadMoreContainer.style.display = allItems.length > ITEMS_PER_PAGE ? 'block' : 'none';
        }
    

    } catch (err) { showErrorState(err); }
}

// ─── Render Items ─────────────────────────────────────────────────────────────
function displayItems(items) {
    if (!itemsGrid) return;
    if (!items?.length) {
        itemsGrid.innerHTML = `<div class="col-span-full text-center py-20">
            <div class="text-white/40 text-6xl mb-4">📦</div>
            <h3 class="text-white text-xl mb-2">No items found</h3>
            <p class="text-white/60">Be the first to list an item!</p></div>`;
        return;
    }
    itemsGrid.innerHTML = '';
    items.forEach((item, i) => {
        const card = createItemCard(item);
        card.style.animationDelay = `${i * 0.08}s`;
        itemsGrid.appendChild(card);
    });
}

function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card opacity-0 cursor-pointer';
    card.addEventListener('click', () => showItemDetail(item));

    const conditionMap = {
        new: { text: 'New', cls: 'item-value-new' },
        like_new: { text: 'Like New', cls: 'item-value-like_new' },
        good:     { text: 'Good',     cls: 'item-value-good' },
        fair:     { text: 'Fair',     cls: 'item-value-fair' },
        poor:     { text: 'Poor',     cls: 'item-value-poor' }
    };
    const cond      = conditionMap[item.condition] || { text: item.condition, cls: 'bg-white/10 text-white' };
    const ownerName = item.profiles ? `${item.profiles.first_name} ${item.profiles.last_name}` : 'Unknown';

    card.innerHTML = `
        <div class="item-image flex items-center justify-center">
            ${item.imageurl
                ? `<img src="${item.imageurl}" alt="${escHtml(item.title)}" class="w-full h-full object-cover" loading="lazy">`
                : `<div class="text-white/20"><i class="fas fa-image text-6xl"></i></div>`}
            <div class="absolute top-4 right-4 ${cond.cls} px-3 py-1 rounded-xl text-xs font-bold uppercase">${cond.text}</div>
            <div class="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-xl text-xs text-white uppercase">${item.status}</div>
        </div>
        <div class="p-6">
            <h4 class="text-white font-semibold text-lg mb-3 line-clamp-2">${escHtml(item.title)}</h4>
            <p class="text-white/70 text-sm mb-4 line-clamp-3 leading-relaxed">${escHtml(item.description)}</p>
            <div class="flex justify-between items-center">
                <span class="text-white/60 text-xs">By ${escHtml(ownerName)}</span>
                <span class="text-white/40 text-xs">${formatDate(item.created_at)}</span>
            </div>
        </div>`;
    return card;
}

// ─── Item Detail Modal ────────────────────────────────────────────────────────
function showItemDetail(item) {
    if (!detailModal) return;
    currentDetailItem = item;

    const cMap = { new:'New', like_new:'Like New', good:'Good', fair:'Fair', poor:'Poor' };
    const ownerName = item.profiles ? `${item.profiles.first_name} ${item.profiles.last_name}` : 'Unknown';

    document.getElementById('modal-title').textContent       = item.title;
    document.getElementById('modal-image').src               = item.imageurl || '';
    document.getElementById('modal-condition').textContent   = cMap[item.condition] || item.condition;
    document.getElementById('modal-status').textContent      = item.status;
    document.getElementById('modal-description').textContent = item.description;
    document.getElementById('modal-owner').textContent       = ownerName;
    document.getElementById('modal-date').textContent        = formatDate(item.created_at);

    const proposeBtn = document.getElementById('propose-swap-btn');
    if (proposeBtn) {
        const isOwn = item.ownerid === currentUser.id;
        const isUnavail = item.status !== 'available';
        proposeBtn.disabled = isOwn || isUnavail;
        if (isOwn)       proposeBtn.innerHTML = '<i class="fas fa-user mr-2"></i>Your Item';
        else if (isUnavail) proposeBtn.innerHTML = '<i class="fas fa-lock mr-2"></i>Not Available';
        else             proposeBtn.innerHTML = '<i class="fas fa-exchange-alt mr-2"></i>PROPOSE SWAP';
    }

    detailModal.classList.remove('hidden');
    detailModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

// ─── Swap Modal ───────────────────────────────────────────────────────────────
async function showSwapModal(requestedItemId) {
    const swapModal  = document.getElementById('swap-modal');
    const itemsList  = document.getElementById('my-items-list');
    const confirmBtn = document.getElementById('confirm-swap-btn');

    document.getElementById('swap-target-item').textContent = currentDetailItem?.title || '';
    swapModal.classList.remove('hidden');
    swapModal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    itemsList.innerHTML = `<div class="text-white/60 p-4 text-center"><div class="loading mx-auto mb-2"></div>Loading your items…</div>`;

    try {
        const { data: items, error } = await supabase
            .from('items')
            .select('*')
            .eq('ownerid', currentUser.id)
            .eq('status', 'available');
        if (error) throw error;

        if (!items?.length) {
            itemsList.innerHTML = `<div class="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                <p class="text-red-400 mb-4">You have no available items to offer!</p>
                <button onclick="hideSwapModal(); showCreateModal();"
                        class="text-white bg-red-500/20 px-4 py-2 rounded-xl text-sm hover:bg-red-500/40 transition">
                    Upload an Item Now
                </button></div>`;
            if (confirmBtn) confirmBtn.style.display = 'none';
            return;
        }

        if (confirmBtn) {
            confirmBtn.style.display = 'block';
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        itemsList.innerHTML = items.map(it => `
            <div class="swap-selection-card"
                 onclick="selectItemToSwap('${it.id}','${escAttr(it.title)}','${it.condition}','${escAttr(it.imageurl||'')}',this)">
                <img src="${it.imageurl || ''}" class="w-12 h-12 rounded-lg object-cover"
                     onerror="this.src='https://via.placeholder.com/50'" alt="">
                <div class="swap-card-info">
                    <p class="swap-card-title">${escHtml(it.title)}</p>
                    <p class="swap-card-condition">${it.condition}</p>
                </div>
                <div class="radio-indicator"></div>
            </div>`).join('');

    } catch (err) {
        itemsList.innerHTML = `<p class="text-red-400 p-4">Error: ${escHtml(err.message)}</p>`;
    }
}

function hideSwapModal() {
    const m = document.getElementById('swap-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    document.body.style.overflow = 'auto';
    selectedItemForSwap = null;
    document.getElementById('selected-item-preview')?.classList.add('hidden');
}

function selectItemToSwap(itemId, title, condition, imageUrl, el) {
    document.querySelectorAll('.swap-selection-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedItemForSwap = { id: itemId, title, condition, imageurl: imageUrl };

    const preview = document.getElementById('selected-item-preview');
    if (preview) {
        document.getElementById('selected-item-image').src   = imageUrl || 'https://via.placeholder.com/50';
        document.getElementById('selected-item-title').textContent     = title;
        document.getElementById('selected-item-condition').textContent = condition;
        preview.classList.remove('hidden');
    }

    const confirmBtn = document.getElementById('confirm-swap-btn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// ─── Submit Bid ───────────────────────────────────────────────────────────────
async function submitBidProposal() {
    if (!selectedItemForSwap || !currentDetailItem) {
        showNotification('Please select an item to offer', 'error'); return;
    }

    const confirmBtn = document.getElementById('confirm-swap-btn');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Sending…'; }

    try {
        const res = await fetch(`${API_BASE}/bids.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
                proposer_id:      currentUser.id,
                proposer_item_id: selectedItemForSwap.id,
                target_item_id:   currentDetailItem.id,
                target_owner_id:  currentDetailItem.ownerid
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit bid');

        showNotification('Swap proposal sent! 🎉', 'success');
        hideSwapModal();
        hideDetailModal();

    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<span class="flex items-center justify-center"><i class="fas fa-paper-plane mr-2"></i>SEND PROPOSAL</span>';
        }
    }
}

// ─── Create Item ──────────────────────────────────────────────────────────────
// Handler for submitting a new item listing
async function handleCreateItem(e) {
    e.preventDefault();
    
    if (!currentUser || !currentUser.id) {
        showNotification('Please log in to create items', 'error');
        return;
    }
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    try {
        // Disable button to prevent double-submission
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading...';

        let imageUrl = null;

        // Upload to Cloudinary if an image was selected
        const imageFile = document.getElementById('item-image').files[0];
        if (imageFile) {
            try {
                imageUrl = await uploadImage(imageFile);
            } catch (uploadError) {
                console.error('Image upload error:', uploadError);
                showNotification('Failed to upload image. Please try again.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                return;
            }
        }

        // Prepare the final data object
        const itemData = {
            title: form.title.value,
            description: form.description.value,
            condition: form.condition.value,
            status: 'available',
            ownerid: currentUser.id,
            imageurl: imageUrl
        };

        console.log('Submitting item data:', itemData);

        // Send the data to items.php
        const response = await fetch(`${API_BASE}/items.php`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(itemData)
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            console.error('Server response error:', responseData);
            throw new Error(responseData.error || `Server error: ${response.status}`);
        }

        // Success
        hideCreateModal();
        form.reset();
        document.getElementById('file-name').textContent = 'PNG, JPG up to 10MB';
        loadItems(); // Refresh the grid
        
        showNotification('Item created successfully!', 'success');
        
    } catch (error) {
        console.error('Error creating item:', error);
        showNotification(error.message || 'Failed to create item. Please check your connection.', 'error');
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}



// Function to upload image to Cloudinary
async function uploadImage(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);

        const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            // If not JSON, get the text response to see what's wrong
            const textResponse = await response.text();
            console.error('Cloudinary non-JSON response:', textResponse);
            
            // Check for common HTML error pages
            if (textResponse.includes('<!DOCTYPE html>') || textResponse.includes('<html')) {
                throw new Error('Cloudinary returned an HTML error page. Check your upload preset and URL.');
            } else {
                throw new Error(`Cloudinary error: ${textResponse.substring(0, 100)}`);
            }
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Image upload failed');
        }

        return data.secure_url;
        
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        
        // Provide more specific error messages
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Network error. Please check your internet connection.');
        } else if (error.message.includes('HTML error page')) {
            throw new Error('Cloudinary configuration error. Please check your upload preset and cloud name.');
        } else {
            throw new Error('Failed to upload image. Please try again.');
        }
    }
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
function showCreateModal() {
    if (!createModal) return;
    createModal.classList.remove('hidden'); createModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}
function hideCreateModal() {
    if (!createModal) return;
    createModal.classList.add('hidden'); createModal.classList.remove('flex');
    document.body.style.overflow = 'auto';
}
function hideDetailModal() {
    if (!detailModal) return;
    detailModal.classList.add('hidden'); detailModal.classList.remove('flex');
    document.body.style.overflow = 'auto';
    currentDetailItem = null;
}

// ─── Filter / sort / search ───────────────────────────────────────────────────
function filterItems() {
    let items = [...allItems];
    const q = searchInput?.value.toLowerCase();
    if (q) items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.condition.toLowerCase().includes(q)
    );

    if (sortFilter?.value.includes('Condition')) {
        const order = ['new', 'like_new', 'good', 'fair', 'poor'];
        items.sort((a, b) => order.indexOf(a.condition) - order.indexOf(b.condition));
    } else {
        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    currentPage = 1;
    displayItems(items.slice(0, ITEMS_PER_PAGE));
    updateItemsCount(items.length);
    if (loadMoreContainer) loadMoreContainer.style.display = items.length > ITEMS_PER_PAGE ? 'block' : 'none';
}

function loadMoreItems() {
    const start = currentPage * ITEMS_PER_PAGE;
    const more  = allItems.slice(start, start + ITEMS_PER_PAGE);
    more.forEach(item => { const c = createItemCard(item); itemsGrid.appendChild(c); });
    currentPage++;
    if (currentPage * ITEMS_PER_PAGE >= allItems.length) {
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function showLoadingState() {
    if (itemsGrid) itemsGrid.innerHTML = `
        <div class="col-span-full text-center py-20">
            <div class="loading mx-auto mb-4"></div>
            <p class="text-white/60">Loading amazing items…</p></div>`;
}
function showErrorState(err) {
    if (itemsGrid) itemsGrid.innerHTML = `
        <div class="col-span-full text-center py-20">
            <div class="text-white/40 text-6xl mb-4">⚠️</div>
            <h3 class="text-white text-xl mb-2">Something went wrong</h3>
            <p class="text-white/60 mb-6">${escHtml(err.message || 'Unable to load items')}</p>
            <button onclick="loadItems()" class="bg-gradient-to-r from-[#FFD700] to-[#8A2BE2] text-white px-6 py-3 rounded-2xl font-semibold">Try Again</button></div>`;
}
function updateItemsCount(n) { if (itemsCount) itemsCount.textContent = n.toLocaleString(); }
function formatDate(s) {
    if (!s) return '';
    return new Date(s).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function escHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str || '')));
    return d.innerHTML;
}
function escAttr(str) { return String(str || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }
function updateFileName(input) {
    const fn = document.getElementById('file-name');
    if (fn) fn.textContent = input.files.length ? input.files[0].name : 'PNG, JPG up to 10MB';
}
function showNotification(msg, type = 'info') {
    document.getElementById('notification')?.remove();
    const el = document.createElement('div');
    el.id = 'notification';
    el.className = `fixed top-4 right-4 p-4 rounded-xl shadow-2xl z-50 text-white text-sm font-medium max-w-xs
        ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}
function handleLogout() {
    localStorage.removeItem('bora_token');
    localStorage.removeItem('user_data');
    window.location.href = 'index.html';
}