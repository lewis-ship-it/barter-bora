document.addEventListener('DOMContentLoaded', () => {
    // 1. Personalized Greeting using the name from localStorage
    const token = localStorage.getItem('bora_token');
    if (!token) {
        window.location.href = "/"; // Kick back to login if no token
    }

    // Decoding JWT manually for the greeting (simplified for now)
    // In production, we'd use a library or get this from a /me endpoint
    document.getElementById('user-greeting').innerText = "BORA TRADER"; 

    // 2. Sample Data (Later this comes from /api/items)
    const items = [
        { id: 1, name: "Vintage Camera", desc: "A 1970s film camera. Working condition.", value: "Medium", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=1000" },
        { id: 2, name: "Jordan 1s", desc: "Slightly worn, size 10. Trading for tech.", value: "High", img: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&q=80&w=1000" }
    ];

    const feed = document.getElementById('feed-container');

    // 3. Build the Feed
    items.forEach(item => {
        const section = document.createElement('section');
        section.className = "snap-start h-screen w-full relative flex items-center justify-center p-4";
        section.innerHTML = `
            <img src="${item.img}" class="absolute inset-0 w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            <div class="relative z-10 text-center w-full max-w-sm mt-auto mb-20 px-6">
                <h3 class="text-4xl font-black italic mb-2 tracking-tighter uppercase">${item.name}</h3>
                <p class="text-sm opacity-80 mb-6">Tap to see details</p>
                <button onclick="openModal(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-full py-4 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md font-bold uppercase tracking-widest">View Item</button>
            </div>
        `;
        feed.appendChild(section);
    });
});

function openModal(item) {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('modal-content');
    
    document.getElementById('modal-title').innerText = item.name;
    document.getElementById('modal-desc').innerText = item.desc;
    document.getElementById('modal-value').innerText = `Value: ${item.value}`;
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('translate-y-full');
    }, 10);
}

document.getElementById('close-modal').onclick = () => {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('modal-content');
    content.classList.add('translate-y-full');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};