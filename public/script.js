let allResults = [];
let currentUser = null;

// Google Sign-In Handler
function handleCredentialResponse(response) {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    currentUser = JSON.parse(jsonPayload);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Display smaller, horizontal user info
    const userInfoDiv = document.getElementById('user-info');
    userInfoDiv.innerHTML = `
        <div class="user-profile" style="display: inline-flex; align-items: center; gap: 10px; padding: 4px 12px 4px 4px; background: rgba(255, 255, 255, 0.08); border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.14);">
            <img src="${currentUser.picture}" alt="${currentUser.name}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover;" />
            <div class="user-profile-text" style="display: flex; flex-direction: column;">
                <p style="margin: 0; font-size: 0.75rem; color: #f5f5f7;"><strong>${currentUser.name}</strong></p>
            </div>
            <button class="logout-btn" onclick="logout()" style="min-height: 28px; padding: 0 10px; font-size: 0.7rem; border-radius: 999px; cursor: pointer;">Logout</button>
        </div>
    `;
    
    const signInDiv = document.querySelector('.g_id_signin');
    if (signInDiv) signInDiv.style.display = 'none';

    loadSearchHistory();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('user-info').innerHTML = '';
    const signInDiv = document.querySelector('.g_id_signin');
    if (signInDiv) signInDiv.style.display = 'block';
    
    const listPanel = document.getElementById('list-panel');
    listPanel.innerHTML = '<p class="status-text">Your search results will appear here...</p>';
}

async function getReviews(historySubject, historyLocation) {
    const subject = historySubject || document.getElementById('subject').value;
    const location = historyLocation || document.getElementById('location').value;

    if (!subject || !location) {
        alert("Please enter both a subject and a location.");
        return;
    }

    const listPanel = document.getElementById('list-panel');
    const historySection = document.getElementById('history-section');
    listPanel.innerHTML = '';
    if (historySection) listPanel.appendChild(historySection);

    const statusText = document.createElement('p');
    statusText.className = 'status-text';
    statusText.textContent = 'Searching for reviews...';
    listPanel.appendChild(statusText);

    try {
        const query = `${subject} ${location} reviews`;
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        allResults = data.organic_results || [];

        displayResults(allResults);

        if (currentUser && !historySubject && !historyLocation) {
            saveSearchToDb(currentUser.sub, subject, location);
        }

    } catch (error) {
        console.error('Error fetching reviews:', error);
        listPanel.innerHTML = '';
        if (historySection) listPanel.appendChild(historySection);
        const errorText = document.createElement('p');
        errorText.className = 'status-text';
        errorText.style.color = 'red';
        errorText.textContent = `Error: ${error.message}`;
        listPanel.appendChild(errorText);
    }
}

async function saveSearchToDb(userId, subject, location) {
    try {
        const response = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, subject, location })
        });

        if (response.status === 503) return;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        loadSearchHistory();
    } catch (err) {
        console.error("Failed to save history:", err);
    }
}

async function loadSearchHistory() {
    if (!currentUser) return;

    try {
        const response = await fetch(`/api/history/${currentUser.sub}`);
        if (response.status === 503) return;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const history = await response.json();
        renderHistoryUI(history);
    } catch (err) {
        console.error("Failed to load history:", err);
    }
}

function renderHistoryUI(history) {
    const listPanel = document.getElementById('list-panel');
    
    let historySection = document.getElementById('history-section');
    if (!historySection) {
        historySection = document.createElement('div');
        historySection.id = 'history-section';
        historySection.style.padding = '10px';
        historySection.style.borderBottom = '2px solid #ddd';
        listPanel.prepend(historySection);
    }

    if (history.length === 0) {
        historySection.innerHTML = '<p style="font-size: 0.8rem; color: #888;">No recent searches</p>';
        return;
    }

    historySection.innerHTML = '<strong style="font-size: 0.9rem;">Recent Searches:</strong>';
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '5px';
    container.style.flexWrap = 'wrap';
    container.style.marginTop = '5px';

    history.forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = `${item.subject} (${item.location})`;
        btn.style.fontSize = '0.75rem';
        btn.style.padding = '2px 8px';
        btn.style.cursor = 'pointer';
        btn.onclick = () => {
            document.getElementById('subject').value = item.subject;
            document.getElementById('location').value = item.location;
            getReviews(item.subject, item.location);
        };
        container.appendChild(btn);
    });

    historySection.appendChild(container);
}

function displayResults(results) {
    const listPanel = document.getElementById('list-panel');
    const historySection = document.getElementById('history-section');
    listPanel.innerHTML = '';
    if (historySection) listPanel.appendChild(historySection);

    if (results.length === 0) {
        const noResults = document.createElement('p');
        noResults.className = 'status-text';
        noResults.textContent = "No results found.";
        listPanel.appendChild(noResults);
        return;
    }

    const forums = [
        { name: 'Reddit', domain: 'reddit.com' },
        { name: 'Quora', domain: 'quora.com' },
        { name: 'Stack Exchange', domain: 'stackexchange.com' },
        { name: 'Stack Overflow', domain: 'stackoverflow.com' },
        { name: 'Trustpilot', domain: 'trustpilot.com' },
        { name: 'MouthShut', domain: 'mouthshut.com' },
        { name: 'ConsumerComplaints', domain: 'consumercomplaints.in' },
        { name: 'Glassdoor', domain: 'glassdoor.co' }
    ];

    const forumResults = {};
    forums.forEach(forum => {
        forumResults[forum.name] = results.filter(item => {
            const l = item.link || item.displayLink || item.displayed_link || '';
            return l.includes(forum.domain);
        });
    });
    
    const generalResults = results.filter(item => !forums.some(forum => {
        const l = item.link || item.displayLink || item.displayed_link || '';
        return l.includes(forum.domain);
    }));

    const forumButtonBar = document.createElement('div');
    forumButtonBar.style.display = 'flex';
    forumButtonBar.style.gap = '8px';
    forumButtonBar.style.marginBottom = '10px';
    forumButtonBar.style.flexWrap = 'wrap';

    forums.forEach(forum => {
        if (forumResults[forum.name] && forumResults[forum.name].length > 0) {
            const btn = document.createElement('button');
            btn.textContent = forum.name;
            btn.className = 'forum-btn';
            btn.style.padding = '4px 10px';
            btn.style.fontSize = '0.8rem';
            btn.onclick = () => {
                document.querySelectorAll('.forum-card, .general-card').forEach(e => e.remove());
                forumResults[forum.name].forEach((item, index) => {
                    const card = createResultCard(item, index, true);
                    listPanel.appendChild(card);
                });
            };
            forumButtonBar.appendChild(btn);
        }
    });

    if (forumButtonBar.children.length > 0) {
        const forumHeading = document.createElement('div');
        forumHeading.textContent = 'Other websites';
        forumHeading.style.fontWeight = 'bold';
        forumHeading.style.fontSize = '1.1rem';
        forumHeading.style.margin = '10px 0 4px 0';
        forumHeading.style.color = '#fff';
        listPanel.appendChild(forumHeading);
        listPanel.appendChild(forumButtonBar);
    }

    forums.forEach(forum => {
        if (forumResults[forum.name]) {
            forumResults[forum.name].forEach((item, index) => {
                const card = createResultCard(item, index, true);
                listPanel.appendChild(card);
            });
        }
    });

    generalResults.forEach((item, index) => {
        const card = createResultCard(item, index, false);
        card.classList.add('general-card');
        listPanel.appendChild(card);
    });
}

function createResultCard(item, index, isForum) {
    const card = document.createElement('div');
    card.className = isForum ? 'list-card forum-card' : 'list-card';
    card.dataset.index = index;
    card.style.position = 'relative';

    const title = item.title || 'No title';
    const snippet = item.snippet || '';
    const link = item.link || item.displayLink || item.displayed_link || '';

    let forumName = null;
    let forumDomain = '';
    
    const forums = [
        { name: 'Reddit', domain: 'reddit.com' },
        { name: 'Quora', domain: 'quora.com' },
        { name: 'Stack Exchange', domain: 'stackexchange.com' },
        { name: 'Stack Overflow', domain: 'stackoverflow.com' },
        { name: 'Trustpilot', domain: 'trustpilot.com' },
        { name: 'MouthShut', domain: 'mouthshut.com' },
        { name: 'ConsumerComplaints', domain: 'consumercomplaints.in' },
        { name: 'Glassdoor', domain: 'glassdoor.co' }
    ];

    for (const forum of forums) {
        if ((link || '').includes(forum.domain)) {
            forumName = forum.name;
            forumDomain = forum.domain;
            break;
        }
    }

    let websiteLabel = '';
    let iconHtml = '';

    if (forumName) {
        websiteLabel = `<span style="color:#d35400;font-weight:bold;">${forumName}</span>`;
        iconHtml = `<img src="https://www.google.com/s2/favicons?domain=${forumDomain}&sz=32" alt="${forumName} icon" style="width: 16px; height: 16px; border-radius: 4px; position: absolute; top: 14px; right: 16px;">`;
    } else {
        let domain = '';
        try {
            const url = new URL(link.startsWith('http') ? link : 'https://' + link);
            domain = url.hostname.replace(/^www\./, '');
        } catch (e) {
            domain = (link || '').split('/')[0];
        }
        websiteLabel = `<a href="https://${domain}" target="_blank" style="color:#888;text-decoration:underline;">${domain}</a>`;
    }

    card.innerHTML = `
        ${iconHtml}
        <h3 style="padding-right: 20px;">${title}</h3>
        <p>${snippet}</p>
        ${websiteLabel}
        <div class="card-arrow">→</div>
    `;
    card.addEventListener('click', showDetails);
    return card;
}

function showDetails(event) {
    const clickedCard = event.currentTarget;
    const index = clickedCard.dataset.index;
    const selectedPost = allResults[index];

    const allCards = document.querySelectorAll('.list-card');
    allCards.forEach(c => c.classList.remove('selected'));
    clickedCard.classList.add('selected');

    const detailsPanel = document.getElementById('details-panel');
    const safeLink = selectedPost.link || '#';
    
    detailsPanel.innerHTML = `
        <h2>${selectedPost.title}</h2>
        <div class="full-text">
            <p>${selectedPost.snippet}</p> 
        </div>
        <a class="visit-btn" href="${safeLink}" target="_blank" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #5eb0ff; color: white; border-radius: 99px; text-decoration: none; font-weight: bold;">Read Full Post</a>
    `;
}

// Check for persisted login on page load
const storedUser = localStorage.getItem('currentUser');
if (storedUser) {
    currentUser = JSON.parse(storedUser);
    
    const userInfoDiv = document.getElementById('user-info');
    userInfoDiv.innerHTML = `
        <div class="user-profile" style="display: inline-flex; align-items: center; gap: 10px; padding: 4px 12px 4px 4px; background: rgba(255, 255, 255, 0.08); border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.14);">
            <img src="${currentUser.picture}" alt="${currentUser.name}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover;" />
            <div class="user-profile-text" style="display: flex; flex-direction: column;">
                <p style="margin: 0; font-size: 0.75rem; color: #f5f5f7;"><strong>${currentUser.name}</strong></p>
            </div>
            <button class="logout-btn" onclick="logout()" style="min-height: 28px; padding: 0 10px; font-size: 0.7rem; border-radius: 999px; cursor: pointer;">Logout</button>
        </div>
    `;
    
    const signInDiv = document.querySelector('.g_id_signin');
    if (signInDiv) signInDiv.style.display = 'none';
    
    loadSearchHistory();
}

console.log("Script loaded, current user:", currentUser);
console.log("mission accomplished");